import { EXAMPLE_MEDIA_ENABLED } from "./features";

export type Deal = {
  id: string;
  title: string;
  category: string;
  region: string;
  location: string;
  stock_type?: string | null; // 2026-09-29 재고 유형 (src/lib/stockType.ts)
  original_price: number;
  deal_price: number;
  total_qty: number;
  remaining_qty: number;
  closes_at: string; // ISO
  images?: string[];
  video_url?: string | null;
  seller_member_id?: string | null;
  seller_display_name?: string | null;
  is_anonymous?: boolean | null;
  description?: string;
  status?: "active" | "closed";
  package_unit?: string | null; // 포장 단위 (예: "20kg 박스")
  origin?: string | null; // 원산지
  spec?: string | null; // 규격/사이즈
  storage_condition?: string | null; // 보관조건 · 소비기한 (예전 자유 입력 — 새 칸이 비었을 때만 표시)
  storage_type?: string | null; // 2026-10-01 상온·냉장·냉동 (src/lib/dealFields.ts)
  expiry_date?: string | null; // 2026-10-01 소비기한 YYYY-MM-DD
  quantity_unit?: string | null; // 수량 단위 (박스/개/kg/톤/파렛트 등) — 없으면 "개"로 표시
  min_order_qty?: number | null; // 최소주문수량(MOQ)
  price_unit?: string | null; // 2026-09-29 단가 단위 (src/lib/priceUnit.ts) — 없으면 수량 단위 기준
  created_at?: string; // ISO — mock 데이터엔 없음
  interest_count?: number; // 2026-09-26: 관심표시(interests+quick_leads) 합산 카운트, deals.interest_count 비정규화 컬럼
  pid?: string | null; // 2026-09-26: 리퀴데이션 파렛트 등의 매니페스트/PID 번호 (선택)
  manifest_items?: Record<string, string>[] | null; // 혼합매물 구성품 CSV 목록 (헤더 그대로)
};

// 2026-09-29: L 추가 (sell·buy·관리자 공통). 단가 단위 목록(priceUnit.ts)도 같은 순서
export const quantityUnits = ["개", "박스", "kg", "톤", "파렛트", "세트", "L"];

const now = Date.now();

