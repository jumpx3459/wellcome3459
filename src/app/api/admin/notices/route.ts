import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNoticePush } from "@/lib/sendPush";
import { checkAdminAuth } from "@/lib/adminAuth";

// 2026-09-28: 긴급 공지(부동산·설비 처분 등) 등록 API — deals(재고 매물)와 별개의
// 가벼운 공지판. src/app/api/admin/deals/route.ts와 동일한 관리자 인증/service_role
// 패턴을 그대로 따른다.
export async function POST(req: NextRequest) {
  const auth = checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

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

  return NextResponse.json({ ok: true, id: notice.id, push: pushResult });
}

// 목록/마감 처리는 관리자 화면에서 공개 select 정책(urgent_notices_public_select)을
// 통해 anon 키로 직접 읽고, 마감만 이 라우트로 처리한다 (deals와 달리 목록이
// 단순해서 별도 GET/manage 라우트를 만들 실익이 적음 — 필요해지면 분리).
export async function PATCH(req: NextRequest) {
  const auth = checkAdminAuth(req);
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
