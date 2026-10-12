import Link from "next/link";
import BusinessFooter from "@/components/BusinessFooter";
import { rem } from "@/lib/rem";
import { UI_DESC, UI_LINK, BTN_CLASS, btnStyle } from "@/lib/uiText";

// 비회원 로그인 안내 화면 — MY·공유(/share) 공용 (2026-10-12 feat/my-menu-share: MY에 있던 화면을 그대로 뽑음).
// returnTo가 있으면 로그인 후 그 화면으로 돌아옴(없으면 로그인 화면 기본 = MY).
export default function LoginRequired({ returnTo }: { returnTo?: string }) {
  const q = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-white">
      {/* 2026-09-27 (재검토): 다크 히어로 톤 대신 화이트 — 로그인 유도 단일 목적 화면이라 화이트 배경이 오렌지 CTA를 더 도드라지게 함.
          로고 80px, 캐릭터는 투명 컷아웃 manager-cut.png */}
      <div className="rounded-xl px-3 py-2 inline-block mb-3">
        <img src="/images/logo.png" alt="덤핑점핑" className="h-20 w-auto" />
      </div>
      <span
        className="rounded-full font-medium mb-6"
        style={{ fontSize: rem(11), color: "#6B7480", padding: "3px 9px", background: "#F0F1F3" }}
      >
        Powered by JumpX
      </span>
      <img
        src="/images/manager-cut.png"
        alt="점핑매니저"
        className="w-24 h-24 object-contain mb-4"
        style={{ filter: "drop-shadow(0 6px 10px rgba(11,37,64,.2))" }}
      />
      <h1 className="font-display text-xl mb-2" style={{ color: "#0B2540" }}>로그인이 필요해요</h1>
      <p className="mb-6" style={UI_DESC}>
        이미 가입하셨다면 번호 인증만으로 바로 들어올 수 있어요.
      </p>
      <Link href={`/login${q}`} className={`px-8 ${BTN_CLASS}`} style={btnStyle("primary")}>
        휴대폰 번호로 로그인
      </Link>
      <Link
        href="/signup"
        className="mt-3 text-center"
        style={{ ...UI_LINK, color: "#6B7480", textDecoration: "underline", textUnderlineOffset: 4 }}
      >
        처음이신가요? 가입하기
      </Link>
      {/* 2026-09-30 (커밋 G): 비로그인 화면에도 사업자 정보 푸터 */}
      <BusinessFooter className="self-stretch -mx-6 mt-10 text-left" />
    </main>
  );
}
