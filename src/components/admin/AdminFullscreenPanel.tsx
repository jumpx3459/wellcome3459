"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { rem } from "@/lib/rem";
import { BTN_CLASS, btnStyle } from "@/lib/uiText";

// 2026-10-23 관리자 PC 전체 화면 수정 패널(PR 1) — 매물 수정·매물 등록을 3단 칸 안에서 인라인으로 펼치던 것을 전체 화면으로 연다.
// 위 상단 바(제목 + ✕) / 가운데 본문 / 아래 저장 바. 본문은 lg 이상에서 3열(열마다 안쪽 스크롤 가능), 그 아래는 한 줄로 쌓여 본문 전체가 스크롤.
// - Esc·✕ = 닫기 요청. dirty면 패널 안 확인 바(window.confirm·alert 안 씀) → [계속 수정] / [저장 안 하고 닫기](= onClose).
//   저장 성공 뒤 닫는 건 부모가 open을 false로 바꿈(onClose는 "저장 안 하고 닫기"에만 불림).
// - 열려 있는 동안 페이지 스크롤 잠금, 닫으면 원래 스크롤 위치로.
// - 하단 시트(VideoNotUploadedSheet 등)와 토스트(z-50)가 이 패널 위로 보이도록 portal 없이 호출한 자리에서 그린다(DOM 순서로 위).

/** 본문 3열의 한 칸 — 제목 + 안쪽 스크롤(lg 이상) */
export function PanelColumn({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 flex flex-col gap-2.5 lg:overflow-y-auto lg:min-h-0 lg:pr-1 ${className}`} data-panel-col={title ?? ""}>
      {title && (
        <h3 className="font-bold" style={{ fontSize: rem(16), color: "#0B2540" }}>
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export default function AdminFullscreenPanel({
  open,
  title,
  onClose,
  children,
  footer,
  dirty = false,
  columns = 3,
  footerSlotRef,
  minimized = false,
}: {
  open: boolean;
  title: ReactNode;
  /** 저장 안 하고 닫기(또는 변경이 없을 때의 닫기) */
  onClose: () => void;
  children: ReactNode;
  /** 하단 저장 바 버튼들 — 함수로 주면 닫기 요청(dirty 확인 바 포함)을 받아 [취소]에 연결할 수 있음 */
  footer?: ReactNode | ((api: { requestClose: () => void }) => ReactNode);
  /** true면 닫기 요청 때 패널 안 확인 바를 먼저 보여줌 */
  dirty?: boolean;
  /** 3 = lg 이상 3열 그리드(칸마다 PanelColumn) / 1 = 본문을 그대로 한 덩어리(등록 폼처럼 자체 2단이 있을 때) */
  columns?: 3 | 1;
  /** 하단 바 안의 빈 자리 — 폼 안의 등록 버튼을 portal로 옮겨 올 때 */
  footerSlotRef?: (el: HTMLDivElement | null) => void;
  /** true면 화면에서만 숨김(내용·입력 상태는 그대로 유지) — 폼 작성 중 사업자 조회 섹션으로 잠깐 나갈 때 */
  minimized?: boolean;
}) {
  const [confirming, setConfirmingState] = useState(false);
  const confirmingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Esc 리스너(한 번만 등록)가 항상 최신 dirty·onClose를 보도록 — 렌더 중이 아니라 effect에서 갱신
  const latest = useRef({ dirty, onClose });
  useEffect(() => {
    latest.current = { dirty, onClose };
    confirmingRef.current = confirming;
  });
  const requestClose = () => {
    if (dirty) setConfirmingState(true);
    else onClose();
  };

  const active = open && !minimized;
  useEffect(() => {
    if (!active) return;
    setConfirmingState(false);
    const y = window.scrollY;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    rootRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      // 확인 바가 떠 있을 때의 Esc = 계속 수정
      if (confirmingRef.current) {
        setConfirmingState(false);
      } else if (latest.current.dirty) {
        setConfirmingState(true);
      } else {
        latest.current.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.scrollTo(0, y);
    };
  }, [active]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "수정"}
      className={`fixed inset-0 z-50 bg-white flex flex-col outline-none${minimized ? " hidden" : ""}`}
      data-admin-panel
    >
      <div className="flex items-center justify-between gap-4 border-b border-gray200 px-8 flex-shrink-0" style={{ minHeight: 56 }}>
        <div className="min-w-0 font-bold truncate" style={{ fontSize: rem(18), color: "#0B2540" }}>
          {title}
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="닫기"
          data-panel-close
          className="flex-shrink-0 rounded-lg font-bold text-gray500 hover:bg-gray100"
          style={{ width: 40, height: 40, fontSize: rem(20) }}
        >
          ✕
        </button>
      </div>

      {confirming && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-8 py-3 flex-shrink-0"
          style={{ background: "#FFF4E0", color: "#7A5B00" }}
          role="alert"
          data-panel-confirm
        >
          <span className="font-bold" style={{ fontSize: rem(15) }}>
            저장하지 않은 변경이 있어요
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingState(false)}
              className={BTN_CLASS}
              style={{ ...btnStyle("primary"), minHeight: 40, fontSize: rem(15), padding: "0 16px" }}
              data-panel-keep
            >
              계속 수정
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmingState(false);
                latest.current.onClose();
              }}
              className={BTN_CLASS}
              style={{ ...btnStyle("secondary"), minHeight: 40, fontSize: rem(15), padding: "0 16px" }}
              data-panel-discard
            >
              저장 안 하고 닫기
            </button>
          </div>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto px-8 py-4 ${columns === 3 ? "flex flex-col gap-6 lg:overflow-hidden lg:grid lg:grid-cols-3" : ""}`}
        data-panel-body
      >
        {children}
      </div>

      <div className="border-t border-gray200 bg-white px-8 py-2.5 flex items-center justify-end gap-3 flex-shrink-0 sticky bottom-0" data-panel-footer>
        <div ref={footerSlotRef} className="flex items-center gap-3 min-w-0" />
        {typeof footer === "function" ? footer({ requestClose }) : footer}
      </div>
    </div>
  );
}
