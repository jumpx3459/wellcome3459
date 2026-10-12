import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "점핑파트너",
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
