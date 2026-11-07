import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requirePerm } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { loadAdminLeads, loadAdminMembers } from "@/lib/adminLists";
import { isServerSearch, parseMemberSearch } from "@/lib/adminMemberSearch";

// 2026-10-06: 데이터 내보내기(회원·리드 CSV)는 최고관리자만 — 관리자 화면의 CSV는 이 응답으로 만든다.
// 목록 조회(GET /api/admin/members·interests)와 같은 칸(src/lib/adminLists.ts). 호출 단위로 감사 로그.
const EXPORTS = {
  members: { load: loadAdminMembers, action: "members_export", targetType: "members" },
  leads: { load: loadAdminLeads, action: "leads_export", targetType: "interests" },
} as const;

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requirePerm(auth.admin, "export");
  if (denied) return denied;

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "members" && type !== "leads") {
    return NextResponse.json({ error: "type은 members 또는 leads예요.", field: "type" }, { status: 400 });
  }
  const spec = EXPORTS[type];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  // 2026-11-07: 회원 CSV는 화면 목록과 같은 조건(?q=회원코드·숫자, ?include_test=1)으로 가져옴 — 화면에서 찾은 오래된 회원도 CSV에 담기게.
  // 조건이 없으면 예전과 같이 최근 300명 전부(테스트 계정 포함).
  const sp = req.nextUrl.searchParams;
  const parsed = parseMemberSearch(sp.get("q"));
  const result =
    type === "members"
      ? await loadAdminMembers(auth.db, {
          includeTest: sp.has("include_test") ? sp.get("include_test") === "1" : undefined,
          search: isServerSearch(parsed) ? parsed : undefined,
        })
      : await spec.load(auth.db);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  await writeAudit(auth.db, req, { admin: auth.admin, action: spec.action, targetType: spec.targetType, detail: { count: result.items.length } });

  return NextResponse.json({ items: result.items });
}
