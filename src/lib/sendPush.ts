import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { matchesConditions } from "@/lib/dealMatching";
import { formatDealPrice } from "@/lib/format";
import { stockTypeBadge } from "@/lib/stockType";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:admin@jumpx.co.kr", vapidPublic, vapidPrivate);
}

// 2026-09-30: 광고성 정보 표시 — 제목 앞 "(광고)", 본문 끝에 수신거부(알림 끄기) 방법.
const OPT_OUT_LINE = "알림 끄기: MY > 이 기기 푸시 알림";

// 2026-09-30: 야간(한국 시간 21:00~07:59) 발송 보류 — 이 시간에 등록된 매물·공지는 push_sent_at을 비워 두고,
// 아침 8시 /api/cron/morning-push가 모아서 보낸다.
export function isQuietHoursKST(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  return hour >= 21 || hour < 8;
}

// 카테고리·지역을 구독한 회원의 기기에 직접 웹 푸시를 발송합니다.
// (카카오 알림톡 같은 중간 채널 없이 브라우저/PWA에 바로 전달, 알라미와 동일한 방식)
// 매물당 1회만 — push_sent_at이 이미 있으면 skip, 발송 직전에 push_sent_at을 조건부로 채워 중복 발송(등록+cron 동시 실행)을 막는다.
export async function sendDealPush(dealId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { sentCount: 0, total: 0, demo: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("id, title, category_id, region_id, deal_price, original_price, quantity_unit, price_unit, stock_type, images, status, closes_at, push_sent_at")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    return { error: "매물을 찾을 수 없습니다." };
  }

  // 2026-09-30: 마감된 매물(status≠active 또는 closes_at 지남)에는 발송하지 않음 — 예전 재발송 경로(/api/push/send, 삭제됨)로
  // 지난 매물 알림이 나가던 문제 방지.
  const closesAtMs = deal.closes_at ? Date.parse(deal.closes_at) : null;
  const skipReason =
    deal.status !== "active"
      ? `status=${deal.status}`
      : closesAtMs !== null && closesAtMs <= Date.now()
      ? `closes_at 지남(${deal.closes_at})`
      : null;
  if (skipReason) {
    console.warn(`[sendDealPush] skip deal=${deal.id} — ${skipReason}`);
    return { sentCount: 0, total: 0, skipped: skipReason };
  }
  if (deal.push_sent_at) {
    return { sentCount: 0, total: 0, skipped: "이미 발송됨" };
  }
  if (isQuietHoursKST()) {
    console.info(`[sendDealPush] hold deal=${deal.id} — 야간(21~08시), 아침 8시 발송 대기`);
    return { sentCount: 0, total: 0, held: true };
  }

  // 먼저 차지한 쪽만 발송 (push_sent_at is null 조건부 update)
  const { data: claimed } = await supabaseAdmin
    .from("deals")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", deal.id)
    .is("push_sent_at", null)
    .select("id");
  if (!claimed?.length) {
    return { sentCount: 0, total: 0, skipped: "이미 발송됨" };
  }

  // 할인율은 정상가가 있을 때만 (없으면 생략)
  const discountPct = deal.original_price
    ? Math.round(((deal.original_price - deal.deal_price) / deal.original_price) * 100)
    : 0;
  const discountPrefix = discountPct > 0 ? `${discountPct}%↓ · ` : "";
  const stockBadge = stockTypeBadge(deal.stock_type);
  const stockTypePrefix = stockBadge ? `${stockBadge} · ` : "";

  // member_categories와 member_regions는 서로 직접 연결된 외래키가 없어
  // 한 번의 조인 쿼리로는 가져올 수 없습니다. 각각 조회한 뒤 교집합을 계산합니다.
  const { data: catMembers } = await supabaseAdmin
    .from("member_categories")
    .select("member_id")
    .eq("category_id", deal.category_id);

  const catMemberIds = (catMembers ?? []).map((m) => m.member_id);

  // 지역을 하나도 선택 안 한 회원은 "전국"으로 간주 — member_regions에 행이
  // 아예 없으면 지역 필터 없이 통과시킵니다. (관심 카테고리 후보로 이미
  // 좁혀놨으니 이 후보들만 대상으로 region 행을 조회합니다.)
  const { data: regionRows } = await supabaseAdmin
    .from("member_regions")
    .select("member_id, region_id")
    .in("member_id", catMemberIds.length ? catMemberIds : ["00000000-0000-0000-0000-000000000000"]);

  const regionsByMember = new Map<string, number[]>();
  for (const r of regionRows ?? []) {
    regionsByMember.set(r.member_id, [...(regionsByMember.get(r.member_id) ?? []), r.region_id]);
  }

  // 알림 끄기(push_opt_out)한 회원 제외 — 끌 때 구독도 지우지만 이중 안전장치.
  // 대상 id를 .in()으로 또 넘기면 URL이 길어지니, 수가 적은 opt-out 쪽을 따로 조회한다.
  const { data: optedOutRows } = await supabaseAdmin.from("members").select("id").eq("push_opt_out", true);
  const optedOut = new Set((optedOutRows ?? []).map((m) => m.id));

  // 매칭 규칙은 회원 홈(AlertInboxHome)과 공유 — src/lib/dealMatching.ts.
  // catMemberIds는 이미 이 카테고리를 고른 회원이라 카테고리 목록은 [deal.category_id]로 충분.
  const memberIds = catMemberIds.filter(
    (id) =>
      matchesConditions(
        { category: deal.category_id, region: deal.region_id },
        [deal.category_id],
        regionsByMember.get(id) ?? []
      ) && !optedOut.has(id)
  );

  if (memberIds.length === 0) {
    return { sentCount: 0, total: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("member_id, endpoint, p256dh, auth_key")
    .in("member_id", memberIds);

  let sentCount = 0;

  for (const sub of subs ?? []) {
    const { data: logRow } = await supabaseAdmin
      .from("notification_logs")
      .insert({ deal_id: deal.id, member_id: sub.member_id, channel: "webpush", status: "sent" })
      .select("id")
      .single();

    try {
      if (vapidPublic && vapidPrivate) {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({
            title: "(광고) 덤핑점핑 · 새 매물",
            // 재고 유형 배지를 앞에 (general이면 없음) — 예: "⏰ 소비기한 임박 · 냉동 삼겹살 · 36%↓ · 398,000원/박스\n알림 끄기: MY > 이 기기 푸시 알림"
            body: `${stockTypePrefix}${deal.title} · ${discountPrefix}${formatDealPrice(Number(deal.deal_price), deal.quantity_unit, deal.price_unit)}\n${OPT_OUT_LINE}`,
            url: `/deals/${deal.id}`,
            tag: `deal-${deal.id}`,
            image: deal.images?.[0] || undefined,
            logId: logRow?.id,
          })
        );
      }
      sentCount++;
    } catch {
      if (logRow?.id) {
        await supabaseAdmin.from("notification_logs").update({ status: "failed" }).eq("id", logRow.id);
      }
    }
  }

  return { sentCount, total: subs?.length ?? 0 };
}

// 2026-09-28: 긴급 공지(부동산·설비 처분 등) 알림 — 재고 매물 알림(sendDealPush)과
// 달리 카테고리 매칭이 없고, notice_alerts_opt_in을 켠 회원만 대상. 공지에 지역이
// 지정돼 있으면 그 지역을 선택한 회원 + 지역 미선택("전국") 회원만, 지역이 없으면
// (전국 공지) opt-in 회원 전원에게 보낸다.
// 2026-09-30: 매물과 같은 규칙 — active 공지만, 1회만(push_sent_at), 야간 보류.
export async function sendNoticePush(noticeId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { sentCount: 0, total: 0, demo: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: notice, error: noticeError } = await supabaseAdmin
    .from("urgent_notices")
    .select("id, title, category, region_id, images, status, push_sent_at")
    .eq("id", noticeId)
    .single();

  if (noticeError || !notice) {
    return { error: "공지를 찾을 수 없습니다." };
  }
  if (notice.status !== "active") {
    console.warn(`[sendNoticePush] skip notice=${notice.id} — status=${notice.status}`);
    return { sentCount: 0, total: 0, skipped: `status=${notice.status}` };
  }
  if (notice.push_sent_at) {
    return { sentCount: 0, total: 0, skipped: "이미 발송됨" };
  }
  if (isQuietHoursKST()) {
    console.info(`[sendNoticePush] hold notice=${notice.id} — 야간(21~08시), 아침 8시 발송 대기`);
    return { sentCount: 0, total: 0, held: true };
  }
  const { data: claimed } = await supabaseAdmin
    .from("urgent_notices")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", notice.id)
    .is("push_sent_at", null)
    .select("id");
  if (!claimed?.length) {
    return { sentCount: 0, total: 0, skipped: "이미 발송됨" };
  }

  const { data: optedIn } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("notice_alerts_opt_in", true)
    .eq("push_opt_out", false);

  let memberIds = (optedIn ?? []).map((m) => m.id);

  if (notice.region_id && memberIds.length > 0) {
    const { data: regionRows } = await supabaseAdmin
      .from("member_regions")
      .select("member_id, region_id")
      .in("member_id", memberIds);

    const membersWithAnyRegion = new Set((regionRows ?? []).map((r) => r.member_id));
    const regionMatchIds = new Set(
      (regionRows ?? []).filter((r) => r.region_id === notice.region_id).map((r) => r.member_id)
    );
    memberIds = memberIds.filter((id) => regionMatchIds.has(id) || !membersWithAnyRegion.has(id));
  }

  if (memberIds.length === 0) {
    return { sentCount: 0, total: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("member_id, endpoint, p256dh, auth_key")
    .in("member_id", memberIds);

  let sentCount = 0;

  for (const sub of subs ?? []) {
    try {
      if (vapidPublic && vapidPrivate) {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({
            title: `(광고) 덤핑점핑 · 긴급 공지 · ${notice.category}`,
            body: `${notice.title}\n${OPT_OUT_LINE}`,
            url: `/notices`,
            tag: `notice-${notice.id}`,
            image: notice.images?.[0] || undefined,
          })
        );
      }
      sentCount++;
    } catch {
      // 구독 만료 등 — deals 알림과 달리 notification_logs에 남기지 않음(공지는
      // North Star 클릭률 측정 대상이 아니라 별도 로그 테이블이 필요 없다고 판단)
    }
  }

  return { sentCount, total: subs?.length ?? 0 };
}

export async function sendAdminPush(title: string, body: string, url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) return;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: admins } = await supabaseAdmin.from("admin_users").select("phone");
  const adminPhoneDigits = new Set(
    (admins ?? []).map((a) => a.phone?.replace(/[^0-9]/g, "")).filter(Boolean)
  );
  if (adminPhoneDigits.size === 0) return;

  const { data: members } = await supabaseAdmin.from("members").select("id, phone");
  const adminMemberIds = (members ?? [])
    .filter((m) => adminPhoneDigits.has(m.phone?.replace(/[^0-9]/g, "")))
    .map((m) => m.id);
  if (adminMemberIds.length === 0) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .in("member_id", adminMemberIds);

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({ title, body, url, tag: "admin-lead" })
      );
    } catch {
      // 구독 만료 등 — 운영자 알림은 베스트에포트라 조용히 무시
    }
  }
}
