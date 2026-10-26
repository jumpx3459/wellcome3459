"use client";

import { useCallback, useEffect, useState } from "react";
import { rem } from "@/lib/rem";
import { DEAL_HINT_STYLE } from "@/components/FormField";
import { canReuseRoot, type ReuseWarning } from "@/lib/businessReuse";
import type { BusinessCheck } from "@/lib/businessCheck";
import { ADMIN_TEXT } from "@/lib/adminText";

// 2026-10-21 확인된 판매자 재사용 — "✓ 확인된 판매자 · YYYY.MM.DD 조회(원본 관리자)" 후보 카드 + [이 기록 재사용].
//   by = { sellerRequestId }(판매 신청 카드: 같은 회원의 이전 신청 기록을 자동으로 찾음) 또는 "bNo 입력"(관리자 등록 폼: 사업자번호 10자리).
//   후보 조회는 국세청을 부르지 않음 — [이 기록 재사용]을 눌렀을 때만 서버가 상태 조회 1번. 자동으로 고르지 않고 관리자가 누른 경우에만 재사용.
//   경고(노란색)는 알려주기만 함 — 막지 않음.

type Candidate = {
  id: string;
  b_no_masked: string | null;
  input_company_name: string | null;
  checked_at: string;
  checked_by_name: string | null;
  exception_ok: boolean;
  over_year: boolean;
};

