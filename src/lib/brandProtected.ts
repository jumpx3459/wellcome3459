import type { SupabaseClient } from "@supabase/supabase-js";

// 브랜드 보호 1단계 (2026-10-27, feat/brand-protected) — 서버 헬퍼 + 화면이 같이 쓰는 문구·상수.
//
// 구조: deals.brand_protected = 켜면 공개 사진(images)은 대표 1장만, 나머지 사진(protected_images = 비공개 버킷 경로)·
// 브랜드명(brand_name)은 가입 회원에게만. 두 칸(protected_images·brand_name)은 anon·authenticated에 select 권한이 없다(서버 전용).
//   ⚠ 브라우저 화면 코드(supabase 클라이언트)는 이 두 칸을 절대 select하지 말 것 — 권한이 없어 요청 전체가 42501로 실패한다.
//   회원 화면은 POST /api/deal-protected(회원 확인 후 서명 URL)로만 받고, 관리자 화면은 관리자 API 응답으로만 받는다.
// 클라이언트↔서버 사진 표기: 공개 사진 = 공개 URL, 보호 사진 = "protected:<경로>"(PROTECTED_REF_PREFIX). DB에는 경로만 저장(접두사 없음).
//
// 사진을 공개↔보호로 옮길 때(공개 사진을 보호로, 보호 사진을 공개로, 신청서 사진을 보호로): 새 버킷에 먼저 복사 → DB 저장 →
// 성공한 뒤에만 옛 객체 삭제(저장 실패·되돌리기 때는 새로 만든 복사본을 지움). 그래서 중간에 멈춰도 사진이 사라지지 않고 남는 쪽은 "남는 객체"뿐.

export const PUBLIC_BUCKET = "deal-images";
export const PROTECTED_BUCKET = "deal-images-protected";
export const PROTECTED_REF_PREFIX = "protected:";
/** 회원 화면 보호 사진 서명 URL 유효 시간(10분) — 만료·로드 오류 땐 화면이 다시 받음 */
export const PROTECTED_SIGNED_TTL_SECONDS = 600;
/** 관리자 폼 미리보기 서명 URL(1시간) — 관리자가 폼을 오래 열어 두는 경우 */
export const ADMIN_PREVIEW_TTL_SECONDS = 3600;
/** 보호 매물의 공개 사진 상한 — DB 제약 deals_brand_protected_chk와 같음 */
export const MAX_PUBLIC_IMAGES_WHEN_PROTECTED = 1;

export const BP_MESSAGES = {
  brandNameRequired: "브랜드명을 입력해주세요.",
  tooManyPublic: "브랜드 보호 매물은 공개 사진을 1장까지만 둘 수 있어요. 사진 1장만 공개로 남겨주세요.",
  convertTooManyPublic: "공개 사진이 2장 이상이라 보호로 바꿀 수 없어요. 사진을 1장만 남기면 켤 수 있어요.",
  noVideo: "브랜드 보호 매물은 영상을 올릴 수 없어요. 영상을 먼저 지워주세요.",
  clearProtectedFirst: "보호 사진을 먼저 지워야 끌 수 있어요.",
  badPhoto: "사진 주소가 올바르지 않아요. 사진을 다시 올려주세요.",
  photoMissing: "올린 사진을 찾을 수 없어요. 사진을 다시 올려주세요.",
  moveFailed: "사진을 옮기지 못했어요. 잠시 후 다시 시도해주세요.",
  // DB 제약(deals_brand_protected_chk) 위반(23514) — 서버 검증이 먼저 나가므로 동시 수정 같은 경우에만 도달
  ruleViolation: "브랜드 보호 매물은 공개 사진 1장 이하·영상 없음·브랜드명 입력이 필요해요. 내용을 확인해주세요.",
} as const;

export const BRAND_NAME_MAX = 60;

const UUID_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/i;
const CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export const isProtectedRef = (v: unknown): v is string => typeof v === "string" && v.startsWith(PROTECTED_REF_PREFIX);
export const toProtectedRef = (path: string) => `${PROTECTED_REF_PREFIX}${path}`;

/** "protected:<경로>" 또는 경로 그대로 → 우리 규칙(uuid.ext)의 경로, 아니면 null */
export function protectedPathFromRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const path = ref.startsWith(PROTECTED_REF_PREFIX) ? ref.slice(PROTECTED_REF_PREFIX.length) : ref;
  return UUID_PATH_RE.test(path) ? path : null;
}

