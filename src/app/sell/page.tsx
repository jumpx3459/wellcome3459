"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TabLink from "@/components/TabLink";
import { hasAppHistory, goHome } from "@/lib/appNav";
import { CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockRegions, categoryIcons, quantityUnits, guessCategory, logUnmatchedProductName } from "@/lib/mockData";
import ImageUploader from "@/components/ImageUploader";
import VideoUploader from "@/components/VideoUploader";
import ManifestUploader from "@/components/ManifestUploader";
import { formatPriceInput, parsePriceInput } from "@/lib/format";
import { isValidContactPhone, formatContactPhone } from "@/lib/auth";
import ContactPhoneInput from "@/components/ContactPhoneInput";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import type { ManifestRow } from "@/lib/parseCsv";
import { rem } from "@/lib/rem";
import { type StockType } from "@/lib/stockType";
import StockTypePicker from "@/components/StockTypePicker";
import { getPhotoLimit, isPhotoLimitMaxed, MAX_PHOTO_SLOTS } from "@/lib/photoLimit";
import { authFetch } from "@/lib/authFetch";
import { FieldLabel, FieldTag, DEAL_INPUT_FONT_SIZE, DEAL_HINT_STYLE, DEAL_CHIP_FONT_SIZE } from "@/components/FormField";
import {
  isStorageType, isValidExpiryDate, discountPercent, priceWarnings, HIGH_DISCOUNT_PCT, formatExpiry, EXPIRY_REQUIRED_MESSAGE,
  PACKAGE_UNIT_EXAMPLES, SPEC_EXAMPLES, ORIGIN_EXAMPLES, type StorageType,
} from "@/lib/dealFields";
import { SuggestInput, StorageTypeButtons } from "@/components/DealFormInputs";
import { DEAL_PRICE_UNITS, LUMP_SUM, isDealPriceUnit, isLumpSum, priceUnitSuffix, type DealPriceUnit } from "@/lib/priceUnit";
import CategoryChips from "@/components/CategoryChips";
import FloatingCTA, { FloatingCTANote, FLOATING_CTA_BUTTON_CLASS, FLOATING_CTA_SPACE, floatingCtaButtonStyle } from "@/components/FloatingCTA";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";
import SellGuestNotice from "@/components/SellGuestNotice";
import { normalizeTitle, checkTitle, checkDescription } from "@/lib/titleGuard";
import ConfirmWarnings, { BLOCK_COLOR, WARN_COLOR } from "@/components/ConfirmWarnings";
import { COMPANY_DISCLOSURE_TEXT, CONSENT_TEXT } from "@/lib/consent";

// 2026-09-30: 작성 중 내용 (sessionStorage) — 사진·영상은 이미 올라간 URL만 보관, 매니페스트 표는 제외
const SELL_DRAFT_KEY = "dj_sell_draft";
type SellDraft = {
  companyName: string; isAnonymous: boolean; contactName: string; contactPhone: string; category: string;
  categoryTouched: boolean; stockType: string; region: string; productName: string; quantity: string; quantityUnit: string;
  minOrderQty: string; hopePrice: string; originalPrice: string; priceUnit: string; priceUnitTouched: boolean; hopeDurationHours: string;
  description: string; packageUnit: string; origin: string; spec: string; storageType: string; expiryDate: string; pid: string;
  images: string[]; videoUrl: string | null; showDetails: boolean;
};

