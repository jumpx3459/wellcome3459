"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_EXPIRED_EVENT } from "@/lib/authFetch";
import { rem } from "@/lib/rem";

// authFetch가 토큰 갱신 후에도 401을 받으면 뜨는 안내 (2026-09-29). 화면 하단 탭 위에 고정.
export default function AuthExpiredNotice() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onExpired = () => setShow(true);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  if (!show) return null;
  return (
    <div
      role="alert"
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-3"
      style={{ bottom: "calc(var(--nav-bottom) + 12px)" }}
    >
      <div className="flex items-center gap-2 rounded-2xl text-white shadow-lg" style={{ background: "#0B2540", padding: "12px 12px 12px 16px" }}>
        <span className="flex-1 min-w-0 font-bold" style={{ fontSize: rem(15) }}>로그인이 만료됐어요. 다시 로그인해주세요</span>
        <Link
          href={`/login?returnTo=${encodeURIComponent(pathname || "/mypage")}`}
          className="flex-shrink-0 font-black rounded-full"
          style={{ background: "#fff", color: "#0B2540", padding: "8px 14px", fontSize: rem(14) }}
          onClick={() => setShow(false)}
        >
          로그인
        </Link>
        <button type="button" aria-label="닫기" onClick={() => setShow(false)} style={{ width: 32, height: 32, fontSize: rem(20), color: "rgba(255,255,255,.8)" }}>
          ×
        </button>
      </div>
    </div>
  );
}
