import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { ADMIN_ROLES, can, rolesFor, type AdminPerm, type AdminRole } from "@/lib/adminPerms";

// 관리자 세션 (2026-10-01 ① 역할 기반 최소판)
//   · ADMIN_SESSION_SECRET이 없거나 32자 미만이면 fail-closed — 토큰 발급·검증 모두 거부("dev-secret" 대체 삭제)
//   · 토큰에는 id·exp만 담고, 요청마다 admin_users에서 이름·역할을 다시 읽음 → 해제·역할 변경이 즉시 반영
//   · 역할: 최고관리자 / 관리자 / 점핑매니저(F 전까지 아무에게도 지정하지 않음)
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
const MIN_SECRET_LENGTH = 32;

//   2026-10-10: 역할별 권한은 src/lib/adminPerms.ts 권한표 한 곳(requirePerm) — 역할 이름·목록도 거기서
export { ADMIN_ROLES, type AdminRole };
export type AdminIdentity = { id: string; name: string; role: AdminRole; phone: string | null };

type AdminPayload = { id: string; exp: number };

function getSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= MIN_SECRET_LENGTH ? s : null;
}

function sign(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/** 토큰 발급 — 비밀값이 기준 미달이면 null(로그인 거부) */
export function signAdminToken(adminId: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const payload: AdminPayload = { id: adminId, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

function verifyAdminToken(token: string): AdminPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body, secret);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as AdminPayload;
    return typeof payload.id === "string" && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function getAdminDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export const clientIp = (req: NextRequest) => (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

// IP 기준 로그인 시도 제한(서버 인스턴스 메모리) — 번호 기준 잠금(admin_login_failures)과 별개로 유지
const attempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 5 * 60 * 1000;

export function checkLoginRateLimit(req: NextRequest) {
  const entry = attempts.get(clientIp(req));
  if (entry && entry.blockedUntil > Date.now()) {
    return { ok: false as const, status: 429, error: "잠시 후 다시 시도해주세요." };
  }
  return { ok: true as const };
}

export function recordLoginFailure(req: NextRequest) {
  const ip = clientIp(req);
  const entry = attempts.get(ip) ?? { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_MS;
    entry.count = 0;
  }
  attempts.set(ip, entry);
}

export function clearLoginFailures(req: NextRequest) {
  attempts.delete(clientIp(req));
}

// 번호 기준 잠금 — 같은 번호로 15분 안에 5회 실패하면 마지막 실패부터 15분 잠금 (admin_login_failures)
export const PHONE_LOCK_FAILS = 5;
export const PHONE_LOCK_MS = 15 * 60 * 1000;
export async function phoneLockedUntil(db: SupabaseClient, phone: string): Promise<number | null> {
  const since = new Date(Date.now() - 2 * PHONE_LOCK_MS).toISOString();
  const { data } = await db
    .from("admin_login_failures")
    .select("created_at")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(PHONE_LOCK_FAILS);
  const times = (data ?? []).map((r) => Date.parse(r.created_at as string));
  if (times.length < PHONE_LOCK_FAILS) return null;
  const [latest] = times;
  const oldest = times[PHONE_LOCK_FAILS - 1];
  if (latest - oldest > PHONE_LOCK_MS) return null; // 5회가 15분 안에 몰리지 않음
  const until = latest + PHONE_LOCK_MS;
  return until > Date.now() ? until : null;
}

type AuthResult = { ok: true; admin: AdminIdentity; db: SupabaseClient } | { ok: false; status: number; error: string };

/** 관리자 인증 — 토큰(id·exp) 검증 후 DB에서 이름·역할 재조회. 계정이 해제됐으면 401 */
export async function checkAdminAuth(req: NextRequest): Promise<AuthResult> {
  const token = req.headers.get("x-admin-key");
  if (!token) return { ok: false, status: 401, error: "인증 실패" };
  if (!getSecret()) return { ok: false, status: 500, error: "관리자 세션 설정 오류" };
  const payload = verifyAdminToken(token);
  if (!payload) return { ok: false, status: 401, error: "인증 실패 또는 세션 만료" };
  const db = getAdminDb();
  if (!db) return { ok: false, status: 500, error: "서버 설정 오류" };
  const { data, error } = await db.from("admin_users").select("id, name, role, phone").eq("id", payload.id).maybeSingle();
  if (error) return { ok: false, status: 500, error: "관리자 확인 실패" };
  if (!data || !(ADMIN_ROLES as readonly string[]).includes(data.role)) {
    return { ok: false, status: 401, error: "관리자 계정이 해제됐거나 권한이 없어요. 다시 로그인해주세요." };
  }
  return { ok: true, admin: { id: data.id, name: data.name, role: data.role as AdminRole, phone: data.phone ?? null }, db };
}

/** 2026-10-10 권한표(adminPerms) 기준 제한 — 권한이 없으면 403(기존 requireRole과 같은 형식), 통과면 null.
 *  "자기 건만"(점핑매니저)은 통과시키고, 거르기는 각 API가 ownOnly + adminScope로 함 */
export function requirePerm(admin: AdminIdentity, perm: AdminPerm): NextResponse | null {
  if (can(admin.role, perm)) return null;
  return NextResponse.json({ error: "권한이 없어요", required: rolesFor(perm) }, { status: 403 });
}

/** 역할 제한 — 허용 역할이 아니면 403 응답을, 통과면 null */
export function requireRole(admin: AdminIdentity, allowed: AdminRole[]): NextResponse | null {
  if (allowed.includes(admin.role)) return null;
  return NextResponse.json({ error: "권한이 없어요", required: allowed }, { status: 403 });
}
