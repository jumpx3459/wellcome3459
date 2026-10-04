// 국세청 연동 시험 — 가짜 국세청 서버(로컬)만 호출, 운영 호출 0건. 실행: node scripts/nts-fake-test.mts
// 가짜 서버는 validate 요청에 b_nm이 있으면 400으로 실패시킴 → 요청에 상호가 안 실리는지 확인.
import http from "node:http";
import assert from "node:assert/strict";

const seen: Record<string, unknown>[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const send = (code: number, json: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
    if (req.url?.startsWith("/validate")) {
      const biz = body.businesses?.[0] ?? {};
      seen.push(biz);
      if ("b_nm" in biz) return send(400, { status_code: "BAD_JSON_REQUEST", message: "b_nm must not be sent" });
      const ok = biz.b_no === "1234567890" && biz.p_nm === "홍길동" && biz.start_dt === "20200101";
      return send(200, { status_code: "OK", data: [{ valid: ok ? "01" : "02", status: ok ? { b_stt_cd: "01", b_stt: "계속사업자", tax_type: "부가가치세 일반과세자" } : undefined }] });
    }
    if (req.url?.startsWith("/status")) return send(200, { status_code: "OK", data: [{ b_no: "1234567890", b_stt_cd: "01", b_stt: "계속사업자", tax_type: "부가가치세 일반과세자" }] });
    send(404, {});
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;
process.env.NTS_API_BASE_URL = `http://127.0.0.1:${port}`;
process.env.NTS_API_KEY = "fake-key";

const modPath = "../src/lib/nts.ts"; // 변수로 import — tsc(빌드)가 .ts 확장자 import를 검사하지 않게
const { ntsValidate } = (await import(modPath)) as typeof import("../src/lib/nts");

const hit = await ntsValidate({ bNo: "1234567890", repName: "홍길동", openDate: "20200101" });
assert.equal(hit.result, "01", "일치 사업자는 01");
const miss = await ntsValidate({ bNo: "1234567890", repName: "김철수", openDate: "20200101" });
assert.equal(miss.result, "02", "대표자명이 다르면 02");
assert.ok(seen.length === 2 && seen.every((b) => !("b_nm" in b)), "validate 요청에 b_nm이 없어야 함");
// 호출부가 예전처럼 companyName을 넘겨도(JS 호출) 요청에는 실리지 않음
const extra = await (ntsValidate as (i: unknown) => ReturnType<typeof ntsValidate>)({ bNo: "1234567890", repName: "홍길동", openDate: "20200101", companyName: "웰컴코리아" });
assert.equal(extra.result, "01");
assert.ok(!("b_nm" in seen[2]));
server.close();
console.log("nts-fake-test OK (요청 3건, b_nm 0건, 운영 호출 0건)");
