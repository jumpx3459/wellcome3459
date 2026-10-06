import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 2026-10-06 새 버전 띠: 빌드한 커밋 값을 화면(UpdateBanner)과 /api/version에 같이 굽는다 — 열려 있던 옛 화면은 옛 값,
  // 새 배포의 /api/version은 새 값이라 다르면 "새 버전이 있어요". GitHub Actions의 vercel build에선 VERCEL_GIT_COMMIT_SHA가
  // 없을 수 있어 GITHUB_SHA로 대신. 둘 다 없으면 "dev"(비교 안 함).
  env: {
    APP_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "dev",
  },
};

export default nextConfig;
