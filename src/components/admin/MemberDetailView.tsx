"use client";

import { useEffect, useState, type ReactNode } from "react";
import { rem } from "@/lib/rem";
import { formatMemberNo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { PanelColumn } from "@/components/admin/AdminFullscreenPanel";
import { manualCheckText, manualCheckWarning, selfCheckText, type MemberDetail } from "@/lib/adminMemberDetail";
import { ADMIN_GRANT_MAX, CREDIT_REASON_MAX, SOURCE_LABEL } from "@/lib/viewCreditsAdmin";
import { ADMIN_TEXT } from "@/lib/adminText";

// 2026-10-23 관리자 회원 상세(보기 전용) 본문 — PC는 전체 화면 패널의 3열(PanelColumn), 모바일·📱는 카드 아래 한 줄로 쌓아 펼침.
// 열 때마다 GET /api/admin/members/[id] 1회(캐시 없이). 번호는 서버가 권한별로(최고관리자 전체 / 관리자 가림) 내려 주고,
// 가린 번호면 기존 [번호 보기](renderPhone)를 그대로 씀. 비회원 행은 서버가 조회하지 않아 여기엔 없음.

const CONSENT_LABEL: Record<string, string> = {
  tos: "이용약관",
  privacy: "개인정보 수집·이용",
  eligibility: "이용 자격 확인",
  deal_alert_ad: "매물 알림 수신",
  kakao_marketing: "카카오 마케팅",
  seller_terms: "판매 신청 확인 사항",
  biz_info: "사업자 정보",
};
const CONNECTION_STATUS: Record<string, string> = {
  requested: "연결 요청",
  accepted: "수락",
  seller_confirmed: "판매자 확인",
  buyer_confirmed: "구매자 확인",
  contact_sent: "연락처 전달",
  closed: "종료",
};
const RESULT: Record<string, string> = { success: "성사", failed: "불발", cancelled: "취소" };
const REQUEST_STATUS: Record<string, string> = { pending: "대기", approved: "승인", rejected: "거절" };
const PARTNER_STATUS: Record<string, string> = { pending: "심사중", approved: "승인", rejected: "거절" };
const LEAD_OUTCOME: Record<string, string> = { pending: "진행중", completed: "성사", no_deal: "불발" };
const BUY_OUTCOME: Record<string, string> = { pending: "진행중", matched: "성사", no_match: "불발" };

const fmt = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtDay = (iso: string | null | undefined) => fmt(iso).split(" ")[0];
const dealState = (d: { status: string | null; closes_at: string } | null) => (!d ? "" : d.status === "active" && Date.parse(d.closes_at) > Date.now() ? "진행 중" : "마감");

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray100" style={{ fontSize: rem(15) }}>
      <span className="flex-shrink-0 text-gray500">{label}</span>
      <span className="min-w-0 text-right font-medium text-gray900 break-words">{children}</span>
    </div>
  );
}
function Chip({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "orange" | "navy" }) {
  const c = { gray: ["#F1F1EF", ADMIN_TEXT.muted], green: ["#E8F8EC", ADMIN_TEXT.ok], orange: ["#FFF4E0", "#966B00"], navy: ["#EAF0F7", "#1B3A5C"] }[tone];
  return (
    <span className="inline-block rounded-full font-bold whitespace-nowrap" style={{ background: c[0], color: c[1], fontSize: rem(13), padding: "2px 10px" }}>
      {children}
    </span>
  );
}
function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1" data-detail-section={title}>
      <h4 className="font-bold" style={{ fontSize: rem(15), color: "#0B2540" }}>
        {title}
        {count != null && <span className="ml-1.5 font-medium text-gray500">({count}건)</span>}
      </h4>
      {children}
    </div>
  );
}
const Empty = () => (
  <p className="text-gray500" style={{ fontSize: rem(14) }}>
    없음
  </p>
);
function Item({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray200 px-3 py-2" style={{ fontSize: rem(14) }}>
      {children}
    </div>
  );
}

const INPUT_CLS = "rounded-lg border border-gray200 px-3 py-2 min-w-0";
const BTN_CLS = "text-xs font-bold rounded-lg px-3 py-2 border border-gray200 text-navy disabled:opacity-60 whitespace-nowrap";

