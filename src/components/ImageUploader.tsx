"use client";

import { useState } from "react";

type Item = { preview: string; url?: string; uploading: boolean };

export default function ImageUploader({
  onChange,
  label = "사진 첨부",
  hint,
  max = 4,
  initialUrls = [],
}: {
  onChange: (urls: string[]) => void;
  label?: string;
  hint?: string;
  max?: number;
  initialUrls?: string[];
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
    const merged = [...items, ...newItems];
    setItems(merged);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      const urls: string[] = data.urls ?? [];

      setItems((prev) => {
        const updated = [...prev];
        // 방금 추가된 항목들(뒤에서 files.length개)에 순서대로 URL 매칭
        let urlIdx = 0;
        for (let i = updated.length - newItems.length; i < updated.length; i++) {
          updated[i] = { ...updated[i], url: urls[urlIdx], uploading: false };
          urlIdx++;
        }
        emitChange(updated);
        return updated;
      });
    } catch {
      setItems((prev) => {
        const updated = prev.map((it) => (it.uploading ? { ...it, uploading: false } : it));
        emitChange(updated);
        return updated;
      });
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
      <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
        {label}
        <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
          선택 · {items.length}/{max}
        </span>
      </label>
      <p className="text-xs text-gray500 mb-2">{displayHint}</p>

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
          {items.map((it, i) => (
            <div key={i} className="relative flex-shrink-0">
              <img
                src={it.preview}
                alt={`첨부 사진 ${i + 1}`}
                className="w-16 h-16 rounded-lg object-cover border border-gray200"
                style={{ opacity: it.uploading ? 0.5 : 1 }}
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray900 text-white text-xs flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