/** 공개 URL이 deal-images 버킷의 uuid.ext(사진)이면 그 경로, 아니면 null(영상·외부 URL 등) */
export function publicPhotoPathFromUrl(url: unknown, supabaseUrl: string): string | null {
  if (typeof url !== "string") return null;
  const prefix = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PUBLIC_BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return UUID_PATH_RE.test(path) ? path : null;
}

export function cleanBrandName(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, BRAND_NAME_MAX) : "";
}

/** 매물명·설명에 브랜드명이 들어 있는지(대소문자·공백 무시) — 저장 전 경고(확인 후 저장)에 씀. 표기가 다른 경우까지는 못 잡음 */
export function brandNameInText(brand: string, text: unknown): boolean {
  const b = brand.replace(/\s+/g, "").toLowerCase();
  if (b.length < 2 || typeof text !== "string") return false;
  return text.replace(/\s+/g, "").toLowerCase().includes(b);
}
export function brandNameWarning(brand: string, where: "title" | "description"): string {
  return where === "title"
    ? `매물명에 브랜드명 "${brand}"이(가) 들어 있어요. 매물명은 비회원에게도 보이고 푸시 알림에도 나가요.`
    : `설명에 브랜드명 "${brand}"이(가) 들어 있어요. 설명은 비회원에게도 보여요.`;
}

/** 제약 위반(23514)이 보호 제약이면 true */
export function isBrandRuleViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23514" && /deals_brand_protected_chk/.test(error.message ?? "");
}

/** 보호 매물 규칙 검사 — 최종 상태(저장 뒤 값) 기준. 문제 없으면 null */
export function checkBrandProtectedRules(f: {
  brandProtected: boolean;
  brandName: string;
  publicImageCount: number;
  videoUrl: string | null | undefined;
  protectedCount: number;
  /** 이번 요청으로 보호를 새로 켜는 경우(기존 매물 전환) — 사진 문구를 전환용으로 */
  turningOn?: boolean;
}): { error: string; field: string } | null {
  if (!f.brandProtected) {
    if (f.protectedCount > 0) return { error: BP_MESSAGES.clearProtectedFirst, field: "brandProtected" };
    return null;
  }
  if (!f.brandName) return { error: BP_MESSAGES.brandNameRequired, field: "brandName" };
  if (f.publicImageCount > MAX_PUBLIC_IMAGES_WHEN_PROTECTED) {
    return { error: f.turningOn ? BP_MESSAGES.convertTooManyPublic : BP_MESSAGES.tooManyPublic, field: "images" };
  }
  if (f.videoUrl) return { error: BP_MESSAGES.noVideo, field: "video" };
  return null;
}

async function copyObject(db: SupabaseClient, fromBucket: string, fromPath: string, toBucket: string): Promise<{ path: string } | { error: string }> {
  const { data: blob, error: dlErr } = await db.storage.from(fromBucket).download(fromPath);
  if (dlErr || !blob) return { error: BP_MESSAGES.photoMissing };
  const ext = fromPath.slice(fromPath.lastIndexOf(".") + 1).toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await db.storage.from(toBucket).upload(path, await blob.arrayBuffer(), { contentType: CONTENT_TYPE[ext] ?? blob.type, upsert: false });
  if (upErr) return { error: BP_MESSAGES.moveFailed };
  return { path };
}

