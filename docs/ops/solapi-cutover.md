# 인증 문자 솔라피 전환 (Send SMS Hook)

2026-10-12 작성 · **2026-10-22 14:33 KST 전환 완료**(첫 시도 11:06·11:09는 성공 판정 버그로 롤백 → #109 수정 후 재시도 성공) · 코드: `src/app/api/auth/sms-hook/route.ts`, `src/lib/sms/` · 시험: `node --experimental-strip-types scripts/sms-hook-test.mts`

## 왜

지금 인증 문자는 Supabase 기본 Twilio(미국 번호)로 나가서 받는 쪽에 "[국제발신]"·스미싱 경고가 뜬다.
솔라피 국내 발신번호 **070-4006-0890**으로 바꾼다. 발신번호 승인 예정 10/15~16.

## 동작

1. 회원이 인증번호를 요청하면 Supabase가 Hook 주소로 POST(서명 헤더 `webhook-id`·`webhook-timestamp`·`webhook-signature`).
2. 서명 검증(±5분) → 번호를 `010…` 11자리로 변환(한국 010 휴대폰만, 아니면 400).
3. 솔라피 단문 발송(제한 2.5초) → 실패(오류 코드·HTTP 오류·시간 초과)면 Twilio로 대신(제한 1.8초, `TWILIO_*` 없으면 건너뜀).
4. 성공 200 `{}` / 둘 다 실패 500 `{ error: { http_code, message } }` — 회원 화면엔 기존과 같은 "발송 실패" 흐름.

- Supabase Hook 제한 시간 **5초**(공식 문서). 2.5 + 1.8 = 4.3초로 그 안에 Twilio까지 들어가게 맞춤.
- 429·503을 돌려주면 Supabase가 재시도(문자 중복)하므로 이 경로는 쓰지 않음.
- 문구는 Supabase SMS 템플릿과 같음: `[덤핑점핑] 인증번호 {otp}\n\n@www.dumpingjumping.com #{otp}` (EUC-KR 59바이트, 단문 90바이트 이하).
  템플릿을 바꾸면 `OTP_SMS_TEMPLATE`(`src/lib/sms/otpText.ts`)도 같이 바꿀 것 — Hook이 켜지면 Supabase 템플릿은 쓰이지 않음.
- 로그(Vercel Functions 로그, `sms-hook` 줄): 발송 업체·가린 번호(010-****-5678)·결과 코드·걸린 시간만. 인증번호·문구 없음. DB 기록 없음.

## 전환 전 확인

- [ ] 솔라피 발신번호 070-4006-0890 승인 완료(솔라피 콘솔 > 발신번호 관리)
- [ ] 솔라피 API Key·Secret 발급(콘솔 > 개발/연동 > API Key)
- [ ] 솔라피 잔액 충전 + **잔액 알림·자동 충전** 설정(잔액 부족이면 솔라피 실패 → Twilio로 넘어가서 다시 [국제발신]이 됨)
- [x] **개인정보 처리방침 수탁자에 솔라피 추가** — **완료(#101, merge `6138c82`, 2026-10-17 배포 · Deploy run 38992931760)**. PrivacyBody 5번 위탁 표 "주식회사 솔라피 · 휴대폰 인증번호 문자 발송, 카카오 알림톡 및 문자 메시지 발송 대행 · 국내", 시행일 10/18. 운영 `/privacy` 확인(200·솔라피 1회·Twilio 행 두 표 유지).
      법인명 확인 완료 — 솔라피(주) = 주식회사 솔라피, 사업자등록번호 217-81-33791(솔라피 홈페이지 하단 기준, 10/17 대표 확인). Twilio 대체를 남기는 2주 동안은 Twilio도 유지(위탁·국외 이전 표 그대로). 070 승인 후 Hook을 켤 것.

## 전환 순서

1. **Supabase > Authentication > Hooks(Auth Hooks) > Send SMS hook > HTTPS** 선택 → 주소 `https://www.dumpingjumping.com/api/auth/sms-hook` 입력 → **Generate secret** → `v1,whsec_…` 복사. 아직 **켜지 않음**(저장만 가능하면 꺼진 상태로 저장).
2. **Vercel > Project > Settings > Environment Variables**(Production, **Sensitive**)
   - `SEND_SMS_HOOK_SECRET` = 1의 `v1,whsec_…` 그대로
   - `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` = `07040060890`
   - 대체용: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` — Supabase > Authentication > Providers > Phone > Twilio에 넣어 둔 값과 같게(Supabase Twilio 설정은 Account SID·Auth Token·**Message Service SID** 방식). Message Service SID가 없으면 `TWILIO_FROM`(+1…).
3. **재배포** — env는 새 배포부터 읽힘. GitHub Actions "Deploy to Vercel"을 다시 돌리거나(Actions > 최근 main run > Re-run) 다음 merge 때.
4. **Firewall 확인**(아래) — 막히면 예외 규칙부터.
5. Supabase Hooks에서 Send SMS hook **켜기(Enable)**.
6. **내부 번호 시험**: 대표·직원 폰으로 로그인 인증번호 요청 → ① 발신 070-4006-0890, "[국제발신]" 없음 ② 인증번호로 로그인 성공 ③ Vercel 로그 `sms-hook {"provider":"solapi",…,"ok":true,"code":"accepted",…}`(statusCode는 응답에 없음 — 성공 = HTTP 2xx + `failedMessageList` 비어 있음) ④ 솔라피 콘솔 발송 내역 성공.
7. 하루 정도 Vercel 로그에서 `"provider":"twilio"`(대체 발송)·`"ok":false` 줄이 있는지 확인.

## 되돌리기

- **Supabase Hooks에서 Send SMS hook 끄기 = 즉시 기존 Twilio 방식.** 배포·env 변경 필요 없음(Supabase Phone 설정의 Twilio 값이 그대로 남아 있어야 함 — 지우지 말 것).

## Vercel Firewall (Bot Protection)

Supabase 서버의 POST는 브라우저가 아니라서, Firewall **Bot Protection을 Challenge**로 켜 두면 이 경로가 막힐 수 있다(Challenge 페이지를 풀 수 없음 → Hook 실패 → 인증 문자 안 감).

- 확인: Vercel > Project > **Firewall** > Bot Management(Bot Protection) 설정 + 켠 뒤 Firewall 트래픽에서 `/api/auth/sms-hook`이 Challenged/Denied로 잡히는지.
  더 확실하게는 5단계 직후 내부 번호 시험에서 문자가 안 오면 Firewall 로그부터 볼 것.
- 막히면: Firewall > **Custom Rule** 추가 — 조건 `Request Path` equals `/api/auth/sms-hook` (+ Method POST) → 동작 **Bypass**. 이 경로는 Hook 서명(HMAC)으로 지켜지므로 우회해도 아무나 문자를 보낼 수 없음.
- 저장소에는 Firewall 설정이 없음(`vercel.json`은 지역·cron만) — 대시보드 설정만 확인하면 됨.
- 앱 쪽 `src/proxy.ts`는 `/api/*`를 matcher에서 빼서 이 경로를 리다이렉트하지 않음(확인됨).

## 2주 뒤 정리

솔라피만으로 2주 동안 `"provider":"twilio"` 줄이 없거나 드물면:

- `src/lib/sms/send.ts`의 `sendTwilio`·`TwilioConfig`·대체 분기, `scripts/sms-hook-test.mts`의 대체 시험 삭제
- Vercel env `TWILIO_*` 삭제, `.env.local.example`의 Twilio 줄 삭제
- 처리방침에서 Twilio 수탁·국외 이전 항목 정리(Supabase Phone의 Twilio 설정을 되돌리기용으로 남길지 같이 결정)
