"use client";

import { useEffect, useState, type ReactNode } from "react";
import { rem } from "@/lib/rem";
import { formatMemberNo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { PanelColumn } from "@/components/admin/AdminFullscreenPanel";
import type { MemberDetail } from "@/lib/adminMemberDetail";

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
  const c = { gray: ["#F1F1EF", "#6B7480"], green: ["#E8F8EC", "#1D8A44"], orange: ["#FFF4E0", "#966B00"], navy: ["#EAF0F7", "#1B3A5C"] }[tone];
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
  }, [adminKey, memberId]);

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