async function objectExists(db: SupabaseClient, bucket: string, path: string): Promise<boolean | null> {
  try {
    const { data, error } = await db.storage.from(bucket).exists(path);
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}

export type PhotoSplit = {
  /** 저장할 공개 사진 URL(images) */
  images: string[];
  /** 저장할 보호 사진 경로(protected_images) */
  protectedPaths: string[];
  /** DB 저장이 성공한 뒤에 지울 옛 객체(공개↔보호로 옮긴 원본) */
  finalize: () => Promise<void>;
  /** 저장 실패·되돌리기: 이번에 새로 만든 복사본을 지움 */
  discard: () => Promise<void>;
};

/**
 * 폼이 보낸 사진 목록을 저장 형태로 정리 — images·protectedImages 각 항목은 공개 URL 또는 "protected:<경로>"(경로만도 허용).
 *   images 쪽: 공개 URL은 그대로, 보호 객체는 공개 버킷으로 복사해 URL로.
 *   protectedImages 쪽: 보호 경로는 그대로(있는지 확인), 공개 URL은 비공개 버킷으로 복사해 경로로.
 * 공개 URL 중 우리 버킷 밖의 주소(예전 외부 URL)는 images에서만 그대로 허용(옮길 수 없으니 protectedImages에는 불가).
 */
export async function resolvePhotos(
  db: SupabaseClient,
  supabaseUrl: string,
  input: { images: unknown; protectedImages: unknown },
): Promise<{ ok: true; split: PhotoSplit } | { ok: false; error: string; field: string; status: number }> {
  const imagesIn = Array.isArray(input.images) ? input.images : [];
  const protectedIn = Array.isArray(input.protectedImages) ? input.protectedImages : [];
  const fail = (error: string, status = 400) => ({ ok: false as const, error, field: "images", status });

  const images: string[] = [];
  const protectedPaths: string[] = [];
  const createdPublic: string[] = []; // 새로 만든 공개 복사본(경로)
  const createdProtected: string[] = []; // 새로 만든 보호 복사본(경로)
  const deletePublicAfter: string[] = []; // 보호로 옮긴 공개 원본
  const deleteProtectedAfter: string[] = []; // 공개로 옮긴 보호 원본

  const discard = async () => {
    if (createdPublic.length) await db.storage.from(PUBLIC_BUCKET).remove(createdPublic).catch(() => {});
    if (createdProtected.length) await db.storage.from(PROTECTED_BUCKET).remove(createdProtected).catch(() => {});
  };

  for (const ref of imagesIn) {
    if (typeof ref !== "string" || !ref) { await discard(); return fail(BP_MESSAGES.badPhoto); }
    const pPath = isProtectedRef(ref) ? protectedPathFromRef(ref) : null;
    if (isProtectedRef(ref)) {
      if (!pPath) { await discard(); return fail(BP_MESSAGES.badPhoto); }
      const copied = await copyObject(db, PROTECTED_BUCKET, pPath, PUBLIC_BUCKET);
      if ("error" in copied) { await discard(); return fail(copied.error, 400); }
      createdPublic.push(copied.path);
      deleteProtectedAfter.push(pPath);
      images.push(db.storage.from(PUBLIC_BUCKET).getPublicUrl(copied.path).data.publicUrl);
    } else {
      images.push(ref);
    }
  }

  for (const ref of protectedIn) {
    if (typeof ref !== "string" || !ref) { await discard(); return fail(BP_MESSAGES.badPhoto); }
    const own = protectedPathFromRef(ref);
    if (own) {
      const ex = await objectExists(db, PROTECTED_BUCKET, own);
      if (ex === false) { await discard(); return fail(BP_MESSAGES.photoMissing); }
      if (ex === null) { await discard(); return fail(BP_MESSAGES.moveFailed, 500); }
      protectedPaths.push(own);
      continue;
    }
    const pub = publicPhotoPathFromUrl(ref, supabaseUrl);
    if (!pub) { await discard(); return fail(BP_MESSAGES.badPhoto); }
    const copied = await copyObject(db, PUBLIC_BUCKET, pub, PROTECTED_BUCKET);
    if ("error" in copied) { await discard(); return fail(copied.error, 400); }
    createdProtected.push(copied.path);
    deletePublicAfter.push(pub);
    protectedPaths.push(copied.path);
  }

  const finalize = async () => {
    if (deletePublicAfter.length) await db.storage.from(PUBLIC_BUCKET).remove(deletePublicAfter).catch(() => {});
    if (deleteProtectedAfter.length) await db.storage.from(PROTECTED_BUCKET).remove(deleteProtectedAfter).catch(() => {});
  };
  return { ok: true, split: { images, protectedPaths, finalize, discard } };
}

/** 보호 사진 서명 URL — 경로 순서 그대로(실패한 칸은 null) */
export async function signProtectedPaths(db: SupabaseClient, paths: string[], ttlSeconds: number): Promise<(string | null)[]> {
  if (!paths.length) return [];
  const { data, error } = await db.storage.from(PROTECTED_BUCKET).createSignedUrls(paths, ttlSeconds);
  if (error || !data) return paths.map(() => null);
  const byPath = new Map<string, string | null>();
  for (const row of data) byPath.set(row.path ?? "", row.error ? null : row.signedUrl ?? null);
  return paths.map((p) => byPath.get(p) ?? null);
}

/** 보호 객체 삭제(매물 삭제·보호 사진 지움) — 실패해도 흐름은 막지 않음 */
export async function removeProtectedObjects(db: SupabaseClient, paths: string[]): Promise<void> {
  const valid = paths.filter((p) => UUID_PATH_RE.test(p));
  if (!valid.length) return;
  const { error } = await db.storage.from(PROTECTED_BUCKET).remove(valid);
  if (error) console.error("[brandProtected] 보호 객체 삭제 실패", valid.length);
}
