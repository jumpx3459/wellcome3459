import { rem } from "@/lib/rem";

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
  );
}
