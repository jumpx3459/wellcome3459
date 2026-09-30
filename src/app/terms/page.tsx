import type { Metadata } from "next";
import { readFileSync } from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "서비스 이용약관",
  description: "덤핑점핑 서비스 이용약관입니다.",
};

// 빌드 때 docs/legal/terms-2026-10-07.md를 읽어 정적 페이지로 만든다 (런타임엔 파일이 필요 없음).
export const dynamic = "force-static";

// 2026-09-30: 약관 전문 = docs/legal/terms-2026-10-07.md (내용 수정 금지 — 바꿀 땐 새 파일 + TERMS_VERSION 변경).
// md는 "# 제목 / 시행일 줄 / ## 조 제목 / 문단·번호 줄"만 쓰므로 그 형식만 그대로 옮긴다(번호도 원문 그대로).
const TERMS_FILE = "docs/legal/terms-2026-10-07.md";

type Block = { kind: "h1" | "h2" | "p"; text: string };

function parseTerms(md: string): Block[] {
  return md
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith("## ")
        ? { kind: "h2" as const, text: line.slice(3) }
        : line.startsWith("# ")
        ? { kind: "h1" as const, text: line.slice(2) }
        : { kind: "p" as const, text: line }
    );
}

export default function TermsPage() {
  const blocks = parseTerms(readFileSync(path.join(process.cwd(), TERMS_FILE), "utf8"));
  const title = blocks.find((b) => b.kind === "h1")?.text ?? "서비스 이용약관";
  const body = blocks.filter((b) => b.kind !== "h1");

  return (
    <main className="min-h-screen px-5 py-8">
      <h1 className="font-display text-2xl text-navy mb-4">{title}</h1>
      <section className="flex flex-col text-sm text-gray900 leading-relaxed">
        {body.map((b, i) =>
          b.kind === "h2" ? (
            <h2 key={i} className="font-bold text-navy mt-5 mb-1.5">
              {b.text}
            </h2>
          ) : (
            <p key={i} className={/^\d+\. /.test(b.text) ? "pl-4 -indent-4 mt-1" : i === 0 ? "text-gray500" : "mt-1"}>
              {b.text}
            </p>
          )
        )}
      </section>
    </main>
  );
}
