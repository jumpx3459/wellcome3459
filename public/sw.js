// 덤핑점핑 알림 서비스워커
// 서버에서 푸시가 오면 이 스크립트가 백그라운드에서 실행되어
// 카카오톡 같은 중간 채널 없이 기기(브라우저/PWA)에 직접 알림을 띄웁니다.
//
// 참고: 알라미 같은 네이티브 앱의 "전체화면 강제 알람"은 OS가 알람/전화 앱에만
// 허용하는 Full-Screen Intent 권한이 필요해서 웹에서는 불가능합니다.
// 아래는 웹 푸시(Notification API)가 낼 수 있는 최대 강도 설정입니다.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "덤핑점핑", body: event.data.text() };
  }

  const title = payload.title || "🔥 덤핑점핑 · 마감 임박";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    image: payload.image, // 매물 사진이 있으면 알림에 크게 표시 (지원 브라우저에서)
    data: { url: payload.url || "/deals", logId: payload.logId },
    requireInteraction: true, // 유저가 직접 닫기 전까지 화면에 계속 남아있음
    renotify: true, // 같은 매물이어도 매번 다시 진동·소리 울림
    tag: payload.tag || "jumpingbid-deal",
    silent: false, // 무음 금지 — 기기 기본 알림음 재생
    vibrate: [300, 100, 300, 100, 300, 100, 500], // 길고 반복되는 진동 패턴 (모바일)
    actions: [
      { action: "view", title: "지금 확인하기" },
      { action: "dismiss", title: "닫기" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/deals";
  const logId = event.notification.data?.logId;

  const openClient = clients.matchAll({ type: "window" }).then((clientList) => {
    for (const client of clientList) {
      if (client.url.includes(url) && "focus" in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  });

  const logClick = logId
    ? fetch("/api/notification-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      }).catch(() => {})
    : Promise.resolve();

  event.waitUntil(Promise.all([openClient, logClick]));
});
