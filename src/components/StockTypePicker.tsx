import { STOCK_TYPES, type StockType } from "@/lib/stockType";
import { rem } from "@/lib/rem";

// 재고 유형 선택 — sell 폼·관리자 매물 폼 공용 (2026-09-29). 2열 격자, 모든 칩 같은 폭·높이 52px,
// 아이콘+글자 왼쪽 정렬, 16px. 칸이 좁으면 글자만 두 줄(높이 52px 유지).
export default function StockTypePicker({
  value,
  onChange,
  id,
}: {
  value: StockType;
  onChange: (v: StockType) => void;
  id?: string; // 첫 칩에 붙음 (라벨 htmlFor용)
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="재고 유형">
      {STOCK_TYPES.map((t, i) => {
        const picked = value === t.value;
        return (
          <button
            key={t.value}
            id={i === 0 ? id : undefined}
            type="button"
            data-stock-type={t.value}
            aria-pressed={picked}
            onClick={() => onChange(t.value)}
            className="flex items-center gap-1.5 rounded-xl text-left min-w-0"
            style={{
              height: 52,
              padding: "0 12px",
              fontSize: rem(16),
              fontWeight: 700,
              background: picked ? "#FFF6EF" : "#fff",
              border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
              color: "#1A1F26",
            }}
          >
            <span className="flex-shrink-0" aria-hidden>
              {t.icon}
            </span>
            {/* 폭이 좁은 관리자 폼에선 말줄임 대신 칩 안에서 두 줄 */}
            <span className="min-w-0" style={{ lineHeight: 1.2 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
