// 카카오톡 채널(덤핑점핑-점프엑스, http://pf.kakao.com/_xcFZrX) "추가" 버튼.
// 카카오 JS SDK 없이 pf.kakao.com의 표준 "친구 추가" URL로 바로 연결하는
// 방식이라 별도 앱키 발급/SDK 로딩 없이도 모바일 카카오톡 앱 딥링크와
// PC 웹 모두에서 그대로 동작합니다. InstallAppButton과 같은 카드 스타일을
// 써서 "홈 화면에 추가"와 나란히 놓아도 톤이 맞게 했습니다.
const KAKAO_CHANNEL_URL = "https://pf.kakao.com/_xcFZrX/friend";

export default function KakaoChannelButton() {
  return (
    <a
      href={KAKAO_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center gap-3 rounded-2xl border-2 border-gray200 px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
    >
      <span
        className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 text-lg"
        style={{ background: "#FEE500" }}
      >
        💬
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-navy">카카오톡 채널 추가 · 공지용</span>
        <span className="block text-xs text-gray500 mt-0.5">
          맞춤 특가 알림은 가입 시 자동 설정 · 이건 공지·이벤트 소식용이에요
        </span>
      </span>
      <span className="text-gray500 flex-shrink-0">›</span>
    </a>
  );
}
