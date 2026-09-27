// 2026-09-28: mypage.tsx의 아바타 업로드에서 쓰던 것과 동일한 패턴 — Vercel
// 서버리스 함수 요청 본문 한도(4.5MB)를 원본 휴대폰 사진(3~6MB 흔함)이 쉽게
// 넘어서, 축소 없이 올리면 여러 장을 한 번에 고를 때 "업로드에 실패했어요"가
// 자주 뜰 수 있음. 매물 사진은 상세 화면에서 크게 보이므로 아바타(640px)보다
// 여유 있게 긴 변 1600px로 축소.
export const resizeImageForUpload = (file: File, maxDim = 1600, quality = 0.85): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("canvas unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error("resize failed"));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image load failed"));
    };
    img.src = objectUrl;
  });
