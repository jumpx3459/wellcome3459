"use client";

import { rem } from "@/lib/rem";
import { PRIVATE_SELLER_NAME } from "@/lib/sellerDisplay";

// 관리자 매물 등록·수정의 "판매자 표시" (2026-09-30, 커밋 E) — 공개 시점 매물은 모두 대리 게시(중개).
// 비공개(기본)면 매물 상세에 "비공개 판매자", 상호 공개면 입력한 상호. 관리자 입력은 사칭 검사 예외.
export default function SellerDisplayPicker({
  isPublic,
  companyName,
  onChange,
  idPrefix,
}: {
  isPublic: boolean;
  companyName: string;
  onChange: (next: { isPublic: boolean; companyName: string }) => void;
  idPrefix: string;
}) {
  const option = (value: boolean, label: string) => (
    <label
      className="flex items-center gap-2.5 rounded-xl cursor-pointer"
      style={{ border: `2px solid ${isPublic === value ? "#0B2540" : "#E4E7EB"}`, padding: "10px 12px", background: "#fff" }}
    >
      <input
        type="radio"
        name={`${idPrefix}-seller-display`}
        checked={isPublic === value}
        onChange={() => onChange({ isPublic: value, companyName })}
        className="w-4 h-4 accent-navy flex-shrink-0"
      />
      <span className="font-bold text-navy" style={{ fontSize: rem(14) }}>{label}</span>
    </label>
  );

  return (
    <div className="min-w-0">
      <div className="text-xs font-bold text-gray500 mb-1">판매자 표시</div>
      <div className="flex flex-col gap-2">
        {option(false, "대리 게시 (비공개)")}
        {option(true, "대리 게시 (상호 공개)")}
      </div>
      {isPublic ? (
        <input
          id={`${idPrefix}-seller-company`}
          className="w-full border-2 border-gray200 rounded-xl px-3 mt-2 outline-none focus:border-navy"
          style={{ height: 44, fontSize: rem(15) }}
          placeholder="매물 상세에 보일 상호"
          maxLength={60}
          value={companyName}
          onChange={(e) => onChange({ isPublic, companyName: e.target.value })}
        />
      ) : null}
      <p className="mt-1.5" style={{ fontSize: rem(13), color: "#6B7480" }}>
        {isPublic && companyName.trim()
          ? `매물 상세: ${companyName.trim()}`
          : `매물 상세: ${PRIVATE_SELLER_NAME} · 점핑매니저가 연결해드려요${isPublic ? " (상호를 입력하면 공개돼요)" : ""}`}
      </p>
    </div>
  );
}