// UI 데모용 예시 매물 — 2026-09-29 사진·영상은 출처 미확인이라 모두 비움(대표 사진 받으면 채움) —
// 실제 매물 사진/영상 아님. Supabase 미설정(로컬 dev/일부 프리뷰) 상태에서만 쓰이는 fallback 데이터라
// 운영 DB(deals 테이블)에는 영향 없음. mockCategories 18개 전부 1건씩 매핑.
const RAW_MOCK_DEALS: Deal[] = [
  {
    id: "1",
    title: "냉동 삼겹살 대패 10kg x 30박스",
    category: "수산·축산물",
    region: "서울",
    location: "서울 가락동",
    original_price: 620000,
    deal_price: 398000,
    total_qty: 30,
    remaining_qty: 21,
    closes_at: new Date(now + 1000 * 60 * 60 * 4.2).toISOString(),
    images: [],
    // 2026-09-29: 영상 제거 — TikTok 워터마크·Costco 로고가 들어 있었음 (파일도 삭제)
    video_url: null,
    description: "냉동 보관 · 박스당 10kg 균일 포장 · 소비기한 여유 3개월 이상",
    package_unit: "10kg 박스",
    origin: "국내산",
    storage_condition: "냉동보관",
    quantity_unit: "박스",
    min_order_qty: 5,
  },
  {
    id: "2",
    title: "국내산 갈치 20kg 박스",
    // 갈치는 수산물이라 원래도 "농산물"이 아니라 "수산·축산물"에 들어갔어야 함 —
    // 이름 정리하면서 같이 바로잡음.
    category: "수산·축산물",
    region: "서울",
    location: "서울 가락동",
    original_price: 380000,
    deal_price: 219000,
    total_qty: 55,
    remaining_qty: 12,
    closes_at: new Date(now + 1000 * 60 * 60 * 2.97).toISOString(),
    images: [],
    video_url: null,
    description: "소비기한 등록일로부터 5일 · 냉동 보관 · 박스당 20kg 균일 포장 · 원산지 증명서 제공 가능",
    package_unit: "20kg 박스",
    origin: "국내산 (제주)",
    storage_condition: "냉동보관 · 소비기한 등록일로부터 5일",
    quantity_unit: "박스",
    min_order_qty: 5,
  },
  {
    id: "3",
    title: "스테인리스 텀블러 500ea",
    category: "생활용품",
    region: "인천",
    location: "인천 남동공단",
    original_price: 4200,
    deal_price: 2300,
    total_qty: 500,
    remaining_qty: 340,
    closes_at: new Date(now + 1000 * 60 * 60 * 11.66).toISOString(),
    images: [],
    video_url: null,
    description: "박스 및 개별 포장 상태 양호 · 사용 흔적 없는 신품 재고 · KC 인증서 보유",
    package_unit: "1개입 개별포장 · 50개입 박스",
    origin: "중국",
    spec: "500ml, 지름 7cm x 높이 22cm",
    quantity_unit: "개",
    min_order_qty: 50,
  },
  {
    id: "4",
    title: "계절 재고 우산 1,200개",
    category: "패션잡화",
    region: "경기",
    location: "경기 부천",
    original_price: 3500,
    deal_price: 1900,
    total_qty: 1200,
    remaining_qty: 1080,
    closes_at: new Date(now + 1000 * 60 * 60 * 28.2).toISOString(),
    images: [],
    video_url: null, // 실제 우산 영상 확보되면 교체
    description: "전 시즌 이월 재고 · 박스 단위(50개입) 판매 · 색상 랜덤 혼합 구성",
  },
  {
    id: "5",
    title: "명품 라인 립스틱 재고 800개",
    category: "화장품",
    region: "경기",
    location: "경기 이천",
    original_price: 28000,
    deal_price: 12900,
    total_qty: 800,
    remaining_qty: 512,
    closes_at: new Date(now + 1000 * 60 * 60 * 9.3).toISOString(),
    images: [],
    video_url: null,
    description: "정품 인증서 보유 · 색상 혼합 구성 · 소비기한 1년 이상",
  },
  {
    id: "6",
    title: "리퍼비시 무선 이어폰 3,000개",
    category: "전자제품",
    region: "서울",
    location: "서울 구로디지털",
    original_price: 32000,
    deal_price: 15900,
    total_qty: 3000,
    remaining_qty: 2140,
    closes_at: new Date(now + 1000 * 60 * 60 * 6.5).toISOString(),
    images: [],
    video_url: null,
    description: "박스 개봉·기능 검수 완료 · 정품 충전케이스 포함 · A/S 불가 명시 필요",
  },
  {
    id: "7",
    title: "산업용 스테인리스 원자재 10톤",
    category: "산업원자재",
    region: "경남",
    location: "경남 김해",
    original_price: 42000000,
    deal_price: 29800000,
    total_qty: 10,
    remaining_qty: 4,
    closes_at: new Date(now + 1000 * 60 * 60 * 5.4).toISOString(),
    images: [],
    video_url: null,
    description: "재질 증명서(밀시트) 제공 · 규격 균일 · 직접 방문 실사 가능 · 지게차 상차 지원",
  },
  {
    id: "8",
    title: "중고 진공포장기 15대",
    category: "기계설비",
    region: "충북",
    location: "충북 음성",
    original_price: 1800000,
    deal_price: 980000,
    total_qty: 15,
    remaining_qty: 9,
    closes_at: new Date(now + 1000 * 60 * 60 * 20).toISOString(),
    images: [],
    video_url: null,
    description: "가동 확인 완료 · 공장 직권 처분 · 상차 지원 가능",
  },
  {
    id: "9",
    title: "소비기한 임박 즉석카레 5,000개",
    category: "가공식품·잡화",
    region: "충남",
    location: "충남 아산",
    original_price: 2800,
    deal_price: 1100,
    total_qty: 5000,
    remaining_qty: 3200,
    closes_at: new Date(now + 1000 * 60 * 60 * 8.1).toISOString(),
    images: [],
    video_url: null,
    description: "소비기한 3주 이내 · 박스당 40개입 · 상온 보관",
    storage_condition: "상온보관 · 소비기한 임박",
  },
  {
    id: "10",
    title: "리퍼 사무용 책상 200개",
    category: "가구",
    region: "경기",
    location: "경기 파주",
    original_price: 95000,
    deal_price: 42000,
    total_qty: 200,
    remaining_qty: 130,
    closes_at: new Date(now + 1000 * 60 * 60 * 33).toISOString(),
    images: [],
    video_url: null,
    description: "전시/반품 재고 · 경미한 스크래치 있음 · 직접 수령 가능",
  },
  {
    id: "11",
    title: "1회용 마스크 KF94 50,000매",
    category: "건강·위생용품",
    region: "대구",
    location: "대구 성서공단",
    original_price: 350,
    deal_price: 150,
    total_qty: 50000,
    remaining_qty: 41000,
    closes_at: new Date(now + 1000 * 60 * 60 * 15.7).toISOString(),
    images: [],
    video_url: null,
    description: "KC 인증 완료 · 50매입 박스 단위 · 개별포장",
    quantity_unit: "매",
  },
  {
    id: "12",
    title: "반품 노트북 재고 120대",
    category: "IT·사무기기",
    region: "서울",
    location: "서울 성수동",
    original_price: 890000,
    deal_price: 520000,
    total_qty: 120,
    remaining_qty: 77,
    closes_at: new Date(now + 1000 * 60 * 60 * 12.4).toISOString(),
    images: [],
    video_url: null,
    description: "단순변심 반품 · 미개봉/개봉 혼합 · 개별 검수표 제공",
  },
  {
    id: "13",
    title: "A4 복사용지 2,000박스",
    category: "사무용품·비품",
    region: "인천",
    location: "인천 부평",
    original_price: 24000,
    deal_price: 14500,
    total_qty: 2000,
    remaining_qty: 1650,
    closes_at: new Date(now + 1000 * 60 * 60 * 40).toISOString(),
    images: [],
    video_url: null,
    description: "박스당 5개입 · 창고 재고 정리",
  },
  {
    id: "14",
    title: "겨울용 스노우체인 800세트",
    category: "자동차용품",
    region: "강원",
    location: "강원 원주",
    original_price: 42000,
    deal_price: 19800,
    total_qty: 800,
    remaining_qty: 610,
    closes_at: new Date(now + 1000 * 60 * 60 * 50).toISOString(),
    images: [],
    video_url: null, // 2026-09-29: 외부 샘플 영상(자동차 브랜드 광고) 제거
    description: "시즌 오프 재고 · 규격별 혼합 구성",
  },
  {
    id: "15",
    title: "강아지 사료 15kg 300포",
    category: "반려동물용품",
    region: "전북",
    location: "전북 익산",
    original_price: 62000,
    deal_price: 38000,
    total_qty: 300,
    remaining_qty: 190,
    closes_at: new Date(now + 1000 * 60 * 60 * 18.9).toISOString(),
    images: [],
    video_url: null,
    description: "소비기한 6개월 이상 · 미개봉 · 파렛트 단위 상차",
    storage_condition: "상온보관",
  },
  {
    id: "16",
    title: "캐릭터 완구 재고 500개",
    category: "완구·유아용품",
    region: "충남",
    location: "충남 천안",
    original_price: 9900,
    deal_price: 4500,
    total_qty: 500,
    remaining_qty: 380,
    closes_at: new Date(now + 1000 * 60 * 60 * 24).toISOString(),
    images: [],
    video_url: null,
    description: "KC 안전인증 완료 · 박스 단위 구성",
  },
  {
    id: "17",
    title: "창고 정리 혼합재고 파렛트 20개",
    category: "혼합재고",
    region: "경기",
    location: "경기 안성",
    original_price: 3000000,
    deal_price: 1200000,
    total_qty: 20,
    remaining_qty: 14,
    closes_at: new Date(now + 1000 * 60 * 60 * 60).toISOString(),
    images: [],
    video_url: null,
    description: "품목 혼합(생활용품·잡화 등) · 파렛트 단위 일괄 판매 · 직접 실사 권장",
  },
  {
    id: "18",
    title: "미분류 재고 잡화 1,000개",
    category: "기타",
    region: "부산",
    location: "부산 사상구",
    original_price: 5000,
    deal_price: 2200,
    total_qty: 1000,
    remaining_qty: 720,
    closes_at: new Date(now + 1000 * 60 * 60 * 16.2).toISOString(),
    images: [],
    video_url: null,
    description: "분류 미정 잡화 혼합 · 박스 단위 랜덤 구성",
  },
];

