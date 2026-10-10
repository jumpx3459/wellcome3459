import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";

// 2026-10-10 지금 로그인한 관리자(id·이름·역할) — 관리자 화면이 역할별 섹션을 고르고 [발굴 매니저]에 "본인"을 넣을 때 씀.
// 역할은 요청마다 DB에서 다시 읽으므로(checkAdminAuth) 로그인 뒤 역할이 바뀌어도 화면이 바로 맞춤. 모든 역할 허용.
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ id: auth.admin.id, name: auth.admin.name, role: auth.admin.role });
}
