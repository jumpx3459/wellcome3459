import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { isDealAlertVersionCurrent } from "@/lib/consent";
import { selectDealAlertMembers, selectNoticeAlertMembers } from "@/lib/dealMatching";
import { pushPriceParts } from "@/lib/priceMode";
import { stockTypeBadge } from "@/lib/stockType";
import { normalizePhone } from "@/lib/phone";
import { isGoneSubscription, isKeyMismatch } from "@/lib/pushGone";

// 2026-10-05: 모든 웹푸시 공통 옵션 — urgency high(기기 절전 중에도 바로 전달), TTL 6시간(지나면 오래된 매물·공지 알림을 버림).
// 옵션 없이 보내면 urgency 보통·TTL 4주 기본값이라 기기가 알림을 미루거나 한참 뒤 몰아서 띄울 수 있었음.
export const PUSH_SEND_OPTIONS = { urgency: "high", TTL: 21600 } as const;

// 2026-10-01: VAPID 키는 모듈 로드 때가 아니라 실제 발송 직전에 1회 설정(lazy).
// 예전엔 파일을 불러오는 순간 setVapidDetails가 돌아, build(GitHub Actions의 vercel build — Sensitive env는 비어 있음) 중
// "Vapid private key must be a URL safe Base 64"로 build 전체가 실패했음. 이제 키가 없거나 형식이 틀리면 발송만 실패
// (에러 로그 + 매물 알림은 notification_logs에 failed), build와 다른 기능은 영향 없음.
let vapidReady: boolean | null = null; // null = 아직 시도 안 함
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.error("[sendPush] VAPID 키 없음 — 푸시 발송 안 함");
    vapidReady = false;
    return false;
  }
  try {
    webpush.setVapidDetails("mailto:admin@jumpx.co.kr", pub, priv);
    vapidReady = true;
  } catch (e) {
    console.error("[sendPush] VAPID 키 형식 오류 — 푸시 발송 안 함", (e as Error).message);
    vapidReady = false;
  }
  return vapidReady;
}

// 2026-09-30: 광고성 정보 표시 — 제목 앞 "(광고)", 본문 끝에 수신거부(알림 끄기) 방법.
const OPT_OUT_LINE = "알림 끄기: MY > 이 기기 푸시 알림";

// 2026-09-30: 매물 알림 수신 동의(deal_alert_ad) 최신 값이 agreed=true인 회원만 발송 대상 — 기록 없으면 제외.
// 2026-10-03 F-3b: 거기에 더해 동의 버전이 DEAL_ALERT_CONSENT_VERSION 이상이어야 함(옛 버전·버전 없음 제외 — 재동의 전까지 미발송).
// 조회 실패는 null(발송 중단) — 선점(push_sent_at) 전에 불러서, 실패해도 나중에 다시 보낼 수 있게 한다.
async function fetchDealAlertAgreedIds(supabaseAdmin: SupabaseClient): Promise<Set<string> | null> {
  const { data, error } = await supabaseAdmin
    .from("member_consent_latest")
    .select("member_id, terms_version")
    .eq("consent_type", "deal_alert_ad")
    .eq("agreed", true);
  if (error) {
    console.error("[sendPush] consent_error", error);
    return null;
  }
  return selectDealAlertAgreedIds((data ?? []) as { member_id: string; terms_version: string | null }[]);
}

// 대상 선정(순수 함수) — agreed=true 행 중 버전이 현재 이상인 회원만
export function selectDealAlertAgreedIds(rows: { member_id: string; terms_version: string | null }[]): Set<string> {
  return new Set(rows.filter((r) => isDealAlertVersionCurrent(r.terms_version)).map((r) => r.member_id));
}

// 2026-09-30: 야간(한국 시간 21:00~07:59) 발송 보류 — 이 시간에 등록된 매물·공지는 push_sent_at을 비워 두고,
// 아침 8시 /api/cron/morning-push가 모아서 보낸다.
export function isQuietHoursKST(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  return hour >= 21 || hour < 8;
}