export default function SellPage() {
  const router = useRouter();
  // 2026-09-28: ← 버튼이 무조건 홈으로 가서, deals/[id]처럼 딥링크(공유/카톡)로
  // 바로 들어온 경우가 아니라 앱 내 다른 화면에서 들어온 경우엔 그 화면으로
  // 돌아가도록 통일 — window.history.length는 카카오톡 인앱 브라우저 등에서
  // 직접 진입해도 1보다 큰 경우가 있어(앱 밖으로 튕겨나감) 대신 이 세션에서
  // 실제 앱 내 이동이 있었는지(hasAppHistory)로 판단.
  const goBack = () => {
    if (hasAppHistory()) {
      router.back();
    } else {
      goHome(router); // 2026-10-01 PR-C: 홈을 위에 쌓지 않음(replace) — 홈에서 뒤로가기 = 앱 종료
    }
  };
  const [companyName, setCompanyName] = useState("");
  // 2026-09-30: 업체명 공개 설정 기본 비공개 (consent-texts 7-2) — 승인 시 공개 && 업체명 있음 → 상호, 그 외 "비공개 판매자"
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [companyError, setCompanyError] = useState<string | null>(null);
  // [필수] 판매자 확인 사항 — 매번 새로 체크(작성 중 내용에 저장하지 않음), 서버가 member_consents(seller_terms)에 기록
  const [sellerTermsAgreed, setSellerTermsAgreed] = useState(false);
  const [sellerTermsError, setSellerTermsError] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [autofilledPhone, setAutofilledPhone] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [bonusPhotoSlots, setBonusPhotoSlots] = useState(0);

  // 2026-09-30: 판매 신청은 회원 전용 — 비회원(로그인 안 함·가입 전)이면 폼 대신 SellGuestNotice.
  // checking 동안은 폼을 그리지 않음(작성 중 내용 복원 전 업로더가 먼저 마운트되지 않게).
  const [authState, setAuthState] = useState<"checking" | "member" | "guest">("checking");
  const draftPhoneRef = useRef<string | null>(null); // 복원한 작성 중 연락처가 있으면 회원 번호로 덮어쓰지 않음

  // 로그인한 회원이면 인증된 번호를 미리 채워준다 — 대리 등록(다른 담당자
  // 연락처로 접수) 케이스가 있어서 수정은 그대로 허용한다.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthState("member"); // 로컬 데모(Supabase 미설정) — 저장 없이 폼만
      return;
    }
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAuthState("guest");
        return;
      }
      const { data: member } = await supabase
        .from("members")
        .select("phone, bonus_photo_slots")
        .eq("id", userData.user.id)
        .maybeSingle();
      // 인증만 하고 가입(members 행)을 안 마친 경우도 비회원 — 서버(/api/seller-requests)도 같은 기준
      if (!member) {
        setAuthState("guest");
        return;
      }
      setMemberId(userData.user.id);
      setAuthState("member");
      if (member.phone && !draftPhoneRef.current) {
        const filled = formatContactPhone(member.phone);
        setContactPhone(filled);
        setAutofilledPhone(filled);
      }
      setBonusPhotoSlots(member.bonus_photo_slots ?? 0);
    })();
  }, []);
  const [category, setCategory] = useState<string>("");
  const [stockType, setStockType] = useState<StockType>("general");
  const [categoryTouched, setCategoryTouched] = useState(false);
  // 2026-09-27: buy/page.tsx와 동일하게 자동 추천되면 칩 목록 대신 요약
  // 한 줄("추천됨" 배지 포함)로 접고, "수정"을 눌러야 다시 펼치도록 통일.
  const [categoryEditing, setCategoryEditing] = useState(true);
  const [region, setRegion] = useState<string>("");
  const [productName, setProductName] = useState("");

  // 카테고리 자동 추천 (2026-09-29 규칙 정리):
  //   - 직접 고르기 전(categoryTouched=false)엔 상품명이 바뀔 때마다 다시 계산
  //   - 상품명을 지우거나 매칭이 없으면 비움 (기본값 없음 — 예전엔 이전 추천이 그대로 남았음)
  //   - 직접 고른 뒤엔 상품명이 바뀌어도 덮어쓰지 않음
  useEffect(() => {
    if (categoryTouched) return;
    const guessed = guessCategory(productName);
    setCategory(guessed ?? "");
    if (!guessed) {
      setCategoryEditing(true);
      return;
    }
    // 2026-09-27: "수정"으로 직접 펼친 상태에서 상품명을 계속 입력하면 이
    // effect가 매번 다시 실행돼 추천 카테고리로 도로 접혀버리는 문제 —
    // 카테고리가 비어있을 때(=아직 한 번도 추천된 적 없을 때)만 자동으로
    // 접고, 이미 펼쳐서 보고 있는 중이면 그대로 유지한다.
    if (!category) setCategoryEditing(false);
  }, [productName, categoryTouched]);
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState(quantityUnits[0]);
  const [minOrderQty, setMinOrderQty] = useState("");
  const [moqError, setMoqError] = useState<string | null>(null);
  const showMoqError = (msg: string) => {
    setMoqError(msg);
    const el = document.getElementById("sell-minOrderQty");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };
  const [hopePrice, setHopePrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState(""); // 2026-10-01 PR-B [3]: 정상 단가(선택) — 할인율 표시
  const [priceWarns, setPriceWarns] = useState<string[]>([]); // [12] 할인율 80% 이상
  // 2026-09-29: 단가 단위 — 수량 단위와 따로. 기본은 수량 단위를 따라가고, 직접 고르면 그 값 유지
  const [priceUnit, setPriceUnit] = useState<DealPriceUnit>(quantityUnits[0] as DealPriceUnit);
  const [priceUnitTouched, setPriceUnitTouched] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const lumpSum = isLumpSum(priceUnit);
  const [hopeDurationHours, setHopeDurationHours] = useState("24");
  const [description, setDescription] = useState("");
  const [packageUnit, setPackageUnit] = useState("");
  const [origin, setOrigin] = useState("");
  const [spec, setSpec] = useState("");
  // 2026-10-01 PR-B [6]: 보관 조건(상온·냉장·냉동)과 소비기한(날짜) 분리 — 재고 유형 "소비기한 임박"이면 소비기한 필수
  const [storageType, setStorageType] = useState<StorageType | "">("");
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [pid, setPid] = useState(""); // 2026-09-26: 리퀴데이션 파렛트 등의 매니페스트/PID 번호 (선택)
  const [manifestItems, setManifestItems] = useState<ManifestRow[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 2026-09-30: 작성 중 내용 유지 — 제출 중 세션이 끊겨 로그인·가입을 다녀와도(returnTo=/sell) 이어서 쓰게
  // sessionStorage에 보관. 저장소가 막혀 있으면(사생활 보호 모드 등) 조용히 넘어감. 카테고리 자동 추천 effect보다
  // 뒤에 둬야 첫 렌더의 추천 effect가 복원한 카테고리를 비우지 않음.
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    let d: Partial<SellDraft> | null = null;
    try {
      const raw = window.sessionStorage.getItem(SELL_DRAFT_KEY);
      d = raw ? (JSON.parse(raw) as Partial<SellDraft>) : null;
    } catch {}
    if (d) {
      if (typeof d.companyName === "string") setCompanyName(d.companyName);
      if (typeof d.isAnonymous === "boolean") setIsAnonymous(d.isAnonymous);
      if (typeof d.contactName === "string") setContactName(d.contactName);
      if (typeof d.contactPhone === "string" && d.contactPhone) {
        setContactPhone(d.contactPhone);
        draftPhoneRef.current = d.contactPhone;
      }
      if (typeof d.categoryTouched === "boolean") setCategoryTouched(d.categoryTouched);
      if (typeof d.category === "string") setCategory(d.category);
      if (d.category) setCategoryEditing(false);
      if (typeof d.stockType === "string") setStockType(d.stockType as StockType);
      if (typeof d.region === "string") setRegion(d.region);
      if (typeof d.productName === "string") setProductName(d.productName);
      if (typeof d.quantity === "string") setQuantity(d.quantity);
      if (typeof d.quantityUnit === "string") setQuantityUnit(d.quantityUnit);
      if (typeof d.minOrderQty === "string") setMinOrderQty(d.minOrderQty);
      if (typeof d.hopePrice === "string") setHopePrice(d.hopePrice);
      if (typeof d.originalPrice === "string") setOriginalPrice(d.originalPrice);
      if (typeof d.priceUnit === "string" && isDealPriceUnit(d.priceUnit)) setPriceUnit(d.priceUnit);
      if (typeof d.priceUnitTouched === "boolean") setPriceUnitTouched(d.priceUnitTouched);
      if (typeof d.hopeDurationHours === "string") setHopeDurationHours(d.hopeDurationHours);
      if (typeof d.description === "string") setDescription(d.description);
      if (typeof d.packageUnit === "string") setPackageUnit(d.packageUnit);
      if (typeof d.origin === "string") setOrigin(d.origin);
      if (typeof d.spec === "string") setSpec(d.spec);
      if (isStorageType(d.storageType)) setStorageType(d.storageType);
      if (isValidExpiryDate(d.expiryDate)) setExpiryDate(d.expiryDate);
      if (typeof d.pid === "string") setPid(d.pid);
      if (Array.isArray(d.images)) setImages(d.images.filter((u): u is string => typeof u === "string"));
      if (typeof d.videoUrl === "string") setVideoUrl(d.videoUrl);
      if (typeof d.showDetails === "boolean") setShowDetails(d.showDetails);
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady || done) return;
    const d: SellDraft = {
      companyName, isAnonymous, contactName, contactPhone, category, categoryTouched, stockType, region, productName,
      quantity, quantityUnit, minOrderQty, hopePrice, originalPrice, priceUnit, priceUnitTouched, hopeDurationHours, description,
      packageUnit, origin, spec, storageType, expiryDate, pid, images, videoUrl, showDetails,
    };
    try {
      window.sessionStorage.setItem(SELL_DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [
    draftReady, done, companyName, isAnonymous, contactName, contactPhone, category, categoryTouched, stockType, region,
    productName, quantity, quantityUnit, minOrderQty, hopePrice, originalPrice, priceUnit, priceUnitTouched, hopeDurationHours,
    description, packageUnit, origin, spec, storageType, expiryDate, pid, images, videoUrl, showDetails,
  ]);

  // 2026-10-01 PR-A [11]: 매물명 막기(빨강)·확인 후 저장(주황) — 관리자 폼과 같은 규칙(src/lib/titleGuard.ts), 서버도 다시 검사
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleWarnings, setTitleWarnings] = useState<string[]>([]);
  const [descWarnings, setDescWarnings] = useState<string[]>([]);
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLInputElement | null)?.focus?.({ preventScroll: true });
  };
  const showWarnings = (t: string[], d: string[], pr: string[] = []) => {
    setTitleWarnings(t);
    setDescWarnings(d);
    setPriceWarns(pr);
    setError("주황 안내를 확인하고 \"그대로 저장\"을 눌러주세요.");
    if (!t.length && !pr.length && d.length) setShowDetails(true);
    setTimeout(() => scrollTo(t.length ? "sell-productName" : pr.length ? "sell-originalPrice" : "sell-description"), 50);
  };

  const submit = async (confirmWarnings = false) => {
    setError(null);
    setMoqError(null);
    setPriceError(null);
    setExpiryError(null);
    if (!productName || !quantity || !contactPhone) {
      setError("매물명 · 재고 총수량 · 판매 단가 · 연락처는 꼭 입력해주세요.");
      return;
    }
    const cleanName = normalizeTitle(productName);
    if (cleanName !== productName) setProductName(cleanName);
    const nameCheck = checkTitle(cleanName);
    if (nameCheck.block) {
      setTitleError(nameCheck.block);
      setError("빨간 안내가 있는 칸을 확인해주세요.");
      scrollTo("sell-productName");
      return;
    }
    // 2026-09-29: 판매(희망) 단가 필수 — 서버(/api/seller-requests)도 같은 검증
    const price = parsePriceInput(hopePrice);
    if (!price || price <= 0) {
      setPriceError("판매 단가를 입력해주세요");
      scrollTo("sell-hopePrice");
      return;
    }
    const orig = parsePriceInput(originalPrice);
    // 2026-10-01 PR-B: 소비기한 임박 재고는 소비기한 필수 (서버도 같은 규칙)
    if (stockType === "near_expiry" && !expiryDate) {
      setExpiryError(EXPIRY_REQUIRED_MESSAGE);
      scrollTo("sell-expiryDate");
      return;
    }
    if (!confirmWarnings) {
      const d = checkDescription(description);
      const pr = priceWarnings(orig, price);
      if (nameCheck.warnings.length || d.length || pr.length) {
        showWarnings(nameCheck.warnings, d, pr);
        return;
      }
    }
    setTitleWarnings([]);
    setDescWarnings([]);
    setPriceWarns([]);
    // 2026-09-29: 사무실 번호(02-, 031-…, 대표번호 15xx 등)도 허용 — 서버도 같은 isValidContactPhone
    if (!isValidContactPhone(contactPhone)) {
      setContactError("휴대폰 또는 사무실 번호를 정확히 입력해주세요");
      document.getElementById("contact-phone")?.focus();
      return;
    }
    // 2026-09-28: 수량 100kg·MOQ 1000kg 같은 신청이 그대로 들어온 사례 — 서버(/api/seller-requests)도 같은 검증
    if (!lumpSum && minOrderQty && quantity && Number(minOrderQty) > Number(quantity)) {
      showMoqError("최소주문량은 재고 총수량보다 클 수 없어요.");
      return;
    }
    if (!sellerTermsAgreed) {
      setSellerTermsError(true);
      document.getElementById("sell-seller-terms")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      // 2026-09-30: 회원 전용 — authFetch가 최신 토큰을 넣고(만료 시 갱신·1회 재시도), 서버는 토큰으로 회원·사진 한도 결정
      const res = await authFetch("/api/seller-requests", {
        json: {
          companyName: companyName || null,
          isAnonymous,
          // 회원 연결은 서버가 accessToken으로 결정 (memberId는 보내지 않음)
          contactName: contactName || null,
          contactPhone: formatContactPhone(contactPhone),
          category: category || null,
          stockType,
          region: region || null,
          productName: cleanName,
          quantity: Number(quantity),
          quantityUnit,
          minOrderQty: !lumpSum && minOrderQty ? Number(minOrderQty) : null, // 일괄 판매면 최소주문 없음
          priceUnit,
          hopePrice: parsePriceInput(hopePrice) ?? null,
          originalPrice: orig ?? null,
          hopeDurationHours: hopeDurationHours ? Number(hopeDurationHours) : null,
          description,
          packageUnit: packageUnit || null,
          origin: origin || null,
          spec: spec || null,
          storageType: storageType || null,
          expiryDate: expiryDate || null,
          pid: pid || null,
          manifestItems: manifestItems.length ? manifestItems : null,
          images,
          videoUrl,
          sellerTermsAgreed,
          confirmWarnings,
        },
      });
      if (res.status === 401) {
        // 세션이 끊김 — 작성 중 내용은 sessionStorage에 남아 있어 로그인 후 /sell로 돌아오면 그대로 이어짐
        setAuthState("guest");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 422 && data.needsConfirm) {
          showWarnings(data.warnings?.title ?? [], data.warnings?.description ?? [], data.warnings?.price ?? []);
          return;
        }
        if (data.field === "expiryDate") {
          setExpiryError(data.error ?? EXPIRY_REQUIRED_MESSAGE);
          scrollTo("sell-expiryDate");
          return;
        }
        if (data.field === "originalPrice") {
          setError(data.error ?? "정상 단가를 확인해주세요.");
          scrollTo("sell-originalPrice");
          return;
        }
        if (data.field === "title") {
          setTitleError(data.error ?? "매물명을 확인해주세요.");
          scrollTo("sell-productName");
          return;
        }
        if (data.field === "contactPhone") {
          setContactError(data.error ?? "연락처를 확인해주세요.");
          document.getElementById("contact-phone")?.focus();
          return;
        }
        if (data.field === "hopePrice") {
          setPriceError(data.error ?? "판매 단가를 입력해주세요");
          document.getElementById("sell-hopePrice")?.focus();
          return;
        }
        if (data.field === "minOrderQty") {
          showMoqError(data.error ?? "최소주문량은 재고 총수량보다 클 수 없어요.");
          return;
        }
        if (data.field === "images") {
          setError(data.error ?? "사진 장수를 확인해주세요.");
          return;
        }
        if (data.field === "companyName") {
          setCompanyError(data.error ?? "업체명을 확인해주세요.");
          document.getElementById("sell-companyName")?.focus();
          return;
        }
        if (data.field === "sellerTerms") {
          setSellerTermsError(true);
          return;
        }
        throw new Error();
      }
      setDone(true);
      try {
        window.sessionStorage.removeItem(SELL_DRAFT_KEY);
      } catch {}
    } catch {
      setError("신청 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="flex flex-col min-h-screen">
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4.5" style={{ borderBottom: "1px solid #EEF0F2" }}>
          <button type="button" onClick={goBack} className="text-gray500" style={{ fontSize: rem(19), background: "none", border: "none", padding: 0, cursor: "pointer" }}>←</button>
          {/* 2026-09-26: 탭 화면마다 로고 유무가 달라 브랜드 인지가 끊긴다는 피드백 —
              모든 하단탭 화면 헤더에 작은 로고를 공통으로 배치. */}
          <img src="/images/logo.png" alt="덤핑점핑" className="w-6 h-6 rounded-md flex-shrink-0 object-contain" />
          <span className="font-display text-2xl whitespace-nowrap" style={{ color: "#0B2540" }}>
            재고 판매 등록
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-6" style={{ paddingTop: 36 }}>
          <CheckCircle className="w-12 h-12 mb-4 text-verified" />
          <h1 className="font-display text-2xl text-navy mb-2">신청이 접수됐어요</h1>
          <p className="text-gray500 text-base leading-relaxed mb-6">
            {/* 2026-09-29: "24시간 이내에" → 매물 상세 배지("빠르게 연락드려요")와 같은 톤 */}
            점핑매니저가 검토 후{" "}
            <br className="hidden sm:inline" />
            입력하신 번호로 빠르게 연락드려요.
          </p>
          <div className="bg-gray100 rounded-2xl px-6 py-5 flex flex-col items-center gap-3">
            <img
              src="/images/manager.png"
              alt="점핑매니저"
              className="w-32 h-32 rounded-xl object-contain bg-white"
            />
            <p className="text-sm font-bold text-navy">점핑매니저가 바로 연락드립니다.</p>
          </div>

          {memberId && (
            <TabLink
              href="/mypage#referral"
              className="w-full block text-left rounded-2xl mt-4"
              style={{ background: "#FFF9EC", border: "1px solid #F0DCA8", padding: "13px 15px" }}
            >
              <p className="text-xs font-bold" style={{ color: "#8A6100" }}>
                {isPhotoLimitMaxed({ bonus_photo_slots: bonusPhotoSlots })
                  ? `🎁 사진 슬롯을 최대로 모았어요 (${MAX_PHOTO_SLOTS}장)`
                  : `🎁 친구 추천하면 나도 친구도 사진 슬롯 +2장 (최대 ${MAX_PHOTO_SLOTS}장까지)`}
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A6100" }}>추천 링크 보내러 가기 →</p>
            </TabLink>
          )}

          <TabLink
            href="/"
            className={`w-full mt-5 ${BTN_CLASS}`}
            style={btnStyle("primary")}
          >
            홈으로
          </TabLink>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* 2026-09-27 (deals/buy 스타일 통일): 하단 탭 레벨 화면 중 sell만 유일하게
          뒤로가기(←)+인라인 타이틀 구조를 쓰던 불일치 — deals/buy와 동일하게
          "로고=홈 링크 + Powered by JumpX 배지(+수수료 0원 배지) / 라벨+로테이션
          태그 행 / 좌측 정렬 대형 타이틀" 구조로 교체. 매니저+안내문구도 buy처럼
          네이비 헤더 안으로 이동. */}
      <div
        className="flex-shrink-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(120deg, #04101C, #1A4B78)",
          backgroundSize: "16px 16px, cover",
        }}
      >
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-center gap-2 mb-3">
            {/* 2026-09-27: buy(찾습니다)·sell(매물등록)은 진입 경로가 다양해
                로고=홈 링크만으로는 부족하다는 피드백 — 뒤로가기(←)를 복원. */}
            <button type="button" onClick={goBack} style={{ fontSize: rem(19), color: "rgba(255,255,255,0.8)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>←</button>
            <TabLink href="/" className="bg-white rounded-lg px-2.5 py-1.5 inline-block shadow-sm">
              <img src="/images/logo.png" alt="덤핑점핑" className="h-7 w-auto" />
            </TabLink>
            <span
              className="rounded-full font-medium"
              style={{ fontSize: rem(11), color: "rgba(255,255,255,0.6)", padding: "3px 9px", background: "rgba(255,255,255,0.08)" }}
            >
              Powered by JumpX
            </span>
            {/* 2026-09-26 (3): 흰 글자+#03C75A 배경은 2.25:1로 11px 텍스트 기준(4.5:1)
                미달 — 네이비 글자로 바꿔 6.89:1 확보. */}
            <span className="ml-auto flex-shrink-0 font-bold rounded-full" style={{ fontSize: rem(11), color: "#0B2540", background: "#03C75A", padding: "5px 10px" }}>
              수수료 0원
            </span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-y-1.5">
            <div className="text-xs font-bold tracking-widest whitespace-nowrap" style={{ color: "#FFD166" }}>
              재고 판매 등록
            </div>
            <RotatingUrgencyTag style={{ color: "var(--color-brandOrangeAccent)" }} />
          </div>
          <h1 className="font-display text-2xl mt-1.5 text-white">지금 등록하고 빠르게 파세요</h1>
        </div>

      </div>

      {authState === "guest" && <SellGuestNotice />}

      {authState === "member" && draftReady && (
      <>
      <div className="flex-1 px-5 py-4.5 flex flex-col gap-4.5" style={{ paddingBottom: FLOATING_CTA_SPACE }}>
        {/* 2026-09-29: 헤더 안 캐릭터 소개(76px/13px) 대신 buy와 같은 "완전 무료" 카드 (판매자용 문구) */}
        <div className="flex items-center gap-3 rounded-2xl" style={{ background: "#fff", border: "1.5px solid #E4E7EB", padding: "15px 16px" }}>
          <img src="/images/manager.png" alt="점핑매니저" className="flex-shrink-0 rounded-xl bg-white" style={{ width: 72, height: 72, objectFit: "contain" }} />
          <span className="flex-1 min-w-0">
            <span className="block" style={{ fontSize: rem(18), fontWeight: 700, color: "#0B2540" }}>판매 등록은 완전 무료예요</span>
            <span className="block font-bold mt-1 leading-relaxed" style={{ fontSize: rem(16), color: "#E25100" }}>
              조건 맞는 구매자에게 빠르게 알림이 가요
            </span>
          </span>
        </div>

        {/* 2026-09-29: 재고 유형(선택) — 매물 카드·상세·푸시 앞에 배지로 표시 (일반 재고는 배지 없음) */}
        <div>
          <FieldLabel compact need="optional">재고 유형</FieldLabel>
          <StockTypePicker value={stockType} onChange={setStockType} />
        </div>

        <div>
          <FieldLabel compact need="required">매물 상품명</FieldLabel>
          <input
            id="sell-productName"
            className="w-full rounded-xl outline-none"
            style={{ border: `1.5px solid ${titleError ? BLOCK_COLOR : "#E4E7EB"}`, padding: 14, fontSize: DEAL_INPUT_FONT_SIZE }}
            value={productName}
            onChange={(e) => {
              setProductName(e.target.value);
              setTitleError(null);
              setTitleWarnings([]);
            }}
            onBlur={() => logUnmatchedProductName("sell", productName)}
            placeholder={stockType === "closure" ? "예: 사무집기 일괄 (책상·의자·캐비닛)" : "예: 국내산 갈치 20kg 박스"}
          />
          {titleError && <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{titleError}</p>}
          <ConfirmWarnings warnings={titleWarnings} onConfirm={() => submit(true)} busy={submitting} />
        </div>

        <div>
          <FieldLabel compact need="optional">카테고리</FieldLabel>
          {stockType === "closure" && (
            <p className="mb-2" style={DEAL_HINT_STYLE}>
              여러 품목이 섞였으면 &apos;혼합재고&apos;를 골라주세요
            </p>
          )}
          {categoryEditing ? (
            <>
            {!category && !categoryTouched && (
              <p className="mb-2" style={DEAL_HINT_STYLE}>💡 상품명을 입력하면 카테고리를 자동으로 골라드려요</p>
            )}
            {/* 2026-09-29: 기본 2줄 + "더보기" (CategoryChips) */}
            <CategoryChips
              value={category}
              onPick={(c) => {
                setCategoryTouched(true);
                setCategory(c);
                setCategoryEditing(false);
              }}
            />
            </>
          ) : (
            <div className="flex items-center justify-between rounded-xl" style={{ border: "1.5px solid #E4E7EB", padding: "10px 13px" }}>
              <span className="flex items-center gap-1.5 text-sm font-bold min-w-0">
                {category ? (
                  <>
                    <span className="flex-shrink-0">{categoryIcons[category]}</span>
                    <span className="truncate" style={{ color: "#1A1F26" }}>{category}</span>
                    {!categoryTouched && (
                      <span
                        className="flex-shrink-0 text-xs font-bold rounded-full"
                        style={{ color: "var(--color-brandOrange)", background: "#FFF1E7", padding: "2px 8px" }}
                      >
                        추천됨
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: "#9AA3AD", fontWeight: 700 }}>카테고리 선택 안 함</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setCategoryEditing(true)}
                className="flex-shrink-0 text-xs font-bold"
                style={{ color: "#6B7480" }}
              >
                수정
              </button>
            </div>
          )}
        </div>

        {/* 2026-10-01 PR-B: 재고 총수량 → 최소주문수량(단위 표시) → 단가 기준 → 판매 단가(왼쪽)·정상 단가(오른쪽) → 보관·소비기한.
            단가 칸에는 "원"만 두고 기준(kg당 등)은 라벨에 — 375px에서 두 칸을 나란히 둬도 큰 금액이 안 잘림 */}
        <div>
          <FieldLabel compact need="required" htmlFor="sell-quantity">재고 총수량</FieldLabel>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
            <input
              id="sell-quantity"
              type="number"
              inputMode="numeric"
              className="flex-1 min-w-0 outline-none"
              style={{ border: "none", padding: "13px 12px", fontSize: DEAL_INPUT_FONT_SIZE }}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="55"
            />
            <select
              aria-label="재고 총수량 단위"
              className="flex-shrink-0 outline-none"
              style={{ width: 86, border: "none", borderLeft: "1px solid #E4E7EB", padding: "13px 6px", fontSize: DEAL_INPUT_FONT_SIZE, fontWeight: 700, color: "#0B2540", background: "#FAFBFC", textAlign: "center" }}
              value={quantityUnit}
              onChange={(e) => {
                setQuantityUnit(e.target.value);
                if (!priceUnitTouched && isDealPriceUnit(e.target.value)) setPriceUnit(e.target.value);
              }}
            >
              {quantityUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 2026-09-29: 일괄(전체 가격) 판매면 최소주문 의미 없음 → 숨김 */}
        {!lumpSum && (
        <div>
          <FieldLabel compact need="optional" htmlFor="sell-minOrderQty">최소주문수량(MOQ)</FieldLabel>
          <div className="flex items-center rounded-xl" style={{ border: moqError ? "1.5px solid var(--color-orange)" : "1.5px solid #E4E7EB" }}>
            <input
              id="sell-minOrderQty"
              type="number"
              inputMode="numeric"
              className="flex-1 min-w-0 outline-none"
              style={{ border: "none", padding: "13px 0 13px 12px", fontSize: DEAL_INPUT_FONT_SIZE }}
              value={minOrderQty}
              onChange={(e) => {
                setMinOrderQty(e.target.value);
                setMoqError(null);
              }}
              placeholder="예: 5"
            />
            <span className="flex-shrink-0 font-bold" style={{ color: "#0B2540", padding: "0 14px", fontSize: DEAL_INPUT_FONT_SIZE }}>{quantityUnit} 이상</span>
          </div>
          {moqError && <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{moqError}</p>}
        </div>
        )}

        <div>
          <FieldLabel compact need="required" htmlFor="sell-priceUnit">단가 기준</FieldLabel>
          {/* 2026-09-29: 단가 단위 — 수량 단위와 따로 (예: 수량은 박스, 가격은 kg당 / 일괄=전체 가격) */}
          <select
            id="sell-priceUnit"
            className="w-full rounded-xl outline-none"
            style={{ border: "1.5px solid #E4E7EB", padding: "13px 10px", fontSize: DEAL_INPUT_FONT_SIZE, fontWeight: 700, color: "#0B2540", background: "#FAFBFC" }}
            value={priceUnit}
            onChange={(e) => {
              if (!isDealPriceUnit(e.target.value)) return;
              setPriceUnit(e.target.value);
              setPriceUnitTouched(true);
              if (e.target.value === LUMP_SUM) setMinOrderQty("");
            }}
          >
            {DEAL_PRICE_UNITS.map((u) => (
              <option key={u} value={u}>
                {priceUnitSuffix(u)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <FieldLabel compact need="required" htmlFor="sell-hopePrice">판매 단가</FieldLabel>
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: priceError ? "1.5px solid var(--color-orange)" : "1.5px solid var(--color-brandOrange)" }}>
              <input
                id="sell-hopePrice"
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "13px 0 13px 12px", fontSize: DEAL_INPUT_FONT_SIZE }}
                value={formatPriceInput(hopePrice)}
                onChange={(e) => {
                  setHopePrice(e.target.value);
                  setPriceError(null);
                  setPriceWarns([]);
                }}
                placeholder={lumpSum ? "5,000,000" : "219,000"}
              />
              <span className="flex-shrink-0 font-bold" style={{ padding: "0 12px 0 4px", fontSize: DEAL_INPUT_FONT_SIZE, color: "#0B2540" }}>원</span>
            </div>
            <p className="mt-1" style={DEAL_HINT_STYLE}>{priceBasis(priceUnit)}</p>
            {priceError && <p className="font-medium mt-1" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{priceError}</p>}
          </div>
          <div className="min-w-0">
            <FieldLabel compact need="optional" htmlFor="sell-originalPrice">정상 단가</FieldLabel>
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1.5px solid #E4E7EB" }}>
              <input
                id="sell-originalPrice"
                type="text"
                inputMode="numeric"
                className="flex-1 min-w-0 outline-none"
                style={{ border: "none", padding: "13px 0 13px 12px", fontSize: DEAL_INPUT_FONT_SIZE }}
                value={formatPriceInput(originalPrice)}
                onChange={(e) => {
                  setOriginalPrice(e.target.value);
                  setPriceWarns([]);
                }}
                placeholder={lumpSum ? "8,000,000" : "300,000"}
              />
              <span className="flex-shrink-0 font-bold" style={{ padding: "0 12px 0 4px", fontSize: DEAL_INPUT_FONT_SIZE, color: "#0B2540" }}>원</span>
            </div>
            <SellDiscountHint original={parsePriceInput(originalPrice)} deal={parsePriceInput(hopePrice)} />
          </div>
        </div>
        <ConfirmWarnings warnings={priceWarns} onConfirm={titleWarnings.length ? undefined : () => submit(true)} busy={submitting} />

        <div>
          <FieldLabel compact need="optional">보관 조건</FieldLabel>
          <StorageTypeButtons id="sell-storageType" value={storageType} onChange={setStorageType} />
        </div>
        <div>
          <FieldLabel compact need={stockType === "near_expiry" ? "required" : "optional"} htmlFor="sell-expiryDate">소비기한</FieldLabel>
          <input
            id="sell-expiryDate"
            type="date"
            className="w-full rounded-xl outline-none bg-white"
            style={{ border: `1.5px solid ${expiryError ? BLOCK_COLOR : "#E4E7EB"}`, padding: "12px", fontSize: DEAL_INPUT_FONT_SIZE, minHeight: 50 }}
            value={expiryDate}
            onChange={(e) => {
              setExpiryDate(e.target.value);
              setExpiryError(null);
            }}
          />
          {expiryError ? (
            <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{expiryError}</p>
          ) : (
            <p className="mt-1.5" style={DEAL_HINT_STYLE}>
              {expiryDate ? `구매자에게 "${formatExpiry(expiryDate)}"로 보여요.` : stockType === "near_expiry" ? "소비기한 임박 재고는 꼭 입력해주세요." : "식품이면 입력해주세요."}
            </p>
          )}
        </div>

        <div>
          <FieldLabel compact need="required">연락처</FieldLabel>
          <ContactPhoneInput
            value={contactPhone}
            onChange={(v) => {
              setContactPhone(v);
              setContactError(null);
            }}
            autofilledValue={autofilledPhone}
            error={contactError}
          />
        </div>

        <div>
          <FieldLabel compact need="optional">마감까지</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "3", l: "3시간" },
              { v: "12", l: "12시간" },
              { v: "24", l: "24시간" },
              { v: "72", l: "3일" },
              { v: "168", l: "7일" },
              { v: "", l: "점핑매니저와 협의" },
            ].map((opt) => {
              const picked = hopeDurationHours === opt.v;
              return (
                <button
                  key={opt.l}
                  onClick={() => setHopeDurationHours(opt.v)}
                  className="font-bold rounded-xl"
                  style={{
                    padding: "12px 14px",
                    fontSize: DEAL_CHIP_FONT_SIZE,
                    background: "#fff",
                    border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB",
                    color: "#1A1F26",
                  }}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
          <p className="mt-2" style={DEAL_HINT_STYLE}>
            여기서 정한 시간이 구매자에게 보이는 마감 카운트다운 기준이 돼요.
          </p>
        </div>

        {/* 2026-09-30: 업체명·공개 설정을 "상세 정보 추가" 밖으로 (consent-texts 7-2, 기본 비공개) */}
        <div>
          <FieldLabel compact need="optional">업체명</FieldLabel>
          <input
            id="sell-companyName"
            className="w-full border-2 rounded-xl px-4 outline-none focus:border-orange"
            style={{ height: "52px", fontSize: DEAL_INPUT_FONT_SIZE, borderColor: companyError ? "var(--color-orange)" : "#E4E7EB" }}
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setCompanyError(null);
            }}
            placeholder="예: 웰컴코리아(주)"
          />
          {companyError && <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>{companyError}</p>}
          <div className="mt-3 font-bold text-navy" style={{ fontSize: rem(15) }}>{COMPANY_DISCLOSURE_TEXT.title}</div>
          <div className="flex flex-col gap-2 mt-2" role="radiogroup" aria-label="업체명 공개 설정">
            {([true, false] as const).map((anon) => {
              const t = anon ? COMPANY_DISCLOSURE_TEXT.private : COMPANY_DISCLOSURE_TEXT.public;
              const picked = isAnonymous === anon;
              return (
                <label
                  key={t.label}
                  className="flex items-start gap-2.5 rounded-xl cursor-pointer"
                  style={{ padding: "12px 14px", background: "#fff", border: picked ? "2px solid var(--color-brandOrange)" : "1.5px solid #E4E7EB" }}
                >
                  <input type="radio" name="sell-company-disclosure" checked={picked} onChange={() => setIsAnonymous(anon)} className="mt-1 flex-shrink-0" />
                  <span className="leading-relaxed" style={{ fontSize: rem(15), color: "#4B5563" }}>
                    <span className="font-bold text-navy">{t.label}</span> — {t.desc}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div id="sell-seller-terms">
          <label
            className="flex items-start gap-2.5 rounded-xl cursor-pointer"
            style={{ padding: "14px 16px", background: "#F5F6F8", border: sellerTermsError ? "1.5px solid var(--color-orange)" : "1.5px solid transparent" }}
          >
            <input
              type="checkbox"
              checked={sellerTermsAgreed}
              onChange={(e) => {
                setSellerTermsAgreed(e.target.checked);
                setSellerTermsError(false);
              }}
              className="mt-1 flex-shrink-0 w-4 h-4"
            />
            <span className="min-w-0">
              <span className="block font-bold text-navy" style={{ fontSize: rem(15) }}>{CONSENT_TEXT.seller_terms.label}</span>
              <ul className="mt-1.5 flex flex-col gap-1">
                {CONSENT_TEXT.seller_terms.items.map((line) => (
                  <li key={line} className="leading-relaxed" style={{ fontSize: rem(14), color: "#4B5563" }}>· {line}</li>
                ))}
              </ul>
            </span>
          </label>
          {sellerTermsError && (
            <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: "var(--color-orange)" }}>판매자 확인 사항에 동의해주세요.</p>
          )}
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl" style={{ background: "#F5F6F8", padding: "14px 16px" }}>
          <span style={{ fontSize: rem(18) }}>🔔</span>
          <span className="flex-1" style={{ ...DEAL_HINT_STYLE, color: "#0B2540", fontWeight: 500 }}>
            점핑매니저 검토 후, 이 조건 알림을 받는 회원들에게 빠르게 발송돼요.
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center justify-between border-2 border-gray200 rounded-xl px-4 font-bold text-navy"
          style={{ height: "52px", fontSize: rem(15) }}
        >
          <span className="flex items-center gap-1.5">상세 정보 추가 <FieldTag compact need="optional" /></span>
          <span className="text-gray500">{showDetails ? "접기 ▴" : "펼치기 ▾"}</span>
        </button>
        {!showDetails && (
          <p className="-mt-3" style={DEAL_HINT_STYLE}>
            없어도 등록돼요, 매니저가 통화로 확인해요.
          </p>
        )}

        {showDetails && (
          <div className="flex flex-col gap-5 border-2 border-gray200 rounded-2xl p-4">
            <ImageUploader onChange={setImages} initialUrls={images} max={getPhotoLimit({ bonus_photo_slots: bonusPhotoSlots })} />

            <VideoUploader onChange={setVideoUrl} initialUrl={videoUrl} />

            <div>
              <FieldLabel compact need="optional">담당자명</FieldLabel>
              <input
                className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                style={{ height: "52px", fontSize: DEAL_INPUT_FONT_SIZE }}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="홍길동"
              />
            </div>

            <div>
              <FieldLabel compact need="optional" className="mb-1">재고 위치(지역)</FieldLabel>
              <p className="mb-2" style={DEAL_HINT_STYLE}>
                물건이 실제로 있는 지역이에요 — 이 지역 알림을 신청한 회원에게 알림이 가요.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {mockRegions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(region === r ? "" : r)}
                    style={{ fontSize: DEAL_CHIP_FONT_SIZE }}
                    className={`py-2.5 rounded-full border-2 font-bold text-center ${
                      region === r ? "bg-[#FF6F0F] text-white border-[#FF6F0F]" : "border-gray200 text-gray500"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel compact need="optional">상품 상세 스펙</FieldLabel>
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="sell-packageUnit" className="mb-1 block" style={DEAL_HINT_STYLE}>포장 단위</label>
                  <SuggestInput
                    id="sell-packageUnit"
                    className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                    style={{ height: "50px", fontSize: DEAL_INPUT_FONT_SIZE }}
                    value={packageUnit}
                    onChange={setPackageUnit}
                    examples={PACKAGE_UNIT_EXAMPLES}
                    placeholder="20kg 박스"
                  />
                </div>
                <div>
                  <label htmlFor="sell-spec" className="mb-1 block" style={DEAL_HINT_STYLE}>규격/사이즈</label>
                  <SuggestInput
                    id="sell-spec"
                    className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                    style={{ height: "50px", fontSize: DEAL_INPUT_FONT_SIZE }}
                    value={spec}
                    onChange={setSpec}
                    examples={SPEC_EXAMPLES}
                    placeholder="500ml, S~L 혼합"
                  />
                </div>
                <div>
                  <label htmlFor="sell-origin" className="mb-1 block" style={DEAL_HINT_STYLE}>원산지</label>
                  <SuggestInput
                    id="sell-origin"
                    className="w-full border-2 border-gray200 rounded-xl px-4 outline-none focus:border-orange"
                    style={{ height: "50px", fontSize: DEAL_INPUT_FONT_SIZE }}
                    value={origin}
                    onChange={setOrigin}
                    examples={ORIGIN_EXAMPLES}
                    placeholder="국내산, 중국산 등"
                  />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel compact need="optional">추가 설명</FieldLabel>
              <textarea
                className="w-full border-2 border-gray200 rounded-xl px-4 py-3 outline-none focus:border-orange"
                style={{ fontSize: DEAL_INPUT_FONT_SIZE }}
                rows={3}
                id="sell-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescWarnings([]);
                }}
                placeholder="그 밖에 알려주실 내용"
              />
              <ConfirmWarnings warnings={descWarnings} onConfirm={titleWarnings.length ? undefined : () => submit(true)} busy={submitting} />
            </div>

            {/* 2026-09-26: 폐업 정리 등으로 여러 품목이 한 파렛트에 섞인 "혼합매물" 대응 —
                개별 사진 없이 PID/매니페스트 번호 + CSV 목록만으로도 등록할 수 있게. */}
            <div>
              <FieldLabel compact need="optional">PID / 매니페스트 번호</FieldLabel>
              <input
                className="w-full border-2 border-gray200 rounded-xl px-4 py-3 outline-none focus:border-orange"
                style={{ fontSize: DEAL_INPUT_FONT_SIZE }}
                value={pid}
                onChange={(e) => setPid(e.target.value)}
                placeholder="예: P809200159651 (리퀴데이션 파렛트라면 적어주세요)"
              />
            </div>
            <ManifestUploader onChange={setManifestItems} />
          </div>
        )}
      </div>

      {/* design-v2: 필수 항목(제목/수량/연락처)만 채워도 바로 제출할 수 있는데,
          버튼이 폼 맨 아래 인라인으로만 있으면 상세정보까지 스크롤해야 찾을 수
          있었음 — signup 1단계와 같은 이유로 하단 고정 처리.
          에러 메시지도 버튼 바로 위(고정 영역)로 옮김 — 필수 항목(제목/수량/연락처)은
          폼 맨 위에 있는데 버튼은 어디서든 누를 수 있어서, 에러가 상세정보 섹션
          근처에 있으면 스크롤을 안 내린 사용자에게는 화면 밖이라 안 보이던 문제.
          bottom: 0으로 두면 AppShell의 fixed 하단 탭바(BottomNav, z-40)에
          이 영역이 가려서 탭바 높이만큼 띄워서 탭바 바로 위에 오도록 함.
          2026-09-26: position:sticky였는데 실제로는 전혀 안 떠 있던 버그 발견
          (buy/page.tsx와 동일 원인 — layout.tsx의 overflow-x-hidden 단독 설정이
          overflow-y:auto로 계산되면서 의도치 않은 sticky 기준 컨테이너가 됐는데
          그 컨테이너 자체는 내부 스크롤이 발생한 적이 없어 sticky가 무력화됨).
          fixed로 교체하고 위 콘텐츠에 paddingBottom 132px 추가. */}
      {/* 2026-09-27: 홈 하단 CTA와 동일한 톤으로 통일 — 불투명 흰 바+실선 테두리
          대신 반투명+블러 카드 + 상단 페이드로, 스크롤 중인 폼 내용이 자연스럽게
          이어지도록 함. */}
      {/* 2026-09-29: 공용 하단 고정 버튼 — 판·블러 없이 버튼만 띄움 */}
      <FloatingCTA>
          {error && <FloatingCTANote>{error}</FloatingCTANote>}
          <button
            onClick={() => submit()}
            disabled={submitting}
            className={FLOATING_CTA_BUTTON_CLASS}
            style={floatingCtaButtonStyle()}
          >
            {submitting ? "처리 중..." : "무료로 매물 등록하기"}
          </button>
              </FloatingCTA>
      </>
      )}
    </main>
  );
}

// "kg당" / 일괄은 "전체 가격" (2026-10-01 PR-B — 단가 칸엔 "원"만, 기준은 칸 아래)
function priceBasis(unit: string): string {
  return isLumpSum(unit) ? "전체 가격" : `${unit}당`;
}

// 정상 단가 칸 아래 — "○% 할인으로 보여요" / 판매가 ≥ 정상가면 주황 안내 (2026-10-01 PR-B [3])
function SellDiscountHint({ original, deal }: { original?: number | null; deal?: number | null }) {
  if (!original || !deal) return <p className="mt-1" style={DEAL_HINT_STYLE}>할인율 표시용</p>;
  const pct = discountPercent(original, deal);
  if (pct === null) {
    return <p className="mt-1 font-medium" style={{ fontSize: rem(14), color: WARN_COLOR }}>판매가가 정상가보다 높거나 같아 할인율이 안 보여요.</p>;
  }
  return <p className="mt-1 font-bold" style={{ fontSize: rem(14), color: pct >= HIGH_DISCOUNT_PCT ? WARN_COLOR : "#0B7A3E" }}>{pct}% 할인으로 보여요</p>;
}
