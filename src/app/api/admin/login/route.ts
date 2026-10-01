import { NextRequest, NextResponse } from "next/server";
import {
  signAdminToken,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  getAdminDb,
  phoneLockedUntil,
  clientIp,
  ADMIN_ROLES,
} from "@/lib/adminAuth";
import { writeAudit, phoneTail } from "@/lib/adminAudit";
import { normalizeKoreanPhone } from "@/lib/auth";

// 관리자 로그인 (2026-10-01) — 휴대폰 번호 + 비밀번호. admin_users.phone 기준 그 계정 1건만 검증
// (verify_admin_login(p_phone, p_password), 예전엔 비밀번호만으로 맞는 첫 계정을 찾았음).
// 같은 번호 15분 안에 5회 실패 → 15분 잠금(admin_login_failures). 성공·실패·잠금 모두 감사 로그.
export async function POST(req: NextRequest) {
  const rate = checkLoginRateLimit(req);
  if (!rate.ok) return NextResponse.json({ error: rate.error }, { status: rate.status });

  const { phone: phoneInput, password } = await req.json().catch(() => ({}));
  const phone = normalizeKoreanPhone(typeof phoneInput === "string" ? phoneInput : "");
  if (!/^01[016789]\d{7,8}$/.test(phone) || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "휴대폰 번호와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });

  const lockedUntil = await phoneLockedUntil(db, phone);
  if (lockedUntil) {
    await writeAudit(db, req, { action: "login_locked", detail: { phone: phoneTail(phone), locked_until: new Date(lockedUntil).toISOString() } });
    const minutes = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));
    return NextResponse.json({ error: `로그인 실패가 많아 잠겼어요. ${minutes}분 뒤에 다시 시도해주세요.` }, { status: 429 });
  }

  const { data, error } = await db.rpc("verify_admin_login", { p_phone: phone, p_password: password });
  const admin = Array.isArray(data) ? data[0] : null;

  if (error || !admin || !(ADMIN_ROLES as readonly string[]).includes(admin.role)) {
    if (error) console.error("[admin/login] verify 실패", error.code, error.message);
    recordLoginFailure(req);
    await db.from("admin_login_failures").insert({ phone, ip: clientIp(req) });
    await writeAudit(db, req, { action: "login_fail", detail: { phone: phoneTail(phone) } });
    return NextResponse.json({ error: "번호 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = signAdminToken(admin.id);
  if (!token) {
    console.error("[admin/login] ADMIN_SESSION_SECRET 없음 또는 32자 미만 — 로그인 거부");
    return NextResponse.json({ error: "관리자 세션 설정 오류" }, { status: 500 });
  }

  clearLoginFailures(req);
  await db.from("admin_login_failures").delete().eq("phone", phone);
  await db.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);
  await writeAudit(db, req, { admin, action: "login_success", targetType: "admin_user", targetId: admin.id });

  return NextResponse.json({ token, admin: { name: admin.name, role: admin.role } });
}
