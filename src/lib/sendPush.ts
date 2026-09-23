import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:contact@jumpingbid.co.kr", vapidPublic, vapidPrivate);
}

// 카테고리·지역을 구독한 회원의 기기에 직접 웹 푸시를 발송합니다.
// (카카오 알림톡 같은 중간 채널 없이 브라우저/PWA에 바로 전달, 알라미와 동일한 방식)
export async function sendDealPush(dealId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { sentCount: 0, total: 0, demo: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("id, title, category_id, region_id, deal_price, images")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    return { error: "매물을 찾을 수 없습니다." };
  }

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

  const membersWithAnyRegion = new Set((regionRows ?? []).map((r) => r.member_id));
  const regionMatchIds = new Set(
    (regionRows ?? []).filter((r) => r.region_id === deal.region_id).map((r) => r.member_id)
  );

  const memberIds = catMemberIds.filter(
    (id) => regionMatchIds.has(id) || !membersWithAnyRegion.has(id)
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
    try {
      if (vapidPublic && vapidPrivate) {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({
            title: "🔥 덤핑점핑 · 마감 임박",
            body: `${deal.title} · ${Number(deal.deal_price).toLocaleString()}원`,
            url: `/deals/${deal.id}`,
            tag: `deal-${deal.id}`,
            image: deal.images?.[0] || undefined,
          })
        );
      }
      await supabaseAdmin.from("notification_logs").insert({
        deal_id: deal.id,
        member_id: sub.member_id,
        channel: "webpush",
        status: "sent",
      });
      sentCount++;
    } catch {
      await supabaseAdmin.from("notification_logs").insert({
        deal_id: deal.id,
        member_id: sub.member_id,
        channel: "webpush",
        status: "failed",
      });
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
