"use client";

import { useId } from "react";
import { BTN_CLASS, btnStyle, UI_CARD_TITLE, UI_DESC } from "@/lib/uiText";
import { useBackToClose } from "@/lib/useBackToClose";
import type { VideoUploadStatus } from "@/components/VideoUploader";

// 2026-10-02 PR-A2: 영상을 골랐는데 안 올라간 채 제출하던 문제(아이폰 Safari 15초 초과 → video_url 없이 판매 신청 4건).
// VideoUploader를 쓰는 폼(/sell·관리자 새 매물·관리자 매물 수정)이 같은 규칙을 씀:
//   uploading → 제출 버튼 비활성 + VIDEO_UPLOADING_LABEL
//   failed·rejected·pending(골랐지만 아직 안 올림) → 이 시트: [영상 빼고 등록] / [다시 고르기]
//
// 2026-10-02 PR-B: 사진(ImageUploader)도 같은 규칙 — 올리는 중엔 버튼 비활성, 실패한 사진이 있으면 이 시트(문구만 바꿔서)로
//   [다시 시도] / [빼고 등록]. 사진·영상이 둘 다 안 올라갔으면 사진 시트 → 영상 시트 순서로 하나씩 묻는다.
export const VIDEO_UPLOADING_LABEL = "영상 올리는 중…";

// 제출 버튼 문구 — 둘 다 올리는 중이면 "사진·영상 올리는 중…", 아니면 null
export function uploadingLabel(photoUploading: boolean, videoUploading: boolean): string | null {
  if (photoUploading && videoUploading) return "사진·영상 올리는 중…";
  if (photoUploading) return "사진 올리는 중…";
  if (videoUploading) return VIDEO_UPLOADING_LABEL;
  return null;
}

export const PHOTO_FAILED_DESCRIPTION = "올라가지 않은 사진은 저장되지 않아요. 다시 올려보거나, 그 사진만 빼고 진행해주세요.";

export function videoNotUploaded(status: VideoUploadStatus): boolean {
  return status === "failed" || status === "rejected" || status === "pending";
}

export default function VideoNotUploadedSheet({
  open,
  onSkip,
  onReselect,
  onClose,
  title = "영상이 올라가지 않았어요",
  reselectLabel = "다시 고르기",
  skipLabel = "영상 빼고 등록",
  description = "고른 영상이 아직 저장되지 않았어요. 영상 없이 진행하거나, 영상을 다시 골라주세요.",
}: {
  open: boolean;
  onSkip: () => void;
  onReselect: () => void;
  onClose: () => void;
  title?: string;
  reselectLabel?: string;
  skipLabel?: string;
  description?: string;
}) {
  const titleId = useId();
  useBackToClose(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white w-full max-w-md rounded-t-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div id={titleId} style={UI_CARD_TITLE}>{title}</div>
        <p className="mt-2" style={UI_DESC}>{description}</p>
        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={onReselect} className={`w-full ${BTN_CLASS}`} style={btnStyle("primary")}>
            {reselectLabel}
          </button>
          <button type="button" onClick={onSkip} className={`w-full ${BTN_CLASS}`} style={btnStyle("secondary")}>
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