// 관심 카테고리를 고른 회원의 기기에 직접 웹 푸시를 발송합니다(2026-10-04부터 지역은 조건이 아님 — 전국 알림).
// (카카오 알림톡 같은 중간 채널 없이 브라우저/PWA에 바로 전달, 알라미와 동일한 방식)
// 매물당 1회만 — push_sent_at이 이미 있으면 skip, 발송 직전에 push_sent_at을 조건부로 채워 중복 발송(등록+cron 동시 실행)을 막는다.
// 2026-09-30 (커밋 K): 발송 결과 410 Gone·404 Not Found = 브라우저에서 구독이 영구 해지됨 → 그 구독 행 삭제.
// 다른 오류(일시 장애·429·5xx 등)는 다음 발송에서 다시 시도하도록 유지. 예전엔 만료 구독이 남아 "알림 활성"에 계속 잡혔음.
// 2026-10-01: 403도 죽은 구독으로 지웠음(VAPID 키 변경 뒤 예전 키 구독). 2026-10-09 4a: 403은 삭제 중지·기록만 —
// 키 환경변수를 잘못 바꾸면 정상 구독이 한꺼번에 지워질 수 있어서(대표 결정). 판정은 src/lib/pushGone.ts

// 발송 실패 이유(notification_logs.error_code·error_message) — 비밀값 없이 짧게
function pushErrorInfo(e: unknown) {
  const err = e as { statusCode?: number; body?: string; message?: string } | null;
  const message = (err?.body || err?.message || "unknown").toString().replace(/\s+/g, " ").slice(0, 200);
  return { error_code: typeof err?.statusCode === "number" ? err.statusCode : null, error_message: message };
}

// 보내기 성공한 구독의 마지막 성공 시각 (MY "이 기기" 표시·죽은 구독 판단용). 컬럼이 없으면(SQL 전) 조용히 넘어감
async function markDelivered(supabaseAdmin: SupabaseClient, ids: string[], label: string) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("id", ids);
  if (error) console.warn(`[${label}] last_success_at 기록 실패`, error.code, error.message);
}

async function pruneGoneSubscriptions(supabaseAdmin: SupabaseClient, endpoints: string[], label: string) {
  if (endpoints.length === 0) return;
  const { error, count } = await supabaseAdmin
    .from("push_subscriptions")
    .delete({ count: "exact" })
    .in("endpoint", endpoints);
  if (error) console.error(`[${label}] 만료 구독 삭제 실패 ${endpoints.length}건`, error.message);
  else console.info(`[${label}] 만료 구독 삭제 ${count ?? endpoints.length}건 (404/410)`);
}

