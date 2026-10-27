import { rem } from "@/lib/rem";

// 브랜드 보호 매물 표시 조각 (2026-10-27, feat/brand-protected) — 목록 카드·홈 카드·상세가 같이 씀.
// 문구 원칙: "가입한 회원에게만 보여요" · "회원 전용 사진" · "보호 사진 N장". "완전 차단"·"유출 불가"·"사업자 회원"·"인증 바이어"는 쓰지 않음.

export const BRAND_PROTECTED_LABEL = "브랜드 보호";
export const PROTECTED_LOCK_TITLE = "브랜드 보호 매물";
export const PROTECTED_LOCK_MESSAGE = "브랜드와 실제 사진은 가입한 회원에게만 보여요";
export const PROTECTED_JOIN_CTA = "가입하고 보기";

/** 사진 위 "🛡 브랜드 보호" 알약(반투명 네이비) */
export function ShieldBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg font-bold text-white whitespace-nowrap pointer-events-none"
      style={{ background: "rgba(11,37,64,0.92)", fontSize: rem(compact ? 12 : 14), lineHeight: 1.3, padding: compact ? "2px 6px" : "3px 9px" }}
      data-brand-badge
    >
      🛡{compact ? "" : ` ${BRAND_PROTECTED_LABEL}`}
    </span>
  );
}

/** 사진 위 "🛡 보호 사진 N장" 알약(오른쪽 아래) */
export function ProtectedCount({ count, compact = false }: { count: number; compact?: boolean }) {
  if (!(count > 0)) return null;
  return (
    <span
      className="rounded font-bold text-white whitespace-nowrap pointer-events-none"
      style={{ fontSize: rem(compact ? 12 : 13), lineHeight: 1.3, padding: "2px 7px", background: "rgba(0,0,0,.55)" }}
      data-protected-count
    >
      {compact ? `🛡 ${count}장` : `🛡 보호 사진 ${count}장`}
    </span>
  );
}

/** 공개 사진이 없는 보호 매물의 남색 🛡 타일 — 부모 크기를 꽉 채움 */
export function ProtectedTile({ count = 0, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center text-center text-white"
      style={{ background: "linear-gradient(160deg,#0b2540,#1b3a5c)", padding: compact ? 6 : 16, gap: compact ? 2 : 6 }}
      data-protected-tile
    >
      <span style={{ fontSize: compact ? 34 : 52, lineHeight: 1 }}>🛡</span>
      {compact ? (
        <span className="font-bold" style={{ fontSize: rem(12), lineHeight: 1.25 }}>회원 전용 사진</span>
      ) : (
        <>
          <span className="font-bold" style={{ fontSize: rem(17), lineHeight: 1.3 }}>브랜드 보호 매물 · 회원 전용 사진</span>
          {count > 0 && <span style={{ fontSize: rem(14), opacity: 0.85 }}>보호 사진 {count}장</span>}
        </>
      )}
    </div>
  );
}
