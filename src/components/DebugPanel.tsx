"use client";

// TEMP DEBUG — 세션 소실 버그 진단용. 원인 확인되면 이 컴포넌트와
// AppShell.tsx의 마운트 코드, src/lib/debugLog.ts를 전부 제거할 것.
import { useEffect, useState } from "react";
import { readDebugLog, clearDebugLog, DEBUG_LOG_EVENT } from "@/lib/debugLog";

// 실서비스 도메인(dumpingjumping.com)에서는 일반 사용자에게 노출되지 않도록 숨김.
// 세션 버그가 완전히 해소됐다고 판단되면 이 컴포넌트/AppShell 마운트/debugLog()
// 호출부를 통째로 제거할 것 — 그 전까지는 프리뷰(*.vercel.app)/로컬에서는 그대로 보임.
function isProductionHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith("dumpingjumping.com");
}

export default function DebugPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [open, setOpen] = useState(true);
  const [isProd, setIsProd] = useState(true);

  useEffect(() => {
    setIsProd(isProductionHost());
    const update = () => setLogs(readDebugLog());
    update();
    window.addEventListener(DEBUG_LOG_EVENT, update);
    window.addEventListener("storage", update);
    const interval = setInterval(update, 1000);
    return () => {
      window.removeEventListener(DEBUG_LOG_EVENT, update);
      window.removeEventListener("storage", update);
      clearInterval(interval);
    };
  }, []);

  if (isProd || logs.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: "#000",
        color: "#0F0",
        fontFamily: "monospace",
        fontSize: 10,
        maxHeight: open ? "45vh" : 28,
        overflowY: "auto",
        borderTop: "2px solid #0F0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 8px",
          background: "#111",
          position: "sticky",
          top: 0,
        }}
      >
        <span>🐛 DEBUG LOG ({logs.length})</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{ color: "#0F0", background: "none", border: "1px solid #0F0", padding: "0 6px" }}
          >
            {open ? "접기" : "펼치기"}
          </button>
          <button
            onClick={() => clearDebugLog()}
            style={{ color: "#F55", background: "none", border: "1px solid #F55", padding: "0 6px" }}
          >
            지우기
          </button>
        </span>
      </div>
      {open && (
        <div style={{ padding: "4px 8px" }}>
          {logs.map((l, i) => (
            <div key={i} style={{ wordBreak: "break-all", borderBottom: "1px solid #133", padding: "2px 0" }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