export async function sendDealPush(dealId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { sentCount: 0, total: 0, demo: true };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: deal, error: dealError } = await supabaseAdmin
    .from("deals")
    .select("id, title, category_id, region_id, deal_price, original_price, price_mode, quantity_unit, price_unit, stock_type, images, status, closes_at, push_sent_at")
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

  const agreedIds = await fetchDealAlertAgreedIds(supabaseAdmin);
  if (!agreedIds) return { sentCount: 0, total: 0, skipped: "consent_error" };

  // 먼저 차지한 쪽만 발송 (push_sent_at is null 조건부 update)
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("deals")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", deal.id)
    .is("push_sent_at", null)
    .select("id");
  if (claimError) {
    // DB 오류는 "이미 발송됨"(0행)과 구분 — 발송하지 않고 로그만 남김
    console.error(`[sendDealPush] claim_error deal=${deal.id}`, claimError);
    return { sentCount: 0, total: 0, skipped: "claim_error" };
  }
  if (!claimed?.length) {
    return { sentCount: 0, total: 0, skipped: "이미 발송됨" };
  }

  // 할인율은 정상가가 있을 때만 (없으면 생략). 2026-10-04: 가격 협의 매물은 할인율 없이 가격 자리에 "가격 협의"(src/lib/priceMode.ts pushPriceParts)
  const { discountPrefix, priceText } = pushPriceParts(deal);
  const stockBadge = stockTypeBadge(deal.stock_type);
  const stockTypePrefix = stockBadge ? `${stockBadge} · ` : "";

  // 2026-10-04: 대상 = 이 카테고리를 고른 회원 ∩ push_opt_out 아님 ∩ deal_alert_ad 최신 agreed·현재 버전 ∩ (아래) 구독 보유. 지역 조건 없음.
  const { data: catMembers } = await supabaseAdmin
    .from("member_categories")
    .select("member_id")
    .eq("category_id", deal.category_id);

  const catMemberIds = (catMembers ?? []).map((m) => m.member_id);

  // 알림 끄기(push_opt_out)한 회원 제외 — 끌 때 구독도 지우지만 이중 안전장치.
  // 대상 id를 .in()으로 또 넘기면 URL이 길어지니, 수가 적은 opt-out 쪽을 따로 조회한다.
  const { data: optedOutRows } = await supabaseAdmin.from("members").select("id").eq("push_opt_out", true);
  const optedOut = new Set((optedOutRows ?? []).map((m) => m.id));

  // 대상 선정 규칙은 src/lib/dealMatching.ts selectDealAlertMembers (단위 시험 scripts/alert-target-test.mts)
  const memberIds = selectDealAlertMembers({ categoryMemberIds: catMemberIds, optedOut, agreed: agreedIds });

  if (memberIds.length === 0) {
    return { sentCount: 0, total: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, member_id, endpoint, p256dh, auth_key")
    .in("member_id", memberIds);

  let sentCount = 0;
  const gone: string[] = [];
  const delivered: string[] = [];

  for (const sub of subs ?? []) {
    // 2026-10-01: 어느 구독으로 보냈는지(subscription_id) — 컬럼이 없으면(SQL 전) 예전 칸만으로 다시 기록
    const first = await supabaseAdmin
      .from("notification_logs")
      .insert({ deal_id: deal.id, member_id: sub.member_id, channel: "webpush", status: "sent", subscription_id: sub.id })
      .select("id")
      .single();
    let logRow = first.data;
    if (first.error) {
      ({ data: logRow } = await supabaseAdmin
        .from("notification_logs")
        .insert({ deal_id: deal.id, member_id: sub.member_id, channel: "webpush", status: "sent" })
        .select("id")
        .single());
    }

    try {
      if (!ensureVapid()) throw new Error("vapid_unavailable"); // → catch에서 notification_logs failed
      {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({
            title: "(광고) 덤핑점핑 · 새 매물",
            // 재고 유형 배지를 앞에 (general이면 없음) — 예: "⏰ 소비기한 임박 · 냉동 삼겹살 · 36%↓ · 398,000원/박스\n알림 끄기: MY > 이 기기 푸시 알림"
            body: `${stockTypePrefix}${deal.title} · ${discountPrefix}${priceText}\n${OPT_OUT_LINE}`,
            url: `/deals/${deal.id}`,
            tag: `deal-${deal.id}`,
            image: deal.images?.[0] || undefined,
            logId: logRow?.id,
          }),
          PUSH_SEND_OPTIONS
        );
      }
      sentCount++;
      delivered.push(sub.id);
    } catch (e) {
      if (isGoneSubscription(e)) gone.push(sub.endpoint);
      if (logRow?.id) {
        const { error: failError } = await supabaseAdmin
          .from("notification_logs")
          .update({ status: "failed", ...pushErrorInfo(e) })
          .eq("id", logRow.id);
        if (failError) await supabaseAdmin.from("notification_logs").update({ status: "failed" }).eq("id", logRow.id);
      }
    }
  }
  await markDelivered(supabaseAdmin, delivered, "sendDealPush");
  await pruneGoneSubscriptions(supabaseAdmin, gone, "sendDealPush");

  return { sentCount, total: subs?.length ?? 0 };
}

