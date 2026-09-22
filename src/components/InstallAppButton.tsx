"use client";

import { useEffect, useState } from "react";

// 표준 타입에 없는 크로미움 전용 PWA 설치 이벤트.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || (!installEvent && !isIOS)) return null;

  const handleClick = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setInstallEvent(null);
      return;
    }
    setShowIOSGuide(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-2.5 text-left"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        <span className="flex-shrink-0" style={{ fontSize: 22 }}>📲</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold" style={{ fontSize: 13.5, color: "#0B2540" }}>홈 화면에 추가하기</span>
          <span className="block mt-0.5" style={{ fontSize: 11.5, color: "#6B7480" }}>
            앱처럼 바로 열고, 마감 알림도 놓치지 마세요
          </span>
        </span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-xl text-navy mb-5">아이폰에 설치하는 방법</div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex-shrink-0">
                  1
                </span>
                <div className="text-sm text-gray900">
                  Safari 하단의 <b>공유 버튼 ⬆️</b> 을 눌러주세요
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex-shrink-0">
                  2
                </span>
                <div className="text-sm text-gray900">
                  메뉴에서 <b>&quot;홈 화면에 추가&quot;</b>를 찾아 눌러주세요
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex-shrink-0">
                  3
                </span>
                <div className="text-sm text-gray900">
                  오른쪽 위 <b>&quot;추가&quot;</b>를 누르면 완료!
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full text-center font-bold rounded-xl py-3 bg-gray100 text-gray500"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
