const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

type AdSlotProps = {
  className?: string;
};

// 애드센스 계정이 아직 없어 자리만 예약해두는 컴포넌트입니다.
// NEXT_PUBLIC_ADSENSE_CLIENT_ID가 설정되면 이 자리를 실제 <ins class="adsbygoogle"> 태그로 교체하면 됩니다.
export default function AdSlot({ className = "" }: AdSlotProps) {
  if (ADSENSE_CLIENT_ID) return null;

  return (
    <div
      className={`w-full rounded-2xl border border-dashed flex flex-col items-center justify-center gap-1 py-6 ${className}`}
      style={{ borderColor: "#C7CBD1", background: "#F1F1EF" }}
    >
      <span className="text-[0.7222rem] font-bold text-gray500 tracking-widest">AD</span>
      <span className="text-xs text-gray500">광고 영역</span>
    </div>
  );
}
