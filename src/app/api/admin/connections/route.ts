import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { maskPhone } from "@/lib/phone";
import { isResultDue, isStuck, sortBoard, type ConnectionStatus } from "@/lib/connectionSteps";
import { getTestBuyerLookup } from "@/lib/kpiExclusion";
import { normalizePhone } from "@/lib/phone";
import { ownOnly } from "@/lib/adminPerms";

// 2026-10-04 F-4 거래 연결 보드 — 목록. 진행 중(closed 아님) 전체 + 최근 종료 20건.
// 구매자 번호는 가린 값만(maskPhone) — 전체 번호는 [번호 보기](/api/admin/connections/[id]/phone, 감사 로그).
// 2026-10-10 권한표: 점핑매니저는 자기에게 배정된 건만(미배정 건은 안 보임) — 진행 중·최근 종료 모두
// 2026-10-11 PR ② 4단계 보드: 테스트 건 표시(is_test — 구매자가 KPI 제외 대상: 회원 kpi_excluded_members, 비회원 kpi_excluded_phones·관리자 번호),
//   ⑤ 연락처 전달 뒤 3일이 지나면 result_due(결과 확인 차례 — 멈춤 아님). 멈춘 건 숫자(stuckCount)에서 테스트 건 제외.
//   정렬: 멈춤 → 3일 지난 결과 확인 → 마지막 변경이 오래된 순 → 테스트 건 맨 아래(sortBoard)
const OPEN_LIMIT = 500;
const CLOSED_LIMIT = 20;

const COLUMNS =
  "id, deal_id, deal_title_snapshot, buyer_member_id, buyer_phone, source, source_id, consent_at, status, result, result_amount, result_reason, " +
  "requested_at, accepted_at, seller_confirmed_at, buyer_confirmed_at, contact_sent_at, closed_at, assigned_admin_id, updated_at";

type Row = {
  id: string;
  deal_id: string;
  deal_title_snapshot: string;
  buyer_member_id: string | null;
  buyer_phone: string | null;
  source: string;
  source_id: string | null;
  consent_at: string | null;
  status: ConnectionStatus;
  result: string | null;
  result_amount: number | null;
  result_reason: string | null;
  requested_at: string;
  accepted_at: string | null;
  seller_confirmed_at: string | null;
  buyer_confirmed_at: string | null;
  contact_sent_at: string | null;
  closed_at: string | null;
  assigned_admin_id: string | null;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "connections"); // 2026-10-10 권한표(adminPerms)
  if (denied) return denied;
  const db = auth.db;
  const mine = ownOnly(auth.admin.role, "connections");
  const scope = <Q extends { eq: (c: string, v: string) => Q }>(q: Q) => (mine ? q.eq("assigned_admin_id", auth.admin.id) : q);

  const [openRes, closedRes] = await Promise.all([
    scope(db.from("deal_connections").select(COLUMNS).neq("status", "closed")).order("updated_at", { ascending: true }).limit(OPEN_LIMIT),
    scope(db.from("deal_connections").select(COLUMNS).eq("status", "closed")).order("closed_at", { ascending: false }).limit(CLOSED_LIMIT),
  ]);
  if (openRes.error || closedRes.error) {
    const e = openRes.error ?? closedRes.error;
    console.error("[admin/connections] 조회 실패", e?.code, e?.message);
    return NextResponse.json({ error: "거래 연결 목록을 불러오지 못했어요." }, { status: 500 });
  }
  const openRows = (openRes.data ?? []) as unknown as Row[];
  const closedRows = (closedRes.data ?? []) as unknown as Row[];
  const all = [...openRows, ...closedRows];

  // 담당자 이름 · 회원 구매자 번호 · 판매자 상호 안내 허락 — 따로 조회(실패해도 목록은 그대로, 칸만 비움)
  const adminIds = [...new Set(all.map((r) => r.assigned_admin_id).filter(Boolean))] as string[];
  const memberIds = [...new Set(all.map((r) => r.buyer_member_id).filter(Boolean))] as string[];
  const dealIds = [...new Set(all.map((r) => r.deal_id))];
  const [adminsRes, membersRes, privRes, testLookup] = await Promise.all([
    adminIds.length ? db.from("admin_users").select("id, name").in("id", adminIds) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? db.from("members").select("id, phone, member_no").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    dealIds.length ? db.from("deal_seller_private").select("deal_id, name_disclosure_ok").in("deal_id", dealIds) : Promise.resolve({ data: [], error: null }),
    getTestBuyerLookup(db, memberIds),
  ]);
  for (const r of [adminsRes, membersRes, privRes]) if (r.error) console.error("[admin/connections] 부가 조회 실패", r.error.code, r.error.message);
  const adminName = new Map((adminsRes.data ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));
  const member = new Map(
    (membersRes.data ?? []).map((m: { id: string; phone: string | null; member_no: number | null }) => [m.id, m])
  );
  const disclosure = new Map(
    (privRes.data ?? []).map((p: { deal_id: string; name_disclosure_ok: boolean }) => [p.deal_id, p.name_disclosure_ok])
  );

  const now = Date.now();
  const shape = (r: Row) => {
    const m = r.buyer_member_id ? member.get(r.buyer_member_id) : undefined;
    const phone = r.buyer_member_id ? m?.phone ?? null : r.buyer_phone;
    return {
      id: r.id,
      deal_id: r.deal_id,
      deal_title: r.deal_title_snapshot,
      buyer_kind: r.buyer_member_id ? ("member" as const) : r.buyer_phone ? ("guest" as const) : ("unknown" as const),
      buyer_member_no: m?.member_no ?? null,
      buyer_phone_masked: phone ? maskPhone(phone) : null,
      has_phone: !!phone,
      source: r.source,
      consent_at: r.consent_at,
      status: r.status,
      result: r.result,
      result_amount: r.result_amount,
      result_reason: r.result_reason,
      requested_at: r.requested_at,
      accepted_at: r.accepted_at,
      seller_confirmed_at: r.seller_confirmed_at,
      buyer_confirmed_at: r.buyer_confirmed_at,
      contact_sent_at: r.contact_sent_at,
      closed_at: r.closed_at,
      assigned_admin_id: r.assigned_admin_id,
      assigned_admin_name: r.assigned_admin_id ? adminName.get(r.assigned_admin_id) ?? "(해제된 관리자)" : null,
      updated_at: r.updated_at,
      name_disclosure_ok: disclosure.get(r.deal_id) ?? false,
      stuck: isStuck(r.status, r.updated_at, now),
      result_due: isResultDue(r.status, r.contact_sent_at, now),
      is_test: r.buyer_member_id ? testLookup.memberIds.has(r.buyer_member_id) : !!r.buyer_phone && testLookup.phones.has(normalizePhone(r.buyer_phone)),
    };
  };

  const open = sortBoard(openRows.map(shape));
  return NextResponse.json({
    open,
    closed: closedRows.map(shape),
    stuckCount: open.filter((c) => c.stuck && !c.is_test).length,
  });
}
