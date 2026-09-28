// 매물 위치 표시 규칙 (목록·상세·홈 미리보기·알림함 공통).
//   지역 + 상세 → "서울 · 가락동"
//   지역만      → "서울"
//   상세만      → 상세 그대로
//   둘 다 없음  → "전국"
// 상세 주소를 "서울 가락동"처럼 지역명까지 넣어 등록한 매물도 있어서, 상세가 지역명으로
// 시작하면 그 부분은 떼고 붙인다("서울 · 서울 가락동" 방지).
export function formatDealLocation(regionName: string | null | undefined, location: string | null | undefined): string {
  const region = (regionName ?? "").trim();
  let detail = (location ?? "").trim();

  if (region && detail.startsWith(region)) {
    detail = detail.slice(region.length).replace(/^[\s·,/-]+/, "");
  }

  if (region && detail) return `${region} · ${detail}`;
  if (region) return region;
  if (detail) return detail;
  return "전국";
}
