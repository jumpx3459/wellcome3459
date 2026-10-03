"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type DragEvent, type Ref } from "react";
import { resizeImageForUpload } from "@/lib/resizeImage";
import { rem } from "@/lib/rem";
import { uploadFormData } from "@/lib/uploadClient";
import { BASE_PHOTO_SLOTS } from "@/lib/photoLimit";
import { usePointerFine } from "@/lib/usePointerFine";
import { DEAL_LABEL_STYLE, FORM_HINT_STYLE, UPLOAD_ERROR_CLASS, UPLOAD_ERROR_STYLE } from "@/components/FormField";
import Toast, { useToast } from "@/components/Toast";

// 2026-10-02 PR-B: file은 이번에 고른 사진만(다시 시도용) — 불러온 기존 사진(initialUrls)엔 없음. error는 실패 이유(목록 아래 안내)
type Item = { id: number; preview: string; url?: string; uploading: boolean; file?: File; error?: string };

// 칸 id — 화면 안에서만 쓰는 번호라 모듈 전체에서 늘어나기만 하면 됨
let nextItemId = 0;

export type ImageUploadStatus = { uploading: number; failed: number };

// 폼의 "사진이 올라가지 않았어요" 창에서 쓰는 동작
export type ImageUploaderHandle = {
  retryFailed: () => void; // 실패한 사진 다시 올리기
  removeFailed: () => void; // 실패한 사진만 빼기 (올라간 사진·기존 사진은 그대로)
};

const HEIC_MESSAGE = "아이폰 사진(HEIC)은 JPG로 바꿔 올려주세요";
const ONLY_PHOTOS_MESSAGE = "사진 파일만 올릴 수 있어요";
const DEFAULT_FAIL_MESSAGE = "사진을 올리지 못했어요. 다시 시도해주세요";
// 썸네일 순서 끌기 표시 — 파일 끌어다 놓기(dataTransfer.types에 "Files")와 구분
const REORDER_TYPE = "application/x-dj-photo";

function isHeic(file: File): boolean {
  return /^image\/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}
// 사진만 받음 — Windows 등에선 HEIC의 type이 비어 있어 확장자로도 봄
function isPhotoFile(file: File): boolean {
  return file.type.startsWith("image/") || isHeic(file);
}
function isTextTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

// retry: 네트워크 오류·5xx(서버 사정)만 한 번 더 시도 — 형식·크기·한도(4xx)와 HEIC는 다시 해도 같으니 바로 실패
type UploadResult = { url: string } | { error: string; retry: boolean };

