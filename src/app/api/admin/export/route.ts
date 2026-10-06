import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, requireRole } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";
import { loadAdminLeads, loadAdminMembers } from "@/lib/adminLists";

// 2026-10-06: 데이터 내보내기(회원·리드 CSV)는 최고관리자만 — 관리자 화면의 CSV는 이 응답으로 만든다.
// 목록 조회(GET /api/admin/members·interests)와 같은 칸(src/lib/adminLists.ts). 호출 단위로 감사 로그.
const EXPORTS = {
  members: { load: loadAdminMembers, action: "members_export", targetType: "members" },
  leads: { load: loadAdminLeads, action: "leads_export", targetType: "interests" },
} as const;

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const denied = requireRole(auth.admin, ["최고관리자"]);
  if (denied) return denied;

  const type = req.nextUrl.searchParams.get("type");
  if (type !== "members" && type !== "leads") {
    return NextResponse.json({ error: "type은 members 또는 leads예요.", field: "type" }, { status: 400 });
  }
  const spec = EXPORTS[type];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const result = await spec.load(auth.db);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  await writeAudit(auth.db, req, { admin: auth.admin, action: spec.action, targetType: spec.targetType, detail: { count: result.items.length } });

  return NextResponse.json({ items: result.items });
}
