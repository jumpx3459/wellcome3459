"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TabLink from "@/components/TabLink";
import { hasAppHistory, goHome } from "@/lib/appNav";
import { CheckCircle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { mockRegions, categoryIcons, quantityUnits, guessCategory, logUnmatchedProductName } from "@/lib/mockData";
import ImageUploader, { type ImageUploadStatus, type ImageUploaderHandle } from "@/components/ImageUploader";
import VideoUploader, { type VideoUploadStatus, type VideoUploaderHandle } from "@/components/VideoUploader";
import VideoNotUploadedSheet, { PHOTO_FAILED_DESCRIPTION, uploadingLabel, videoNotUploaded } from "@/components/VideoNotUploadedSheet";
import ManifestUploader from "@/components/ManifestUploader";
import { formatPriceInput, parsePriceInput } from "@/lib/format";
import { isValidContactPhone } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import ContactPhoneInput from "@/components/ContactPhoneInput";
import RotatingUrgencyTag from "@/components/RotatingUrgencyTag";
import type { ManifestRow } from "@/lib/parseCsv";
import { rem } from "@/lib/rem";
import { type StockType, STOCK_TYPES, isStockType } from "@/lib/stockType";
import { getPhotoLimit, isPhotoLimitMaxed, MAX_PHOTO_SLOTS } from "@/lib/photoLimit";
import { authFetch, AUTH_EXPIRED_EVENT, isAuthNetworkError } from "@/lib/authFetch";
import { FieldLabel, DEAL_INPUT_FONT_SIZE, DEAL_HINT_STYLE, DEAL_CHIP_FONT_SIZE, DEAL_LABEL_STYLE } from "@/components/FormField";
import FormAccordion, { FormSectionTitle, FORM_ROW2, FORM_ROW3 } from "@/components/FormAccordion";
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

// 2026-09-30: 작성 중 내용 (sessionStorage) — 사진·영상은 이미 올라간 URL만 보관
// 2026-10-03 fix/offline-auth-misjudge: 매니페스트 표도 보관(로그인 다녀와도 유지). 판매자 동의 체크는 다시 받으므로 제외
const SELL_DRAFT_KEY = "dj_sell_draft";
// 2026-10-03: 제출이 401·인터넷 끊김이어도 폼은 그대로 — 예전엔 401이면 비회원 화면으로 바뀌어 폼이 사라졌음(오프라인 가짜 401 포함)
const AUTH_LOST_MESSAGE = "로그인이 풀렸어요. 입력한 내용은 그대로 있어요";
const NETWORK_LOST_MESSAGE = "인터넷 연결이 끊겼어요. 연결 후";
type SellDraft = {
  companyName: string; isAnonymous: boolean; contactName: string; contactPhone: string; category: string;
  categoryTouched: boolean; stockType: string; region: string; productName: string; quantity: string; quantityUnit: string;
  minOrderQty: string; hopePrice: string; originalPrice: string; priceUnit: string; priceUnitTouched: boolean; hopeDurationHours: string;
  description: string; packageUnit: string; origin: string; spec: string; storageType: string; expiryDate: string; pid: string;
  images: string[]; videoUrl: string | null; manifestItems: ManifestRow[];
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
        const filled = formatPhone(member.phone);
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
  // 2026-10-01 fix/form-overflow: 재고 위치(지역) 필수 — 서버도 400 field "region"
  const [regionError, setRegionError] = useState<string | null>(null);
  // 묶음 펼침 — 2026-10-01 2차: ④ 제품 상세·⑤ 거래 조건·⑥ 판매자 정보 모두 기본 접힘 ("deal" = 거래 조건, "detail" = 제품 상세)
  const [openDeal, setOpenDeal] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [openSeller, setOpenSeller] = useState(false);
  // 접힌 묶음 안 칸이면 먼저 펼치고(다음 렌더 뒤) 그 칸으로 스크롤
  const reveal = (section: "deal" | "detail" | "seller" | null, id: string) => {
    if (section === "deal") setOpenDeal(true);
    if (section === "detail") setOpenDetail(true);
    if (section === "seller") setOpenSeller(true);
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | null)?.focus?.({ preventScroll: true });
    }, 30);
  };
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
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [quantityUnit, setQuantityUnit] = useState(quantityUnits[0]);
  const [minOrderQty, setMinOrderQty] = useState("");
  const [moqError, setMoqError] = useState<string | null>(null);
  const showMoqError = (msg: string) => {
    setMoqError(msg);
    reveal("detail", "sell-minOrderQty");
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
  // 2026-10-02 PR-A2: 영상 올리는 중엔 제출 막고, 안 올라간 채 제출하면 시트로 확인(VideoNotUploadedSheet)
  const [videoStatus, setVideoStatus] = useState<VideoUploadStatus>("idle");
  const [videoSheet, setVideoSheet] = useState<{ confirmWarnings: boolean } | null>(null);
  const videoUploaderRef = useRef<VideoUploaderHandle>(null);
  // 2026-10-02 PR-B: 사진도 같은 규칙 — 올리는 중엔 제출 막고, 실패한 사진이 있으면 시트로 확인(사진 → 영상 순서)
  const [photoStatus, setPhotoStatus] = useState<ImageUploadStatus>({ uploading: 0, failed: 0 });
  const [photoSheet, setPhotoSheet] = useState<{ confirmWarnings: boolean } | null>(null);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
  const busyLabel = uploadingLabel(photoStatus.uploading > 0, videoStatus === "uploading");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 2026-10-02 layout-cleanup: 폼 폭이 2칸 기준(@container 560px~)이면 PC형 — 하단 고정 버튼 대신 폼 맨 끝 인라인 버튼
  const formRef = useRef<HTMLDivElement>(null);
  const [wideForm, setWideForm] = useState(false);

  // 2026-09-30: 작성 중 내용 유지 — 제출 중 세션이 끊겨 로그인·가입을 다녀와도(returnTo=/sell) 이어서 쓰게
  // sessionStorage에 보관. 저장소가 막혀 있으면(사생활 보호 모드 등) 조용히 넘어감. 카테고리 자동 추천 effect보다
  // 뒤에 둬야 첫 렌더의 추천 effect가 복원한 카테고리를 비우지 않음.
  const [draftReady, setDraftReady] = useState(false);
  // 측정 전 기본값 = 모바일(하단 고정 버튼). 첫 페인트 전에 한 번 재서 PC형이면 바로 인라인으로 바꿈
  useLayoutEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const measure = () => setWideForm(el.clientWidth - 40 >= 560); // px-5 좌우 20px씩 뺀 내용 폭 = @container 기준
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [authState, draftReady]);
  // 모바일 오류 알약 실제 높이(+아래 간격 8px)만큼 본문 아래 여백을 늘려 마지막 칸이 안 가리게
  const [noteEl, setNoteEl] = useState<HTMLDivElement | null>(null);
  const [noteH, setNoteH] = useState(0);
  useLayoutEffect(() => {
    if (!noteEl) {
      setNoteH(0);
      return;
    }
    const measure = () => setNoteH(noteEl.offsetHeight + 8);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(noteEl);
    return () => ro.disconnect();
  }, [noteEl]);
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
      if (Array.isArray(d.manifestItems)) setManifestItems(d.manifestItems.filter((r): r is ManifestRow => !!r && typeof r === "object"));
    }
    setDraftReady(true);
  }, []);
  useEffect(() => {
    if (!draftReady || done) return;
    const d: SellDraft = {
      companyName, isAnonymous, contactName, contactPhone, category, categoryTouched, stockType, region, productName,
      quantity, quantityUnit, minOrderQty, hopePrice, originalPrice, priceUnit, priceUnitTouched, hopeDurationHours, description,
      packageUnit, origin, spec, storageType, expiryDate, pid, images, videoUrl, manifestItems,
    };
    try {
      window.sessionStorage.setItem(SELL_DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [
    draftReady, done, companyName, isAnonymous, contactName, contactPhone, category, categoryTouched, stockType, region,
    productName, quantity, quantityUnit, minOrderQty, hopePrice, originalPrice, priceUnit, priceUnitTouched, hopeDurationHours,
    description, packageUnit, origin, spec, storageType, expiryDate, pid, images, videoUrl, manifestItems,
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
    if (t.length) reveal(null, "sell-productName");
    else if (pr.length) reveal(null, "sell-originalPrice");
    else reveal("detail", "sell-description");
  };

  // 묶음 제목 "○개 입력됨" — 기본값(일반 재고·24시간)은 세지 않음
  const detailCount = [!lumpSum && minOrderQty, hopeDurationHours !== "24", storageType, expiryDate, packageUnit, spec, origin, description].filter(Boolean).length;
  const dealCount = [category, stockType !== "general", pid, manifestItems.length > 0].filter(Boolean).length;
  const sellerCount = [companyName, !isAnonymous, contactName].filter(Boolean).length;
  // 재고 유형 "소비기한 임박"이면 소비기한(④ 제품 상세)이 필수라 제품 상세를 펼쳐 둠
  useEffect(() => {
    if (stockType === "near_expiry") setOpenDetail(true);
  }, [stockType]);

  const lastSubmitArgs = useRef<[boolean, boolean, boolean]>([false, false, false]); // 인터넷 끊김 [다시 시도]용
  const submit = async (confirmWarnings = false, skipVideo = false, skipPhotos = false) => {
    lastSubmitArgs.current = [confirmWarnings, skipVideo, skipPhotos];
    setError(null);
    setMoqError(null);
    setPriceError(null);
    setExpiryError(null);
    setRegionError(null);
    setQuantityError(null);
    // 2026-10-02: 첫 누락 칸으로 스크롤·포커스·빨간 테두리 (문구만 뜨던 것 개선)
    if (!productName || !parsePriceInput(quantity) || !contactPhone) {
      setError("매물명 · 재고 총수량 · 연락처는 꼭 입력해주세요.");
      if (!productName) {
        setTitleError("매물 상품명을 입력해주세요.");
        scrollTo("sell-productName");
      } else if (!parsePriceInput(quantity)) {
        setQuantityError("재고 총수량을 입력해주세요.");
        scrollTo("sell-quantity");
      } else {
        setContactError("연락처를 입력해주세요");
        scrollTo("contact-phone");
      }
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
    // 2026-10-01: 재고 위치(지역) 필수 — 알림 매칭 기준 (서버도 같은 규칙)
    if (!region) {
      setRegionError("재고 위치(지역)를 선택해주세요.");
      setError("빨간 안내가 있는 칸을 확인해주세요.");
      reveal(null, "sell-region");
      return;
    }
    const orig = parsePriceInput(originalPrice);
    // 2026-10-01 PR-B: 소비기한 임박 재고는 소비기한 필수 (서버도 같은 규칙) — ③이 접혀 있으면 펼침
    if (stockType === "near_expiry" && !expiryDate) {
      setExpiryError(EXPIRY_REQUIRED_MESSAGE);
      reveal("detail", "sell-expiryDate");
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
    if (!lumpSum && minOrderQty && quantity && Number(minOrderQty) > (parsePriceInput(quantity) ?? 0)) {
      showMoqError("최소주문량은 재고 총수량보다 클 수 없어요.");
      return;
    }
    if (!sellerTermsAgreed) {
      setSellerTermsError(true);
      document.getElementById("sell-seller-terms")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (busyLabel) return; // 버튼도 비활성 — 키보드 등으로 들어온 경우
    if (!skipPhotos && photoStatus.failed > 0) {
      setPhotoSheet({ confirmWarnings });
      return;
    }
    if (!skipVideo && videoNotUploaded(videoStatus)) {
      setVideoSheet({ confirmWarnings });
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
          contactPhone: formatPhone(contactPhone),
          category: category || null,
          stockType,
          region: region || null,
          productName: cleanName,
          quantity: parsePriceInput(quantity),
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
          videoUrl: skipVideo ? null : videoUrl,
          sellerTermsAgreed,
          confirmWarnings,
        },
      });
      if (res.status === 401) {
        // 세션이 끊김 — 폼은 그대로 두고 AuthExpiredNotice [로그인]으로 안내. 작성 중 내용은 sessionStorage에 남아 있어
        // 로그인 후 /sell로 돌아오면 그대로 이어짐
        setError(AUTH_LOST_MESSAGE);
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
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
          reveal("detail", "sell-expiryDate");
          return;
        }
        if (data.field === "originalPrice") {
          setError(data.error ?? "정상 단가를 확인해주세요.");
          reveal(null, "sell-originalPrice");
          return;
        }
        if (data.field === "region") {
          setRegionError(data.error ?? "재고 위치(지역)를 선택해주세요.");
          reveal(null, "sell-region");
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
          reveal("seller", "sell-companyName");
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
    } catch (e) {
      setError(isAuthNetworkError(e) ? NETWORK_LOST_MESSAGE : "신청 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };
  const errorNote =
    error === NETWORK_LOST_MESSAGE ? (
      <>
        {error}{" "}
        <button
          type="button"
          onClick={() => submit(...lastSubmitArgs.current)}
          disabled={submitting}
          className="pointer-events-auto font-bold underline"
          style={{ color: "inherit", background: "none", border: "none", padding: 0 }}
        >
          다시 시도
        </button>
      </>
    ) : (
      error
    );

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
      {/* 2026-10-01 feat/form-order-v2: 매물 폼 재배치 2차 — 저장 항목·검증 그대로, 순서·묶음·표시만.
          ① 필수 정보 → ② 사진·영상 → ③ 판매자 확인 동의 → ④ 제품 상세(접힘) → ⑤ 거래 조건(접힘) → ⑥ 판매자 정보(접힘).
          칸 수는 폼 폭 기준(@container): 1칸 → 2칸(560px~) → 3칸(840px~), PC 최대 960px. 접힌 묶음 칸에서 오류 나면 펼치고 스크롤
          2026-10-02 feat/sell-pc-2col: 화면 1024px(lg) 이상이면 2단 — 왼쪽(필수 정보·동의·접기 묶음) / 오른쪽 고정(사진·영상·안내·등록 버튼).
          칸은 한 벌만 그리고(업로더 다시 마운트 없음) 배치만 CSS로 바꿈: lg 미만은 두 묶음이 display:contents라 칸들이
          바깥 세로 줄에 그대로 서고 order로 예전 순서(① → 사진·영상 → 동의 → 접기 → 🔔 → 버튼). lg에선 각 묶음이 칸 수 기준(@container). */}
      <div ref={formRef} className="@container w-full max-w-[720px] lg:max-w-[1160px] mx-auto flex-1 px-5 py-4.5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(360px,38%,420px)] lg:gap-x-8 lg:gap-y-0 lg:items-start" style={{ paddingBottom: wideForm ? 24 : FLOATING_CTA_SPACE + noteH }}>
      {/* 왼쪽 */}
      <div className="contents lg:@container lg:flex lg:flex-col lg:gap-5 lg:min-w-0">
        {/* 2026-09-29: 헤더 안 캐릭터 소개(76px/13px) 대신 buy와 같은 "완전 무료" 카드 (판매자용 문구) */}
        <div className="order-1 flex items-center gap-3 rounded-2xl" style={{ background: "#fff", border: "1.5px solid #E4E7EB", padding: "15px 16px" }}>
          <img src="/images/manager.png" alt="점핑매니저" className="flex-shrink-0 rounded-xl bg-white" style={{ width: 72, height: 72, objectFit: "contain" }} />
          <span className="flex-1 min-w-0">
            <span className="block" style={{ fontSize: rem(18), fontWeight: 700, color: "#0B2540" }}>판매 등록은 완전 무료예요</span>
            <span className="block font-bold mt-1 leading-relaxed" style={{ fontSize: rem(16), color: "#E25100" }}>
              조건 맞는 구매자에게 빠르게 알림이 가요
            </span>
          </span>
        </div>

        <p className="order-1" style={DEAL_HINT_STYLE}>
          <span style={{ color: "#E25100", fontWeight: 800 }}>*</span> 필수 항목
        </p>

        {/* ① 필수 정보 */}
        <section className="order-1">
          <FormSectionTitle>필수 정보</FormSectionTitle>
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <FieldLabel compact need="required" htmlFor="sell-productName">매물 상품명</FieldLabel>
              <input
                id="sell-productName"
                className="w-full rounded-xl outline-none bg-white"
                style={sellInputStyle(!!titleError)}
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

            {/* 가격 한 줄: [판매 단가 | 원 / 단위] · 정상 단가(같은 단위, 할인율은 라벨 옆 배지) — 단위 = price_unit(기본 수량 단위, 일괄이면 최소주문 숨김) */}
            <div className={FORM_ROW2}>
              <div className="min-w-0">
                <FieldLabel compact need="required" htmlFor="sell-hopePrice">판매 단가</FieldLabel>
                <div className="flex items-stretch rounded-xl overflow-hidden bg-white" style={{ border: `1.5px solid ${priceError ? BLOCK_COLOR : "#E4E7EB"}` }}>
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
                  <span className="flex-shrink-0 flex items-center font-bold" style={{ padding: "0 4px 0 6px", fontSize: DEAL_INPUT_FONT_SIZE, color: "#0B2540" }}>원 /</span>
                  {/* 2026-09-29: 단가 단위 — 수량 단위와 따로 (예: 수량은 박스, 가격은 kg당 / 일괄=전체 가격). 2026-10-01: "단가 기준" 칸을 여기로 */}
                  <select
                    id="sell-priceUnit"
                    aria-label="판매 단가 단위"
                    className="flex-shrink-0 outline-none"
                    style={{ border: "none", borderLeft: "1px solid #E4E7EB", padding: "0 6px", fontSize: DEAL_INPUT_FONT_SIZE, fontWeight: 700, color: "#0B2540", background: "#FAFBFC" }}
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
                        {u === LUMP_SUM ? "일괄(전체)" : u}
                      </option>
                    ))}
                  </select>
                </div>
                {priceError && <p className="font-medium mt-1" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{priceError}</p>}
                {/* 2026-10-03 A안: 비회원에겐 가격 비공개("회원가 보기") — 판매자에게 미리 알림 */}
                <p className="mt-1" style={DEAL_HINT_STYLE}>가격은 가입 회원에게만 공개돼요 · 브랜드 없이 올리고 싶으시면 추가 설명에 적어 주세요</p>
              </div>
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-originalPrice" extra={<SellDiscountBadge original={parsePriceInput(originalPrice)} deal={parsePriceInput(hopePrice)} />}>
                  정상 단가
                </FieldLabel>
                <div className="flex items-center rounded-xl overflow-hidden bg-white" style={{ border: "1.5px solid #E4E7EB" }}>
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
                  <span className="flex-shrink-0 font-bold whitespace-nowrap" style={{ padding: "0 12px 0 4px", fontSize: DEAL_INPUT_FONT_SIZE, color: "#0B2540" }}>{priceUnitSuffix(priceUnit)}</span>
                </div>
                <p className="mt-1" style={DEAL_HINT_STYLE}>판매 단가와 같은 단위로 적어주세요</p>
                <SellDiscountWarn original={parsePriceInput(originalPrice)} deal={parsePriceInput(hopePrice)} />
                <ConfirmWarnings warnings={priceWarns} onConfirm={titleWarnings.length ? undefined : () => submit(true)} busy={submitting} />
              </div>
            </div>

            {/* 재고 총수량+단위 · 재고 위치(지역, 필수 — 알림 매칭 기준) · 연락처 — 2단(lg) 왼쪽은 묶음 내용 680px 이상일 때만 3칸, 미만은 2칸(수량·지역 / 연락처) */}
            <div className={`${FORM_ROW3} lg:@min-[680px]:grid-cols-3!`}>
              <div className="min-w-0">
                <FieldLabel compact need="required" htmlFor="sell-quantity">재고 총수량</FieldLabel>
                <div className="flex rounded-xl overflow-hidden bg-white" style={{ border: `1.5px solid ${quantityError ? BLOCK_COLOR : "#E4E7EB"}` }}>
                  <input
                    id="sell-quantity"
                    type="text"
                    inputMode="numeric"
                    className="flex-1 min-w-0 outline-none"
                    style={{ border: "none", padding: "13px 12px", fontSize: DEAL_INPUT_FONT_SIZE }}
                    value={formatPriceInput(quantity)}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      setQuantityError(null);
                    }}
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
                {quantityError && <p className="font-medium mt-1" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{quantityError}</p>}
              </div>
              <div className="min-w-0">
                <FieldLabel compact need="required" htmlFor="sell-region">재고 위치(지역)</FieldLabel>
                <select
                  id="sell-region"
                  className="w-full rounded-xl outline-none bg-white"
                  style={{ ...sellInputStyle(!!regionError), color: region ? "#1A1F26" : "#9AA3AD" }}
                  value={region}
                  onChange={(e) => {
                    setRegion(e.target.value);
                    setRegionError(null);
                  }}
                >
                  <option value="">지역을 선택해주세요</option>
                  {mockRegions.map((r) => (
                    <option key={r} value={r} style={{ color: "#1A1F26" }}>{r}</option>
                  ))}
                </select>
                {regionError ? (
                  <p className="font-medium mt-1" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{regionError}</p>
                ) : (
                  <p className="mt-1" style={DEAL_HINT_STYLE}>물건이 있는 곳 — 이 지역 알림 회원에게 알림이 가요.</p>
                )}
              </div>
              {/* 2단 왼쪽 2칸일 땐 연락처를 한 줄 전체로 — 반 칸이면 예시 문구("010-0000-0000 또는 02-000-0000")가 잘림(1024px) */}
              <div className="min-w-0 lg:col-span-2 lg:@min-[680px]:col-span-1">
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
            </div>
          </div>
        </section>

        {/* 동의 + 접기 묶음 — lg 미만에선 바깥 줄에서 order-3(사진·영상 다음) */}
        <div className="order-3 flex flex-col gap-5">
        {/* ③ 필수 동의 — 판매자 확인 사항 (동의 저장은 등록 시점, 미체크로 등록하면 여기로 스크롤) */}
        <div id="sell-seller-terms">
          <label
            className="flex items-start gap-2.5 rounded-xl cursor-pointer"
            style={{ padding: "14px 16px", background: "#F5F6F8", border: sellerTermsError ? `1.5px solid ${BLOCK_COLOR}` : "1.5px solid transparent" }}
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
            <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>판매자 확인 사항에 동의해주세요.</p>
          )}
        </div>

        {/* ④ 제품 상세 — 기본 접힘 (소비기한 임박이면 자동 펼침) */}
        <FormAccordion id="sell-detail" title="제품 상세" count={detailCount} open={openDetail} onToggle={() => setOpenDetail((v) => !v)}>
          <div className="flex flex-col gap-4">
            <div className={FORM_ROW2}>
              {/* 2026-09-29: 일괄(전체 가격) 판매면 최소주문 의미 없음 → 숨김 */}
              {!lumpSum && (
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-minOrderQty">최소 주문수량(MOQ)</FieldLabel>
                <div className="flex items-center rounded-xl bg-white" style={{ border: `1.5px solid ${moqError ? BLOCK_COLOR : "#E4E7EB"}` }}>
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
                {moqError && <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{moqError}</p>}
              </div>
              )}
              <div className="min-w-0">
                <FieldLabel compact need="optional">마감까지</FieldLabel>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="마감까지">
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
                        type="button"
                        role="radio"
                        aria-checked={picked}
                        onClick={() => setHopeDurationHours(opt.v)}
                        className="font-bold rounded-xl"
                        style={{
                          padding: "10px 12px",
                          fontSize: DEAL_CHIP_FONT_SIZE,
                          background: picked ? "#E9ECEF" : "#fff",
                          border: picked ? "2px solid #6B7480" : "1.5px solid #E4E7EB",
                          color: "#1A1F26",
                        }}
                      >
                        {picked ? "✓ " : ""}
                        {opt.l}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2" style={DEAL_HINT_STYLE}>
                  여기서 정한 시간이 구매자에게 보이는 마감 카운트다운 기준이 돼요.
                </p>
              </div>
            </div>

            <div className={FORM_ROW2}>
              <div className="min-w-0">
                <FieldLabel compact need="optional">보관 조건</FieldLabel>
                <StorageTypeButtons id="sell-storageType" value={storageType} onChange={setStorageType} />
              </div>
              <div className="min-w-0">
                <FieldLabel compact need={stockType === "near_expiry" ? "required" : "optional"} htmlFor="sell-expiryDate">소비기한</FieldLabel>
                <input
                  id="sell-expiryDate"
                  type="date"
                  className="w-full rounded-xl outline-none bg-white"
                  style={{ ...sellInputStyle(!!expiryError), minHeight: 50 }}
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
            </div>

            <div className={FORM_ROW3}>
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-packageUnit">포장 단위</FieldLabel>
                <SuggestInput id="sell-packageUnit" className="w-full rounded-xl outline-none bg-white" style={sellInputStyle(false)} value={packageUnit} onChange={setPackageUnit} examples={PACKAGE_UNIT_EXAMPLES} placeholder="20kg 박스" />
              </div>
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-spec">규격/사이즈</FieldLabel>
                <SuggestInput id="sell-spec" className="w-full rounded-xl outline-none bg-white" style={sellInputStyle(false)} value={spec} onChange={setSpec} examples={SPEC_EXAMPLES} placeholder="500ml, S~L 혼합" />
              </div>
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-origin">원산지</FieldLabel>
                <SuggestInput id="sell-origin" className="w-full rounded-xl outline-none bg-white" style={sellInputStyle(false)} value={origin} onChange={setOrigin} examples={ORIGIN_EXAMPLES} placeholder="국내산, 중국산 등" />
              </div>
            </div>
            <div className="min-w-0">
              <FieldLabel compact need="optional" htmlFor="sell-description">추가 설명</FieldLabel>
              <textarea
                id="sell-description"
                className="w-full rounded-xl outline-none bg-white"
                style={{ ...sellInputStyle(false), padding: "12px 14px" }}
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescWarnings([]);
                }}
                placeholder="그 밖에 알려주실 내용"
              />
              <ConfirmWarnings warnings={descWarnings} onConfirm={titleWarnings.length || priceWarns.length ? undefined : () => submit(true)} busy={submitting} />
            </div>
          </div>
        </FormAccordion>

        {/* ⑤ 거래 조건 — 기본 접힘 */}
        <FormAccordion id="sell-deal" title="거래 조건" count={dealCount} open={openDeal} onToggle={() => setOpenDeal((v) => !v)}>
          <div className="flex flex-col gap-4">
            <div className={FORM_ROW2}>
              <div className="min-w-0">
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
                    neutral
                    value={category}
                    onPick={(c) => {
                      setCategoryTouched(true);
                      setCategory(c);
                      setCategoryEditing(false);
                    }}
                  />
                  </>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-white" style={{ border: "1.5px solid #E4E7EB", padding: "10px 13px" }}>
                    <span className="flex items-center gap-1.5 text-sm font-bold min-w-0">
                      {category ? (
                        <>
                          <span className="flex-shrink-0">{categoryIcons[category]}</span>
                          <span className="truncate" style={{ color: "#1A1F26" }}>{category}</span>
                          {!categoryTouched && (
                            <span className="flex-shrink-0 text-xs font-bold rounded-full" style={{ color: "#4B5563", background: "#E9ECEF", padding: "2px 8px" }}>
                              추천됨
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "#9AA3AD", fontWeight: 700 }}>카테고리 선택 안 함</span>
                      )}
                    </span>
                    <button type="button" onClick={() => setCategoryEditing(true)} className="flex-shrink-0 text-xs font-bold" style={{ color: "#6B7480" }}>
                      수정
                    </button>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                {/* 2026-09-29: 재고 유형 — 매물 카드·상세·푸시 앞에 배지로 표시 (일반 재고는 배지 없음). 2026-10-01: 드롭다운 */}
                <FieldLabel compact need="optional" htmlFor="sell-stockType">재고 유형</FieldLabel>
                <select
                  id="sell-stockType"
                  className="w-full rounded-xl outline-none bg-white"
                  style={sellInputStyle(false)}
                  value={stockType}
                  onChange={(e) => {
                    if (isStockType(e.target.value)) setStockType(e.target.value);
                  }}
                >
                  {STOCK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
                {stockType === "near_expiry" && <p className="mt-1" style={DEAL_HINT_STYLE}>소비기한은 &quot;제품 상세&quot;에서 꼭 입력해주세요.</p>}
              </div>
            </div>
            {/* 2026-09-26: 폐업 정리 등으로 여러 품목이 한 파렛트에 섞인 "혼합매물" 대응 —
                개별 사진 없이 PID/매니페스트 번호 + CSV 목록만으로도 등록할 수 있게. */}
            <div className="min-w-0">
              <FieldLabel compact need="optional" htmlFor="sell-pid">PID / 매니페스트 번호</FieldLabel>
              <input
                id="sell-pid"
                className="w-full rounded-xl outline-none bg-white"
                style={sellInputStyle(false)}
                value={pid}
                onChange={(e) => setPid(e.target.value)}
                placeholder="예: P809200159651 (리퀴데이션 파렛트라면 적어주세요)"
              />
            </div>
            <ManifestUploader onChange={setManifestItems} initialRows={manifestItems} />
          </div>
        </FormAccordion>

        {/* ⑥ 판매자 정보 — 기본 접힘 (2026-09-30 업체명 공개 설정 기본 비공개, consent-texts 7-2) */}
        <FormAccordion id="sell-seller" title="판매자 정보" count={sellerCount} open={openSeller} onToggle={() => setOpenSeller((v) => !v)}>
          <div className="flex flex-col gap-4">
            <div className={FORM_ROW2}>
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-companyName">업체명</FieldLabel>
                <input
                  id="sell-companyName"
                  className="w-full rounded-xl outline-none bg-white"
                  style={sellInputStyle(!!companyError)}
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    setCompanyError(null);
                  }}
                  placeholder="예: 웰컴코리아(주)"
                />
                {companyError && <p className="font-medium mt-1.5" style={{ fontSize: rem(14), color: BLOCK_COLOR }}>{companyError}</p>}
              </div>
              <div className="min-w-0">
                <FieldLabel compact need="optional" htmlFor="sell-contactName">담당자명</FieldLabel>
                <input
                  id="sell-contactName"
                  className="w-full rounded-xl outline-none bg-white"
                  style={sellInputStyle(false)}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="홍길동"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p style={DEAL_LABEL_STYLE}>{COMPANY_DISCLOSURE_TEXT.title}</p>
              <div className="flex flex-col gap-2 mt-2" role="radiogroup" aria-label="업체명 공개 설정">
                {([true, false] as const).map((anon) => {
                  const t = anon ? COMPANY_DISCLOSURE_TEXT.private : COMPANY_DISCLOSURE_TEXT.public;
                  const picked = isAnonymous === anon;
                  return (
                    <label
                      key={t.label}
                      className="flex items-start gap-2.5 rounded-xl cursor-pointer"
                      style={{ padding: "12px 14px", background: picked ? "#F3F4F6" : "#fff", border: picked ? "1.5px solid #9AA3AD" : "1.5px solid #E4E7EB" }}
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
          </div>
        </FormAccordion>
        </div>
      </div>

      {/* 오른쪽 — lg에서 행 높이만큼 늘어나고(self-stretch) 페이지와 함께 스크롤. 등록 버튼(+ 오류 문구)만 맨 아래(mt-auto)에서 sticky bottom:0 — 흰 배경 + 아래 padding(--nav-bottom + 12px)으로 버튼은 탭바 12px 위, 그 아래 틈까지 배경이 채워 비침 방지 */}
      <div className="contents lg:@container lg:flex lg:flex-col lg:gap-4 lg:min-w-0 lg:self-stretch">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          {/* ② 사진·영상 */}
          <section className="order-2">
            <FormSectionTitle hint="사진이 있으면 더 빨리 연결돼요">사진·영상</FormSectionTitle>
            <div className="flex flex-col gap-5">
              <div id="sell-photos">
                <ImageUploader ref={imageUploaderRef} onChange={setImages} onStatusChange={setPhotoStatus} globalPaste initialUrls={images} max={getPhotoLimit({ bonus_photo_slots: bonusPhotoSlots })} />
              </div>
              <div id="sell-video">
                <VideoUploader ref={videoUploaderRef} onChange={setVideoUrl} initialUrl={videoUrl} onStatusChange={setVideoStatus} />
              </div>
            </div>
          </section>

          <div className="order-4 flex items-center gap-2.5 rounded-2xl" style={{ background: "#F5F6F8", padding: "14px 16px" }}>
            <span style={{ fontSize: rem(18) }}>🔔</span>
            <span className="flex-1" style={{ ...DEAL_HINT_STYLE, color: "#0B2540", fontWeight: 500 }}>
              점핑매니저 검토 후, 이 조건 알림을 받는 회원들에게 빠르게 발송돼요.
            </span>
          </div>
        </div>

        {/* 2026-10-02: PC형(폼 폭 2칸 이상)이면 하단 고정 버튼 대신 인라인 버튼(lg 2단에선 오른쪽 맨 아래 sticky) — 오류 문구는 버튼 바로 위 */}
        {wideForm && (
          <div className="order-5 lg:mt-auto lg:sticky lg:bottom-0 lg:z-10 lg:bg-white lg:pt-2 lg:pb-[calc(var(--nav-bottom)_+_12px)]">
            {error && <FloatingCTANote>{errorNote}</FloatingCTANote>}
            <button
              onClick={() => submit()}
              disabled={submitting || busyLabel !== null}
              className={FLOATING_CTA_BUTTON_CLASS}
              style={floatingCtaButtonStyle()}
            >
              {submitting ? "처리 중..." : busyLabel ?? "무료로 매물 등록하기"}
            </button>
          </div>
        )}
      </div>
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
      {!wideForm && (
      <FloatingCTA>
          {error && <div ref={setNoteEl}><FloatingCTANote>{errorNote}</FloatingCTANote></div>}
          <button
            onClick={() => submit()}
            disabled={submitting || busyLabel !== null}
            className={FLOATING_CTA_BUTTON_CLASS}
            style={floatingCtaButtonStyle()}
          >
            {submitting ? "처리 중..." : busyLabel ?? "무료로 매물 등록하기"}
          </button>
              </FloatingCTA>
      )}
      <VideoNotUploadedSheet
        open={photoSheet !== null}
        title={`사진 ${photoStatus.failed}장이 올라가지 않았어요`}
        description={PHOTO_FAILED_DESCRIPTION}
        reselectLabel="다시 시도"
        skipLabel="빼고 등록"
        onClose={() => setPhotoSheet(null)}
        onReselect={() => {
          imageUploaderRef.current?.retryFailed();
          document.getElementById("sell-photos")?.scrollIntoView({ behavior: "smooth", block: "center" });
          setPhotoSheet(null);
        }}
        onSkip={() => {
          const confirmWarnings = photoSheet?.confirmWarnings ?? false;
          imageUploaderRef.current?.removeFailed();
          setPhotoSheet(null);
          submit(confirmWarnings, false, true);
        }}
      />
      <VideoNotUploadedSheet
        open={videoSheet !== null}
        onClose={() => setVideoSheet(null)}
        onReselect={() => {
          videoUploaderRef.current?.reselect();
          document.getElementById("sell-video")?.scrollIntoView({ behavior: "smooth", block: "center" });
          setVideoSheet(null);
        }}
        onSkip={() => {
          const confirmWarnings = videoSheet?.confirmWarnings ?? false;
          videoUploaderRef.current?.clear();
          setVideoSheet(null);
          submit(confirmWarnings, true);
        }}
      />
      </>
      )}
    </main>
  );
}

