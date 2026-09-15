export type Deal = {
  id: string;
  title: string;
  category: string;
  region: string;
  location: string;
  original_price: number;
  deal_price: number;
  total_qty: number;
  remaining_qty: number;
  closes_at: string; // ISO
  images?: string[];
  video_url?: string | null;
  description?: string;
  status?: "active" | "closed";
  package_unit?: string | null; // 포장 단위 (예: "20kg 박스")
  origin?: string | null; // 원산지
  spec?: string | null; // 규격/사이즈
  storage_condition?: string | null; // 보관조건 · 유통기한
  quantity_unit?: string | null; // 수량 단위 (박스/개/kg/톤/팔레트 등) — 없으면 "개"로 표시
  min_order_qty?: number | null; // 최소주문수량(MOQ)
  created_at?: string; // ISO — mock 데이터엔 없음
};

export const quantityUnits = ["개", "박스", "kg", "톤", "팔레트", "세트"];

const now = Date.now();

export const mockDeals: Deal[] = [
  {
    id: "1",
    title: "국내산 갈치 20kg 박스",
    category: "농수축산물",
    region: "서울",
    location: "서울 가락동",
    original_price: 380000,
    deal_price: 219000,
    total_qty: 55,
    remaining_qty: 12,
    closes_at: new Date(now + 1000 * 60 * 60 * 2.97).toISOString(),
    description: "소비기한 등록일로부터 5일 · 냉동 보관 · 박스당 20kg 균일 포장 · 원산지 증명서 제공 가능",
    package_unit: "20kg 박스",
    origin: "국내산 (제주)",
    storage_condition: "냉동보관 · 소비기한 등록일로부터 5일",
    quantity_unit: "박스",
    min_order_qty: 5,
  },
  {
    id: "2",
    title: "스테인리스 텀블러 500ea",
    category: "생활용품",
    region: "인천",
    location: "인천 남동공단",
    original_price: 4200,
    deal_price: 2300,
    total_qty: 500,
    remaining_qty: 340,
    closes_at: new Date(now + 1000 * 60 * 60 * 11.66).toISOString(),
    description: "박스 및 개별 포장 상태 양호 · 사용 흔적 없는 신품 재고 · KC 인증서 보유",
    package_unit: "1개입 개별포장 · 50개입 박스",
    origin: "중국",
    spec: "500ml, 지름 7cm x 높이 22cm",
    quantity_unit: "개",
    min_order_qty: 50,
  },
  {
    id: "3",
    title: "계절 재고 우산 1,200개",
    category: "패션잡화",
    region: "경기",
    location: "경기 부천",
    original_price: 3500,
    deal_price: 1900,
    total_qty: 1200,
    remaining_qty: 1080,
    closes_at: new Date(now + 1000 * 60 * 60 * 28.2).toISOString(),
    description: "전 시즌 이월 재고 · 박스 단위(50개입) 판매 · 색상 랜덤 혼합 구성",
  },
  {
    id: "4",
    title: "산업용 스테인리스 원자재 10톤",
    category: "산업원자재",
    region: "경남",
    location: "경남 김해",
    original_price: 42000000,
    deal_price: 29800000,
    total_qty: 10,
    remaining_qty: 4,
    closes_at: new Date(now + 1000 * 60 * 60 * 5.4).toISOString(),
    description: "재질 증명서(밀시트) 제공 · 규격 균일 · 직접 방문 실사 가능 · 지게차 상차 지원",
  },
  {
    id: "5",
    title: "명품 화장품 재고 (립스틱 외) 800개",
    category: "화장품",
    region: "경기",
    location: "경기 이천",
    original_price: 28000,
    deal_price: 12900,
    total_qty: 800,
    remaining_qty: 0,
    closes_at: new Date(now - 1000 * 60 * 60 * 14).toISOString(),
    description: "정품 인증서 보유 · 마감 완료",
    status: "closed",
  },
  {
    id: "6",
    title: "완구 재고 캐릭터 인형 500개",
    category: "기타",
    region: "충남",
    location: "충남 천안",
    original_price: 9900,
    deal_price: 4500,
    total_qty: 500,
    remaining_qty: 0,
    closes_at: new Date(now - 1000 * 60 * 60 * 40).toISOString(),
    description: "KC 안전인증 완료 · 마감 완료",
    status: "closed",
  },
];

export const mockCategories = [
  "냉동냉장식품",
  "농수축산물",
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

export const categoryIcons: Record<string, string> = {
  냉동냉장식품: "🧊",
  농수축산물: "🌾",
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
  냉동냉장식품: { bg: "#E0F7FA", text: "#0E7C82", solid: "#17B8C4" },
  농수축산물: { bg: "#E8F8EC", text: "#1D8A44", solid: "#34C471" },
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
