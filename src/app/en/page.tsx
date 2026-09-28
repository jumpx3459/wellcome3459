import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SITE_URL } from "@/lib/siteUrl";
import { rem } from "@/lib/rem";
import HtmlLang from "./HtmlLang";

// 2026-09-29: 해외 투자자·파트너용 1페이지 영문 소개. 앱 전체 영문화는 하지 않음.
// 표현 원칙: "dumping" 단독 대신 surplus / excess / near-expiry inventory (서비스명은 그대로),
// 확인된 숫자만 (~830명 커뮤니티는 "초기 검증 기반"으로만), 미확인 수치·일정은 넣지 않음.

const TITLE = "DumpingJumping by JumpX — B2B Surplus Inventory Alerts";
const DESCRIPTION =
  "A B2B alert service that connects surplus, near-expiry and excess stock with the buyers who need it — by JumpX.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/en`,
    languages: { "ko-KR": `${SITE_URL}/`, en: `${SITE_URL}/en`, "x-default": `${SITE_URL}/` },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/en`,
    siteName: "DumpingJumping by JumpX",
    locale: "en_US",
    alternateLocale: ["ko_KR"],
    type: "website",
    images: [{ url: "/images/en/og.jpg", width: 1200, height: 630, alt: "DumpingJumping by JumpX" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/images/en/og.jpg"] },
};

const NAVY = "#0B2540";
const ORANGE = "#E25100";
const TEXT = "#1F2937";
const MUTED = "#4B5563";

const PROBLEMS = [
  {
    title: "Scattered offers",
    body: "Surplus stock is offered through KakaoTalk group chats and text messages, spread across many rooms and contacts.",
  },
  {
    title: "Good deals vanish fast",
    body: "Near-expiry and excess inventory has to move quickly. Buyers who are not watching at the right moment miss it.",
  },
  {
    title: "No data is left behind",
    body: "Prices and outcomes of these trades are never recorded, so the market has no reference for what surplus stock is worth.",
  },
];

const STEPS = [
  {
    title: "Sellers list stock",
    body: "Wholesalers, distributors and manufacturers register surplus, near-expiry or excess inventory — free to list.",
  },
  {
    title: "Buyers get instant alerts",
    body: "Buyers choose categories and regions once, and receive a push notification when a matching listing goes live.",
  },
  {
    title: "JumpX managers connect the deal",
    body: "A JumpX manager reviews each listing and connects the buyer and seller directly.",
  },
];

const SCREENS = [
  { src: "/images/en/screen-home.jpg", title: "Member home", caption: "Only listings that match the member's categories and regions." },
  { src: "/images/en/screen-detail.jpg", title: "Listing detail", caption: "Unit price, discount, remaining quantity and the deadline." },
  { src: "/images/en/screen-alerts.jpg", title: "Alert settings", caption: "Categories, regions and push notifications, set once." },
];

const ROADMAP = [
  { stage: "Now", name: "DumpingJumping", body: "Lead discovery — surplus listings and instant buyer alerts." },
  { stage: "Next", name: "JumpX Marketplace", body: "A B2B marketplace where discovered deals become orders." },
  // 영문 표기(JumpingBid / JumpingBead)는 확정 전 — 확정되면 name만 바꿀 것
  { stage: "Built", name: "JumpingBid", body: "Auction, reverse-auction and group-buy engine already built on the JumpX platform; opening to users next." },
  { stage: "Planned", name: "Logistics / Data", body: "Freight booking and price data built on accumulated trade records." },
];

function SectionTitle({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <p className="font-bold uppercase tracking-wider" style={{ fontSize: rem(14), color: ORANGE }}>{eyebrow}</p>
      <h2 className="font-black mt-1.5" style={{ fontSize: rem(28), color: NAVY, lineHeight: 1.25 }}>{children}</h2>
    </>
  );
}

export default function EnglishPage() {
  return (
    <div lang="en" className="min-h-screen bg-white" style={{ color: TEXT, fontSize: rem(17), lineHeight: 1.6 }}>
      <HtmlLang lang="en" />

      {/* Top bar */}
      <header className="border-b border-gray200">
        <div className="mx-auto max-w-5xl flex items-center justify-between" style={{ padding: "14px 20px" }}>
          <div className="flex items-center gap-2.5">
            <span className="bg-white rounded-md inline-flex items-center border border-gray200" style={{ padding: "4px 7px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt="DumpingJumping" className="h-6 w-auto block" />
            </span>
            <span className="font-bold" style={{ fontSize: rem(16), color: MUTED }}>by JumpX</span>
          </div>
          <Link href="/" hrefLang="ko" lang="ko" className="font-bold underline underline-offset-4" style={{ fontSize: rem(16), color: NAVY }}>
            한국어
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, #04101C, ${NAVY} 55%, #14395C)` }}>
        <div className="mx-auto max-w-5xl" style={{ padding: "56px 20px 60px" }}>
          <h1 className="font-black text-white" style={{ fontSize: "clamp(2.1rem, 6vw, 3.4rem)", lineHeight: 1.12 }}>
            Surplus inventory,
            <br className="hidden sm:inline" /> <span style={{ color: "#FF8A3D" }}>found first.</span>
          </h1>
          <p className="mt-4 max-w-2xl" style={{ fontSize: rem(19), color: "rgba(255,255,255,.88)" }}>
            A B2B alert service that connects surplus, near-expiry and excess stock with the buyers who need it — by JumpX.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="mailto:admin@jumpx.co.kr"
              className="inline-flex items-center justify-center font-black rounded-xl text-white"
              style={{ minHeight: 52, padding: "0 24px", fontSize: rem(17), background: ORANGE }}
            >
              Contact us
            </a>
            <Link
              href="/"
              hrefLang="ko"
              className="inline-flex items-center justify-center font-bold rounded-xl"
              style={{ minHeight: 52, padding: "0 24px", fontSize: rem(17), color: "#fff", border: "1.5px solid rgba(255,255,255,.5)" }}
            >
              See the live service (Korean)
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl" style={{ padding: "0 20px" }}>
        {/* Problem */}
        <section style={{ padding: "56px 0 8px" }}>
          <SectionTitle eyebrow="The problem">Surplus stock moves through chat rooms, not a market.</SectionTitle>
          <div className="grid gap-3 mt-6 md:grid-cols-3">
            {PROBLEMS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-gray200" style={{ padding: "20px 20px 22px" }}>
                <h3 className="font-black" style={{ fontSize: rem(18), color: NAVY }}>{p.title}</h3>
                <p className="mt-2" style={{ color: MUTED }}>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section style={{ padding: "56px 0 8px" }}>
          <SectionTitle eyebrow="How it works">Three steps from listing to deal.</SectionTitle>
          <ol className="grid gap-3 mt-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl" style={{ padding: "20px 20px 22px", background: "#F9FAFB" }}>
                <span
                  className="inline-flex items-center justify-center rounded-full text-white font-black"
                  style={{ width: 34, height: 34, background: NAVY, fontSize: rem(16) }}
                >
                  {i + 1}
                </span>
                <h3 className="font-black mt-3" style={{ fontSize: rem(18), color: NAVY }}>{s.title}</h3>
                <p className="mt-1.5" style={{ color: MUTED }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Screens */}
        <section style={{ padding: "56px 0 8px" }}>
          <SectionTitle eyebrow="The product">Built for phones, where these trades already happen.</SectionTitle>
          <p className="mt-2" style={{ color: MUTED, fontSize: rem(16) }}>
            Screens from the live Korean app, shown with sample listings.
          </p>
          <div className="grid gap-6 mt-6 sm:grid-cols-3">
            {SCREENS.map((s) => (
              <figure key={s.src} className="m-0">
                <div className="rounded-3xl overflow-hidden border border-gray200 mx-auto" style={{ maxWidth: 300, boxShadow: "0 10px 30px rgba(11,37,64,.12)" }}>
                  <Image src={s.src} alt={`${s.title} screen`} width={780} height={1688} sizes="(min-width: 640px) 300px, 80vw" className="w-full h-auto block" />
                </div>
                <figcaption className="mt-3 text-center">
                  <span className="block font-black" style={{ fontSize: rem(17), color: NAVY }}>{s.title}</span>
                  <span className="block" style={{ fontSize: rem(16), color: MUTED }}>{s.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Why it matters */}
        <section style={{ padding: "56px 0 8px" }}>
          <SectionTitle eyebrow="Why it matters">Less waste, and a price record that does not exist today.</SectionTitle>
          <div className="grid gap-3 mt-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray200" style={{ padding: "20px 20px 22px" }}>
              <h3 className="font-black" style={{ fontSize: rem(18), color: NAVY }}>Less inventory written off</h3>
              <p className="mt-2" style={{ color: MUTED }}>
                Stock that would otherwise be discarded or sold off below value can reach a buyer before it expires.
              </p>
            </div>
            <div className="rounded-2xl border border-gray200" style={{ padding: "20px 20px 22px" }}>
              <h3 className="font-black" style={{ fontSize: rem(18), color: NAVY }}>Real transaction price data</h3>
              <p className="mt-2" style={{ color: MUTED }}>
                Every listing, inquiry and match adds to a record of actual B2B surplus prices by category and region.
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-2xl" style={{ padding: "16px 20px", background: "#FFF4E0", color: TEXT }}>
            We start from an existing B2B trade community of ~830 members as our initial validation base.
          </p>
        </section>

        {/* Roadmap */}
        <section style={{ padding: "56px 0 8px" }}>
          <SectionTitle eyebrow="Roadmap">From lead discovery to a full B2B surplus platform.</SectionTitle>
          <ol className="grid gap-3 mt-6 md:grid-cols-4">
            {ROADMAP.map((r) => (
              <li
                key={r.name}
                className="rounded-2xl"
                style={{ padding: "18px 18px 20px", border: r.stage === "Now" ? `2px solid ${ORANGE}` : "1px solid #E4E7EB" }}
              >
                <span
                  className="inline-block rounded-full font-bold"
                  style={{
                    fontSize: rem(14),
                    padding: "3px 10px",
                    background: r.stage === "Now" ? ORANGE : r.stage === "Built" ? NAVY : "#EEF3FA",
                    color: r.stage === "Now" || r.stage === "Built" ? "#fff" : NAVY,
                  }}
                >
                  {r.stage}
                </span>
                <h3 className="font-black mt-2.5" style={{ fontSize: rem(18), color: NAVY }}>{r.name}</h3>
                <p className="mt-1" style={{ color: MUTED, fontSize: rem(16) }}>{r.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Contact */}
        <section style={{ padding: "56px 0 64px" }}>
          <div className="rounded-3xl text-white" style={{ padding: "32px 24px", background: NAVY }}>
            <h2 className="font-black" style={{ fontSize: rem(26) }}>Contact</h2>
            <dl className="mt-4 grid gap-2" style={{ fontSize: rem(17) }}>
              <div className="flex flex-wrap gap-x-3">
                <dt style={{ color: "rgba(255,255,255,.7)" }}>Company</dt>
                <dd className="font-bold m-0">JumpX</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt style={{ color: "rgba(255,255,255,.7)" }}>Email</dt>
                <dd className="m-0">
                  <a href="mailto:admin@jumpx.co.kr" className="font-bold underline underline-offset-4">admin@jumpx.co.kr</a>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt style={{ color: "rgba(255,255,255,.7)" }}>Korean site</dt>
                <dd className="m-0">
                  <Link href="/" hrefLang="ko" className="font-bold underline underline-offset-4">
                    {SITE_URL}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