/** [사업자번호 입력] — 등록증 수동 승인 회원(기록 없음) 전용. 국세청 상태조회만(진위확인 아님), 결과 저장 뒤 상세를 다시 읽음 */
function ManualBizForm({ adminKey, memberId, onDone }: { adminKey: string; memberId: string; onDone: () => void }) {
  const [bNo, setBNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/business-manual`, { method: "POST", headers: { "x-admin-key": adminKey, "content-type": "application/json" }, body: JSON.stringify({ b_no: bNo }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(body.error ?? "저장하지 못했어요.");
      else onDone();
    } catch {
      setMsg("저장하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray200 px-3 py-2" style={{ fontSize: rem(14) }} data-manual-biz-form>
      <p className="text-gray500">등록증과 대조한 사업자등록번호를 입력하면 국세청 상태(계속·휴업·폐업)를 조회해 저장해요. 진위확인이 아니며, 인증 상태는 바뀌지 않아요.</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input value={bNo} onChange={(e) => setBNo(e.target.value)} inputMode="numeric" placeholder="사업자등록번호 10자리" className={`${INPUT_CLS} flex-1`} style={{ fontSize: rem(15) }} data-manual-biz-input />
        <button type="button" onClick={submit} disabled={busy || !bNo.trim()} className={BTN_CLS} data-manual-biz-submit>
          {busy ? "조회 중..." : "상태 조회·저장"}
        </button>
      </div>
      {msg && <p className="font-bold" style={{ color: "#B91C1C" }} data-manual-biz-msg>{msg}</p>}
    </div>
  );
}

/** 열람권 수동 지급 — 최고관리자 전용(서버가 다시 막음). 수량·사유 필수, 지급 시각 + 90일 */
function CreditGrantForm({ adminKey, memberId, onDone }: { adminKey: string; memberId: string; onDone: () => void }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/view-credits`, { method: "POST", headers: { "x-admin-key": adminKey, "content-type": "application/json" }, body: JSON.stringify({ quantity: Number(qty), reason }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(body.error ?? "지급하지 못했어요.");
      else {
        setQty("");
        setReason("");
        onDone();
      }
    } catch {
      setMsg("지급하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray200 px-3 py-2" style={{ fontSize: rem(14) }} data-credit-grant-form>
      <div className="font-bold">수동 지급 (90일 유효)</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder={`수량 1~${ADMIN_GRANT_MAX}`} className={INPUT_CLS} style={{ width: 120, fontSize: rem(15) }} data-credit-qty />
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={CREDIT_REASON_MAX} placeholder="사유(필수)" className={`${INPUT_CLS} flex-1`} style={{ fontSize: rem(15) }} data-credit-reason />
        <button type="button" onClick={submit} disabled={busy || !qty.trim() || !reason.trim()} className={BTN_CLS} data-credit-grant-submit>
          {busy ? "지급 중..." : "지급"}
        </button>
      </div>
      {msg && <p className="font-bold" style={{ color: "#B91C1C" }} data-credit-msg>{msg}</p>}
    </div>
  );
}

/** 열람권 회수 — 지급 줄 1개에서 N개(남은 수까지). 최고관리자 전용(서버가 다시 막음), 사유 필수. 남은 수 판정은 서버(SQL 함수)가 잠금 안에서 */
function CreditRevokeForm({ adminKey, memberId, grantId, left, onDone }: { adminKey: string; memberId: string; grantId: string; left: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(left));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/view-credits/revoke`, { method: "POST", headers: { "x-admin-key": adminKey, "content-type": "application/json" }, body: JSON.stringify({ grant_id: grantId, quantity: Number(qty), reason }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(body.error ?? "회수하지 못했어요.");
      else {
        setOpen(false);
        setReason("");
        onDone();
      }
    } catch {
      setMsg("회수하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <button type="button" onClick={() => { setQty(String(left)); setOpen(true); }} className={`${BTN_CLS} mt-1.5`} data-credit-revoke-open>
        회수
      </button>
    );
  return (
    <div className="flex flex-col gap-1.5 mt-1.5" data-credit-revoke-form>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" aria-label="회수 수량" className={INPUT_CLS} style={{ width: 80, fontSize: rem(15) }} data-credit-revoke-qty />
        <span className="text-gray500">개 (남은 {left}개까지)</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={CREDIT_REASON_MAX} placeholder="회수 사유(필수)" className={`${INPUT_CLS} flex-1`} style={{ fontSize: rem(15) }} data-credit-revoke-reason />
        <button type="button" onClick={submit} disabled={busy || !qty.trim() || !reason.trim()} className={BTN_CLS} data-credit-revoke-submit>
          {busy ? "회수 중..." : "회수 확정"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMsg(null); }} disabled={busy} className={BTN_CLS}>
          취소
        </button>
      </div>
      {msg && <p className="font-bold" style={{ color: "#B91C1C" }} data-credit-revoke-msg>{msg}</p>}
    </div>
  );
}

export default function MemberDetailView({
  adminKey,
  memberId,
  layout,
  renderPhone,
}: {
  adminKey: string;
  memberId: string;
  layout: "panel" | "inline";
  /** 가린 번호일 때 [번호 보기] 버튼이 붙은 번호 표시(기존 MemberPhoneReveal) */
  renderPhone: (memberId: string, masked: string) => ReactNode;
}) {
  const [data, setData] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // 수동 입력·지급 뒤 상세를 다시 읽기 위한 숫자(처음 불러오기만 "불러오는 중" 표시)
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/members/${memberId}`, { headers: { "x-admin-key": adminKey }, cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(body.error ?? "회원 상세를 불러오지 못했어요.");
        else setData(body as MemberDetail);
      } catch {
        if (!cancelled) setError("회원 상세를 불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminKey, memberId, reloadKey]);

  const span = layout === "panel" ? "lg:col-span-3" : "";
  if (loading) return <div className={`text-gray500 py-6 ${span}`} data-detail-loading>불러오는 중...</div>;
  if (error || !data)
    return (
      <div className={`py-6 font-bold ${span}`} style={{ color: "#B91C1C" }} data-detail-error>
        {error ?? "회원 상세를 불러오지 못했어요."}
      </div>
    );

  const { member: m, business: b } = data;
  const col1 = (
    <>
      <Section title="기본 정보">
        <Row label="번호">{m.phone_masked ? renderPhone(m.id, m.phone) : <span data-testid="member-phone-full">{formatPhone(m.phone)}</span>}</Row>
        <Row label="회원 코드">{m.member_no != null ? formatMemberNo(m.member_no) : "없음"}</Row>
        <Row label="가입일">{fmt(m.created_at)}</Row>
        <Row label="구분">{m.is_test ? <Chip tone="orange">시험 회원</Chip> : "일반 회원"}</Row>
        <Row label="닉네임">{m.nickname ?? "없음"}</Row>
        <Row label="상호">{m.company_name ?? "없음"}</Row>
        <Row label="가입 유입(UTM)">
          {m.utm ? `${m.utm.source ?? "-"} / ${m.utm.medium ?? "-"} / ${m.utm.campaign ?? "-"}` : "기록 없음"}
        </Row>
        <Row label="추천인">{m.referrer ? `${m.referrer.member_no != null ? formatMemberNo(m.referrer.member_no) + " · " : ""}${m.referrer.phone_masked}` : "없음"}</Row>
        <Row label="내가 추천한 회원">{m.referred_count}명</Row>
        <Row label="공식 파트너">{m.is_official_partner ? <Chip tone="green">공식 파트너</Chip> : "아님"}</Row>
        <Row label="파트너 신청">
          {m.partner_request ? `${PARTNER_STATUS[m.partner_request.status] ?? m.partner_request.status} · ${fmtDay(m.partner_request.created_at)}` : "없음"}
        </Row>
      </Section>
    </>
  );
  const col2 = (
    <>
      <Section title="사업자">
        <Row label="사업자 여부">{m.is_business ? "사업자" : "일반"}</Row>
        <Row label="인증 상태">
          {b.state === "verified" ? <Chip tone="green">인증</Chip> : b.state === "license_only" ? <Chip tone="orange">등록증만 있음(승인 전)</Chip> : <Chip>없음</Chip>}
        </Row>
        {b.state === "verified" && <Row label="인증일">{b.verified_at ? fmt(b.verified_at) : "인증일 기록 없음"}</Row>}
        {data.self_check && (
          <Row label="셀프 확인">
            <span data-self-check>{selfCheckText(data.self_check)}</span>
            {data.self_check.same_bno_members > 0 && (
              <span className="ml-1.5" data-self-check-same>
                <Chip tone="orange">같은 사업자번호 {data.self_check.same_bno_members}명</Chip>
              </span>
            )}
          </Row>
        )}
        {data.manual_check && (
          <Row label="수동 입력">
            <span data-manual-check>{manualCheckText(data.manual_check)}</span>
            {(() => {
              const warn = manualCheckWarning(data.manual_check);
              return warn ? (
                <span className="ml-1.5" data-manual-check-warn>
                  <Chip tone="orange">{warn}</Chip>
                </span>
              ) : null;
            })()}
            {data.manual_check.same_bno_members > 0 && (
              <span className="ml-1.5" data-manual-check-same>
                <Chip tone="orange">같은 사업자번호 {data.manual_check.same_bno_members}명</Chip>
              </span>
            )}
            <span className="block text-gray500" style={{ fontSize: rem(13) }}>진위확인 아님 · 인증 상태는 그대로</span>
          </Row>
        )}
        {data.manual_input_available && <ManualBizForm adminKey={adminKey} memberId={memberId} onDone={() => setReloadKey((k) => k + 1)} />}
      </Section>
      <Section title="열람권">
        {!data.view_credits ? (
          <p className="text-gray500" style={{ fontSize: rem(14) }} data-credits-error>열람권 정보를 불러오지 못했어요.</p>
        ) : (
          <>
            <Row label="잔여">
              {data.view_credits.state === "pending" ? (
                <span data-credits-pending>첫 열람 시 월 5 + 웰컴 5 지급 예정</span>
              ) : data.view_credits.state === "not_verified" ? (
                <span className="text-gray500" data-credits-notverified>사업자 인증 전 · 지급 없음</span>
              ) : (
                <span data-credits-remaining>{data.view_credits.remaining}개</span>
              )}
            </Row>
            {data.view_credits.next_expires_at && <Row label="가장 빠른 만료">{fmtDay(data.view_credits.next_expires_at)}</Row>}
            {data.view_credits.grants.length > 0 && (
              <div className="flex flex-col gap-1" data-credit-grants>
                {data.view_credits.grants.map((g) => (
                  <Item key={g.id}>
                    <div className="font-bold">
                      {SOURCE_LABEL[g.source] ?? g.source}
                      {g.period_month ? ` · ${g.period_month.slice(0, 7)}` : ""} · {g.left}/{g.quantity}개 남음
                      {g.expired && <span className="ml-1.5"><Chip>만료</Chip></span>}
                    </div>
                    <div className="text-gray500">
                      지급 {fmtDay(g.created_at)} · 만료 {fmtDay(g.expires_at)}
                      {g.used > 0 && ` · 사용 ${g.used}`}
                      {g.revoked > 0 && ` · 회수 ${g.revoked}`}
                      {g.reason && ` · ${g.reason}`}
                    </div>
                    {data.view_credits?.can_manage && !g.expired && g.left > 0 && (
                      <CreditRevokeForm adminKey={adminKey} memberId={memberId} grantId={g.id} left={g.left} onDone={() => setReloadKey((k) => k + 1)} />
                    )}
                  </Item>
                ))}
              </div>
            )}
            {data.view_credits.events.length > 0 && (
              <div className="flex flex-col gap-1" data-credit-events>
                {data.view_credits.events.map((e) => (
                  <Item key={e.id}>
                    <div className="font-bold">
                      {e.kind === "use" ? "열람" : "회수"} {e.quantity}개{e.deal_title ? ` · ${e.deal_title}` : ""}
                    </div>
                    <div className="text-gray500">
                      {fmt(e.created_at)}
                      {e.reason && ` · ${e.reason}`}
                    </div>
                  </Item>
                ))}
              </div>
            )}
            {/* 미인증 회원은 지급 칸을 숨김(서버도 409) */}
            {data.view_credits.can_manage && data.view_credits.state !== "not_verified" && <CreditGrantForm adminKey={adminKey} memberId={memberId} onDone={() => setReloadKey((k) => k + 1)} />}
          </>
        )}
      </Section>
      <Section title="동의">
        {data.consents.map((c) => (
          <Row key={c.type} label={CONSENT_LABEL[c.type] ?? c.type}>
            {c.status === "none" ? (
              <span className="text-gray500">기록 없음</span>
            ) : (
              <span>
                <Chip tone={c.status === "agreed" ? "green" : "orange"}>{c.status === "agreed" ? "동의" : "철회"}</Chip>
                <span className="ml-1.5 text-gray500" style={{ fontSize: rem(13) }}>
                  {fmt(c.at)}
                </span>
              </span>
            )}
          </Row>
        ))}
      </Section>
      <Section title="알림">
        <Row label="구독 기기">{data.push_device_count}대</Row>
        <Row label="알림 끄기(push_opt_out)">{m.push_opt_out ? <Chip tone="orange">끔</Chip> : "켬"}</Row>
        <Row label="관심 카테고리">{data.categories.length ? data.categories.join(", ") : "없음"}</Row>
        <Row label="관심 지역">{data.regions.length ? data.regions.join(", ") : "없음"}</Row>
      </Section>
    </>
  );
  const col3 = (
    <>
      <Section title="판매 신청" count={data.seller_requests.length}>
        {data.seller_requests.length === 0 ? (
          <Empty />
        ) : (
          data.seller_requests.map((r) => (
            <Item key={r.id}>
              <div className="font-bold">{r.product_name ?? "(품목 없음)"}</div>
              <div className="text-gray500">
                {REQUEST_STATUS[r.status ?? ""] ?? r.status} · {fmtDay(r.created_at)}
                {r.linked_deal && ` → ${r.linked_deal.title} (${dealState(r.linked_deal)})`}
              </div>
            </Item>
          ))
        )}
      </Section>
      <Section title="찾는 상품" count={data.buy_requests.length}>
        {data.buy_requests.length === 0 ? (
          <Empty />
        ) : (
          data.buy_requests.map((r) => (
            <Item key={r.id}>
              <div className="font-bold">{r.product_name}</div>
              <div className="text-gray500">
                {r.category ? `${r.category} · ` : ""}
                {BUY_OUTCOME[r.outcome ?? ""] ?? r.outcome} · {r.contacted ? "연락함" : "연락 전"} · {fmtDay(r.created_at)}
              </div>
            </Item>
          ))
        )}
      </Section>
      <Section title="관심 표시" count={data.interests.length}>
        {data.interests.length === 0 ? (
          <Empty />
        ) : (
          data.interests.map((r) => (
            <Item key={r.id}>
              <div className="font-bold">{r.deal_title ?? "삭제된 매물"}</div>
              <div className="text-gray500">
                {r.contacted ? "연락함" : "연락 전"} · {LEAD_OUTCOME[r.outcome ?? ""] ?? r.outcome} · {fmtDay(r.created_at)}
              </div>
            </Item>
          ))
        )}
      </Section>
      <Section title="거래 연결" count={data.connections.length}>
        {data.connections.length === 0 ? (
          <Empty />
        ) : (
          data.connections.map((r) => (
            <Item key={r.id}>
              <div className="font-bold">{r.deal_title}</div>
              <div className="text-gray500">
                {CONNECTION_STATUS[r.status] ?? r.status}
                {r.result ? ` · ${RESULT[r.result] ?? r.result}` : ""} · {fmtDay(r.created_at)}
              </div>
            </Item>
          ))
        )}
      </Section>
    </>
  );

  if (layout === "panel") {
    return (
      <>
        <PanelColumn title="기본·가입">{col1}</PanelColumn>
        <PanelColumn title="사업자·동의·알림">{col2}</PanelColumn>
        <PanelColumn title="활동">{col3}</PanelColumn>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4 mt-3 pt-3 border-t border-gray200" data-member-detail-inline>
      {col1}
      {col2}
      {col3}
    </div>
  );
}
