"use client";

import { useState } from "react";
import { authFetch } from "@/lib/authFetch";

type Status = "none" | "pending" | "verified";

export default function BusinessLicenseUploader({
  status,
  onUploaded,
}: {
  status: Status;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // 토큰은 authFetch가 호출 직전에 최신으로 넣음 (만료 시 갱신·1회 재시도)
      const res = await authFetch("/api/business-license/upload", { formData });
      if (res.status === 401) {
        setError("로그인이 필요해요.");
        return;
      }
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "업로드에 실패했어요.");
      } else {
        onUploaded();
      }
    } catch {
      setError("업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5 flex-wrap">
        사업자등록증
        <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
          선택
        </span>
        {status === "verified" && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#E8F8EC", color: "#1D8A44" }}
          >
            ✓ 인증된 사업자
          </span>
        )}
        {status === "pending" && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#FFF6E5", color: "#B45309" }}
          >
            인증 대기중
          </span>
        )}
      </label>
      <p className="text-xs text-gray500 mb-2 leading-relaxed">
        비공개로 저장되며 점핑매니저만 확인해요. 다른 회원에게는 절대 공개되지 않아요.
      </p>

      <label
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray200 rounded-xl text-gray500 text-sm cursor-pointer"
        style={{ minHeight: "72px" }}
      >
        {uploading ? "업로드 중..." : status === "none" ? "탭해서 사업자등록증 첨부" : "탭해서 다시 첨부"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {preview && (
        <img
          src={preview}
          alt="사업자등록증 미리보기"
          className="w-20 h-20 rounded-lg object-cover border border-gray200 mt-2.5"
          style={{ opacity: uploading ? 0.5 : 1 }}
        />
      )}
      {error && <p className="text-xs text-orange mt-1.5">{error}</p>}
    </div>
  );
}
