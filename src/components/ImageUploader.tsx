"use client";

import { useState } from "react";
import { resizeImageForUpload } from "@/lib/resizeImage";
import { rem } from "@/lib/rem";
import { uploadFormData } from "@/lib/uploadClient";
import { FieldTag, FORM_LABEL_STYLE, FORM_HINT_STYLE } from "@/components/FormField";

type Item = { preview: string; url?: string; uploading: boolean };

export default function ImageUploader({
  onChange,
  label = "사진 첨부",
  hint,
  max = 6,
  initialUrls = [],
  adminKey,
}: {
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: string;
  max?: number;
  initialUrls?: string[];
  adminKey?: string; // 관리자 화면에서만 — 있으면 x-admin-key로, 없으면 회원 토큰(authFetch)으로 업로드
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url) => ({ preview: url, url, uploading: false }))
  );
  const displayHint = hint ?? `실물사진 · 박스사진 · 라벨(제품표시사항) 등, 최대 ${max}장`;

  const emitChange = (list: Item[]) => {
    onChange(list.filter((i) => i.url).map((i) => i.url as string));
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remaining = max - items.length;
    if (remaining <= 0) return;
    const files = Array.from(fileList).slice(0, remaining);

    // 기존 목록에 이어서 누적 (매번 초기화되지 않도록)
    const newItems: Item[] = files.map((f) => ({
      preview: URL.createObjectURL(f),
      uploading: true,
    }));
    const startIndex = items.length;
    setItems([...items, ...newItems]);

    // 2026-09-28: 여러 장을 한 요청에 모아 보내면 Vercel 서버리스 함수 요청
    // 본문 한도(4.5MB)를 원본 휴대폰 사진 2~3장만으로도 넘기기 쉬워서, 업로드
    // 전 축소(resizeImageForUpload) + 장당 개별 요청으로 변경 — 한 장이
    // 실패해도 나머지 장은 정상 업로드되고, 실패한 자리만 표시할 수 있음.
    for (let i = 0; i < files.length; i++) {
      try {
        const resized = await resizeImageForUpload(files[i]);
        const formData = new FormData();
        formData.append("files", resized, files[i].name || "photo.jpg");
        // 2026-09-30: 회원 토큰 또는 관리자 키 필수 (서버가 회원 사진 한도도 토큰으로 다시 계산)
        const res = await uploadFormData(formData, adminKey);
        const data = await res.json();
        const url: string | undefined = data.urls?.[0];
        setItems((prev) => {
          const updated = [...prev];
          if (updated[startIndex + i]) {
            updated[startIndex + i] = { ...updated[startIndex + i], url, uploading: false };
          }
          emitChange(updated);
          return updated;
        });
      } catch {
        setItems((prev) => {
          const updated = [...prev];
          if (updated[startIndex + i]) {
            updated[startIndex + i] = { ...updated[startIndex + i], uploading: false };
          }
          emitChange(updated);
          return updated;
        });
      }
    }
  };

  const removeAt = (index: number) => {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      emitChange(updated);
      return updated;
    });
  };

  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 flex-wrap" style={FORM_LABEL_STYLE}>
        {label}
        <FieldTag need="optional" />
        <span className="font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full" style={{ fontSize: rem(15) }}>
          {items.length}/{max}
        </span>
      </label>
      <p className="mb-2" style={FORM_HINT_STYLE}>{displayHint}</p>

      {items.length < max && (
        <label
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray200 rounded-xl text-gray500 text-sm cursor-pointer"
          style={{ minHeight: "72px" }}
        >
          탭해서 사진 선택 (여러 번 눌러서 계속 추가할 수 있어요)
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = ""; // 같은 파일을 다시 선택할 수 있도록 초기화
            }}
          />
        </label>
      )}

      {items.length > 0 && (
        <div className="flex gap-2 mt-2.5 overflow-x-auto">
          {items.map((it, i) => {
            // 2026-09-28: 업로드가 끝났는데(uploading: false) url이 없으면 실패한
            // 것 — 전엔 조용히 목록에서 빠져서(emitChange가 url 없는 항목을
            // 걸러냄) 사용자가 실패를 알아챌 방법이 없었음. 미리보기는 로컬
            // blob이라 실패해도 그대로 보여서, 테두리+배지로 구분해줘야 함.
            const failed = !it.uploading && !it.url;
            return (
              <div key={i} className="relative flex-shrink-0">
                <img
                  src={it.preview}
                  alt={`첨부 사진 ${i + 1}`}
                  className="w-16 h-16 rounded-lg object-cover"
                  style={{
                    opacity: it.uploading ? 0.5 : 1,
                    border: failed ? "1.5px solid #E5484D" : "1px solid #E4E7EB",
                  }}
                />
                {failed && (
                  <span
                    className="absolute bottom-0 left-0 right-0 text-center font-bold rounded-b-lg"
                    style={{ fontSize: rem(9), color: "#fff", background: "rgba(229,72,77,0.9)", padding: "1px 0" }}
                  >
                    실패 · 삭제 후 재시도
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray900 text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
