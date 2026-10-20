import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { maskBizNo, normalizeBizNo } from "@/lib/nts";
import { findLatestRoot, toClient } from "@/lib/businessChecksServer";
import { isOverYear } from "@/lib/businessReuse";

// 2026-10-21 확인된 판매자 재사용 — 후보 조회. 국세청 호출 없음(페이지 열기·번호 입력만으로는 호출하지 않음 — 호출은 [재사용] 실행 때 1번).
//   ?b_no=10자리(대리 등록) 또는 ?sellerRequestId=(판매 신청 → 같은 회원의 이전 신청 기록에서 찾음).
//   가장 최근 root 1건: 마스킹 번호·상호·원본 조회일·원본 처리자·예외 여부·1년 경과 여부만. 원문 b_no·rep_name은 응답에 없음.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerRequests"); // 사업자 조회 권한과 같음
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;

  let found;
  if (sp.get("b_no") != null) {
    const bNo = normalizeBizNo(sp.get("b_no"));
    if (!bNo) return NextResponse.json({ error: "사업자등록번호 10자리를 입력해주세요." }, { status: 400 });
    found = await findLatestRoot(auth.db, { bNo });
  } else if (sp.get("sellerRequestId") != null) {
    const id = sp.get("sellerRequestId")!;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    found = await findLatestRoot(auth.db, { sellerRequestId: id });
  } else {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: 500 });
  if (!found.root) return NextResponse.json({ candidate: null });

  const r = found.root;
  const [c] = await toClient(auth.db, [r]);
  return NextResponse.json({
    candidate: {
      id: r.id,
      b_no_masked: maskBizNo(r.b_no),
      input_company_name: r.input_company_name,
      checked_at: r.checked_at,
      checked_by_name: c.checked_by_name,
      exception_ok: r.exception_ok === true,
      over_year: isOverYear(r.checked_at, Date.now()),
    },
  });
}