// 정상 단가 라벨 옆 배지 "27% 할인" (2026-10-02 feat/sell-pc-2col — 예전 할인율 한 줄 대신, 값 없으면 자리 없음)
function SellDiscountBadge({ original, deal }: { original?: number | null; deal?: number | null }) {
  const pct = original && deal ? discountPercent(original, deal) : null;
  if (pct === null) return null;
  const warn = pct >= HIGH_DISCOUNT_PCT;
  return (
    <span className="rounded-full font-bold whitespace-nowrap" style={{ fontSize: rem(13), lineHeight: 1.4, padding: "1px 8px", color: warn ? WARN_COLOR : "#0B7A3E", background: warn ? "#FFF4E5" : "#E8F5EE" }}>
      {pct}% 할인
    </span>
  );
}

// 판매가 ≥ 정상가면 정상 단가 칸 아래 주황 안내 (2026-10-01 PR-B [3])
function SellDiscountWarn({ original, deal }: { original?: number | null; deal?: number | null }) {
  if (!original || !deal || discountPercent(original, deal) !== null) return null;
  return <p className="mt-1 font-medium" style={{ fontSize: rem(14), color: WARN_COLOR }}>판매가가 정상가보다 높거나 같아 할인율이 안 보여요.</p>;
}

// 매물 폼 입력칸 공통 모양 (2026-10-01) — 오류 테두리는 빨강
function sellInputStyle(error: boolean) {
  return { border: `1.5px solid ${error ? BLOCK_COLOR : "#E4E7EB"}`, padding: "13px 12px", fontSize: DEAL_INPUT_FONT_SIZE } as const;
}
