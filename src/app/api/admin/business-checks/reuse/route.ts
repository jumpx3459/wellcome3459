import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm, requireRole } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { maskBizNo, ntsStatus } from "@/lib/nts";
import { normalizePhone } from "@/lib/phone";
import { COLUMNS, toClient, type Row } from "@/lib/businessChecksServer";
import { ALREADY_HANDLED_MESSAGE } from "@/lib/businessCheck";
import { buildReuseWarnings, isRootCheck, type ReuseStatus } from "@/lib/businessReuse";

// 2026-10-21 확인된 판매자 재사용 — 원본(root)을 새 행으로 복사. 서버가 root를 다시 검증하고, 상태 조회(ntsStatus)는 이 호출에서 딱 1번.
//   body { sourceCheckId, sellerRequestId?, company?, phone? } — sourceCheckId가 재사용 행이면 그 원본(root)을 따라감(항상 root id를 넣음).
//   · 판매 신청에 재사용: 그 신청(대기 중)과 같은 회원의 이전 신청에서 확인된 root만. 상호·연락처 비교는 신청 값으로.
//   · 직접 등록(sellerRequestId 없음): 폼에 적힌 company·phone(선택)으로 비교. 새 행은 신청·매물에 안 붙은 채로 만들어져 등록 폼의 선택 기록이 됨.
//   · root가 예외 확인이면 최고관리자·관리자만(예외 확인 권한과 같음). 그 밖은 사업자 조회 권한(sellerRequests).
//   · 경고(휴업·폐업/상태 조회 실패, 상호·연락처 상이, 1년 경과, 첫 확인이 예외)는 알려주기만 — 막지 않음.
// 응답·감사 로그에는 원문 사업자번호·대표자 성명을 넣지 않음(마스킹 번호만).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerRequests");
  if (denied) return denied;
  const db = auth.db;
  const body = await req.json().catch(() => null);
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
  if (!body || typeof body !== "object") return bad("잘못된 요청입니다.");
  const sourceId = body.sourceCheckId;
  if (typeof sourceId !== "string" || !UUID_RE.test(sourceId)) return bad("잘못된 요청입니다.");
  const requestId = body.sellerRequestId == null || body.sellerRequestId === "" ? null : body.sellerRequestId;
  if (requestId !== null && (typeof requestId !== "string" || !UUID_RE.test(requestId))) return bad("판매 신청이 올바르지 않아요.");

  // root 찾기 — 고른 행이 재사용 행이면 그 원본으로
  const { data: src, error: srcErr } = await db.from("seller_business_checks").select("id, reused_from_check_id").eq("id", sourceId).maybeSingle();
  if (srcErr) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
  if (!src) return NextResponse.json({ error: "재사용할 기록을 찾을 수 없어요." }, { status: 404 });
  const rootId = (src.reused_from_check_id as string | null) || (src.id as string);
  const { data: rootRow, error: rootErr } = await db.from("seller_business_checks").select(COLUMNS).eq("id", rootId).maybeSingle();
  if (rootErr) return NextResponse.json({ error: "조회 기록을 불러오지 못했어요." }, { status: 500 });
  const root = rootRow as Row | null;
  if (!root || !isRootCheck(root)) return NextResponse.json({ error: "재사용할 수 없는 기록이에요. 사업자 조회를 다시 해주세요." }, { status: 409 });

  // 권한 — 예외 확인 root는 예외 확인 권한
  if (root.exception_ok) {
    const roleDenied = requireRole(auth.admin, ["최고관리자", "관리자"]);
    if (roleDenied) return roleDenied;
  }

  // 판매 신청 재사용: 대기 중 신청 + 같은 회원의 이전 신청에서 확인된 root
  let currentCompany: string | null = typeof body.company === "string" && body.company.trim() ? body.company.trim() : null;
  let currentPhone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
  if (requestId) {
    const { data: sr, error: srReqErr } = await db
      .from("seller_requests")
      .select("id, company_name, contact_phone, seller_member_id, status, linked_deal_id")
      .eq("id", requestId)
      .maybeSingle();
    if (srReqErr) return NextResponse.json({ error: "판매 신청을 확인하지 못했어요." }, { status: 500 });
    if (!sr) return NextResponse.json({ error: "판매 신청을 찾을 수 없어요." }, { status: 404 });
    if (sr.status !== "pending" || sr.linked_deal_id) return NextResponse.json({ error: ALREADY_HANDLED_MESSAGE }, { status: 409 });
    if (!sr.seller_member_id) return NextResponse.json({ error: "회원 신청이 아니라 같은 판매자를 확인할 수 없어요." }, { status: 409 });
    if (!root.seller_request_id) return NextResponse.json({ error: "이 신청의 판매자와 이어진 기록이 아니에요." }, { status: 409 });
    const { data: rootReq } = await db.from("seller_requests").select("seller_member_id").eq("id", root.seller_request_id).maybeSingle();
    if (!rootReq || rootReq.seller_member_id !== sr.seller_member_id) return NextResponse.json({ error: "이 신청의 판매자와 이어진 기록이 아니에요." }, { status: 409 });
    currentCompany = (sr.company_name as string | null) ?? null;
    currentPhone = normalizePhone(sr.contact_phone as string | null);
  }

  // 첫 확인 때의 연락처 — root의 판매 신청 연락처, 없으면 root가 붙은 매물의 판매자 비공개 연락처
  let originalPhone: string | null = null;
  if (root.seller_request_id) {
    const { data: r0 } = await db.from("seller_requests").select("contact_phone").eq("id", root.seller_request_id).maybeSingle();
    originalPhone = normalizePhone((r0?.contact_phone as string | null) ?? null) || null;
  } else if (root.deal_id) {
    const { data: p0 } = await db.from("deal_seller_private").select("contact_phone").eq("deal_id", root.deal_id).maybeSingle();
    originalPhone = normalizePhone((p0?.contact_phone as string | null) ?? null) || null;
  }

  // 상태 조회 — 이 호출에서 1번(후보 조회·화면 열기에서는 호출하지 않음)
  const s = await ntsStatus(root.b_no);
  const status: ReuseStatus = s.result === "ok" ? { kind: "ok", code: s.status.code } : { kind: "failed" };

  const insert = {
    seller_request_id: requestId,
    kind: "validate" as const,
    b_no: root.b_no,
    rep_name: root.rep_name,
    open_date: root.open_date,
    input_company_name: root.input_company_name,
    validate_result: root.validate_result,
    status_code: s.result === "ok" ? s.status.code : null,
    status_text: s.result === "ok" ? s.status.text : null,
    tax_type: s.result === "ok" ? s.status.taxType : null,
    error_kind: null,
    reused_from_check_id: root.id,
    checked_by_admin_id: auth.admin.id, // 처리자 = 지금 관리자 · checked_at은 기본값(지금)
    exception_ok: root.exception_ok === true,
    exception_reason: root.exception_reason,
    exception_by_admin_name: root.exception_by_admin_name,
    exception_at: root.exception_at,
  };
  const { data: saved, error: insErr } = await db.from("seller_business_checks").insert(insert).select(COLUMNS).single();
  if (insErr || !saved) {
    console.error("[business-checks/reuse] 기록 실패", insErr?.code);
    return NextResponse.json({ error: "재사용 기록을 저장하지 못했어요. 다시 시도해주세요." }, { status: 500 });
  }

  const warnings = buildReuseWarnings({
    status,
    rootCheckedAt: root.checked_at,
    rootException: root.exception_ok === true,
    rootCompany: root.input_company_name,
    currentCompany,
    originalPhone,
    currentPhone: currentPhone || null,
    now: Date.now(),
  });

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "business_check_reuse",
    targetType: "seller_business_check",
    targetId: saved.id as string,
    detail: {
      source_check_id: root.id,
      new_check_id: saved.id,
      b_no: maskBizNo(root.b_no),
      seller_request_id: requestId,
      warnings: warnings.map((w) => w.code),
    },
  });

  const [item] = await toClient(db, [saved as Row]);
  // 응답에는 대표자 성명(rep_name)을 넣지 않음
  return NextResponse.json({ item: { ...item, rep_name: null }, warnings });
}
