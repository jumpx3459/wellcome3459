import Link from "next/link";
import { rem } from "@/lib/rem";
import { BUSINESS_INFO, telHref } from "@/lib/businessInfo";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 알림톡 템플릿 심사용 확인 페이지 최소판 (2026-10-16, feat/confirm-page-stub) — 고정 화면.
// 알림톡 속 확인 링크(/c/<값>)로 들어오면 어떤 값이든 같은 안내를 보여 준다. DB·API 호출 없음.
// 주소의 <값>은 읽지도 화면에 찍지도 검사·저장·로그하지도 않는다(그래서 params를 받지 않음).
// 연락처는 businessInfo.ts 값만 쓴다(고객센터 전화·카카오톡 채널 문의 주소). 검색 제외는 부르는 page.tsx의 metadata.
export default function ConfirmStub() {
  const b = BUSINESS_INFO;
  return (
    <main className="flex flex-col min-h-screen bg-white">
      <div className="px-5 pt-5 pb-5" style={{ background: "linear-gradient(120deg, #04101C, #1A4B78)" }}>
        <span className="bg-white rounded-lg px-3 py-2 inline-block shadow-sm">
          <img src="/images/logo.png" alt="덤핑점핑" className="h-8 w-auto" />
        </span>
      </div>
      <div className="px-5 pt-8 pb-8">
        <h1 className="font-display" style={{ fontSize: rem(23), color: "#0B2540", letterSpacing: "-0.02em", lineHeight: 1.35 }}>
          확인 링크
        </h1>
        <p className="mt-3" style={{ fontSize: rem(16), color: "#495057", lineHeight: 1.65 }}>
          이 링크는 덤핑점핑 점핑매니저가 보낸 확인용 링크예요.
          <br />
          링크가 만료됐거나 올바르지 않으면 아래로 문의해 주세요.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <a href={b.kakaoChannel.url} target="_blank" rel="noopener noreferrer" className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
            카카오톡 채널로 문의
          </a>
          <a href={telHref(b.tel)} className={`w-full ${BTN_CLASS}`} style={btnStyle("secondary")}>
            고객센터 전화 {b.tel}
          </a>
          <Link href="/" className={`w-full ${BTN_CLASS}`} style={btnStyle("secondary")}>
            덤핑점핑 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
