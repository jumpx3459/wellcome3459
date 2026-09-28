"use client";

import { useState } from "react";
import { isKakaoInApp, type PushBlocker } from "@/lib/browserEnv";
import { openExternal, copyCurrentUrl } from "@/lib/openExternal";
import { rem } from "@/lib/rem";

// 웹푸시를 받을 수 없는 환경(인앱 브라우저 / iPhone 홈 화면 미설치) 안내 — PushStatusCard·가입 화면 공용.
// 이 상태에선 [알림 켜기]를 누르게 하지 않는다(눌러도 실패).
export default function PushBlockerNotice({ kind }: { kind: PushBlocker }) {
  const [manual, setManual] = useState(false); // iOS 인앱(카톡 외) — 자동으로 못 여는 경우
  const [copied, setCopied] = useState<boolean | null>(null);

  if (kind === "ios_needs_install") {
    return (
      <div className="rounded-lg leading-relaxed" style={{ background: "#F5F6F8", padding: "12px 14px", fontSize: rem(14), color: "#1A1F26" }}>
        <p className="font-bold">iPhone은 홈 화면에 추가해야 알림을 받을 수 있어요</p>
        <ol className="mt-1.5 list-decimal pl-5" style={{ color: "#495057" }}>
          <li>Safari 아래쪽 공유 버튼(□↑) 누르기</li>
          <li>&quot;홈 화면에 추가&quot; 선택</li>
          <li>홈 화면에 생긴 앱을 열고 [알림 켜기]</li>
        </ol>
      </div>
    );
  }

  const open = () => {
    if (!openExternal()) setManual(true);
  };

  return (
    <div className="rounded-lg leading-relaxed" style={{ background: "#FFF4E0", padding: "12px 14px", fontSize: rem(14), color: "#1A1F26" }}>
      <p className="font-bold">{isKakaoInApp() ? "카카오톡" : "이 앱"} 안에서는 새 매물 알림을 받을 수 없어요</p>
      {!manual ? (
        <button
          type="button"
          onClick={open}
          className="mt-2 w-full font-bold rounded-lg text-white"
          style={{ background: "#0B2540", padding: "10px 0", fontSize: rem(14) }}
        >
          외부 브라우저로 열기
        </button>
      ) : (
        <>
          <p className="mt-1.5" style={{ color: "#495057" }}>
            화면 오른쪽 위 <b>···</b> 메뉴 → <b>Safari로 열기</b>를 눌러주세요.
          </p>
          <button
            type="button"
            onClick={async () => setCopied(await copyCurrentUrl())}
            className="mt-2 w-full font-bold rounded-lg"
            style={{ border: "1.5px solid #0B2540", color: "#0B2540", padding: "9px 0", fontSize: rem(14) }}
          >
            {copied ? "링크 복사됨 ✓" : "링크 복사"}
          </button>
          {copied === false && (
            <p className="mt-1.5 break-all" style={{ color: "#495057", fontSize: rem(13) }}>
              {typeof window !== "undefined" ? window.location.href : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
