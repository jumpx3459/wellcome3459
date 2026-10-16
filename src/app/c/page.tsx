import type { Metadata } from "next";
import ConfirmStub from "./ConfirmStub";

// /c (값 없음)도 [code] 화면과 같은 안내 — 404 대신. 검색 제외.
export const metadata: Metadata = {
  title: "확인 링크",
  robots: { index: false, follow: false },
};

export default function ConfirmIndexPage() {
  return <ConfirmStub />;
}
