import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { phoneTail, writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { dealPrivateScopeDenied } from "@/lib/adminScope";
import { maskBizNo } from "@/lib/nts";
import { NOT_CHECKED_MESSAGE } from "@/lib/businessCheck";
import {
  findLinkableCheck,
  linkDirectCheck,
  linkedSellerRequest,
  parseSellerPrivateFields,
  saveSellerPrivate,
  type SellerPrivateField,
  type SellerPrivateVia,
} from "@/lib/sellerPrivate";

// 2026-10-04 feat/deal-seller-private: 매물 수정 화면의 "실제 판매자"(상호·담당자·연락처, 구매자에게 보이지 않음) — 매물 id로 deal_seller_private 1행.
// GET ?dealId=: 저장된 값(없으면 null) + 그 매물에 붙은 사업자 조회(있으면 표시만) + 판매 신청 매물 여부. 조회·저장 모두 감사 로그(값은 넣지 않음).
// PUT: 상호·연락처 필수(등록과 같은 검증 함수). 아직 사업자 조회가 안 붙은 매물은 businessCheckId로 통과한 직접 조회 행을 골라 붙일 수 있음 — 이미 붙은 매물은 거절.
// 기존 실매물 채우기용. 기존 매물 수정(/api/admin/deals/manage PATCH)과 별개 경로라 알림을 다시 보내지 않음.

const FIELD_NAME: Record<SellerPrivateField, string> = {
  companyName: "sellerPrivateCompany",
  contactName: "sellerPrivateName",
  contactPhone: "sellerPrivatePhone",
  memo: "sellerPrivateName",
};

async function linkedValidateCheck(db: SupabaseClient, dealId: string) {
  const { data, error } = await db
    .from("seller_business_checks")
    .select("id, checked_at, input_company_name, b_no, validate_result, exception_ok, status_code")
    .eq("deal_id", dealId)
    .eq("kind", "validate")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { check: data, error };
}

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerPrivate"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;
  const dealId = req.nextUrl.searchParams.get("dealId") ?? "";
  if (!UUID_RE.test(dealId)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const db = auth.db;
  const scoped = await dealPrivateScopeDenied(db, auth.admin, dealId); // 점핑매니저는 담당 매물만
  if (scoped) return scoped;

  const [{ data: item, error: privError }, { check, error: chkError }, request] = await Promise.all([
    db.from("deal_seller_private").select("company_name, contact_name, contact_phone, source").eq("deal_id", dealId).maybeSingle(),
    linkedValidateCheck(db, dealId),
    linkedSellerRequest(db, dealId),
  ]);
  if (privError || chkError) return NextResponse.json({ error: "판매자 정보를 불러오지 못했어요." }, { status: 500 });

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "seller_private_view",
    targetType: "deal",
    targetId: dealId,
    detail: { via: "deal_edit", has_row: !!item },
  });
  return NextResponse.json({
    item: item ?? null,
    fromSellerRequest: !!request,
    // 신청 매물인데 비공개 정보가 아직 비어 있으면 신청 정보를 참고용으로 돌려줌(저장 전까지는 DB에 없음)
    suggest: request && !item ? { company_name: request.company_name, contact_name: request.contact_name, contact_phone: request.contact_phone } : null,
    linkedCheck: check
      ? {
          id: check.id,
          checked_at: check.checked_at,
          input_company_name: check.input_company_name,
          b_no_masked: maskBizNo(check.b_no as string),
          validate_result: check.validate_result,
          exception_ok: check.exception_ok,
          status_code: check.status_code,
        }
      : null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerPrivate"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const dealId = typeof body?.dealId === "string" ? body.dealId : "";
  if (!UUID_RE.test(dealId)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const parsed = parseSellerPrivateFields(
    { companyName: body?.sellerPrivateCompany, contactName: body?.sellerPrivateName, contactPhone: body?.sellerPrivatePhone },
    { requireCompany: true, requirePhone: true, withMemo: false }
  );
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: FIELD_NAME[parsed.field] }, { status: 400 });
  const businessCheckId = body?.businessCheckId;
  const wantLink = typeof businessCheckId === "string" && businessCheckId !== "";
  if (businessCheckId != null && businessCheckId !== "" && (!wantLink || !UUID_RE.test(businessCheckId as string))) {
    return NextResponse.json({ error: NOT_CHECKED_MESSAGE, field: "businessCheckId" }, { status: 400 });
  }

  const db = auth.db;
  const scoped = await dealPrivateScopeDenied(db, auth.admin, dealId); // 점핑매니저는 담당 매물만
  if (scoped) return scoped;
  const { data: deal, error: dealError } = await db.from("deals").select("id").eq("id", dealId).maybeSingle();
  if (dealError) return NextResponse.json({ error: "매물을 불러오지 못했어요." }, { status: 500 });
  if (!deal) return NextResponse.json({ error: "매물을 찾을 수 없어요." }, { status: 404 });

  // 사업자 조회 연결은 저장 전에 가능 여부부터 확인 — 이미 붙은 매물이거나 연결 불가 행이면 아무것도 바꾸지 않음
  if (wantLink) {
    const { check: existing, error: chkError } = await linkedValidateCheck(db, dealId);
    if (chkError) return NextResponse.json({ error: "사업자 조회 기록을 확인하지 못했어요." }, { status: 500 });
    if (existing) return NextResponse.json({ error: "이미 사업자 조회가 연결된 매물이에요.", field: "businessCheckId" }, { status: 409 });
    const c = await findLinkableCheck(db, businessCheckId as string);
    if (c === "error") return NextResponse.json({ error: "사업자 조회 기록을 확인하지 못했어요." }, { status: 500 });
    if (!c) return NextResponse.json({ error: NOT_CHECKED_MESSAGE, field: "businessCheckId" }, { status: 409 });
  }

  const { data: before } = await db.from("deal_seller_private").select("company_name, contact_name, contact_phone").eq("deal_id", dealId).maybeSingle();
  const next = { company_name: parsed.value.company_name, contact_name: parsed.value.contact_name, contact_phone: parsed.value.contact_phone };
  const saved = await saveSellerPrivate(db, dealId, auth.admin.id, next);
  if (!saved.ok) {
    console.error("[admin/deals/manage/seller] 저장 실패", saved.message);
    return NextResponse.json({ error: "판매자 정보를 저장하지 못했어요." }, { status: 500 });
  }
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => (before?.[k] ?? null) !== next[k]);

  let linkedCheckId: string | null = null;
  let linkFailed: "not_eligible" | "error" | null = null;
  if (wantLink) {
    const linked = await linkDirectCheck(db, businessCheckId as string, dealId);
    if (linked === "ok") linkedCheckId = businessCheckId as string;
    else linkFailed = linked;
  }

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "seller_private_save",
    targetType: "deal",
    targetId: dealId,
    detail: {
      via: "deal_edit" satisfies SellerPrivateVia,
      created: saved.created,
      changed,
      contact_phone: phoneTail(next.contact_phone),
      ...(linkedCheckId ? { linked_check_id: linkedCheckId } : {}),
      ...(linkFailed ? { link_failed: linkFailed } : {}),
    },
  });

  // 판매자 정보는 저장됐지만 조회 연결만 실패한 경우 — 어느 쪽이 됐는지 분명히 알림
  if (linkFailed) {
    return NextResponse.json(
      {
        error:
          linkFailed === "not_eligible"
            ? `판매자 정보는 저장했어요. ${NOT_CHECKED_MESSAGE}(선택한 조회가 그 사이 다른 곳에 연결됐어요)`
            : "판매자 정보는 저장했어요. 사업자 조회를 연결하지 못했어요. 다시 시도해주세요.",
        field: "businessCheckId",
        saved: true,
      },
      { status: linkFailed === "not_eligible" ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