// 2026-09-29: 예시 매물 미디어 스위치 — 출처 확인 전인 사진·영상을 한 번에 끌 수 있게.
// false면 모든 예시 카드가 사진 없이(NoPhotoPlaceholder) 표시된다.
// 2026-09-29 (2차): 출처 미확인 미디어는 파일(public/images/mock, public/videos/mock)과 위 경로를 모두
// 삭제함 — 대표 사진을 받으면 public/images/example/ 등에 새로 넣고 images에 경로를 채운 뒤 플래그를 true로.
export const mockDeals: Deal[] = EXAMPLE_MEDIA_ENABLED
  ? RAW_MOCK_DEALS
  : RAW_MOCK_DEALS.map((d) => ({ ...d, images: [], video_url: null }));

export const mockCategories = [
  "수산·축산물",
  "농산물",
  "생활용품",
  "패션잡화",
  "화장품",
  "전자제품",
  "산업원자재",
  "기계설비",
  "가공식품·잡화",
  "가구",
  "건강·위생용품",
  "IT·사무기기",
  "사무용품·비품",
  "자동차용품",
  "반려동물용품",
  "완구·유아용품",
  "혼합재고",
  "기타",
];

export const categoryKeywords: Record<string, string[]> = {
  // design-v2: "농수축산물"(이름은 농/수/축산 다 포함하는데 실제로는 농산물만 있던 문제)과
  // "냉동냉장식품"(이름은 보관상태인데 실제로는 수산물+축산물 전체를 담당하던 문제)의
  // 이름-실제 쓰임 불일치를 해소 — 품목 유형 기준으로 "농산물"/"수산·축산물"로 재정리.
  // 보관 상태(냉동/건조/활 등)는 카테고리가 아니라 sell 폼의 "보관조건" 필드에서 다룸.
  // 2026-09-29: 실사용 단어로 보강 (카테고리당 10개 이상). 짧은 단어가 긴 단어 일부로 잘못 잡히는 걸 막으려고
  // "굴"(굴삭기)·"차"(자동차)·"김"(김치냉장고)·"펫"(카펫)·"랩"(랩탑)처럼 한두 글자 단어는 넣지 않음.
  // 여러 카테고리에 걸리면 가장 긴 단어가 이김 (guessCategory) — 예: "업소용 냉동고"는 냉동(수산) 대신 냉동고(전자).
  "수산·축산물": ["갈치", "고등어", "삼겹살", "생선", "수산", "냉동", "냉장", "새우", "오징어", "조기", "닭고기", "돈육", "소고기", "축산물", "정육", "아이스크림", "만두", "한우", "계란", "광어", "연어", "참치", "명태", "꽃게", "전복", "멸치", "돼지고기", "목살", "갈비", "오리고기", "수입육"],
  농산물: ["농산물", "과일", "채소", "쌀", "감자", "고구마", "배추", "사과", "양파", "수박", "과채", "당근", "마늘", "대파", "토마토", "딸기", "포도", "감귤", "버섯", "잡곡", "옥수수", "고춧가루"],
  생활용품: ["세제", "휴지", "수건", "욕실용품", "주방용품", "청소용품", "생활잡화", "물티슈", "칫솔", "치약", "샴푸", "바디워시", "섬유유연제", "락스", "고무장갑", "지퍼백", "위생랩", "텀블러", "밀폐용기", "키친타월"],
  패션잡화: ["의류", "신발", "가방", "액세서리", "모자", "양말", "잡화", "티셔츠", "바지", "청바지", "자켓", "점퍼", "패딩", "운동화", "구두", "슬리퍼", "벨트", "지갑", "우산", "스카프", "속옷"],
  화장품: ["스킨케어", "메이크업", "화장품", "크림", "로션", "립스틱", "마스크팩", "선크림", "에센스", "세럼", "앰플", "클렌징", "쿠션팩트", "파운데이션", "향수", "네일", "스킨토너"],
  전자제품: ["가전", "전자제품", "냉장고", "세탁기", "청소기", "에어컨", "TV", "텔레비전", "전자레인지", "선풍기", "제습기", "가습기", "공기청정기", "밥솥", "전기포트", "드라이기", "이어폰", "스피커", "냉동고", "김치냉장고"],
  산업원자재: ["원단", "철강", "원사", "산업자재", "화학원료", "플라스틱원료", "알루미늄", "구리", "동판", "철판", "강관", "합판", "목재", "레진", "펠릿", "시멘트", "스크랩", "코일", "원자재"],
  기계설비: ["기계", "설비", "공구", "모터", "펌프", "밸브", "지게차", "포크리프트", "리프트", "컴프레서", "발전기", "용접기", "공작기계", "CNC", "선반", "프레스", "컨베이어", "중장비", "굴삭기"],
  "가공식품·잡화": ["라면", "과자", "음료", "통조림", "소스", "조미료", "가공식품", "커피", "즉석밥", "참기름", "식용유", "밀가루", "설탕", "소금", "간장", "된장", "고추장", "시리얼", "생수", "냉동식품"],
  가구: ["침대", "소파", "책상", "의자", "가구", "수납장", "식탁", "테이블", "옷장", "서랍장", "책장", "매트리스", "행거", "진열대", "캐비닛", "파티션", "사무집기", "사무용가구", "철제선반", "앵글선반", "진열선반", "수납선반"],
  "건강·위생용품": ["마스크", "손소독제", "비타민", "건강기능식품", "위생용품", "영양제", "홍삼", "유산균", "체온계", "반창고", "붕대", "생리대", "소독제", "방역", "니트릴장갑", "위생장갑"],
  "IT·사무기기": ["노트북", "컴퓨터", "모니터", "프린터", "키보드", "태블릿", "아이패드", "스마트폰", "휴대폰", "마우스", "복합기", "복사기", "서버", "공유기", "외장하드", "SSD", "빔프로젝터", "포스기"],
  "사무용품·비품": ["문구", "사무용품", "복사용지", "토너", "볼펜", "노트", "클리어파일", "바인더", "스테이플러", "포스트잇", "서류봉투", "박스테이프", "라벨지", "명함", "화이트보드", "A4"],
  자동차용품: ["자동차용품", "타이어", "차량부품", "워셔액", "엔진오일", "블랙박스", "와이퍼", "차량용", "시트커버", "세차용품", "내비게이션", "부동액", "브레이크패드", "자동차배터리", "알로이휠"],
  반려동물용품: ["강아지", "고양이", "사료", "반려동물", "애견", "애묘", "캣타워", "배변패드", "하네스", "리드줄", "츄르", "급식기", "이동장", "펫용품", "펫푸드", "스크래쳐"],
  "완구·유아용품": ["장난감", "완구", "기저귀", "유아용품", "젖병", "인형", "레고", "퍼즐", "유모차", "카시트", "분유", "유아복", "보행기", "킥보드", "아기용품", "아기옷"],
  혼합재고: ["혼합재고", "잡화모음", "다품목", "땡처리", "재고정리", "창고정리", "일괄판매", "떨이", "랜덤박스", "여러품목", "혼합품목"],
  기타: [],
};

