// 2026-09-27: 점핑파트너 영업용 데모 스킨(/p/[slug]) 설정.
// 실제 화이트라벨(서브도메인·데이터 격리)이 아니라, 기존 코드베이스/데이터를 그대로
// 쓰면서 로고·이름·강조색만 파트너 브랜드로 재구성한 "미리보기" 페이지입니다.
// 계약 전 영업 데모 용도이며, 실제 파트너와 계약이 체결되면 이 배열에 항목을 추가합니다.
export interface PartnerConfig {
  slug: string;
  /** 파트너 브랜드로 보여줄 표시명 (예: "카카오덤핑 × 덤핑점핑") */
  name: string;
  /** 히어로 아래 짧은 소개 문구 */
  tagline: string;
  /** 브랜드 오렌지(#FF6F0F) 대신 쓸 강조색 */
  accentColor: string;
  /**
   * 파트너 본인 계정의 추천 코드(ref_code). 있으면 가입 CTA가
   * /signup?ref=<code>로 연결돼 실제 추천 트래킹(referred_by)이 붙습니다.
   * 아직 계정이 없는 후보사는 비워두면 일반 가입 링크로 연결됩니다.
   */
  refCode?: string;
}

export const partners: PartnerConfig[] = [
  {
    slug: "demo",
    name: "파트너 데모",
    tagline: "이 화면은 파트너사 전용 브랜드로 보이는 덤핑점핑 미리보기 데모입니다.",
    accentColor: "#2563EB",
  },
];

export function getPartner(slug: string): PartnerConfig | undefined {
  return partners.find((p) => p.slug === slug);
}
