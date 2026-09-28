"use client";

import { useEffect, useState } from "react";
import { rem } from "@/lib/rem";
import { isInAppBrowser, isIOS as detectIOS, isStandalone as detectStandalone } from "@/lib/browserEnv";
import IosInstallSteps, { IOS_INSTALL_TITLE } from "@/components/IosInstallSteps";

// 표준 타입에 없는 크로미움 전용 PWA 설치 이벤트.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// 홈/알림함 등에서 "설치 배너 자체를 보여줄지"를 미리 판단할 때 씁니다.
// beforeinstallprompt는 페이지당 한 번만 발생하므로, InstallAppButton이 이 훅을
// 따로 또 호출하면 부모가 이미 이벤트를 가로챈 뒤라 자기 몫은 영영 못 받아 null만
// 반환합니다 — 부모의 테두리·닫기버튼만 남고 내용은 빈 박스가 되는 원인.
// 그래서 canInstall/promptInstall은 반드시 부모가 이 훅으로 한 번만 구해서
// props로 내려줘야 합니다 (컴포넌트 내부에서 재호출 금지).
//
// 2026-09-26: canInstall을 "네이티브 beforeinstallprompt 발생 여부"에만 묶어두면
// Chrome이 자체 engagement 휴리스틱으로 그 이벤트를 억제(재방문/재설치 후 한동안
// 재발화 안 함)할 때 설치 배너가 통째로 사라진다 — 사용자에게는 "설치 화면이
// 다시 안 뜬다"로 보임. 네이티브 이벤트는 프롬프트 트리거 수단일 뿐이고, 배너
// 노출 여부는 "아직 설치 안 된 상태(!isStandalone)"만으로 판단하도록 분리.
// 클릭 시 네이티브 프롬프트가 있으면 그걸 쓰고, 없으면(iOS든 Android/기타
// 브라우저든) 수동 안내 모달로 폴백한다.
export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  // 판별 전엔 배너를 띄우지 않음(인앱에서 잠깐 보였다 사라지는 깜빡임 방지)
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    // 2026-09-29: 상황별로 안내는 하나만 — 설치 앱(standalone)이면 숨김, 인앱 브라우저는 설치가
    // 안 되므로 숨김(대신 InAppBanner가 크롬/사파리로 유도). 예전엔 인앱에서도 떴었음.
    setEligible(!detectStandalone() && !isInAppBrowser());
    setIsIOS(detectIOS());

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // 설치 안 된 상태면 항상 배너를 보여준다. 네이티브 프롬프트가 아직
  // 안 쏘여도(브라우저 쿨다운 등) 최소한 수동 설치 경로는 열어둔다.
  const canInstall = eligible;

  const promptInstall = async (): Promise<"prompted" | "ios-guide" | "manual-guide"> => {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") setInstallEvent(null);
      return "prompted";
    }
    if (isIOS) return "ios-guide";
    return "manual-guide";
  };

  return { canInstall, promptInstall };
}

export default function InstallAppButton({
  canInstall,
  promptInstall,
}: {
  canInstall: boolean;
  promptInstall: () => Promise<"prompted" | "ios-guide" | "manual-guide">;
}) {
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  useEffect(() => setIsIOSDevice(detectIOS()), []);

  if (!canInstall) return null;

  const handleClick = async () => {
    const result = await promptInstall();
    if (result === "ios-guide") setShowIOSGuide(true);
    if (result === "manual-guide") setShowManualGuide(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-2.5 text-left"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        <span className="flex-shrink-0" style={{ fontSize: rem(22) }}>📲</span>
        <span className="flex-1 min-w-0">
          {/* 2026-09-27: "앱처럼 열 수 있다"는 기능 설명보다, 실제 혜택(마감 임박
              매물을 더 빨리 받는다)을 앞세우는 카피로 변경. 구체적 쿠폰/금액은
              실제 지급 로직이 없어 표기하지 않음. */}
          <span className="block font-bold" style={{ fontSize: rem(13.5), color: "#0B2540" }}>홈 화면에 추가하기</span>
          <span className="block mt-0.5" style={{ fontSize: rem(11.5), color: "#6B7480" }}>
            {isIOSDevice ? IOS_INSTALL_TITLE : "설치하면 마감 임박 알림을 가장 먼저 받아요"}
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
            {/* 알림 안내(PushBlockerNotice)와 같은 문구·디자인 — IosInstallSteps */}
            <div className="font-bold mb-4" style={{ fontSize: rem(17), color: "#0B2540" }}>{IOS_INSTALL_TITLE}</div>
            <IosInstallSteps />
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full text-center font-bold rounded-xl py-3 bg-gray100 text-gray500"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 2026-09-26: Chrome이 beforeinstallprompt를 아직/다시 안 쏜 Android·PC
          브라우저용 폴백 안내. 네이티브 미니 인포바가 없어도 최소한 수동 설치
          경로는 항상 열어둔다. */}
      {showManualGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowManualGuide(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-xl text-navy mb-5">홈 화면에 설치하는 방법</div>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex-shrink-0">
                  1
                </span>
                <div className="text-sm text-gray900">
                  브라우저 오른쪽 위 <b>메뉴(⋮)</b> 를 눌러주세요
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex-shrink-0">
                  2
                </span>
                <div className="text-sm text-gray900">
                  <b>&quot;앱 설치&quot;</b> 또는 <b>&quot;홈 화면에 추가&quot;</b>를 찾아 눌러주세요
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-navy text-white text-sm font-bold flex-shrink-0">
                  3
                </span>
                <div className="text-sm text-gray900">
                  안내에 따라 <b>&quot;설치&quot;</b> 또는 <b>&quot;추가&quot;</b>를 누르면 완료!
                </div>
              </div>
            </div>
            <p className="text-xs text-gray500 mt-4 leading-relaxed">
              메뉴 이름은 브라우저마다 조금씩 다를 수 있어요 (예: Chrome은 &quot;앱 설치&quot;, 삼성인터넷은 &quot;홈 화면에 추가&quot;)
            </p>
            <button
              onClick={() => setShowManualGuide(false)}
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
