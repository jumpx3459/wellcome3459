import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/adminAuth";

// 기능 오픈 알림 신청 수 (feature_waitlist, RLS상 본인 행만 보이므로 service_role로 집계).
// 2026-09-29: 현재는 "quotes"(내 견적함)만 — 전체 / 받은 견적 보관(receiver) / 보낸 견적 관리(sender).
export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ quotes: null, demo: true });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const count = (role?: string) => {
    let q = supabaseAdmin.from("feature_waitlist").select("id", { count: "exact", head: true }).eq("feature", "quotes");
    if (role) q = q.eq("role", role);
    return q;
  };
  const [total, receiver, sender] = await Promise.all([count(), count("receiver"), count("sender")]);
  const err = total.error ?? receiver.error ?? sender.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  return NextResponse.json({ quotes: { total: total.count ?? 0, receiver: receiver.count ?? 0, sender: sender.count ?? 0 } });
}
