import { rem } from "@/lib/rem";
import { BUSINESS_INFO, mailHref, telHref } from "@/lib/businessInfo";

// 고객센터 문의 경로 (2026-09-30, 커밋 D) — 카카오톡 채널 채팅 · 전화 · 이메일. 값은 src/lib/businessInfo.ts
export default function ContactLinks({ className = "" }: { className?: string }) {
  const item = "inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap";
  const style = { fontSize: rem(14), padding: "7px 12px", background: "#fff", border: "1px solid #E4E7EB", color: "#1A1F26" };
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={BUSINESS_INFO.kakaoChannel.url} target="_blank" rel="noopener noreferrer" className={item} style={style}>
        💬 카카오톡 채널 {BUSINESS_INFO.kakaoChannel.searchId} (채팅 상담)
      </a>
      <a href={telHref(BUSINESS_INFO.tel)} className={item} style={style}>
        📞 {BUSINESS_INFO.tel}
      </a>
      <a href={mailHref(BUSINESS_INFO.email)} className={item} style={style}>
        ✉️ {BUSINESS_INFO.email}
      </a>
    </div>
  );
}
