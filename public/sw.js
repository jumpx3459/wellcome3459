// 덤핑점핑 알림 서비스워커
// 서버에서 푸시가 오면 이 스크립트가 백그라운드에서 실행되어
// 카카오톡 같은 중간 채널 없이 기기(브라우저/PWA)에 직접 알림을 띄웁니다.
//
// 참고: 알라미 같은 네이티브 앱의 "전체화면 강제 알람"은 OS가 알람/전화 앱에만
// 허용하는 Full-Screen Intent 권한이 필요해서 웹에서는 불가능합니다.
// 아래는 웹 푸시(Notification API)가 낼 수 있는 최대 강도 설정입니다.

// 2026-10-06: 새 sw.js를 받으면 기다리지 않고 바로 적용(설치 즉시 대기 건너뛰기 + 열린 화면도 새 워커가 맡음).
// 캐시(fetch 처리)는 하지 않으므로 화면 내용에는 영향 없음 — 푸시·알림 클릭 처리만 새 버전으로 바뀜.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "덤핑점핑", body: event.data.text() };
  }

  const title = payload.title || "(광고) 덤핑점핑";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    image: payload.image, // 매물 사진이 있으면 알림에 크게 표시 (지원 브라우저에서)
    data: { url: payload.url || "/deals", logId: payload.logId },
    requireInteraction: false, // 2026-09-30: 광고성 알림이 닫을 때까지 화면에 남지 않도록 (기기 기본 동작)
    silent: false, // 무음 금지 — 기기 기본 알림음 재생
    vibrate: [200, 100, 200], // 짧은 두 번 진동 (모바일, 2026-09-30 약 1.7초 → 0.5초)
    actions: [
      { action: "view", title: "지금 확인하기" },
      { action: "dismiss", title: "닫기" },
    ],
  };

  // tag는 매물별(deal-<id>)·공지별(notice-<id>)로 서로 달라야 함 — 고정 tag로 교체되면 알림음이 안 날 수 있음.
  // 서버가 tag를 보내면 그대로, 없으면 url(/deals/<id>)에서 매물 id를 뽑고, 그것도 없으면 tag를 아예 넣지 않음.
  // renotify는 tag가 있을 때만(tag 없이 renotify:true면 showNotification이 TypeError로 실패).
  const dealMatch = /^\/deals\/([^/?#]+)/.exec(payload.url || "");
  const tag = payload.tag || (dealMatch ? `deal-${dealMatch[1]}` : "");
  if (tag) {
    options.tag = tag;
    options.renotify = true; // 같은 tag여도 매번 다시 진동·소리 울림
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const path = event.notification.data?.url || "/deals";
  const logId = event.notification.data?.logId;

  // 비정식 주소(xxx.vercel.app)에서 구독한 기기는 알림을 누르면 그 주소로 열렸음 —
  // 그 경우에만 정식 주소 기준으로 연다. 정식 주소/localhost는 기존처럼 같은 origin 상대경로.
  // (정적 파일이라 env를 못 읽어서 src/lib/siteUrl.ts의 SITE_URL과 같은 값을 직접 적음)
  const SITE_URL = "https://www.dumpingjumping.com";
  const url = self.location.hostname.endsWith(".vercel.app") ? new URL(path, SITE_URL).href : path;

  // 2026-10-27: 절대 주소로 통일 + 열린 창이 있어도 알림의 주소로 이동하고, 실패하면 새 창으로(대체 동작).
  // 예전엔 열린 창의 주소에 알림 주소가 "포함"되기만 하면 focus만 하고 끝 — 같은 매물이 이미 열려 있거나 기본값 /deals일 때
  // 눌러도 화면이 안 바뀌어 무반응처럼 보였고, focus가 거부되면 대체 동작이 없었음. 경로는 정확히 비교(/deals/abc ≠ /deals/abcd)
  const target = new URL(url, self.location.origin).href;
  const openClient = (async () => {
    try {
      const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const targetUrl = new URL(target);
      const sameOrigin = list.filter((c) => new URL(c.url).origin === targetUrl.origin);
      const exact = sameOrigin.find((c) => new URL(c.url).pathname === targetUrl.pathname);
      const win = exact || sameOrigin[0];
      if (win) {
        await win.focus();
        if (!exact && "navigate" in win) await win.navigate(target); // 다른 화면이 열려 있으면 그 창을 알림 매물로 이동
        return;
      }
    } catch {
      // focus·navigate 거부 등 → 아래 새 창 열기로
    }
    if (clients.openWindow) await clients.openWindow(target);
  })();

  const logClick = logId
    ? fetch("/api/notification-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      }).catch(() => {})
    : Promise.resolve();

  event.waitUntil(Promise.all([openClient, logClick]));
});
