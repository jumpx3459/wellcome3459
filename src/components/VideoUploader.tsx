"use client";

import { useRef, useState } from "react";

const MAX_SECONDS = 15;

type Phase = "idle" | "loading" | "need-trim" | "trimming" | "uploading" | "done" | "error";

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

export default function VideoUploader({
  onChange,
  label = "소개 영상 첨부",
  hint = "최대 15초 · 15초보다 길면 원하는 구간을 골라 잘라드려요",
  initialUrl,
}: {
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
  initialUrl?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(initialUrl ? "done" : "idle");
  const [srcUrl, setSrcUrl] = useState<string | null>(null); // 원본(트림 대상) 미리보기
  const [resultUrl, setResultUrl] = useState<string | null>(initialUrl ?? null); // 업로드 완료된 최종 영상
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const trimVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<File | null>(null);

  const reset = () => {
    setPhase("idle");
    setSrcUrl(null);
    setResultUrl(null);
    setDuration(0);
    setTrimStart(0);
    setError(null);
    fileRef.current = null;
    onChange(null);
  };

  const uploadFile = async (file: File | Blob, filename: string) => {
    setPhase("uploading");
    try {
      const formData = new FormData();
      formData.append("video", file, filename);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.videoUrl) {
        setResultUrl(data.videoUrl);
        onChange(data.videoUrl);
        setPhase("done");
      } else if (data.demo) {
        // 로컬 데모 모드: 실제 저장은 안 되지만 미리보기는 그대로 보여줌
        const localUrl = URL.createObjectURL(file);
        setResultUrl(localUrl);
        onChange(localUrl);
        setPhase("done");
      } else {
        throw new Error();
      }
    } catch {
      setError("영상 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
      setPhase("error");
    }
  };

  const handleSelect = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    fileRef.current = file;
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    setPhase("loading");

    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    probe.onloadedmetadata = () => {
      const dur = probe.duration;
      const afterDuration = (d: number) => {
        if (!isFinite(d) || d <= 0) {
          setError("영상 길이를 확인하지 못했어요. 다른 파일로 시도해주세요.");
          setPhase("error");
          return;
        }
        if (d <= MAX_SECONDS + 0.3) {
          // 15초 이내면 바로 업로드
          uploadFile(file, file.name);
        } else {
          setDuration(d);
          setTrimStart(0);
          setPhase("need-trim");
        }
      };

      if (!isFinite(dur)) {
        // 일부 브라우저에서 duration이 즉시 안 잡히는 경우 보정
        probe.currentTime = 1e9;
        probe.ontimeupdate = () => {
          probe.ontimeupdate = null;
          afterDuration(probe.duration);
        };
      } else {
        afterDuration(dur);
      }
    };
  };

  const doTrim = async () => {
    const video = trimVideoRef.current;
    if (!video) return;

    // captureStream 미지원 브라우저 대비 (구형 Safari 등)
    // @ts-expect-error - 표준에는 있지만 일부 타입 정의에 없을 수 있음
    const captureFn = video.captureStream || video.mozCaptureStream;
    if (!captureFn) {
      setError("이 브라우저에서는 자동 자르기가 지원되지 않아요. 다른 영상으로 시도하거나 미리 잘라서 올려주세요.");
      setPhase("error");
      return;
    }

    setPhase("trimming");
    try {
      const stream: MediaStream = captureFn.call(video);
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopAndUpload = () => {
        video.pause();
        video.ontimeupdate = null;
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        uploadFile(blob, `trimmed-${Date.now()}.webm`);
      };

      video.currentTime = trimStart;
      video.onseeked = () => {
        video.onseeked = null;
        recorder.start();
        video.play();
        video.ontimeupdate = () => {
          if (video.currentTime >= trimStart + MAX_SECONDS) stopAndUpload();
        };
        // 영상 자체가 구간 도중 끝나는 경우 대비
        video.onended = stopAndUpload;
        // 안전장치: 16초 넘게 걸리면 강제 종료
        setTimeout(stopAndUpload, (MAX_SECONDS + 1) * 1000);
      };
    } catch {
      setError("영상을 자르는 중 문제가 발생했어요. 다시 시도해주세요.");
      setPhase("error");
    }
  };

  return (
    <div>
      <label className="text-sm font-bold text-navy mb-2 flex items-center gap-1.5">
        {label}
        <span className="text-xs font-medium text-gray500 bg-gray100 px-2 py-0.5 rounded-full">
          선택 · 최대 15초
        </span>
      </label>
      <p className="text-xs text-gray500 mb-2">{hint}</p>

      {phase === "idle" && (
        <label
          className="flex flex-col items-center justify-center border-2 border-dashed border-gray200 rounded-xl text-gray500 text-sm cursor-pointer"
          style={{ minHeight: "72px" }}
        >
          🎬 탭해서 영상 선택
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              handleSelect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {phase === "loading" && (
        <div className="text-sm text-gray500 py-4 text-center">영상 길이를 확인하는 중...</div>
      )}

      {phase === "need-trim" && srcUrl && (
        <div className="border-2 border-gray200 rounded-xl p-3">
          <video
            ref={trimVideoRef}
            src={srcUrl}
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: "220px" }}
            controls={false}
          />
          <p className="text-xs text-gray500 mt-2">
            영상이 {Math.round(duration)}초라 15초를 넘어요. 시작 지점을 골라주세요 — 그 지점부터 15초가
            잘려서 올라가요.
          </p>
          <input
            type="range"
            min={0}
            max={Math.max(0, duration - MAX_SECONDS)}
            step={0.1}
            value={trimStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTrimStart(v);
              if (trimVideoRef.current) trimVideoRef.current.currentTime = v;
            }}
            className="w-full mt-3 accent-orange"
          />
          <div className="text-xs font-bold text-navy mt-1">
            선택 구간: {trimStart.toFixed(1)}초 ~ {(trimStart + MAX_SECONDS).toFixed(1)}초
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={reset}
              className="flex-1 text-sm font-bold border-2 border-gray200 text-gray500 rounded-xl py-2.5"
            >
              취소
            </button>
            <button
              type="button"
              onClick={doTrim}
              className="flex-1 text-sm font-bold text-white rounded-xl py-2.5"
              style={{ background: "#FF6F0F" }}
            >
              이 구간으로 자르기
            </button>
          </div>
        </div>
      )}

      {phase === "trimming" && (
        <div className="text-sm text-gray500 py-4 text-center">
          영상을 자르는 중이에요... (재생되는 15초 동안 잠시만 기다려주세요)
        </div>
      )}

      {phase === "uploading" && (
        <div className="text-sm text-gray500 py-4 text-center">영상 업로드 중...</div>
      )}

      {phase === "done" && resultUrl && (
        <div className="flex items-center gap-3 border-2 border-gray200 rounded-xl p-3">
          <video src={resultUrl} className="w-24 h-24 rounded-lg object-cover bg-black" muted />
          <div className="flex-1">
            <div className="text-sm font-bold text-navy">영상 첨부 완료</div>
            <div className="text-xs text-gray500">최대 15초로 준비됐어요.</div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="w-8 h-8 rounded-full bg-gray900 text-white text-sm flex items-center justify-center flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-orange font-medium">{error}</div>
          <button
            type="button"
            onClick={reset}
            className="self-start text-sm font-bold text-navy underline"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
