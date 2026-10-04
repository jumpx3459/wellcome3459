import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { UUID_RE } from "@/lib/rateLimit";
import { saveSellerPrivate } from "@/lib/sellerPrivate";
import {
  CONNECTION_METHODS, CONNECTION_RESULTS, MEMO_MAX, RESULT_TO_LEAD_OUTCOME, STEP_AT_COLUMN,
  canMoveTo, hasPhoneNumber, isConnectionStatus, type ConnectionMethod, type ConnectionResult,
} from "@/lib/connectionSteps";

// 2026-10-04 F-4 거래 연결 단계 전환.
// body: { from(화면이 본 단계), to, method(phone·sms·kakao), memo?, result?(to=closed), amount?(성사일 때), reason? }
//   · 앞으로만(건너뛰기 허용), 뒤로 가기 409. ⑥ 결과(closed)는 어느 단계에서나.
//   · 동시 처리: "status = from"일 때만 update → 0행이면 409(다른 관리자가 먼저 처리). 그 뒤 단계 이력(deal_connection_events) insert.
//     이력 insert가 실패하면 단계는 이미 바뀐 상태 → 500으로 알리고 감사 로그에 남김.
//   · 담당자가 없으면 이번에 처리한 관리자가 담당자(보통 ② 접수). 이미 있으면 바꾸지 않음.
//   · KPI 맞추기: 원본 리드(interests·quick_leads, source_id)를 리드 카드 PATCH와 같은 값으로 — 진행 단계면 contacted=true,
//     ⑥이면 outcome(성사 completed / 불발·취소 no_deal)·completed_amount·completed_at도. 실패해도 단계 전환은 유지(응답에 표시).
//   · ③ 판매자 확인: nameDisclosureOk(판매자가 상호 안내를 허락함)를 deal_seller_private에 저장(매물당 1행, 없으면 만듦).
//     ④는 허락이 없어도 막지 않음(화면에 "상호 비공개로 안내" 표시만).
const RACE_MESSAGE = "다른 관리자가 먼저 처리했어요. 새로고침해 주세요.";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/connections/[id]/step">) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { from, to, method } = body ?? {};
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!isConnectionStatus(from) || !isConnectionStatus(to) || to === "requested") {
    return NextResponse.json({ error: "단계 값이 올바르지 않아요.", field: "to" }, { status: 400 });
  }
  if (!CONNECTION_METHODS.includes(method as ConnectionMethod)) {
    return NextResponse.json({ error: "연락 방법(전화·문자·카톡)을 골라주세요.", field: "method" }, { status: 400 });
  }
  const nameDisclosureOk = body?.nameDisclosureOk;
  if (nameDisclosureOk !== undefined && (typeof nameDisclosureOk !== "boolean" || to !== "seller_confirmed")) {
    return NextResponse.json({ error: "상호 안내 허락 값이 올바르지 않아요.", field: "nameDisclosureOk" }, { status: 400 });
  }
  if (memo.length > MEMO_MAX) return NextResponse.json({ error: `메모는 ${MEMO_MAX}자까지 적을 수 있어요.`, field: "memo" }, { status: 400 });
  if (hasPhoneNumber(memo)) return NextResponse.json({ error: "메모에 휴대폰 번호는 적을 수 없어요.", field: "memo" }, { status: 400 });

  let result: ConnectionResult | null = null;
  let amount: number | null = null;
  if (to === "closed") {
    if (!CONNECTION_RESULTS.includes(body?.result as ConnectionResult)) {
      return NextResponse.json({ error: "결과(성사·불발·취소)를 골라주세요.", field: "result" }, { status: 400 });
    }
    result = body!.result as ConnectionResult;
    if (result === "success" && body?.amount != null && body.amount !== "") {
      const n = body.amount;
      if (!(typeof n === "number" && Number.isSafeInteger(n) && n >= 0)) {
        return NextResponse.json({ error: "성사 금액은 0 이상 숫자여야 해요.", field: "amount" }, { status: 400 });
      }
      amount = n;
    }
    if (reason.length > MEMO_MAX) return NextResponse.json({ error: `사유는 ${MEMO_MAX}자까지 적을 수 있어요.`, field: "reason" }, { status: 400 });
    if (hasPhoneNumber(reason)) return NextResponse.json({ error: "사유에 휴대폰 번호는 적을 수 없어요.", field: "reason" }, { status: 400 });
  }

  const db = auth.db;
  const { data: conn, error: readError } = await db
    .from("deal_connections")
    .select("id, deal_id, status, consent_at, assigned_admin_id, source, source_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "연결 기록을 불러오지 못했어요." }, { status: 500 });
  if (!conn) return NextResponse.json({ error: "연결 기록을 찾을 수 없어요." }, { status: 404 });
  if (conn.status !== from) return NextResponse.json({ error: RACE_MESSAGE, race: true }, { status: 409 });
  if (!canMoveTo(conn.status, to)) {
    return NextResponse.json({ error: "이전 단계로는 되돌릴 수 없어요.", field: "to" }, { status: 409 });
  }
  if (to === "contact_sent" && !conn.consent_at) {
    return NextResponse.json({ error: "연결 동의가 없는 건은 연락처를 전달할 수 없어요.", field: "to" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, [STEP_AT_COLUMN[to]]: nowIso };
  if (!conn.assigned_admin_id) patch.assigned_admin_id = auth.admin.id;
  if (to === "closed") {
    patch.result = result;
    patch.result_amount = amount;
    patch.result_reason = reason || null;
  }
  const { data: updated, error: updateError } = await db
    .from("deal_connections")
    .update(patch)
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (updateError) {
    console.error("[admin/connections/step] update 실패", updateError.code, updateError.message);
    return NextResponse.json({ error: "단계를 바꾸지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
  if (!updated || updated.length === 0) return NextResponse.json({ error: RACE_MESSAGE, race: true }, { status: 409 });

  const { error: eventError } = await db.from("deal_connection_events").insert({
    connection_id: id,
    step: to,
    method,
    actor_type: "person",
    actor_admin_id: auth.admin.id,
    memo: memo || null,
  });

  // ③ 상호 안내 허락 (실패해도 단계 전환은 유지 — 응답·감사 로그에 표시)
  let disclosure: "ok" | "skipped" | "failed" = "skipped";
  if (typeof nameDisclosureOk === "boolean") {
    const saved = await saveSellerPrivate(db, conn.deal_id, auth.admin.id, {
      name_disclosure_ok: nameDisclosureOk,
      name_disclosure_at: nameDisclosureOk ? nowIso : null,
    });
    disclosure = saved.ok ? "ok" : "failed";
    if (!saved.ok) console.error("[admin/connections/step] 상호 허락 저장 실패", saved.message);
  }

  // KPI 맞추기 — 원본 리드 (리드 카드 PATCH와 같은 값)
  let leadSync: "ok" | "skipped" | "failed" = "skipped";
  const leadTable = conn.source === "interest" ? "interests" : conn.source === "quick_lead" ? "quick_leads" : null;
  if (leadTable && conn.source_id) {
    const leadPatch: Record<string, unknown> =
      to === "closed"
        ? { outcome: RESULT_TO_LEAD_OUTCOME[result!], completed_amount: result === "success" ? amount : null, completed_at: nowIso }
        : { contacted: true };
    const { error: leadError } = await db.from(leadTable).update(leadPatch).eq("id", conn.source_id);
    leadSync = leadError ? "failed" : "ok";
    if (leadError) console.error("[admin/connections/step] 리드 갱신 실패", leadTable, leadError.code, leadError.message);
  }

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "connection_step",
    targetType: "deal_connection",
    targetId: id,
    detail: {
      deal_id: conn.deal_id,
      from,
      to,
      method,
      ...(to === "closed" ? { result, amount } : {}),
      assigned: !conn.assigned_admin_id,
      lead_sync: leadSync,
      ...(typeof nameDisclosureOk === "boolean" ? { name_disclosure_ok: nameDisclosureOk, disclosure_save: disclosure } : {}),
      ...(eventError ? { event_insert_failed: true, event_error: eventError.code ?? eventError.message } : {}),
    },
  });

  if (eventError) {
    console.error("[admin/connections/step] 이력 저장 실패", eventError.code, eventError.message);
    return NextResponse.json(
      { error: "단계는 바뀌었지만 처리 이력을 저장하지 못했어요. 대표에게 알려주세요.", eventFailed: true, status: to },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, status: to, leadSyncFailed: leadSync === "failed", disclosureFailed: disclosure === "failed" });
}
