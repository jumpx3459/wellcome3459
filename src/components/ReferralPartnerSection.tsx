"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { formatMemberNo } from "@/lib/format";
import { dealPriceLabel } from "@/lib/priceMode";
import { rem } from "@/lib/rem";
import ReferralShareButtons from "@/components/ReferralShareButtons";
import type { ReferralShareState } from "@/lib/useReferralShare";
import { MY_BADGE, MY_CARD_TITLE, MY_DESC, MY_INPUT_FONT_SIZE, MY_LINK, MY_META, myBtnStyle } from "@/lib/myText";
import { BTN_CLASS } from "@/lib/uiText";

// 점핑파트너 구역 본문 (2026-10-12 feat/my-menu-share) — 예전 MY "🤝 점핑파트너" 구역 내용 그대로 /share로 옮김.
// 매물 선택 · 공유 버튼 3개 · 주소 · 공식 파트너 신청 카드 · 대시보드 열기 · 추천 회원(최근 3명).
export default function ReferralPartnerSection({ s }: { s: ReferralShareState }) {
  const { referrals } = s;
  return (
    <div id="referral">
      <p className="mb-3" style={MY_DESC}>
        아래 링크로 가입하면 내가 추천한 회원으로 따로 관리돼요.
      </p>

      {s.shareDeals.length > 0 ? (
        <label htmlFor="share-deal" className="mb-1.5 block font-bold" style={MY_META}>공유할 매물 선택</label>
      ) : (
        <p className="mb-2" style={MY_META}>공유할 매물이 아직 없어요 · 가입 추천 링크로 보내져요</p>
      )}
      {s.shareDeals.length > 0 && (
        <select
          id="share-deal"
          value={s.selectedShareDealId}
          onChange={(e) => s.setSelectedShareDealId(e.target.value)}
          className="w-full border-2 border-gray200 rounded-xl mb-2 outline-none bg-white"
          style={{ padding: "10px 12px", color: "#0B2540", ...MY_LINK }}
        >
          {s.shareDeals.map((d) => (
            <option key={d.id} value={d.id}>
              📦 {d.title} · {dealPriceLabel(d)}
            </option>
          ))}
          <option value="">🔗 매물 없이 가입 추천만 보내기</option>
        </select>
      )}

      {/* 2026-09-29: "내 추천 회원" 화면과 같은 공용 버튼 */}
      <ReferralShareButtons refUrl={s.refUrl} shareText={s.shareText} />

      <div className="mt-6 rounded-2xl" style={{ background: "#FFF9EC", border: "1px solid #F0DCA8", padding: "14px 15px" }}>
        <h3 style={{ ...MY_CARD_TITLE, color: "#0B2540" }}>🏅 공식 점핑파트너</h3>
        {!s.isOfficialPartner && (
          <>
            <p className="mt-1.5" style={MY_DESC}>
              이미 덤핑·재고 유통업, 도매업, 밴드/카톡채널/블로그 등 SNS 운영자, 대기업 대리점,
              제조·수입·커뮤니티 운영자로 활동 중이신가요? 공급자이자 수요자 역할을 함께 할 수 있는
              리더에게 드리는 공식 등급입니다.
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {[
                "공식 파트너 배지 표시",
                "향후 리워드 제도 도입 시 우선 적용",
                "점핑매니저와 우선 연결",
                "내 판매·구매 신청 현황을 마이페이지에서 한 번에 확인",
              ].map((b) => (
                <li key={b} className="flex items-start gap-1.5" style={MY_DESC}>
                  <span style={{ color: "#2F9E44", fontWeight: 900 }}>✔</span>{b}
                </li>
              ))}
            </ul>
          </>
        )}
        {s.isOfficialPartner && (
          // 2026-09-29: 실제로 적용되는 건 배지뿐 — 리워드·우선 연결은 등급제 오픈 전이라 따로 안내
          <div className="mt-1.5">
            <p style={MY_DESC}>공식 파트너 배지를 받았어요.</p>
            <p className="mt-0.5" style={MY_META}>우선 리워드 · 점핑매니저 우선 연결은 등급제 오픈 시 제공돼요.</p>
          </div>
        )}

        {s.isOfficialPartner ? (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full" style={{ background: "#E8F8EC", padding: "6px 12px" }}>
            <span style={{ color: "#2F9E44", fontWeight: 900 }}>✔</span>
            <span style={{ ...MY_LINK, color: "#2F9E44" }}>공식 점핑파트너입니다</span>
          </div>
        ) : s.partnerStatus === "pending" ? (
          <div className="flex items-center gap-2.5 mt-2.5 rounded-xl" style={{ background: "#FFF4E0", padding: "12px 13px" }}>
            <span className="flex-shrink-0 rounded" style={{ ...MY_BADGE, padding: "3px 9px", background: "#F5E3BC", color: "#966B00" }}>심사중</span>
            <span className="flex-1" style={MY_DESC}>
              신청서를 검토하고 있어요. 보통 2영업일 안에 결과를 알려드립니다.
            </span>
          </div>
        ) : s.partnerStatus === "rejected" ? (
          <p className="mt-2.5 rounded-xl text-center" style={{ background: "#F5F6F8", padding: "10px", ...MY_DESC }}>
            신청이 반려되었어요. 문의는 점핑매니저에게 연락주세요.
          </p>
        ) : (
          <div className="mt-2.5 space-y-2.5">
            <input
              className="w-full rounded-xl outline-none bg-white"
              style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: MY_INPUT_FONT_SIZE }}
              placeholder="업종/사업형태 (예: 냉동수산물 도매)"
              value={s.partnerForm.businessType}
              onChange={(e) => s.setPartnerForm((f) => ({ ...f, businessType: e.target.value }))}
            />
            <input
              className="w-full rounded-xl outline-none bg-white"
              style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: MY_INPUT_FONT_SIZE }}
              placeholder="채널 정보 (카카오톡 채널/블로그 URL 등)"
              value={s.partnerForm.channelInfo}
              onChange={(e) => s.setPartnerForm((f) => ({ ...f, channelInfo: e.target.value }))}
            />
            <textarea
              className="w-full rounded-xl outline-none resize-none bg-white"
              style={{ border: "1.5px solid #E4D5AE", padding: 12, fontSize: MY_INPUT_FONT_SIZE, lineHeight: 1.5, height: 88 }}
              placeholder="추가로 전달하고 싶은 내용 (선택)"
              value={s.partnerForm.message}
              onChange={(e) => s.setPartnerForm((f) => ({ ...f, message: e.target.value }))}
            />
            {s.partnerError && <p style={{ fontSize: rem(16), color: "var(--color-orange)" }}>{s.partnerError}</p>}
            <button
              onClick={s.submitPartnerRequest}
              disabled={s.partnerSubmitting}
              className={`w-full ${BTN_CLASS}`}
              style={myBtnStyle("primary")}
            >
              {s.partnerSubmitting ? "신청 중..." : "공식 점핑파트너 신청하기"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mt-5 mb-2">
        <p style={MY_DESC}>내가 추천한 회원은 여기서 확인할 수 있어요.</p>
        {/* 2026-09-27: 추천 0명일 때도 링크는 항상 보이게 — 대시보드가 0명 상태를 이미 잘 보여줌 */}
        <Link href="/mypage/referrals" className="flex-shrink-0" style={{ ...MY_LINK, color: "#E25100" }}>
          대시보드 열기 →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {referrals.length === 0 ? (
          <div
            className="flex items-center gap-2.5 rounded-xl"
            style={{ background: "#F5F6F8", border: "1px solid #E4E7EB", padding: "12px 14px" }}
          >
            <span className="text-lg flex-shrink-0">📣</span>
            <p style={MY_DESC}>
              아직 추천으로 가입한 회원이 없어요. 위쪽 링크 복사·공유 버튼으로 친구에게 보내보세요!
            </p>
          </div>
        ) : (
          <>
            {referrals.slice(0, 3).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 bg-white border border-gray200 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <div style={MY_CARD_TITLE}>
                    {r.member_no != null ? formatMemberNo(r.member_no) : "회원번호 없음"}
                    {r.company_name && (
                      <span className="font-medium ml-1.5" style={MY_META}>{r.company_name}</span>
                    )}
                  </div>
                  <div className="mt-0.5" style={MY_META}>
                    {r.phone}
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("ko-KR")} 가입
                    {r.is_business && " · 사업자"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-full whitespace-nowrap" style={{ ...MY_BADGE, background: "#E8F8EC", color: "#1D8A44" }}>
                    가입완료
                  </span>
                  {r.business_verified && (
                    <span
                      className="px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                      style={{ ...MY_BADGE, background: "#E8F8EC", color: "#1D8A44" }}
                    >
                      <CheckCircle className="w-3 h-3" /> 인증된 사업자
                    </span>
                  )}
                </div>
              </div>
            ))}
            {referrals.length > 3 && (
              <Link href="/mypage/referrals" className="text-center py-2" style={{ ...MY_LINK, color: "#6B7480" }}>
                +{referrals.length - 3}명 더 보기 →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
