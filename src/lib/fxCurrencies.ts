// 환율 계산기(/logistics)와 서버 경로(/api/fx)가 함께 쓰는 통화 목록 — B2B 소싱에서 실사용 빈도가 높은 순.
export const FX_CURRENCIES = [
  { code: "USD", label: "미국 달러", flag: "🇺🇸" },
  { code: "CNY", label: "중국 위안", flag: "🇨🇳" },
  { code: "JPY", label: "일본 엔 (100엔)", flag: "🇯🇵" },
  { code: "EUR", label: "유럽 유로", flag: "🇪🇺" },
];

export const FX_CODES: string[] = FX_CURRENCIES.map((c) => c.code);
