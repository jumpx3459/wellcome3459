"use client";

import { useState } from "react";

// 2026-09-28: "40~60대는 글씨가 작아서 잘 안 보인다"는 지적 — 이 페이지는 앱
// 전체에서 가장 밀도 높은 순수 읽기 콘텐츠라 우선 적용. 앱 전체 폰트는 인라인
// px 스타일이 워낙 많아 전역으로 키우기 위험한 반면, 이 섹션은 전부 Tailwind
// text-sm 등 rem 기반 클래스라 zoom으로 통째로 확대해도 레이아웃이 깨지지
// 않음(고정 요소 없는 순수 스크롤 콘텐츠라 zoom 부작용도 없음).
export default function PrivacyBody() {
  const [large, setLarge] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-1 gap-3">
        <h1 className="font-display text-2xl text-navy">개인정보 처리방침</h1>
        <button
          type="button"
          onClick={() => setLarge((v) => !v)}
          className="flex-shrink-0 text-xs font-bold rounded-lg px-3 py-2 border border-gray200 text-navy"
        >
          {large ? "가 작게" : "가 크게 보기"}
        </button>
      </div>
      <p className="text-sm text-gray500 mb-6">시행일: 2026년 7월 17일</p>

      <div style={{ zoom: large ? 1.3 : 1 }}>
        <section className="flex flex-col gap-5 text-sm text-gray900 leading-relaxed">
          <div>
            <h2 className="font-bold text-navy mb-1.5">1. 수집하는 개인정보 항목</h2>
            <p>
              덤핑점핑 알림 서비스(이하 &quot;서비스&quot;)는 알림 발송을 위해 아래 정보를 수집합니다.
            </p>
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>필수: 휴대폰 번호, 관심 카테고리, 관심 지역</li>
              <li>선택: 사업자 회원 여부, 기기 알림(푸시) 구독 정보(매물 알림 수신에 동의한 경우)</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">2. 개인정보의 수집 및 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>관심 카테고리·지역에 맞는 매물 알림 발송</li>
              <li>회원 식별 및 본인 확인</li>
              <li>점핑매니저의 거래 매칭 상담 연락</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">3. 개인정보의 보유 및 이용기간</h2>
            <p>
              회원 탈퇴 시 지체 없이 파기합니다. 알림만 끈 경우에는 기기 알림(푸시) 구독 정보만
              삭제되며, 회원 정보는 탈퇴 전까지 유지됩니다. 단, 관계 법령에 따라 보존이 필요한 경우
              해당 기간 동안 보관합니다. 탈퇴 후에도 보존하는 거래·문의 기록은 연락처 등 개인을
              식별할 수 없도록 처리한 뒤 보관합니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">4. 개인정보의 제3자 제공</h2>
            <p>
              서비스는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다만, 관심 표시(&quot;관심있어요&quot;)를
              남긴 매물에 한해, 점핑매니저를 통해 해당 매물을 등록한 판매자에게 연락처가 전달될 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">5. 정보주체의 권리</h2>
            <p>
              회원은 언제든지 알림 수신을 끄거나 탈퇴(개인정보 삭제)할 수 있습니다. 로그인 후{" "}
              <a href="/unsubscribe" className="text-orange font-bold underline">
                알림 해지·탈퇴 페이지
              </a>
              에서 직접 처리하거나, 로그인이 어려운 경우 아래 문의처로 요청하실 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">6. 동의 거부권 및 불이익</h2>
            <p>
              정보주체는 개인정보 수집에 동의를 거부할 권리가 있습니다. 다만, 필수 항목(휴대폰 번호) 동의를
              거부할 경우 서비스 이용이 제한될 수 있습니다. 매물 알림·카카오톡 채널 소식 등 광고성 정보 수신
              동의는 선택이며, 동의하지 않아도 매물 둘러보기 등 기본 서비스는 이용할 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">7. 쿠키(Cookie) 및 광고</h2>
            <p>
              서비스는 접속 환경 유지, 서비스 이용 통계 분석을 위해 쿠키 및 이와 유사한 기술을
              사용할 수 있습니다. 이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으며, 이 경우
              일부 기능 이용에 제한이 있을 수 있습니다.
            </p>
            <p className="mt-1.5">
              서비스는 Google을 포함한 제3자 광고 서비스를 이용할 수 있습니다. 이러한 제3자
              공급업체는 쿠키를 사용해 이용자의 과거 서비스 방문 기록을 바탕으로 광고를 게재할 수
              있습니다. 이용자는{" "}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange font-bold underline"
              >
                Google 광고 설정
              </a>
              에서 맞춤 광고를 비활성화할 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">8. 문의처</h2>
            <p>점프엑스 주식회사 (덤핑점핑)</p>
            <p>개인정보 관련 문의: 서비스 내 점핑매니저 채널을 통해 접수해 주세요.</p>
          </div>
        </section>

        <div className="mt-8 pt-6 border-t border-gray200">
          <h2 className="font-display text-xl text-navy mb-3">이용약관 (요약)</h2>
          <ul className="list-disc pl-5 text-sm text-gray900 space-y-1.5 leading-relaxed">
            <li>본 서비스는 B2B 재고(덤핑) 매물 정보를 알림으로 제공하는 정보 서비스입니다.</li>
            <li>매물의 실제 거래는 서비스가 아닌 판매자와 구매자, 점핑매니저 간 별도 협의로 진행됩니다.</li>
            <li>서비스는 매물 정보의 정확성을 위해 노력하나, 거래 결과에 대한 법적 책임은 거래 당사자에게 있습니다.</li>
            <li>회원은 언제든지 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
