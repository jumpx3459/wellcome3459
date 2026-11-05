import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { maskBizNo, normalizeBizNo, normalizeOpenDate, ntsValidate } from "@/lib/nts";
import {
  GLOBAL_DAILY_LIMIT, MEMBER_DAILY_LIMIT, dbStatusCode, kstDayStartIso, openDateToDb, selfBizCheckOn, type SelfCheckResponse,
} from "@/lib/memberBusinessCheck";

// 2026-11-05 1단계: 회원 사업자 셀프 확인 — 회원 본인이 사업자번호·대표자명·개업일자를 넣으면 국세청 진위확인(+상태조회)을 부르고
//   member_business_checks에 1행 기록. 진위 일치(01)면 members.business_verified = true(휴업·폐업도 true, 상태는 기록만).
//   불일치(02)·오류는 기존 business_verified를 바꾸지 않음(내리지 않음).
// body: { accessToken, b_no, rep_name, open_date, company_name? }  또는  { accessToken, check: true } (저장·국세청 호출 없이 최근 일치 기록만)
// 횟수 제한은 DB 집계(서버 인스턴스 메모리 아님): 회원당 KST 하루 01·02 결과 MEMBER_DAILY_LIMIT회 넘으면 429, 전체 하루 GLOBAL_DAILY_LIMIT행 넘으면 503.
// 사업자번호 원문은 응답·로그에 남기지 않음(maskBizNo만).
// 게이트 아님 — 연락처 보기·연결 흐름과 연결하지 않음.
// NEXT_PUBLIC_SELF_BIZ_CHECK가 "on"이 아니면(기본) 404 — 처리방침 반영 전에는 화면뿐 아니라 수집 경로 자체를 닫음(인증·형식 검사보다 먼저, 국세청 호출·저장·갱신 0).

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const bad = (error: string, field?: string) => json({ error, ...(field ? { field } : {}) }, 400);

export async function POST(req: NextRequest) {
  if (!selfBizCheckOn(process.env.NEXT_PUBLIC_SELF_BIZ_CHECK)) return json({ error: "Not found" }, 404);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { accessToken, check } = body ?? {};

  if (typeof accessToken !== "string" || !accessToken) return json({ error: "로그인이 필요합니다." }, 401);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    if (process.env.NODE_ENV === "production") return json({ error: "서버 설정 오류입니다." }, 500);
    return json({ result: "unavailable", demo: true });
  }

  const db = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await db.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "인증이 만료됐어요." }, 401);
  const memberId = userData.user.id;

  // 최근 일치 기록만 — 국세청 호출·저장·횟수 집계 없음 (MY 카드의 "국세청 M/D" 표시용)
  if (check === true) {
    const { data, error } = await db
      .from("member_business_checks")
      .select("status_code, status_text, created_at")
      .eq("member_id", memberId)
      .eq("validate_result", "01")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return json({ error: "조회에 실패했어요." }, 500);
    const last = data?.[0];
    return json({ last: last ? { status_code: last.status_code, status_text: last.status_text, checked_at: last.created_at } : null });
  }

  // 입력 형식 — 통과한 요청만 저장(member_business_checks의 not null·check 제약과 같은 범위)
  const bNo = normalizeBizNo(body?.b_no);
  if (!bNo) return bad("사업자등록번호 10자리를 입력해주세요.", "b_no");
  const repName = typeof body?.rep_name === "string" ? body.rep_name.trim() : "";
  if (!repName) return bad("대표자 성명을 입력해주세요.", "rep_name");
  if (repName.length > 50) return bad("대표자 성명이 너무 길어요.", "rep_name");
  const openDate = normalizeOpenDate(body?.open_date);
  if (!openDate) return bad("개업일자를 YYYYMMDD로 입력해주세요.", "open_date");
  const companyRaw = typeof body?.company_name === "string" ? body.company_name.trim() : "";
  if (companyRaw.length > 100) return bad("상호가 너무 길어요.", "company_name");
  const companyName = companyRaw || null;

  const { data: member } = await db.from("members").select("id").eq("id", memberId).maybeSingle();
  if (!member) return json({ error: "회원 정보가 없어요. 가입을 마친 뒤 다시 시도해주세요." }, 403);

  // 횟수 제한 — DB 집계. 전체(error 포함) 먼저, 그다음 회원(01·02만)
  const dayStart = kstDayStartIso();
  const { count: totalToday, error: totalErr } = await db
    .from("member_business_checks")
    .select("id", { count: "exact", head: true })
    .gte("created_at", dayStart);
  if (totalErr) {
    console.error("[business-check] 전체 집계 실패", totalErr.code);
    return json({ result: "unavailable", error: "잠시 후 다시 시도해주세요." }, 500);
  }
  if ((totalToday ?? 0) >= GLOBAL_DAILY_LIMIT) {
    return json({ result: "unavailable", error: "오늘 확인 요청이 많아 잠시 닫았어요. 내일 다시 시도해주세요." }, 503);
  }
  const { count: mineToday, error: mineErr } = await db
    .from("member_business_checks")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .in("validate_result", ["01", "02"])
    .gte("created_at", dayStart);
  if (mineErr) {
    console.error("[business-check] 회원 집계 실패", mineErr.code);
    return json({ result: "unavailable", error: "잠시 후 다시 시도해주세요." }, 500);
  }
  if ((mineToday ?? 0) >= MEMBER_DAILY_LIMIT) {
    return json({ result: "limited", error: "오늘 확인 횟수를 모두 썼어요." }, 429);
  }

  // nts.ts는 예외를 던지지 않음 — 01이면 상태조회까지 한 번에(ntsValidate 안에서 ntsStatus 호출)
  const v = await ntsValidate({ bNo, repName, openDate });
  const statusCode = v.result === "01" ? dbStatusCode(v.status?.code) : null;
  const statusText = v.result === "01" ? v.status?.text ?? null : null;
  const taxType = v.result === "01" ? v.status?.taxType ?? null : null;

  const { data: saved, error: saveErr } = await db
    .from("member_business_checks")
    .insert({
      member_id: memberId,
      method: "nts",
      b_no: bNo,
      rep_name: repName,
      open_date: openDateToDb(openDate),
      company_name: companyName,
      validate_result: v.result,
      status_code: statusCode,
      status_text: statusText,
      tax_type: taxType,
      error_kind: v.result === "error" ? v.errorKind : null,
    })
    .select("created_at")
    .single();
  if (saveErr || !saved) {
    console.error("[business-check] 기록 실패", saveErr?.code, maskBizNo(bNo));
    return json({ result: "unavailable", error: "결과를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
  }
  const checkedAt = saved.created_at as string;

  if (v.result === "01") {
    // 휴업·폐업도 true(상태는 기록만). service role 갱신이라 protect_business_verified·protect_member_privileged 트리거가 막지 않음
    const { error: upErr } = await db.from("members").update({ business_verified: true }).eq("id", memberId);
    if (upErr) {
      console.error("[business-check] business_verified 갱신 실패", upErr.code, maskBizNo(bNo));
      return json({ result: "unavailable", error: "확인은 됐지만 반영하지 못했어요. 잠시 후 다시 시도해주세요." }, 500);
    }
  }

  const out: SelfCheckResponse = {
    result: v.result === "01" ? "verified" : v.result === "02" ? "mismatch" : "unavailable",
    ...(v.result === "01" ? { status_code: statusCode, status_text: statusText } : {}),
    checked_at: checkedAt,
  };
  return json(out);
}
