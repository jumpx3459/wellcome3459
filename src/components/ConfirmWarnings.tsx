"use client";

import { rem } from "@/lib/rem";

// "확인 후 저장" 경고 (2026-10-01 PR-A [11]) — 매물명·설명 칸 바로 아래 주황 안내 + [그대로 저장].
// 막는 문제(빨강)는 각 폼의 칸 오류로 따로 표시.
export const BLOCK_COLOR = "#DC2626";
export const WARN_COLOR = "#C2410C";

export default function ConfirmWarnings({
  id,
  warnings,
  onConfirm,
  busy,
}: {
  id?: string;
  warnings: string[];
  onConfirm?: () => void; // 없으면 안내만 (같은 폼에서 버튼은 한 곳에만)
  busy?: boolean;
}) {
  if (!warnings.length) return null;
  return (
    <div id={id} className="mt-1.5 rounded-lg" style={{ background: "#FFF7ED", border: "1px solid #FED7AA", padding: "8px 10px" }} data-confirm-warnings>
      <ul className="flex flex-col gap-0.5">
        {warnings.map((w) => (
          <li key={w} style={{ fontSize: rem(14), color: WARN_COLOR, lineHeight: 1.5 }}>· {w}</li>
        ))}
      </ul>
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="mt-2 rounded-lg font-bold disabled:opacity-60"
          style={{ fontSize: rem(14), padding: "6px 12px", background: "#fff", border: `1.5px solid ${WARN_COLOR}`, color: WARN_COLOR }}
        >
          {busy ? "저장 중…" : "확인했어요 · 그대로 저장"}
        </button>
      )}
    </div>
  );
}
