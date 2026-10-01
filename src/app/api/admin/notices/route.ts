import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNoticePush } from "@/lib/sendPush";
import { checkAdminAuth, requireRole } from "@/lib/adminAuth";
import { writeAudit } from "@/lib/adminAudit";

// 2026-09-28: 긴급 공지(부동산·설비 처분 등) 등록 API — deals(재고 매물)와 별개의
// 가벼운 공지판. src/app/api/admin/deals/route.ts와 동일한 관리자 인증/service_role
// 패턴을 그대로 따른다.
export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  // 2026-10-01: 긴급 공지 등록(= 푸시 발송)은 최고관리자만
  const denied = requireRole(auth.admin, ["최고관리자"]);
  if (denied) return denied;

  const body = await req.json();
  const { category, title, noticeBody, region, contactName, contactPhone, images } = body;

  if (!title || !noticeBody) {
    return NextResponse.json({ error: "제목·내용은 필수예요." }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true, demo: true, id: "demo-notice" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let regionId: number | null = null;
  if (region) {
    const { data: regRow } = await supabaseAdmin.from("regions").select("id").eq("name", region).single();
    regionId = regRow?.id ?? null;
  }

  const { data: notice, error } = await supabaseAdmin
    .from("urgent_notices")
    .insert({
      category: category || "부동산",
      title,
      body: noticeBody,
      region_id: regionId,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      images: images ?? [],
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pushResult = await sendNoticePush(notice.id);
  await writeAudit(supabaseAdmin, req, {
    admin: auth.admin,
    action: "notice_send",
    targetType: "urgent_notice",
    targetId: notice.id,
    detail: { title, category: category || "부동산", push: pushResult },
  });

  return NextResponse.json({ ok: true, id: notice.id, push: pushResult });
}

// 2026-09-28 (2): 등록 폼만 있고 목록/마감 UI가 없어 한 번 올린 공지를 내릴
// 방법이 없다는 지적 — deals/manage와 동일하게 GET으로 활성 공지 목록을 반환.
// (직전 코멘트의 "anon 키로 공개 조회" 계획은 이 파일 전체가 admin-key 인증 +
// service_role 경로로 통일된 패턴과 맞지 않아 폐기하고 GET을 추가하는 쪽으로 정정.)
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ items: [], demo: true });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabaseAdmin
    .from("urgent_notices")
    .select("*, regions(name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

// 마감 처리(status → closed) — 등록은 POST, 목록은 GET, 마감은 이 PATCH.
export async function PATCH(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id·status는 필수예요." }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabaseAdmin
    .from("urgent_notices")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
