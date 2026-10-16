import type { Metadata } from "next";
import ConfirmStub from "../ConfirmStub";

// 알림톡 템플릿 심사용 확인 페이지 — 주소의 [code] 값은 쓰지 않는다(화면 출력·검사·저장·로그 없음). 검색 제외.
export const metadata: Metadata = {
  title: "확인 링크",
  robots: { index: false, follow: false },
};

export default function ConfirmPage() {
  return <ConfirmStub />;
}
