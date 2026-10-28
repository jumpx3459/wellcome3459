import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { canSeeDealPrivate } from "@/lib/adminScope";
import { loadRecentSellers } from "@/lib/recentSellers";
import { UUID_RE } from "@/lib/rateLimit";

// 2026-10-28 7a 최근 확인된 판매자 칩 — 값 조회(칩 클릭 1건). 등록 폼의 빈 칸 채우기용 — 재사용(POST /business-checks/reuse)과는 별개 호출.
//   ?rootCheckId=: 칩 목록(recent-sellers)에 있는 판매자만(같은 범위·같은 권한 규칙 — 목록에 없으면 404). 대표자명(rep_name)은 응답에 절대 없음.
//   · 담당 매물(canSeeDealPrivate: 최고관리자·관리자는 항상, 점핑매니저는 담당 매물)이면 { companyName, contactName, contactPhone, full: true }
//   · 담당이 아니면 { companyName(= 조회 때 입력한 상호), contactName: null, contactPhone: null, full: false } — 연락처 전체는 새지 않음
//   감사: seller_private_view + detail { via: "check_prefill", full } — 값은 넣지 않음, 호출 1번에 1행(대상 = 가장 최근 매물).
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "sellerRequests");
  if (denied) return denied;
  const rootCheckId = req.nextUrl.searchParams.get("rootCheckId") ?? "";
  if (!UUID_RE.test(rootCheckId)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  const db = auth.db;

  const found = await loadRecentSellers(db, auth.admin);
  if ("error" in found) return NextResponse.json({ error: found.error }, { status: 500 });
  const s = found.items.find((x) => x.rootCheckId === rootCheckId);
  if (!s) return NextResponse.json({ error: "최근 1년 안에 등록한 판매자를 찾을 수 없어요." }, { status: 404 });

  const full = await canSeeDealPrivate(db, auth.admin, s.dealId);
  if (full === "error") return NextResponse.json({ error: "권한을 확인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });

  let body: { companyName: string | null; contactName: string | null; contactPhone: string | null; contactPhone2: string | null; full: boolean };
  if (full) {
    const { data, error } = await db.from("deal_seller_private").select("company_name, contact_name, contact_phone, contact_phone_2").eq("deal_id", s.dealId).maybeSingle();
    if (error) return NextResponse.json({ error: "판매자 정보를 불러오지 못했어요." }, { status: 500 });
    body = { companyName: (data?.company_name as string | null) ?? s.rootCompany, contactName: (data?.contact_name as string | null) ?? null, contactPhone: (data?.contact_phone as string | null) ?? null, contactPhone2: (data?.contact_phone_2 as string | null) ?? null, full: true };
  } else {
    body = { companyName: s.rootCompany, contactName: null, contactPhone: null, contactPhone2: null, full: false };
  }

  await writeAudit(db, req, {
    admin: auth.admin,
    action: "seller_private_view",
    targetType: "deal",
    targetId: s.dealId,
    detail: { via: "check_prefill", full },
  });
  return NextResponse.json(body);
}