export default function ImageUploader({
  onChange,
  onStatusChange,
  label = "사진 첨부",
  hint,
  max = BASE_PHOTO_SLOTS,
  initialUrls = [],
  adminKey,
  globalPaste = false,
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
  // 2026-10-02 PR-B: 업로더가 하나뿐인 화면(/sell)만 — 사진 영역에 포커스가 없어도 문서 어디서든 Ctrl+V로 사진을 받음
  // (글자 칸·contenteditable에 포커스가 있으면 무시). 끄면 사진 영역을 클릭·포커스했을 때만 받음
  globalPaste?: boolean;
  ref?: Ref<ImageUploaderHandle>;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initialUrls.map((url) => ({ id: nextItemId++, preview: url, url, uploading: false }))
  );
  // 이번 묶음(올리는 중이 하나도 없을 때 시작, 올리는 중에 더 고르면 같은 묶음에 더함) — "올리는 중 2/5장"
  const [batchIds, setBatchIds] = useState<number[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragDepth = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerFine = usePointerFine();
  const { message: toastMessage, showToast } = useToast();
  const displayHint = hint ?? `실물사진 · 박스사진 · 라벨(제품표시사항) 등, 최대 ${max}장`;

  // 연달아 고르기·드롭이 화면 갱신 전에 들어와도 남은 칸을 맞게 세도록 최신 목록을 ref로도 둠
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 2026-10-02 PR-B: 올라간 사진 목록(화면 순서)이 바뀔 때만 onChange — 예전엔 setItems 갱신 함수 안에서 불러서
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

  const batchItems = items.filter((it) => batchIds.includes(it.id));
  const batchDone = batchItems.filter((it) => !it.uploading).length;

  // 2026-10-02 PR-B: 자리 찾기를 번호(index) 대신 id로 — 올리는 중에 다른 사진을 ×로 지우거나 순서를 바꿔도 결과가 엉뚱한 칸에 붙지 않게
  const patchItem = (id: number, patch: Partial<Item>) => {
    setItems((prev) => {
      if (!prev.some((it) => it.id === id)) return prev; // 그사이 ×로 지운 사진
      return prev.map((it) => (it.id === id ? { ...it, ...patch } : it));
    });
  };

  const tryUpload = async (file: File): Promise<UploadResult> => {
    const heic = isHeic(file);
    let resized: Blob;
    try {
      resized = await resizeImageForUpload(file);
    } catch {
      // 이 브라우저가 못 여는 파일(대개 HEIC) — 다시 해도 같음
      return { error: heic ? HEIC_MESSAGE : "사진을 열지 못했어요. 다른 사진으로 올려주세요", retry: false };
    }
    let res: Response;
    try {
      const formData = new FormData();
      formData.append("files", resized, file.name || "photo.jpg");
      // 2026-09-30: 회원 토큰 또는 관리자 키 필수 (서버가 회원 사진 한도도 토큰으로 다시 계산)
      res = await uploadFormData(formData, adminKey);
    } catch {
      return { error: heic ? HEIC_MESSAGE : DEFAULT_FAIL_MESSAGE, retry: !heic }; // 네트워크 오류
    }
    const data = await res.json().catch(() => ({}));
    const url: string | undefined = data.urls?.[0];
    if (res.ok && url) return { url };
    if (heic) return { error: HEIC_MESSAGE, retry: false };
    return { error: (typeof data.error === "string" && data.error) || DEFAULT_FAIL_MESSAGE, retry: res.status >= 500 };
  };

  const uploadOne = async (id: number, file: File) => {
    let result = await tryUpload(file);
    if ("error" in result && result.retry) {
      // 2026-10-02 PR-B: 자동 재시도 1회 — 잠깐 쉬었다가
      await new Promise((r) => setTimeout(r, 800));
      if (!itemsRef.current.some((it) => it.id === id)) return; // 그사이 ×로 지움
      result = await tryUpload(file);
    }
    if ("url" in result) patchItem(id, { url: result.url, uploading: false, error: undefined });
    else patchItem(id, { uploading: false, error: result.error });
  };

  const startBatch = (ids: number[]) => {
    const busy = itemsRef.current.some((it) => it.uploading);
    setBatchIds((prev) => (busy ? [...prev, ...ids] : ids));
  };

  const addFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    const photos = fileList.filter(isPhotoFile);
    if (photos.length === 0) {
      showToast(ONLY_PHOTOS_MESSAGE);
      return;
    }
    const remaining = max - itemsRef.current.length;
    if (remaining <= 0) {
      showToast(`최대 ${max}장까지 올릴 수 있어요`);
      return;
    }
    const files = photos.slice(0, remaining);
    if (photos.length > remaining) showToast(`최대 ${max}장까지 올릴 수 있어요`);
    else if (photos.length < fileList.length) showToast(`${ONLY_PHOTOS_MESSAGE} — 사진만 담았어요`);

    // 기존 목록에 이어서 누적 (매번 초기화되지 않도록)
    const newItems: Item[] = files.map((f) => ({
      id: nextItemId++,
      preview: URL.createObjectURL(f),
      uploading: true,
      file: f,
    }));
    startBatch(newItems.map((it) => it.id));
    itemsRef.current = [...itemsRef.current, ...newItems];
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
    startBatch([...ids]);
    itemsRef.current = itemsRef.current.map((it) => (ids.has(it.id) ? { ...it, uploading: true } : it));
    setItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, uploading: true, error: undefined } : it)));
    for (const it of list) await uploadOne(it.id, it.file as File);
  };

  useImperativeHandle(ref, () => ({
    retryFailed: () => retry(items),
    removeFailed: () => setItems((prev) => prev.filter((it) => it.uploading || it.url)),
  }));

  const removeAt = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // 순서 변경 — 저장되는 images 배열 = 화면 순서(맨 앞이 대표 사진). 올리는 중인 사진도 id로 옮김
  const moveTo = (id: number, toIndex: number) => {
    setItems((prev) => {
      const from = prev.findIndex((it) => it.id === id);
      if (from < 0 || toIndex < 0 || toIndex >= prev.length || from === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  // 붙여넣기 — 클립보드에 사진 파일이 없으면(글자 등) 그냥 둠
  const handlePaste = (e: ClipboardEvent | ReactClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  };
  const handlePasteRef = useRef(handlePaste);
  useEffect(() => {
    handlePasteRef.current = handlePaste;
  });
  useEffect(() => {
    if (!globalPaste) return;
    const onPaste = (e: ClipboardEvent) => {
      if (isTextTarget(e.target) || isTextTarget(document.activeElement)) return; // 글자 붙여넣기 방해 금지
      handlePasteRef.current(e);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [globalPaste]);

  // 파일 끌어다 놓기 — dataTransfer.types에 "Files"가 있을 때만(썸네일 순서 끌기와 구분)
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      addFiles(Array.from(e.dataTransfer.files));
    },
  };

  const failedMessages = [...new Set(items.filter((it) => !it.uploading && !it.url && it.error).map((it) => it.error as string))];

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onPaste={globalPaste ? undefined : handlePaste}
      onMouseDown={(e) => {
        // PC에서 사진 영역을 누르면 포커스(전역 :focus-visible 테두리) — 그다음 Ctrl+V로 붙여넣기. 터치 기기는 탭할 때 테두리가 생기지 않게 건너뜀
        if (pointerFine && !isTextTarget(e.target)) rootRef.current?.focus({ preventScroll: true });
      }}
      className="rounded-xl"
      style={dragOver ? { outline: "2px dashed #0B2540", outlineOffset: 4 } : undefined}
      {...dropHandlers}
    >
      {/* 2026-10-01: 매물 폼 공통 — (선택) 글자 없음, 라벨 15px */}
      <div className="mb-2 flex items-center gap-1.5 flex-wrap" style={DEAL_LABEL_STYLE}>
        {label}
        <span className="font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full" style={{ fontSize: rem(15) }}>
          {items.length}/{max}
        </span>
        {uploadingCount > 0 && batchItems.length > 0 && (
          <span className="font-bold text-navy" style={{ fontSize: rem(14) }} aria-live="polite">
            올리는 중 {Math.min(batchDone + 1, batchItems.length)}/{batchItems.length}장
          </span>
        )}
      </div>
      <p className="mb-2" style={FORM_HINT_STYLE}>{displayHint}</p>

      {items.length < max && (
        <label
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-sm cursor-pointer text-center px-3"
          style={{
            minHeight: "72px",
            borderColor: dragOver ? "#0B2540" : "#E4E7EB",
            background: dragOver ? "#F0F4F8" : undefined,
            color: dragOver ? "#0B2540" : "#6B7480",
          }}
        >
          {/* 2026-10-03 PR-D: PC는 버튼 모양 + 끌어다 놓기 안내(누르면 지금처럼 파일 선택 창, 여러 장). 휴대폰 문구는 그대로 */}
          {pointerFine ? (
            <span className="flex flex-col items-center gap-1.5 py-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg bg-white font-bold"
                style={{ border: "1.5px solid #0B2540", color: "#0B2540", fontSize: rem(15), padding: "8px 16px" }}
              >
                📁 사진 파일 선택
              </span>
              <span style={{ fontSize: rem(14) }}>또는 사진을 여기로 끌어다 놓으세요 · 여러 장 한 번에 선택 가능</span>
            </span>
          ) : (
            "탭해서 사진 선택 (여러 번 눌러서 계속 추가할 수 있어요)"
          )}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = ""; // 같은 파일을 다시 선택할 수 있도록 초기화
            }}
          />
        </label>
      )}

      {items.length > 0 && (
        // 2026-10-02 PR-B: 가로 스크롤(overflow-x-auto) 대신 줄바꿈 — 바깥으로 나간 ×가 잘리던 문제, 끌어서 순서 바꾸기도 한 화면에서
        <div className="flex flex-wrap gap-2 mt-2.5">
          {items.map((it, i) => {
            // 2026-09-28: 업로드가 끝났는데(uploading: false) url이 없으면 실패한
            // 것 — 미리보기는 로컬 blob이라 실패해도 그대로 보여서, 테두리+덮개로 구분.
            // (onChange로는 url 있는 사진만 나가서 실패한 사진은 저장되지 않음)
            const failed = !it.uploading && !it.url;
            return (
              <div
                key={it.id}
                className="relative flex-shrink-0"
                style={{ width: 64, opacity: draggingId === it.id ? 0.4 : 1, cursor: pointerFine ? "grab" : undefined }}
                draggable={pointerFine}
                onDragStart={(e) => {
                  e.dataTransfer.setData(REORDER_TYPE, String(it.id));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingId(it.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(e) => {
                  if (!Array.from(e.dataTransfer.types).includes(REORDER_TYPE)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  const raw = e.dataTransfer.getData(REORDER_TYPE);
                  if (!raw) return;
                  e.preventDefault();
                  moveTo(Number(raw), i);
                  setDraggingId(null);
                }}
              >
                <img
                  src={it.preview}
                  alt={`첨부 사진 ${i + 1}`}
                  draggable={false}
                  className="w-16 h-16 rounded-lg object-cover"
                  style={{
                    opacity: it.uploading ? 0.5 : 1,
                    border: failed ? "1.5px solid #E5484D" : "1px solid #E4E7EB",
                  }}
                />
                {i === 0 && !failed && (
                  <span
                    className="absolute left-0 right-0 text-center font-bold rounded-b-lg pointer-events-none"
                    style={{ top: 48, height: 16, fontSize: rem(10), lineHeight: "16px", color: "#fff", background: "rgba(11,37,64,0.85)" }}
                  >
                    대표 사진
                  </span>
                )}
                {/* 2026-10-02 PR-B: 실패한 사진은 자리를 지키고 [다시 시도] — 폼은 실패 장수를 보고 제출 전에 확인 창을 띄움 */}
                {failed && (
                  <button
                    type="button"
                    onClick={() => retry([it])}
                    aria-label={`첨부 사진 ${i + 1} 다시 시도`}
                    className="absolute top-0 left-0 w-16 h-16 flex flex-col items-center justify-center rounded-lg font-bold"
                    style={{ fontSize: rem(10), color: "#fff", background: "rgba(229,72,77,0.82)", lineHeight: 1.25 }}
                  >
                    실패
                    <span style={{ textDecoration: "underline" }}>다시 시도</span>
                  </button>
                )}
                {/* 2026-10-02 PR-B: ×는 썸네일 안쪽 모서리(예전엔 바깥으로 나가 위가 잘림) — 보이는 원 20px, 누르는 자리 32px */}
                <button
                  type="button"
                  onClick={() => removeAt(it.id)}
                  aria-label={`첨부 사진 ${i + 1} 삭제`}
                  className="absolute top-0 right-0 flex items-start justify-end"
                  style={{ width: 32, height: 32, padding: 3 }}
                >
                  <span className="w-5 h-5 rounded-full bg-gray900 text-white text-xs flex items-center justify-center" style={{ opacity: 0.88 }}>
                    ×
                  </span>
                </button>
                {/* 터치 기기는 끌기 대신 ◀▶ (맨 앞/맨 뒤는 해당 버튼 비활성) */}
                {!pointerFine && items.length > 1 && (
                  <div className="flex mt-1">
                    <button
                      type="button"
                      onClick={() => moveTo(it.id, i - 1)}
                      disabled={i === 0}
                      aria-label={`첨부 사진 ${i + 1} 앞으로`}
                      className="flex items-center justify-center text-navy disabled:text-gray200"
                      style={{ width: 32, height: 32, fontSize: rem(13) }}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTo(it.id, i + 1)}
                      disabled={i === items.length - 1}
                      aria-label={`첨부 사진 ${i + 1} 뒤로`}
                      className="flex items-center justify-center text-navy disabled:text-gray200"
                      style={{ width: 32, height: 32, fontSize: rem(13) }}
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {items.length > 1 && (
        <p className="mt-1.5" style={FORM_HINT_STYLE}>
          {pointerFine ? "첫 장이 대표 사진이에요 · 끌어서 순서를 바꿀 수 있어요" : "첫 장이 대표 사진이에요 · ◀▶로 순서를 바꿀 수 있어요"}
        </p>
      )}
      {failedMessages.map((m) => (
        <p key={m} className={UPLOAD_ERROR_CLASS} style={UPLOAD_ERROR_STYLE}>
          {m}
        </p>
      ))}
      <Toast message={toastMessage} />
    </div>
  );
}
