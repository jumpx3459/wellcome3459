import { rem } from "@/lib/rem";

// 관리자 대시보드 표시 조각 (2026-09-29) — 차트 라이브러리 없이 CSS 막대만.
// 색은 의미 있을 때만: 일반 지표 남색 1색, 오늘/조치 필요만 주황, 0은 회색으로 흐리게.
export const NAVY = "#1B3A5C";
export const ORANGE = "#E25100";
export const MUTED = "#D5DAE0";
export const BIG_NUM = { fontSize: rem(28), fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 } as const;
export const LABEL = { fontSize: rem(14), color: "#6B7480" } as const;
export const CARD = "bg-white border border-gray200 rounded-2xl p-4";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

// 비율 + 진행 바 (예: 알림 활성 회원 12 / 40명 → 30%)
export function RatioMetric({ label, num, den, unit, note }: { label: string; num: number; den: number; unit: string; note?: string }) {
  const p = pct(num, den);
  return (
    <div className={CARD}>
      <div style={LABEL} className="font-bold">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span style={{ ...BIG_NUM, color: p === null ? "#9AA3AD" : "#0B2540" }}>{p === null ? "—" : `${p}%`}</span>
        <span style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>
          {num.toLocaleString()} / {den.toLocaleString()}
          {unit}
        </span>
      </div>
      <div className="mt-2.5 h-2.5 rounded-full overflow-hidden" style={{ background: "#EEF1F4" }} role="img" aria-label={`${label} ${p ?? 0}%`}>
        <div className="h-full rounded-full" style={{ width: `${p ?? 0}%`, background: NAVY }} />
      </div>
      {note && <div className="mt-2" style={LABEL}>{note}</div>}
    </div>
  );
}

// 최근 7일 일별 막대 — 오늘(마지막) 막대만 주황, 0인 날은 얇은 회색 바
export function DailyBars({ title, days, values }: { title: string; days: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const H = 64;
  return (
    <div className={CARD}>
      <div className="flex items-baseline justify-between">
        <span style={LABEL} className="font-bold">{title}</span>
        <span style={{ ...LABEL, fontVariantNumeric: "tabular-nums" }}>7일 합계 <b style={{ color: "#0B2540" }}>{total}</b></span>
      </div>
      <div className="mt-3 flex items-end gap-1.5" style={{ height: H + 22 }}>
        {values.map((v, i) => {
          const today = i === values.length - 1;
          return (
            <div key={days[i]} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${days[i]} ${v}`}>
              <span style={{ fontSize: rem(14), fontVariantNumeric: "tabular-nums", color: v === 0 ? "#B0B7C0" : today ? ORANGE : "#0B2540", fontWeight: today ? 800 : 600 }}>{v}</span>
              <div
                className="w-full rounded-t"
                style={{ height: v === 0 ? 2 : Math.max(6, Math.round((v / max) * H)), background: v === 0 ? MUTED : today ? ORANGE : NAVY, marginTop: 2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {days.map((d, i) => (
          <span key={d} className="flex-1 text-center min-w-0" style={{ fontSize: rem(14), color: i === days.length - 1 ? ORANGE : "#6B7480", fontWeight: i === days.length - 1 ? 800 : 400, fontVariantNumeric: "tabular-nums" }}>
            {i === days.length - 1 ? "오늘" : `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`}
          </span>
        ))}
      </div>
    </div>
  );
}

// 단계 흐름 (전체 리드 → 연락완료 → 성사) — 막대 폭은 첫 단계 대비, 오른쪽에 이전 단계 대비 비율
export function FunnelBars({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value ?? 0;
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s, i) => {
        const prev = i === 0 ? null : steps[i - 1].value;
        const ofPrev = prev === null ? null : pct(s.value, prev);
        const w = first > 0 ? Math.max(s.value > 0 ? 4 : 0, (s.value / first) * 100) : 0;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between">
              <span style={{ fontSize: rem(15), color: "#1F2937" }}>{s.label}</span>
              <span style={{ fontSize: rem(15), fontVariantNumeric: "tabular-nums" }}>
                <b style={{ color: "#0B2540" }}>{s.value}</b>
                {ofPrev !== null && <span style={LABEL}> · 이전 단계의 {ofPrev === null ? "—" : `${ofPrev}%`}</span>}
              </span>
            </div>
            <div className="mt-1 h-3 rounded-full overflow-hidden" style={{ background: "#EEF1F4" }}>
              <div className="h-full rounded-full" style={{ width: `${w}%`, background: s.value === 0 ? MUTED : NAVY }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 표 안 인라인 가로 막대 (최대값 기준)
export function InlineBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <span className="flex-1 h-2 rounded-full overflow-hidden min-w-0" style={{ background: "#EEF1F4" }} aria-hidden>
      <span className="block h-full rounded-full" style={{ width: `${w}%`, background: value === 0 ? MUTED : NAVY }} />
    </span>
  );
}
