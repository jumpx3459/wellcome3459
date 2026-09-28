import { categoryIcons, categoryColors } from "@/lib/mockData";

// 사진 없는 매물 공통 자리표시 (상세 히어로·목록 카드·알림함·홈 미리보기).
// 부모 크기를 꽉 채운다. size="sm"(64px 이하 썸네일)은 글자가 안 들어가서 아이콘만.
export default function NoPhotoPlaceholder({
  category,
  size = "lg",
  muted = false,
}: {
  category: string;
  size?: "sm" | "lg";
  muted?: boolean; // 마감 매물 — 회색 톤
}) {
  const color = categoryColors[category] ?? categoryColors["기타"];
  const icon = categoryIcons[category] ?? "🗂️";

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1.5"
      style={{ background: muted ? "#F1F1EF" : color.bg }}
    >
      <span aria-hidden style={{ fontSize: size === "sm" ? "1.5rem" : "3rem", lineHeight: 1 }}>
        {icon}
      </span>
      {size === "lg" && (
        <span className="font-bold" style={{ fontSize: "0.8125rem", color: muted ? "#8A8A82" : color.text }}>
          사진 준비 중
        </span>
      )}
    </div>
  );
}
