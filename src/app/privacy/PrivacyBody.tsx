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
      <p className="text-sm text-gray500 mb-6">시행일: 2026년 10월 7일</p>

      <div style={{ zoom: large ? 1.3 : 1 }}>
        {/* 2026-09-30: docs/legal/consent-texts-2026-10-07.md 6번 반영 (수집 항목 표·제3자 제공 신설·처리 위탁·
            보유 기간·광고성 정보·보호책임자). [확인] 자리는 코드로 확인한 값으로 채우고, 확인 못 한 값은 "[확인 필요]"로 둠. */}
        <section className="flex flex-col gap-5 text-sm text-gray900 leading-relaxed">
          <div>
            <h2 className="font-bold text-navy mb-1.5">1. 수집하는 개인정보 항목</h2>
            <p>덤핑점핑 서비스(이하 &quot;서비스&quot;)는 아래 정보를 수집합니다.</p>
            <Table
              head={["구분", "항목", "수집 시점"]}
              rows={[
                ["필수", "휴대폰 번호", "가입"],
                ["필수", "관심 카테고리·지역, 서비스 이용 기록, 접속 기기·브라우저 정보", "가입·이용 중"],
                ["선택", "기기 알림(푸시) 구독 정보", "매물 알림 동의·알림 켜기"],
                ["선택", "사업자 회원 여부, 업체명, 이름·이메일·프로필 사진", "가입·MY 프로필·판매 신청"],
                ["선택", "사업자등록증 사본(이미지)", "사업자 인증"],
                ["판매 신청 시", "매물 정보, 담당자 연락처, 업체명·공개 여부", "판매 신청"],
                ["자동 생성", "동의 이력(종류·일시·화면), 알림 발송 기록, 인증번호 요청 기록", "이용 중"],
              ]}
            />
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
            <ul className="list-disc pl-5 space-y-1">
              <li>회원 정보: 탈퇴 시까지(탈퇴 시 지체 없이 파기, 법령상 보관 항목 제외).</li>
              <li>인증번호 요청 기록: 30일 후 자동 삭제.</li>
              <li>동의 이력: 회원 탈퇴 시 함께 삭제.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">4. 개인정보의 제3자 제공</h2>
            <Table
              head={["제공받는 자", "제공 항목", "목적", "보유 기간"]}
              rows={[["구매자가 연결을 요청한 매물의 판매자", "구매자의 이름, 휴대폰 번호, 상호", "해당 매물 거래 상담", "거래 상담 종료 시까지"]]}
            />
            <ul className="list-disc pl-5 mt-1.5 space-y-1">
              <li>제공은 구매자의 매물별 동의와 점핑매니저의 판매자 상호 안내·확인 후에만 이루어집니다.</li>
              <li>비공개 판매자의 정보는 구매자에게 제공하지 않습니다(법령에 따른 요청 제외).</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">5. 개인정보 처리의 위탁</h2>
            <Table
              head={["수탁자", "위탁 업무"]}
              rows={[
                ["Supabase Inc.", "데이터베이스·회원 인증"],
                ["Vercel Inc.", "웹 호스팅·서버 실행"],
                ["[확인 필요: 문자 인증번호 발송 업체]", "인증번호 문자 발송"],
                ["브라우저 푸시 서비스(Google·Apple·Samsung 등)", "알림 전달"],
              ]}
            />
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">6. 광고성 정보</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>매물 알림·긴급 공지·카카오톡 채널 소식은 광고성 정보이며 선택 동의한 회원에게만 보냅니다.</li>
              <li>밤 9시~아침 8시에는 광고성 알림을 보내지 않습니다.</li>
              <li>수신 거부: MY 화면 또는 고객센터. 동의·철회 결과는 처리 즉시 화면에 안내합니다.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">7. 정보주체의 권리</h2>
            <p>
              회원은 언제든지 알림 수신을 끄거나 탈퇴(개인정보 삭제)할 수 있습니다. 로그인 후{" "}
              <a href="/unsubscribe" className="text-orange font-bold underline">
                알림 해지·탈퇴 페이지
              </a>
              에서 직접 처리하거나, 로그인이 어려운 경우 아래 개인정보 보호책임자에게 요청하실 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">8. 동의 거부권 및 불이익</h2>
            <p>
              정보주체는 개인정보 수집에 동의를 거부할 권리가 있습니다. 다만, 필수 항목(휴대폰 번호) 동의를
              거부할 경우 서비스 이용이 제한될 수 있습니다. 매물 알림·카카오톡 채널 소식 등 광고성 정보 수신
              동의는 선택이며, 동의하지 않아도 매물 둘러보기 등 기본 서비스는 이용할 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy mb-1.5">9. 쿠키(Cookie) 및 광고</h2>
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
            <h2 className="font-bold text-navy mb-1.5">10. 개인정보 보호책임자</h2>
            <p>점프엑스 주식회사 (덤핑점핑)</p>
            <p>성명: 김현정</p>
            <p>연락처: 070-4006-0890, info@jumpx.co.kr</p>
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

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ minWidth: head.length > 3 ? 480 : undefined }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border border-gray200 font-bold text-navy px-2 py-1.5 align-top" style={{ background: "#F7F8FA" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border border-gray200 px-2 py-1.5 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
