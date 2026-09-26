"use client";

import { useState } from "react";
import { parseCsv, type ManifestRow } from "@/lib/parseCsv";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — 500행 제한과 함께 과도한 붙여넣기/손상파일 방지

// 2026-09-26: 혼합매물(리퀴데이션 팔레트 등) 구성품 목록을 CSV로 업로드해서 그대로
// 테이블로 미리보기하는 컴포넌트. ImageUploader/VideoUploader와 같은 자리(sell 폼,
// admin DealForm)에서 씀. 파싱은 전부 브라우저에서 일어나고 서버엔 결과 JSON만 전달됨.
export default function ManifestUploader({
  onChange,
  initialRows,
}: {
  onChange: (rows: ManifestRow[]) => void;
  initialRows?: ManifestRow[];
}) {
  const [rows, setRows] = useState<ManifestRow[]>(initialRows ?? []);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("CSV 파일만 업로드할 수 있어요 (엑셀 → 다른 이름으로 저장 → CSV UTF-8).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("파일이 너무 커요 (2MB 이하로 올려주세요).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const { headers, rows: parsed, truncated: wasTruncated } = parseCsv(text);
      if (headers.length === 0) {
        setError("내용을 읽을 수 없어요. 파일을 확인해주세요.");
        return;
      }
      setRows(parsed);
      setTruncated(wasTruncated);
      setFileName(file.name);
      onChange(parsed);
    };
    reader.onerror = () => setError("파일을 읽는 중 문제가 발생했어요.");
    reader.readAsText(file, "utf-8");
  };

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div>
      <label className="text-xs font-bold text-gray500 mb-1 block">
        구성품 목록 CSV (선택 — 여러 품목이 섞인 혼합매물/리퀴데이션 팔레트용)
      </label>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="text-sm w-full"
      />
      <p className="text-xs text-gray500 mt-1">
        개별 사진 없이 여러 품목이 한 팔레트에 섞인 경우, 엑셀/구글시트에서 &quot;CSV로 다운로드&quot;한
        목록을 올리면 상세 페이지에 표로 보여줘요.
      </p>
      {error && <div className="text-xs text-orange font-medium mt-1.5">{error}</div>}
      {rows.length > 0 && (
        <div className="mt-2 bg-white border border-gray200 rounded-lg overflow-hidden">
          <div className="text-xs font-bold text-gray500 px-2.5 py-1.5 bg-gray100">
            {fileName ? `${fileName} · ` : ""}총 {rows.length}개 품목
            {truncated ? " (최대 500개까지만 반영돼요)" : ""}
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full" style={{ minWidth: headers.length * 90 }}>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="text-left px-2 py-1 border-t border-gray200 whitespace-nowrap text-gray500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} className="px-2 py-1 border-t border-gray200 whitespace-nowrap">
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && (
            <div className="text-xs text-gray500 px-2.5 py-1.5">외 {rows.length - 5}개 더...</div>
          )}
        </div>
      )}
    </div>
  );
}