// 2026-09-28: 긴급 공지(부동산·설비 처분 등) 알림 — 재고 매물 알림(sendDealPush)과
// 달리 카테고리 매칭이 없고, notice_alerts_opt_in을 켠 회원만 대상.
// 2026-10-04: 지역 조건 없음 — 공지의 지역(region_id)은 표시용일 뿐, 대상 = 긴급 공지 알림을 켠 회원 ∩ push_opt_out 아님 ∩
// deal_alert_ad 최신 agreed·현재 버전 ∩ 구독 보유 전원(매물 알림과 같은 규칙에서 카테고리·지역만 뺌).
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
  const agreedIds = await fetchDealAlertAgreedIds(supabaseAdmin);
  if (!agreedIds) return { sentCount: 0, total: 0, skipped: "consent_error" };
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("urgent_notices")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", notice.id)
    .is("push_sent_at", null)
    .select("id");
  if (claimError) {
    console.error(`[sendNoticePush] claim_error notice=${notice.id}`, claimError);
    return { sentCount: 0, total: 0, skipped: "claim_error" };
  }
  if (!claimed?.length) {
    return { sentCount: 0, total: 0, skipped: "이미 발송됨" };
  }

  const { data: optedIn } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("notice_alerts_opt_in", true)
    .eq("push_opt_out", false);

  // 긴급 공지 opt-in에 더해 매물 알림 수신 동의(광고성 정보)도 있어야 함. 지역은 보지 않음(단위 시험 scripts/alert-target-test.mts)
  const memberIds = selectNoticeAlertMembers({
    noticeOptInIds: (optedIn ?? []).map((m) => m.id),
    optedOut: new Set<string>(), // 위 조회에서 push_opt_out = false만 가져옴
    agreed: agreedIds,
  });

  if (memberIds.length === 0) {
    return { sentCount: 0, total: 0 };
  }

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, member_id, endpoint, p256dh, auth_key")
    .in("member_id", memberIds);

  let sentCount = 0;
  const gone: string[] = [];
  const delivered: string[] = [];

  for (const sub of subs ?? []) {
    try {
      if (!ensureVapid()) throw new Error("vapid_unavailable");
      {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({
            title: `(광고) 덤핑점핑 · 긴급 공지 · ${notice.category}`,
            body: `${notice.title}\n${OPT_OUT_LINE}`,
            url: `/notices`,
            tag: `notice-${notice.id}`,
            image: notice.images?.[0] || undefined,
          }),
          PUSH_SEND_OPTIONS
        );
      }
      sentCount++;
      delivered.push(sub.id);
    } catch (e) {
      // 구독 만료 등 — deals 알림과 달리 notification_logs에 남기지 않음(공지는
      // North Star 클릭률 측정 대상이 아니라 별도 로그 테이블이 필요 없다고 판단)
      if (isGoneSubscription(e)) gone.push(sub.endpoint);
      else console.warn("[sendNoticePush] 발송 실패", pushErrorInfo(e));
    }
  }
  await markDelivered(supabaseAdmin, delivered, "sendNoticePush");
  await pruneGoneSubscriptions(supabaseAdmin, gone, "sendNoticePush");

  return { sentCount, total: subs?.length ?? 0 };
}

// 2026-10-03: 판매자 연결 요청 알림은 건마다 따로 보이게 tag를 매번 다르게 — 예전엔 모든 관리자 알림이 tag "admin-lead" 하나라
// 새 알림이 알림창의 이전 알림을 덮어써서(회원 연결 → 비회원 연결) 한 건이 안 온 것처럼 보일 수 있었음.
export function adminConnectionTag() {
  return `admin-connection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 관리자 알림 받는 사람: admin_users 전원(역할 무관)의 번호와 같은 번호로 가입한 회원 계정의 모든 기기 구독(push_subscriptions).
// push_opt_out·매물 알림 동의는 보지 않음(운영 알림). 2026-10-03: 번호 비교를 normalizePhone으로 — admin_users.phone이
// "+8210…"·하이픈 형식이면 members.phone("010…")과 숫자만 비교해선 안 맞아 알림이 안 갔음.
export async function sendAdminPush(title: string, body: string, url: string, tag = adminConnectionTag()) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !ensureVapid()) return;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: admins } = await supabaseAdmin.from("admin_users").select("phone");
  const adminPhoneDigits = new Set((admins ?? []).map((a) => normalizePhone(a.phone)).filter(Boolean));
  if (adminPhoneDigits.size === 0) return;

  const { data: members } = await supabaseAdmin.from("members").select("id, phone");
  const adminMemberIds = (members ?? [])
    .filter((m) => adminPhoneDigits.has(normalizePhone(m.phone)))
    .map((m) => m.id);
  if (adminMemberIds.length === 0) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .in("member_id", adminMemberIds);

  const gone: string[] = [];
  const delivered: string[] = [];
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({ title, body, url, tag }),
        PUSH_SEND_OPTIONS
      );
      delivered.push(sub.id);
    } catch (e) {
      // 운영자 알림은 베스트에포트 — 영구 해지(410/404)만 정리. 403(키 불일치)은 지우지 않고 기록만
      if (isGoneSubscription(e)) gone.push(sub.endpoint);
      else if (isKeyMismatch(e)) console.warn("[sendAdminPush] 403 키 불일치 — 구독 유지", pushErrorInfo(e));
    }
  }
  await markDelivered(supabaseAdmin, delivered, "sendAdminPush");
  await pruneGoneSubscriptions(supabaseAdmin, gone, "sendAdminPush");
}
