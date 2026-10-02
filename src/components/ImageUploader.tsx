"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { resizeImageForUpload } from "@/lib/resizeImage";
import { rem } from "@/lib/rem";
import { uploadFormData } from "@/lib/uploadClient";
import { DEAL_LABEL_STYLE, FORM_HINT_STYLE } from "@/components/FormField";

// 2026-10-02 PR-B: file은 이번에 고른 사진만(다시 시도용) — 불러온 기존 사진(initialUrls)엔 없음
type Item = { id: number; preview: string; url?: string; uploading: boolean; file?: File };

// 칸 id — 화면 안에서만 쓰는 번호라 모듈 전체에서 늘어나기만 하면 됨
let nextItemId = 0;

export type ImageUploadStatus = { uploading: number; failed: number };

// 폼의 "사진이 올라가지 않았어요" 창에서 쓰는 동작
export type ImageUploaderHandle = {
  retryFailed: () => void; // 실패한 사진 다시 올리기
  removeFailed: () => void; // 실패한 사진만 빼기 (올라간 사진·기존 사진은 그대로)
};

export default function ImageUploader({
  onChange,
  onStatusChange,
  label = "사진 첨부",
  hint,
  max = 6,
  initialUrls = [],
  adminKey,
  ref,
}: {
  onChange: (urls: string[]) => void;
  // 2026-10-02 PR-B: 올리는 중·실패 장수 — 폼이 제출을 막거나 확인 창을 띄움 (안 넘기면 예전처럼 동작)
  onStatusChange?: (status: ImageUploadStatus) => void;
  label?: string;
  hint?: string;
  max?: number;
  initialUrls?: string[];
  adminKey?: string; // 관리자 화면에서만 — 있으면 x-admin-key로, 없으면 회원 토큰(authFetch)으로 업로드
  ref?: Ref<ImageUploaderHandle>;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url) => ({ id: nextItemId++, preview: url, url, uploading: false }))
  );
  const displayHint = hint ?? `실물사진 · 박스사진 · 라벨(제품표시사항) 등, 최대 ${max}장`;

  // 2026-10-02 PR-B: 올라간 사진 목록이 바뀔 때만 onChange — 예전엔 setItems 갱신 함수 안에서 불러서
  // "Cannot update a component while rendering a different component" 경고가 났음
  const urls = items.filter((i) => i.url).map((i) => i.url as string);
  const urlsKey = urls.join("\n");
  const lastUrlsKey = useRef(urlsKey);
  useEffect(() => {
    if (lastUrlsKey.current === urlsKey) return;
    lastUrlsKey.current = urlsKey;
    onChange(urls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  const uploadingCount = items.filter((i) => i.uploading).length;
  const failedCount = items.filter((i) => !i.uploading && !i.url).length;
  useEffect(() => {
    onStatusChange?.({ uploading: uploadingCount, failed: failedCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadingCount, failedCount]);

  // 2026-10-02 PR-B: 자리 찾기를 번호(index) 대신 id로 — 올리는 중에 다른 사진을 ×로 지워도 결과가 엉뚱한 칸에 붙지 않게
  const patchItem = (id: number, patch: Partial<Item>) => {
    setItems((prev) => {
      if (!prev.some((it) => it.id === id)) return prev; // 그사이 ×로 지운 사진
      return prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
    });
  };

  const uploadOne = async (id: number, file: File) => {
    try {
      const resized = await resizeImageForUpload(file);
      const formData = new FormData();
      formData.append("files", resized, file.name || "photo.jpg");
      // 2026-09-30: 회원 토큰 또는 관리자 키 필수 (서버가 회원 사진 한도도 토큰으로 다시 계산)
      const res = await uploadFormData(formData, adminKey);
      const data = await res.json();
      const url: string | undefined = data.urls?.[0];
      patchItem(id, { url, uploading: false });
    } catch {
      patchItem(id, { uploading: false });
    }
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const remaining = max - items.length;
    if (remaining <= 0) return;
    const files = Array.from(fileList).slice(0, remaining);

    // 기존 목록에 이어서 누적 (매번 초기화되지 않도록)
    const newItems: Item[] = files.map((f) => ({
      id: nextItemId++,
      preview: URL.createObjectURL(f),
      uploading: true,
      file: f,
    }));
    setItems((prev) => [...prev, ...newItems]);

    // 2026-09-28: 여러 장을 한 요청에 모아 보내면 Vercel 서버리스 함수 요청
    // 본문 한도(4.5MB)를 원본 휴대폰 사진 2~3장만으로도 넘기기 쉬워서, 업로드
    // 전 축소(resizeImageForUpload) + 장당 개별 요청으로 변경 — 한 장이
    // 실패해도 나머지 장은 정상 업로드되고, 실패한 자리만 표시할 수 있음.
    for (const it of newItems) await uploadOne(it.id, it.file as File);
  };

  const retry = async (targets: Item[]) => {
    const list = targets.filter((it) => it.file && !it.uploading && !it.url);
    if (list.length === 0) return;
    const ids = new Set(list.map((it) => it.id));
    setItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, uploading: true } : it)));
    for (const it of list) await uploadOne(it.id, it.file as File);
  };

  useImperativeHandle(ref, () => ({
    retryFailed: () => retry(items),
    removeFailed: () => {
      setItems((prev) => prev.filter((it) => it.uploading || it.url));
    },
  }));

  const removeAt = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div>
      {/* 2026-10-01: 매물 폼 공통 — (선택) 글자 없음, 라벨 15px */}
      <label className="mb-2 flex items-center gap-1.5 flex-wrap" style={DEAL_LABEL_STYLE}>
        {label}
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
            // 것 — 미리보기는 로컬 blob이라 실패해도 그대로 보여서, 테두리+덮개로 구분.
            // (onChange로는 url 있는 사진만 나가서 실패한 사진은 저장되지 않음)
            const failed = !it.uploading && !it.url;
            return (
              <div key={it.id} className="relative flex-shrink-0">
                <img
                  src={it.preview}
                  alt={`첨부 사진 ${i + 1}`}
                  className="w-16 h-16 rounded-lg object-cover"
                  style={{
                    opacity: it.uploading ? 0.5 : 1,
                    border: failed ? "1.5px solid #E5484D" : "1px solid #E4E7EB",
                  }}
                />
                {/* 2026-10-02 PR-B: 실패한 사진은 자리를 지키고 [다시 시도] — 폼은 실패 장수를 보고 제출 전에 확인 창을 띄움 */}
                {failed && (
                  <button
                    type="button"
                    onClick={() => retry([it])}
                    aria-label={`첨부 사진 ${i + 1} 다시 시도`}
                    className="absolute inset-0 flex flex-col items-center justify-center rounded-lg font-bold"
                    style={{ fontSize: rem(10), color: "#fff", background: "rgba(229,72,77,0.82)", lineHeight: 1.25 }}
                  >
                    실패
                    <span style={{ textDecoration: "underline" }}>다시 시도</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(it.id)}
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
