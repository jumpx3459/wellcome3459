// 사진 장수 한도 단위 시험 — src/lib/photoLimit.ts (2026-10-12 feat/photo12-video30: 판매자 12 · 관리자 25, 추천 보너스 무시)
// 실행: node --experimental-strip-types scripts/photo-limit-test.mts   (Node 24 — 별도 패키지 없음, 운영 접속 없음)
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const m = await import(pathToFileURL(join(root, "src/lib/photoLimit.ts")).href);
const v = await import(pathToFileURL(join(root, "src/lib/videoUpload.ts")).href);

let failed = 0;
const eq = (got: unknown, want: unknown, msg: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failed++;
    console.error("FAIL", msg, "→", JSON.stringify(got), "기대", JSON.stringify(want));
  } else console.log("ok  ", msg, "→", JSON.stringify(got));
};

eq(m.SELLER_PHOTO_LIMIT, 12, "판매자 한도 12");
eq(m.ADMIN_PHOTO_LIMIT, 25, "관리자 한도 25");
eq(m.getPhotoLimit(null), 12, "비회원(null) → 12");
eq(m.getPhotoLimit(undefined), 12, "인자 없음 → 12");
eq(m.getPhotoLimit({ bonus_photo_slots: null }), 12, "보너스 null → 12");
eq(m.getPhotoLimit({ bonus_photo_slots: 0 }), 12, "보너스 0 → 12");
eq(m.getPhotoLimit({ bonus_photo_slots: 2 }), 12, "보너스 2 → 12 (더하지 않음)");
eq(m.getPhotoLimit({ bonus_photo_slots: 10 }), 12, "보너스 10 → 12");
eq(m.getPhotoLimit({ bonus_photo_slots: 40 }), 12, "보너스 40 → 12");
eq(m.photoLimitError(12), "사진은 최대 12장까지 올릴 수 있어요", "판매자 오류 문구");
eq(m.ADMIN_PHOTO_LIMIT_ERROR, "사진은 최대 25장까지 올릴 수 있어요.", "관리자 오류 문구");
for (const gone of ["BASE_PHOTO_SLOTS", "MAX_BONUS_PHOTO_SLOTS", "MAX_PHOTO_SLOTS", "isPhotoLimitMaxed"]) eq(gone in m, false, `옛 보너스 값 ${gone} 없음`);
eq(v.MAX_VIDEO_BYTES, 104857600, "영상 100MB = 버킷 file_size_limit 104857600");
eq(v.VIDEO_TOO_LARGE_MESSAGE, "영상은 100MB 이하만 올릴 수 있어요. 일반 화질(1080p)로 찍어 주세요.", "영상 크기 문구");

if (failed) {
  console.error(`\n${failed}건 실패`);
  process.exit(1);
}
console.log("\n전부 통과");
