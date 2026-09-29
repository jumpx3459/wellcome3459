"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { UI_DESC, UI_LINK, UI_META, BTN_CLASS, btnStyle } from "@/lib/uiText";

// 추천 링크 [링크 복사] [링크 공유] [QR 코드] (2026-09-29) — MY 점핑파트너·"내 추천 회원" 화면 공용.
// 공유: 기기 공유창(navigator.share)이 있으면 그걸로, 없으면 링크 복사로 대신.
export default function ReferralShareButtons({
  refUrl,
  shareText,
  showUrl = true,
}: {
  refUrl: string;
  shareText: string; // 공유창에 넣을 문구 (링크 포함)
  showUrl?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(refUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 접근 실패 — 무시
    }
  };

  const share = async () => {
    if (!refUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "덤핑점핑", text: shareText });
      } catch {
        // 사용자가 공유를 취소한 경우 — 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(refUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // 클립보드 접근 실패 — 무시
    }
  };

  const tile = "flex flex-col items-center gap-1 rounded-2xl bg-white border border-gray200";
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={copy} className={tile} style={{ padding: "14px 8px" }}>
          {copied ? <CheckCircle className="w-5 h-5" style={{ color: "#2F9E44" }} /> : <span className="text-xl leading-none">🔗</span>}
          <span className="text-navy" style={UI_LINK}>{copied ? "복사됨" : "링크 복사"}</span>
        </button>
        <button type="button" onClick={share} aria-label="추천 링크 공유" className={tile} style={{ padding: "14px 8px" }}>
          {shared ? <CheckCircle className="w-5 h-5" style={{ color: "#2F9E44" }} /> : <span className="text-xl leading-none">📤</span>}
          <span className="text-navy" style={UI_LINK}>{shared ? "공유됨" : "링크 공유"}</span>
        </button>
        <button type="button" onClick={() => setQrOpen(true)} className={tile} style={{ padding: "14px 8px" }}>
          <span className="text-xl leading-none">⬛</span>
          <span className="text-navy" style={UI_LINK}>QR 코드</span>
        </button>
      </div>
      {showUrl && refUrl && (
        <p className="mt-2" style={{ ...UI_META, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{refUrl}</p>
      )}

      {qrOpen && refUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setQrOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl flex flex-col items-center" style={{ padding: "28px 24px 32px" }} onClick={(e) => e.stopPropagation()}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(refUrl)}`}
              alt="추천 링크 QR 코드"
              className="w-44 h-44 rounded-xl border border-gray200"
            />
            <p className="mt-3 text-center" style={UI_DESC}>
              명함 대신 QR로 보여주세요 · 스캔하면 제 추천으로 가입돼요
            </p>
            <button type="button" onClick={() => setQrOpen(false)} className={`mt-4 w-full ${BTN_CLASS}`} style={btnStyle("secondary")}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
