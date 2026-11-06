import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { manualCheckFields } from "@/lib/memberBusinessCheck";
import { maskBizNo, normalizeBizNo, ntsStatus } from "@/lib/nts";

// 2026-11-06 수동 승인 회원 사업자번호 입력 — 등록증 승인(business_verified=true)만 된 회원은 사업자번호가 어디에도 없어 국세청 상태를 알 수 없음.
// 관리자가 등록증과 대조해 입력한 번호로 국세청 상태조회(ntsStatus)만 하고 member_business_checks에 method='manual', validate_result='manual'로 1행 저장.
// 진위확인(대표자명·개업일)이 아님 — 입력한 번호가 이 회원 것인지는 관리자가 등록증과 대조한 값을 믿는 구조.
// 권한: businessLicense(등록증 승인과 같은 등급). 대상: business_verified=true이고 member_business_checks 기록이 하나도 없는 회원만(재입력·번호 변경은 이번 범위 밖 — 오입력 발생 시 재개).
// 상태조회가 오류·미등록·휴업·폐업이어도 business_verified는 바꾸지 않음(행은 저장하고 화면이 경고). 응답·감사 로그에는 마스킹 번호만.
// body: { b_no }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const denied = requirePerm(auth.admin, "businessLicense");
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return json({ error: "잘못된 요청입니다." }, 400);

  const body = (await req.json().catch(() => null)) as { b_no?: unknown } | null;
  const bNo = normalizeBizNo(body?.b_no);
  if (!bNo) return json({ error: "사업자등록번호 10자리를 입력해주세요.", field: "b_no" }, 400);

  const db = auth.db;
  const { data: member, error: memberErr } = await db.from("members").select("id, business_verified").eq("id", id).maybeSingle();
  if (memberErr) return json({ error: "회원 정보를 불러오지 못했어요." }, 500);
  if (!member) return json({ error: "회원을 찾을 수 없어요." }, 404);
  if (member.business_verified !== true) return json({ error: "사업자 인증이 승인된 회원만 입력할 수 있어요." }, 409);

  const { count, error: countErr } = await db.from("member_business_checks").select("id", { count: "exact", head: true }).eq("member_id", id);
  if (countErr) return json({ error: "기록을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  if ((count ?? 0) > 0) return json({ error: "이미 사업자 확인 기록이 있는 회원이에요." }, 409);

  // nts.ts는 예외를 던지지 않음 — 오류도 결과로 돌아오고, 그 경우에도 행은 저장(상태 미확인 경고 표시)
  const lookup = await ntsStatus(bNo);
  const f = manualCheckFields(lookup);
  const { data: saved, error: saveErr } = await db
    .from("member_business_checks")
    .insert({
      member_id: id,
      method: "manual",
      b_no: bNo,
      rep_name: null,
      open_date: null,
      company_name: null,
      validate_result: "manual",
      status_code: f.status_code,
      status_text: f.status_text,
      tax_type: f.tax_type,
      error_kind: f.error_kind,
    })
    .select("id, created_at")
    .single();
  if (saveErr || !saved) {
    console.error("[business-manual] 기록 실패", saveErr?.code, maskBizNo(bNo));
    return json({ error: "결과를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "business_manual_check",
    targetType: "member",
    targetId: id,
    detail: { check_id: saved.id, b_no: maskBizNo(bNo), result: f.error_kind ? "error" : "ok", status_code: f.status_code, error_kind: f.error_kind },
  });
  return json({ ok: true, status_code: f.status_code, status_text: f.status_text, error_kind: f.error_kind, checked_at: saved.created_at });
}