const WARN_BOX = { background: "#FFF8DB", color: "#7A5B00", fontSize: rem(14), padding: "8px 12px", lineHeight: 1.5 } as const;
const dotDate = (iso: string) => {
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}.${g("month")}.${g("day")}`;
};
function formatBizNoTyping(v: string) {
  const d = v.replace(/[^0-9]/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function ReuseCandidate({
  adminKey,
  adminRole,
  sellerRequestId,
  findByBizNo,
  company,
  phone,
  disabled,
  onReused,
}: {
  adminKey: string;
  adminRole: string | null;
  /** 판매 신청 카드용 — 이 신청과 같은 회원의 이전 신청에서 후보를 찾음 */
  sellerRequestId?: string;
  /** 관리자 등록 폼용 — true면 사업자번호 입력 칸을 보여 줌 */
  findByBizNo?: boolean;
  /** 등록 폼에 적힌 상호·연락처(경고 비교용, 직접 등록일 때만 서버로 보냄) */
  company?: string;
  phone?: string;
  disabled?: boolean;
  /** 재사용 행이 만들어진 뒤 — 부모가 선택 기록 지정·목록 새로고침 */
  onReused: (item: BusinessCheck, warnings: ReuseWarning[]) => void | Promise<void>;
}) {
  const [bNo, setBNo] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null | undefined>(undefined); // undefined = 아직 안 찾음
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ReuseWarning[] | null>(null);
  const [done, setDone] = useState(false);

  const find = useCallback(
    async (query: string) => {
      setLoading(true);
      setError(null);
      setWarnings(null);
      setDone(false);
      try {
        const res = await fetch(`/api/admin/business-checks/reusable?${query}`, { headers: { "x-admin-key": adminKey } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "확인된 판매자를 찾지 못했어요.");
          setCandidate(undefined);
          return;
        }
        setCandidate((data.candidate as Candidate | null) ?? null);
      } catch {
        setError("확인된 판매자를 찾지 못했어요.");
        setCandidate(undefined);
      } finally {
        setLoading(false);
      }
    },
    [adminKey]
  );

  // 판매 신청 카드: 신청을 고르면 같은 회원의 이전 기록을 찾음(국세청 호출 없음)
  useEffect(() => {
    setCandidate(undefined);
    setWarnings(null);
    setDone(false);
    setError(null);
    if (sellerRequestId) void find(`sellerRequestId=${sellerRequestId}`);
  }, [sellerRequestId, find]);

  const digits = bNo.replace(/[^0-9]/g, "");

  const reuse = async () => {
    if (!candidate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/business-checks/reuse", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(sellerRequestId ? { sourceCheckId: candidate.id, sellerRequestId } : { sourceCheckId: candidate.id, company: company ?? "", phone: phone ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 403 ? "예외 확인 건은 최고관리자·관리자만 재사용할 수 있어요." : data.error ?? "재사용하지 못했어요.");
        return;
      }
      setWarnings((data.warnings ?? []) as ReuseWarning[]);
      setDone(true);
      await onReused(data.item as BusinessCheck, (data.warnings ?? []) as ReuseWarning[]);
    } catch {
      setError("재사용하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const blocked = !!candidate && !canReuseRoot(adminRole ?? "", candidate.exception_ok);

  return (
    <div className="min-w-0 flex flex-col gap-2" data-reuse-candidate>
      {findByBizNo && (
        <div className="min-w-0">
          <label className="block mb-1 font-bold" style={{ fontSize: rem(14), color: "#0B2540" }} htmlFor="reuse-bno">
            사업자번호로 확인된 판매자 찾기
          </label>
          <div className="flex gap-2">
            <input
              id="reuse-bno"
              className="flex-1 min-w-0 border-2 border-gray200 rounded-lg px-3 py-2.5 outline-none focus:border-orange bg-white"
              style={{ fontSize: rem(14) }}
              inputMode="numeric"
              placeholder="123-45-67890"
              value={bNo}
              disabled={disabled}
              onChange={(e) => {
                setBNo(formatBizNoTyping(e.target.value));
                setCandidate(undefined);
                setWarnings(null);
                setDone(false);
              }}
            />
            <button
              type="button"
              disabled={disabled || loading || digits.length !== 10}
              onClick={() => void find(`b_no=${digits}`)}
              className="flex-shrink-0 font-bold rounded-lg px-3 border-2 border-gray200 disabled:opacity-50"
              style={{ fontSize: rem(14), color: "#0B2540" }}
            >
              {loading ? "찾는 중…" : "찾기"}
            </button>
          </div>
        </div>
      )}

      {candidate === null && (
        <p style={DEAL_HINT_STYLE} data-reuse-none>
          {findByBizNo ? "이 번호로 확인된 기록이 없어요. 사업자 조회를 먼저 해주세요." : "같은 판매자의 이전 확인 기록이 없어요."}
        </p>
      )}

      {candidate && (
        <div className="rounded-xl min-w-0" style={{ border: "2px solid #BFE6CB", background: "#F3FBF6", padding: "10px 12px" }} data-reuse-card>
          <div className="font-bold" style={{ fontSize: rem(14), color: ADMIN_TEXT.ok }}>
            ✓ 확인된 판매자 · 조회일 {dotDate(candidate.checked_at)}{candidate.checked_by_name ? ` (${candidate.checked_by_name})` : ""}
          </div>
          <div className="mt-0.5 break-words" style={{ fontSize: rem(14), color: "#374151" }}>
            {candidate.input_company_name || "상호 미입력"} · {candidate.b_no_masked ?? ""}
            {candidate.exception_ok ? " · 예외 확인" : ""}
            {candidate.over_year ? " · 1년 경과" : ""}
          </div>
          {blocked ? (
            <p className="mt-1.5" style={{ ...DEAL_HINT_STYLE, color: "#7A5B00" }} data-reuse-blocked>
              예외 확인 건은 최고관리자·관리자만 재사용할 수 있어요. 사업자 조회를 다시 해주세요.
            </p>
          ) : (
            <button
              type="button"
              disabled={disabled || busy || done}
              onClick={() => void reuse()}
              className="mt-2 w-full font-bold rounded-lg py-2 text-white disabled:opacity-60"
              style={{ background: "#0B2540", fontSize: rem(14) }}
              data-reuse-button
            >
              {busy ? "재사용 중…" : done ? "재사용됨" : "이 기록 재사용"}
            </button>
          )}
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="flex flex-col gap-1.5" data-reuse-warnings>
          {warnings.map((w) => (
            <div key={w.code} className="rounded-lg" style={WARN_BOX} data-reuse-warning={w.code}>
              ⚠ {w.text}
            </div>
          ))}
        </div>
      )}
      {done && warnings && warnings.length === 0 && (
        <p style={{ ...DEAL_HINT_STYLE, color: ADMIN_TEXT.ok }} data-reuse-ok>
          재사용했어요. 이번 상태 조회에서도 경고가 없어요.
        </p>
      )}
      {error && (
        <p className="font-medium" style={{ fontSize: rem(14), color: "#DC2626" }} data-reuse-error>
          {error}
        </p>
      )}
    </div>
  );
}