// 여러 카테고리 단어가 걸리면 가장 긴 단어의 카테고리 (같은 길이면 mockCategories 순서).
// 영문은 대소문자 무시(TV·CNC·SSD), 띄어쓰기를 뺀 상품명으로도 한 번 더 비교.
export function guessCategory(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const tNoSpace = t.replace(/\s+/g, ""); // "철제 선반"도 "철제선반"(가구)으로 — 기계설비 "선반"보다 긴 단어라 이김
  let best: string | null = null;
  let bestLen = 0;
  for (const category of mockCategories) {
    for (const kw of categoryKeywords[category] ?? []) {
      const k = kw.toLowerCase();
      if (kw.length > bestLen && (t.includes(k) || tNoSpace.includes(k))) {
        best = category;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

// 추천이 안 된 상품명은 콘솔에 남김 — 키워드 보강용 (buy·sell 상품명 칸에서 포커스가 빠질 때). 개발·로컬에서만.
export function logUnmatchedProductName(form: "buy" | "sell", text: string): void {
  if (process.env.NODE_ENV === "production") return;
  const t = text.trim();
  if (t && !guessCategory(t)) console.info(`[카테고리 추천 없음] ${form}: ${t}`);
}

export const categoryIcons: Record<string, string> = {
  "수산·축산물": "🧊",
  농산물: "🌾",
  생활용품: "📦",
  패션잡화: "👜",
  화장품: "💄",
  전자제품: "🔌",
  산업원자재: "🏗️",
  기계설비: "⚙️",
  "가공식품·잡화": "🥫",
  가구: "🛋️",
  "건강·위생용품": "🧴",
  "IT·사무기기": "💻",
  "사무용품·비품": "🗄️",
  자동차용품: "🚗",
  반려동물용품: "🐾",
  "완구·유아용품": "🧸",
  혼합재고: "🔀",
  기타: "🗂️",
};

// 카테고리마다 고유 컬러를 줘서 리스트에서 한눈에 구분되게 합니다.
export const categoryColors: Record<string, { bg: string; text: string; solid: string }> = {
  "수산·축산물": { bg: "#E0F7FA", text: "#0E7C82", solid: "#17B8C4" },
  농산물: { bg: "#E8F8EC", text: "#1D8A44", solid: "#34C471" },
  생활용품: { bg: "#F3EBFF", text: "#7A3FC2", solid: "#9B5DE5" },
  패션잡화: { bg: "#FFE9F3", text: "#C22B72", solid: "#F5439B" },
  화장품: { bg: "#FFEAF0", text: "#C22050", solid: "#FF5C8A" },
  전자제품: { bg: "#EDEBFF", text: "#4C3FB8", solid: "#6C5CE7" },
  산업원자재: { bg: "#F5EDE4", text: "#7A5230", solid: "#A9744F" },
  기계설비: { bg: "#EAEDF5", text: "#3D4A66", solid: "#5C6B8C" },
  "가공식품·잡화": { bg: "#FFF4E0", text: "#966B00", solid: "#F5A623" },
  가구: { bg: "#FDE9E0", text: "#B84A24", solid: "#E8794A" },
  "건강·위생용품": { bg: "#E6F9F1", text: "#0F7A5C", solid: "#2BB894" },
  "IT·사무기기": { bg: "#E7F0FF", text: "#1D4FA0", solid: "#3E7BFA" },
  "사무용품·비품": { bg: "#EEF1F5", text: "#45505E", solid: "#7C8BA0" },
  자동차용품: { bg: "#FDEBEA", text: "#A32B2B", solid: "#E5484D" },
  반려동물용품: { bg: "#FFF6DE", text: "#8A6100", solid: "#F2B705" },
  "완구·유아용품": { bg: "#E9F6FF", text: "#0B6FA6", solid: "#38B6FF" },
  혼합재고: { bg: "#F2F1E6", text: "#6B6420", solid: "#B5A642" },
  기타: { bg: "#F1F1EF", text: "#5C5C57", solid: "#8A8A82" },
};

export const mockRegions = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];
