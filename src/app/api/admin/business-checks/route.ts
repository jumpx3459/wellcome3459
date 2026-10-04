import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { maskBizNo, normalizeBizNo, normalizeOpenDate, ntsValidate } from "@/lib/nts";
import { normalizePhone } from "@/lib/phone";
import type { BusinessCheck } from "@/lib/businessCheck";
import { PASSING_OR } from "@/lib/sellerPrivate";

// 2026-10-04 판매자 신원 확인 — 사업자 조회(국세청 진위확인·상태조회) 기록. 3역할 모두 조회 가능, 예외 확인은 [id]/exception.
// 응답·감사 로그에는 사업자번호 전체를 넣지 않음(maskBizNo "123-45-*****"). [다시 조회]는 recheckOf(조회 id)로 서버가 저장된 값을 씀.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS =
  "id, seller_request_id, deal_id, kind, b_no, rep_name, open_date, input_company_name, validate_result, status_code, status_text, tax_type, error_kind, checked_at, checked_by_admin_id, exception_ok, exception_reason, exception_by_admin_name, exception_at";

type Row = Omit<BusinessCheck, "b_no_masked" | "checked_by_name"> & { b_no: string; checked_by_admin_id: string | null };

/** 응답용 — 전체 사업자번호 대신 마스킹, 조회한 관리자 이름 */
async function toClient(db: SupabaseClient, rows: Row[]): Promise<BusinessCheck[]> {
  const ids = [...new Set(rows.map((r) => r.checked_by_admin_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await db.from("admin_users").select("id, name").in("id", ids);
    for (const a of data ?? []) names.set(a.id as string, a.name as string);
  }
  return rows.map(({ b_no, checked_by_admin_id, ...r }) => ({
    ...r,
    b_no_masked: maskBizNo(b_no),
    checked_by_name: checked_by_admin_id ? names.get(checked_by_admin_id) ?? null : null,
  }));
}

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = auth.db;
  const sp = req.nextUrl.searchParams;

  // 판매 신청 하나의 이력
  const one = sp.get("seller_request_id");
  if (one) {
    if (!UUID_RE.test(one)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const { data, error } = await db
      .from("seller_business_checks")
      .select(COLUMNS)
      .eq("seller_request_id", one)
      .order("checked_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
    return NextResponse.json({ items: await toClient(db, (data ?? []) as Row[]) });
  }

  // 판매 신청 카드 배지용 — 여러 신청의 기록 + 신청 연락처가 신청 회원 가입 번호와 같은지(번호 자체는 안 돌려줌)
  const many = sp.get("seller_request_ids");
  if (many != null) {
    const ids = many.split(",").filter((v) => UUID_RE.test(v)).slice(0, 100);
    if (!ids.length) return NextResponse.json({ items: [], phoneMatch: {} });
    const [checks, reqs] = await Promise.all([
      db.from("seller_business_checks").select(COLUMNS).in("seller_request_id", ids).order("checked_at", { ascending: false }).limit(500),
      db.from("seller_requests").select("id, contact_phone, seller_member_id").in("id", ids),
    ]);
    if (checks.error) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
    const memberIds = [...new Set((reqs.data ?? []).map((r) => r.seller_member_id as string | null).filter((v): v is string => !!v))];
    const phones = new Map<string, string>();
    if (memberIds.length) {
      const { data } = await db.from("members").select("id, phone").in("id", memberIds);
      for (const m of data ?? []) phones.set(m.id as string, normalizePhone(m.phone as string));
    }
    const phoneMatch: Record<string, boolean | null> = {};
    for (const r of reqs.data ?? []) {
      const memberPhone = r.seller_member_id ? phones.get(r.seller_member_id as string) : undefined;
      phoneMatch[r.id as string] = memberPhone ? memberPhone === normalizePhone(r.contact_phone as string) : null;
    }
    return NextResponse.json({ items: await toClient(db, (checks.data ?? []) as Row[]), phoneMatch });
  }

  // 2026-10-04 feat/deal-seller-private: 매물에 붙일 수 있는 조회 — 신청 없이 조회했고(seller_request_id null) 아직 매물에 안 붙은(deal_id null)
  // validate 행 중 통과(진위 일치 또는 예외 확인)만. 등록·수정 폼의 "사업자 조회 기록" 선택 목록(자동 선택 없음)
  if (sp.get("unlinked") === "1") {
    const { data, error } = await db
      .from("seller_business_checks")
      .select(COLUMNS)
      .is("seller_request_id", null)
      .is("deal_id", null)
      .eq("kind", "validate")
      .or(PASSING_OR)
      .order("checked_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
    return NextResponse.json({ items: await toClient(db, (data ?? []) as Row[]) });
  }

  // 최근 50건
  const { data, error } = await db.from("seller_business_checks").select(COLUMNS).order("checked_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
  return NextResponse.json({ items: await toClient(db, (data ?? []) as Row[]) });
}

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = auth.db;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const bad = (error: string, field?: string) => NextResponse.json({ error, field }, { status: 400 });

  let bNo: string | null;
  let repName: string;
  let openDate: string | null;
  let companyName: string | null;
  let sellerRequestId: string | null;

  if (body.recheckOf != null) {
    // [다시 조회] — 저장된 입력값 그대로 다시 진위확인(번호를 화면에 돌려주지 않으려고)
    if (typeof body.recheckOf !== "string" || !UUID_RE.test(body.recheckOf)) return bad("잘못된 요청입니다.");
    const { data: prev, error } = await db
      .from("seller_business_checks")
      .select("b_no, rep_name, open_date, input_company_name, seller_request_id, kind")
      .eq("id", body.recheckOf)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
    if (!prev || prev.kind !== "validate" || !prev.rep_name || !prev.open_date) {
      return NextResponse.json({ error: "다시 조회할 기록이 없어요." }, { status: 404 });
    }
    bNo = prev.b_no as string;
    repName = prev.rep_name as string;
    openDate = prev.open_date as string;
    companyName = (prev.input_company_name as string | null) ?? null;
    sellerRequestId = (prev.seller_request_id as string | null) ?? null;
  } else {
    bNo = normalizeBizNo(body.b_no);
    if (!bNo) return bad("사업자등록번호 10자리를 입력해주세요.", "b_no");
    repName = typeof body.rep_name === "string" ? body.rep_name.trim() : "";
    if (!repName) return bad("대표자 성명을 입력해주세요.", "rep_name");
    if (repName.length > 50) return bad("대표자 성명이 너무 길어요.", "rep_name");
    openDate = normalizeOpenDate(body.open_date);
    if (!openDate) return bad("개업일자를 YYYYMMDD로 입력해주세요.", "open_date");
    companyName = typeof body.input_company_name === "string" && body.input_company_name.trim() ? body.input_company_name.trim() : null;
    if (companyName && companyName.length > 100) return bad("상호가 너무 길어요.", "input_company_name");
    sellerRequestId = null;
    if (body.seller_request_id != null && body.seller_request_id !== "") {
      if (typeof body.seller_request_id !== "string" || !UUID_RE.test(body.seller_request_id)) return bad("판매 신청이 올바르지 않아요.", "seller_request_id");
      const { data: sr } = await db.from("seller_requests").select("id").eq("id", body.seller_request_id).maybeSingle();
      if (!sr) return NextResponse.json({ error: "판매 신청을 찾을 수 없어요.", field: "seller_request_id" }, { status: 404 });
      sellerRequestId = body.seller_request_id;
    }
  }

  const v = await ntsValidate({ bNo: bNo!, repName, openDate: openDate! });
  const row = {
    seller_request_id: sellerRequestId,
    kind: "validate" as const,
    b_no: bNo,
    rep_name: repName,
    open_date: openDate,
    input_company_name: companyName,
    validate_result: v.result,
    status_code: v.result === "01" ? v.status?.code ?? null : null,
    status_text: v.result === "01" ? v.status?.text ?? null : null,
    tax_type: v.result === "01" ? v.status?.taxType ?? null : null,
    error_kind: v.result === "error" ? v.errorKind : null,
    checked_by_admin_id: auth.admin.id,
  };
  const { data: saved, error } = await db.from("seller_business_checks").insert(row).select(COLUMNS).single();
  if (error || !saved) {
    console.error("[business-checks] 기록 실패", error?.code);
    return NextResponse.json({ error: "조회 결과를 저장하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "business_check",
    targetType: "seller_business_check",
    targetId: saved.id as string,
    detail: {
      b_no: maskBizNo(bNo),
      seller_request_id: sellerRequestId,
      result: v.result,
      status_code: row.status_code,
      error_kind: row.error_kind,
      recheck: body.recheckOf != null,
    },
  });

  const [item] = await toClient(db, [saved as Row]);
  return NextResponse.json({ item });
}
