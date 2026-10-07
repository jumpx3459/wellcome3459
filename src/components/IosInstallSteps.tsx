import { rem } from "@/lib/rem";
import { BUSINESS_INFO } from "@/lib/businessInfo";

// iPhone "홈 화면에 추가" 안내(2026-10-03 4단계 — 홈 화면 앱은 사파리와 저장소가 달라 로그인이 풀려 있음) — 설치 안내(InstallAppButton)와 알림 안내(PushBlockerNotice)가
// 같은 문구·디자인을 쓰도록 한 곳에 둔다 (2026-09-29).
export const IOS_INSTALL_TITLE = "iPhone은 홈 화면에 추가해야 알림을 받을 수 있어요";

const STEPS: React.ReactNode[] = [
  <>사파리 아래쪽 <b>공유 버튼(□↑)</b> 누르기</>,
  <><b>&quot;홈 화면에 추가&quot;</b> 선택</>,
  <>홈 화면에 생긴 앱 열기</>,
  <>홈 화면 앱에서 <b>한 번 더 로그인</b>하면 알림을 켤 수 있어요</>,
];

export default function IosInstallSteps() {
  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-center gap-2.5" style={{ fontSize: rem(15), color: "#1A1F26" }}>
            <span
              className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
              style={{ width: 26, height: 26, background: "#0B2540", fontSize: rem(13) }}
            >
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {/* 2026-10-07: 40~60대가 4단계에서 막힐 때 바로 물어볼 수 있게 — 기존 카톡 채널 채팅 링크 */}
      <p className="flex items-center gap-2 flex-wrap" style={{ marginTop: 12, fontSize: rem(14), color: "#4B5563" }}>
        어려우시면
        <a
          href={BUSINESS_INFO.kakaoChannel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold rounded-full"
          style={{ border: "1.5px solid #0B2540", color: "#0B2540", padding: "6px 12px", background: "#fff" }}
        >
          카톡으로 물어보기
        </a>
      </p>
    </>
  );
}
