"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { FORM_LABEL_STYLE } from "@/components/FormField";
import { MY_BADGE, MY_DESC, MY_INPUT_FONT_SIZE, MY_META, myBtnStyle } from "@/lib/myText"; // MY 전용 글자 크기 (2026-10-12)
import { BTN_CLASS } from "@/lib/uiText";
import { kstMonthDay, statusWord, type SelfCheckResponse } from "@/lib/memberBusinessCheck";

// 2026-11-05 1단계: 회원 사업자 셀프 확인 카드 — 사업자번호·대표자명·개업일자로 국세청 진위확인(POST /api/business-check).
// 게이트 아님(연락처 보기·연결과 무관). 이 카드는 mypage가 NEXT_PUBLIC_SELF_BIZ_CHECK=on일 때만 그림(기본 off).
// 이미 business_verified(수동 승인 포함)면 입력칸을 숨기고 완료 표시. 사업자등록증 업로드는 아래 칸에서 "자동 확인이 안 되면" 보조 경로.

const MSG = {
  mismatch: "입력하신 정보가 국세청 등록 정보와 달라요. 사업자등록증의 번호·대표자명·개업일을 확인해 주세요.",
  unavailable: "국세청 조회가 잠시 안 돼요. 잠시 후 다시 시도해 주세요.",
  limited: "오늘 확인 횟수를 모두 썼어요. 내일 다시 시도하거나 사업자등록증을 올려 주세요.",
} as const;

type Done = { checkedAt: string | null; statusCode: string | null };

const inputCls = "w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange";
const inputStyle = { height: "54px", fontSize: MY_INPUT_FONT_SIZE } as const;

export default function BusinessSelfCheckCard({
  verified,
  onVerified,
}: {
  verified: boolean;
  onVerified: () => void;
}) {
  const [bNo, setBNo] = useState("");
  const [rep, setRep] = useState("");
  const [open, setOpen] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  // 인증 완료 상태에서 "국세청 M/D"를 보여 주려고 최근 일치 기록만 조회(국세청 호출·집계 없음)
  useEffect(() => {
    if (!verified || done) return;
    let alive = true;
    (async () => {
      try {
        const res = await authFetch("/api/business-check", { json: { check: true } });
        const data = await res.json().catch(() => null);
        if (alive && res.ok && data?.last) setDone({ checkedAt: data.last.checked_at, statusCode: data.last.status_code ?? null });
      } catch {
        /* 표시 전용 — 실패하면 날짜 없이 완료 표시만 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [verified, done]);

  const submit = async () => {
    if (busy) return;
    setMsg(null);
    setFieldErr(null);
    setBusy(true);
    try {
      const res = await authFetch("/api/business-check", {
        json: { b_no: bNo, rep_name: rep, open_date: open, company_name: company },
      });
      const data = (await res.json().catch(() => null)) as (Partial<SelfCheckResponse> & { error?: string; field?: string }) | null;
      if (res.status === 400) {
        setFieldErr(data?.error ?? "입력을 확인해 주세요.");
      } else if (res.status === 401) {
        setMsg("로그인이 필요해요.");
      } else if (res.status === 429 || data?.result === "limited") {
        setMsg(MSG.limited);
      } else if (data?.result === "verified") {
        setDone({ checkedAt: data.checked_at ?? null, statusCode: data.status_code ?? null });
        onVerified();
      } else if (data?.result === "mismatch") {
        setMsg(MSG.mismatch);
      } else {
        setMsg(MSG.unavailable);
      }
    } catch {
      setMsg(MSG.unavailable);
    } finally {
      setBusy(false);
    }
  };

  if (verified) {
    const word = statusWord(done?.statusCode);
    const trouble = done?.statusCode === "02" || done?.statusCode === "03";
    return (
      <div data-biz-self-card="done" className="rounded-xl border border-gray200 px-4 py-3" style={{ background: "#F4FBF6" }}>
        <div className="flex items-center gap-1.5 flex-wrap" style={FORM_LABEL_STYLE}>
          <span className="px-2 py-0.5 rounded-full" style={{ ...MY_BADGE, background: "#E8F8EC", color: "#1D8A44" }}>
            ✓ 사업자 확인 완료
          </span>
          {done?.checkedAt && (
            <span style={MY_META}>
              · 국세청 {kstMonthDay(done.checkedAt)}
              {trouble && word ? ` · ${word}` : ""}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div data-biz-self-card="form" className="rounded-xl border border-gray200 px-4 py-4">
      <div className="mb-1" style={FORM_LABEL_STYLE}>사업자 확인</div>
      <p className="mb-3" style={MY_DESC}>사업자등록증의 번호·대표자명·개업일을 넣으면 국세청에서 바로 확인해요.</p>
      <div className="flex flex-col gap-2.5">
        <input
          inputMode="numeric"
          data-biz-bno
          className={inputCls}
          style={inputStyle}
          value={bNo}
          onChange={(e) => setBNo(e.target.value)}
          placeholder="사업자등록번호 10자리"
          aria-label="사업자등록번호"
        />
        <input
          data-biz-rep
          className={inputCls}
          style={inputStyle}
          value={rep}
          onChange={(e) => setRep(e.target.value)}
          placeholder="대표자 성명"
          aria-label="대표자 성명"
        />
        <input
          inputMode="numeric"
          data-biz-open
          className={inputCls}
          style={inputStyle}
          value={open}
          onChange={(e) => setOpen(e.target.value)}
          placeholder="개업일자 (예: 20200101)"
          aria-label="개업일자"
        />
        <input
          data-biz-company
          className={inputCls}
          style={inputStyle}
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="상호 (선택)"
          aria-label="상호 (선택)"
        />
      </div>
      {fieldErr && <p data-biz-msg="field" className="text-orange mt-2" style={{ fontSize: MY_META.fontSize }}>{fieldErr}</p>}
      {msg && <p data-biz-msg="result" className="text-orange mt-2" style={{ fontSize: MY_META.fontSize }}>{msg}</p>}
      <button
        type="button"
        data-biz-submit
        onClick={submit}
        disabled={busy}
        className={`w-full mt-3 ${BTN_CLASS}`}
        style={myBtnStyle("primary")}
      >
        {busy ? "확인 중..." : "국세청으로 확인하기"}
      </button>
      <p className="mt-2" style={MY_META}>자동 확인이 안 되면 아래에 사업자등록증을 올려 주세요.</p>
    </div>
  );
}
