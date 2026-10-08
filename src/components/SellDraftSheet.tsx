"use client";

import { useId } from "react";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import { rem } from "@/lib/rem";
import { formatDraftTime, type StoredSellDraft } from "@/lib/sellDraft";

// /sell 진입 때 이 기기에 작성하던 내용이 있으면 묻는 창 (2026-10-07 PR 3) — 바깥을 눌러도 닫히지 않음(둘 중 하나를 골라야 함)
export default function SellDraftSheet({
  draft,
  onResume,
  onDiscard,
}: {
  draft: StoredSellDraft;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const titleId = useId();
  const name = draft.data.productName?.trim() || "상품명 없음";
  const photos = Array.isArray(draft.data.images) ? draft.data.images.filter((u): u is string => typeof u === "string") : [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(15,31,58,0.55)" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white w-full max-w-md"
        style={{ borderRadius: "20px 20px 0 0", padding: "22px 16px calc(18px + env(safe-area-inset-bottom))" }}
      >
        <h2 id={titleId} style={{ fontSize: rem(20), fontWeight: 800, color: "#0B2540", lineHeight: 1.35 }}>
          작성하던 내용이 있어요
        </h2>
        <p className="mt-1.5" style={{ fontSize: rem(15), color: "#6b7280", lineHeight: 1.5 }}>
          {formatDraftTime(draft.savedAt)}에 쓰던 내용
          <br />
          {name}
          {photos.length > 0 && ` · 사진 ${photos.length}장`}
        </p>
        {photos.length > 0 && (
          <div className="flex mt-3" style={{ gap: 6 }}>
            {photos.slice(0, 3).map((url) => (
              <img key={url} src={url} alt="" className="object-cover" style={{ width: 56, height: 56, borderRadius: 10, border: "1px solid #E4E7EB" }} />
            ))}
          </div>
        )}
        <button type="button" onClick={onResume} className={`w-full mt-5 ${BTN_CLASS}`} style={btnStyle("primary")}>
          이어서 쓰기
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="w-full mt-1.5 flex items-center justify-center underline"
          style={{ minHeight: 44, fontSize: rem(16), color: "#6b7280" }}
        >
          새로 쓰기 (지금 내용 지우기)
        </button>
      </div>
    </div>
  );
}
