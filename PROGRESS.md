# PROGRESS

마지막 업데이트: 2026-09-14

새 세션을 시작할 때 이 파일을 먼저 읽고, 아래 "다음에 할 일"부터 확인하세요.

## 프로젝트 개요

덤핑점핑(JumpX 알림 MVP) — B2B 덤핑정보 알림 웹앱.
Next.js 16 (App Router) + Supabase + Tailwind CSS v4. 자세한 배포/구조 설명은 `README.md` 참고.

## ⚠️ 브랜치 상태 주의 (2026-09-14 확인)

이 저장소에 로컬 브랜치 `main`과 `claude/dumping-alert-app-rb20gt`(GitHub 기본 브랜치)가
서로 다른 커밋으로 갈라져 있었음 (예: 카테고리/지역 가로 스크롤 칩 전환이 두 브랜치에
각각 별도 커밋으로 존재). 확인 결과 `main`이 시각적으로 더 최신(관리자 다중계정 인증,
파트너 신청 등 최근 작업이 모두 main에 있음)이라 **이 세션은 `main`을 기준으로 작업**함.
다음 세션에서도 반드시 `git log --oneline main..origin/claude/dumping-alert-app-rb20gt`와
반대 방향을 먼저 확인해서 두 브랜치가 여전히 갈라져 있는지, 합쳐야 하는지 사용자에게
확인할 것 — 원인 파악 전에 임의로 강제 병합/삭제하지 말 것.

## 현재 상태

- 작업 기준 브랜치: `main` (위 주의사항 참고 — GitHub 기본 브랜치는 여전히 `claude/dumping-alert-app-rb20gt`로 설정되어 있음)
- 열려 있는 PR: #11 (관리자 계정을 mypage에서 인식 — admin_users.phone 연결, 병합 전 Supabase SQL 수동 실행 필요)
- 병합 완료 (기본 브랜치에 모두 반영됨): PR #1~#10 (견적함 메뉴+Toast, 회원가입 개선, PWA 배너 수정, 회원번호+추천 공유, 프로필/사업자인증, 관리자 다중계정 인증 등)
- 로컬 git 사용자 정보 설정 완료 (이 저장소 한정): `user.name = kimkeeyong33-sys`, `user.email = kimkeeyong33@gmail.com`

## 최근 작업 (2026-09-14)

1. **PC 가로 스크롤 칩 넘기기 개선** — 홈 카테고리 칩, 구매 등록 페이지의 카테고리/희망지역
   칩에 마우스 사용자를 위한 좌우 화살표 버튼(`hidden md:flex`)과 세로 휠→가로 스크롤 변환을
   추가하는 재사용 컴포넌트 `src/components/CategoryScroller.tsx` 신설. → `main`에 직접 커밋.
2. **매물 공유 링크에 추천인 코드 반영** — `src/app/deals/[id]/page.tsx`의 `handleShare`가
   로그인한 회원의 `ref_code`를 붙여서 공유하도록 수정 (`?ref=` 쿼리, 기존 `resolve-ref`/가입
   흐름과 동일한 규칙). → `main`에 직접 커밋.
3. **관리자 계정을 mypage에서 인식** — `admin_users.phone` 컬럼 추가(스키마에 마이그레이션
   문구 추가, 실제 DB엔 아직 미적용) + `/api/is-admin` 라우트 + mypage 네이비 배지/`/admin`
   이동 링크. 카카오 로그인·경매 등 기존 핵심 기능은 아니지만 "관리자 인식/권한" 관련이라
   CLAUDE.md 4번 규칙에 따라 `feature/admin-mypage-badge` 브랜치 + PR #11로 진행 (main에
   직접 커밋하지 않음).

## 최근 작업 (이번 세션, 시간순)

1. **마이페이지 "견적함" 메뉴** — 기존 카드 스타일로 메뉴 버튼 추가, 클릭 시 토스트만 표시(이동 없음). 새 `src/components/Toast.tsx` 컴포넌트 도입. → PR #1, 병합됨.
2. **회원가입 화면 개선** — 카카오 로그인을 최상단으로 옮기고 크게(문구: "카카오로 3초 만에 시작하기"), 휴대폰번호 입력 아래에 "업체명 (선택)" 필드 추가. → PR #2, 병합됨.
3. **PWA 설치 배너 버그 수정** — 서비스워커가 회원가입 완료 후에만 등록되던 문제 발견 → `AppShell`에서 첫 로드 시 바로 등록하도록 이동, 회원가입 화면에도 `InstallAppButton` 추가. → PR #3, 병합됨.
4. **회원번호 + 추천 링크 공유** — `members.member_no`(자동증가, "JX-00042" 표시) 추가, 마이페이지/관리자 화면에 노출, 점핑파트너 목록의 마스킹된 전화번호를 회원번호로 대체. 추천 링크에 `navigator.share` 공유 버튼 추가. → PR #4, 병합됨.
5. **프로필 완성하기 + 사업자등록증 인증** — 마이페이지에 상호명/성명/이메일(전부 선택) 저장 섹션과 사업자등록증 업로드(비공개 Storage 버킷, `members.business_license_path`) 추가. 업로드하면 "인증 대기중" 상태가 되고, 관리자가 서명 URL로 열람 후 "인증 완료 처리"하면 "✓ 인증된 사업자" 배지가 마이페이지/관리자 회원 목록/리드 목록에 표시됨. 병합 전 최종 점검에서 `members_self_update` RLS가 컬럼을 구분하지 않아 회원이 직접 자기 `business_verified`를 켤 수 있는 구멍을 발견 → `protect_business_verified` 트리거로 service_role이 아닌 변경은 무시하도록 막음. → PR #5, 병합됨.

## 최근 작업 (2026-09-04)

- 커밋 작성자 이메일이 GitHub 계정(`kimkeeyong33-sys`)의 등록 이메일(`kimkeeyong33@gmail.com`)과 다르게 찍혀 있던 최근 커밋 2개(63fd68e, c6053b5)를 `git rebase --exec "git commit --amend --reset-author --no-edit"`로 정정하고 `push --force-with-lease`로 반영. Vercel 대시보드에서 Production Deployment가 정정된 커밋(`d910791`) 기준으로 **Ready** 상태인 것 확인 — 이메일 불일치로 배포가 막혀있던 정황은 없었음.

## 다음에 할 일

- [ ] PR #11 병합 전, Supabase SQL Editor에서 `admin_users`에 `phone` 컬럼 추가 + 기존 관리자 계정에 실제 번호 채우기 (schema.sql 해당 주석 참고), 그 다음 PR #11 리뷰/병합
- [x] Supabase 대시보드 → Storage에 `business-licenses` 버킷 생성 완료 (2026-09-03, 사용자 확인)
- [ ] 실제 Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql`의 마이그레이션 블록을 아직 실행 안 했다면 실행 필요 — `member_no`, `name`/`email`/`business_license_path` 컬럼과 `protect_business_verified` 트리거까지 전부 포함 (이 세션엔 연결된 Supabase 프로젝트가 없어 로컬에서 직접 검증하지 못했음)
- [ ] 위 두 가지가 끝나면, 실제 업로드 → 관리자 열람 → 인증 완료 처리까지 전체 흐름을 한 번 직접 확인해보는 걸 권장
- [ ] "견적함" 실제 기능 기획/개발 (현재는 "준비중" 자리표시자만 있음)
- [ ] (선택) `Toast.tsx`를 다른 화면에서도 재사용할 만한 곳이 있는지 점검

## 개발 환경 참고사항

- 이 환경에는 기본적으로 `node_modules`가 없을 수 있음 → 작업 전 `npm install` 필요
- `.env.local`이 없으면 Supabase 미설정 상태로 동작 (`isSupabaseConfigured === false`) → 마이페이지 등 로그인 필요한 화면은 "데모 모드" 안내만 뜸. 실제 데이터로 화면 확인하려면 `.env.local.example`을 복사해 Supabase 값 채우거나, README의 "지금 바로 로컬에서 확인하기" 섹션 참고
- git 사용자 정보(user.name/email)는 이 저장소 로컬 config에만 설정돼 있음 (global 아님)
- PR을 만들면 Vercel이 자동으로 프리뷰를 배포함 (GitHub 커밋 상태 체크 "Vercel" 또는 PR 코멘트에서 링크 확인). 프리뷰 URL은 Vercel 배포 보호(SSO)가 걸려 있어 접속 시 본인 Vercel 계정 로그인이 필요할 수 있음

## JUMP X 인증 브릿지 (feature/jumpx-auth-bridge, 진행 중)

- 배경: 덤핑점핑과 JUMP X(jumpx-luxury-redesign 저장소)는 완전히 별개의 Supabase 프로젝트(다른 조직)라 로그인 세션을 직접 공유할 수 없음. Supabase 공식 API로 전화번호만으로 서버가 조용히 세션을 발급하는 방법이 없어서(`admin.generateLink()`는 이메일 기반만 지원), "전화번호 입력만 건너뛰고 실제 SMS 인증(OTP)은 그대로 유지"하는 티켓 방식을 채택.
- JUMP X 쪽(별도 세션이 같은 날 작업): `bridge_tickets` 테이블 + `bridge-issue-ticket`/`bridge-consume-ticket` Edge Function 2개 + `/auth/bridge` 진입점을 `feature/jumpx-auth-bridge` 브랜치에 구현·배포 완료. `BRIDGE_SHARED_SECRET` 프로젝트 시크릿을 JUMP X Supabase 대시보드에 이미 설정함.
- 덤핑점핑 쪽(이 저장소, 이 커밋): 매물 상세(`src/app/deals/[id]/page.tsx`)에 "JUMP X에서 입찰 참여하기" 버튼 추가 — 로그인된 회원이면 `members.phone`을 바로 쓰고, 아니면 인라인 폼으로 번호를 받음. 새 `/api/jumpx-bridge` 라우트가 `JUMPX_BRIDGE_SHARED_SECRET`으로 JUMP X의 `bridge-issue-ticket`을 서버 간 호출해 1회용 코드를 받아오고, `jumpx.co.kr/auth/bridge?code=...`로 리다이렉트.
- 필요 환경변수(`JUMPX_BRIDGE_URL`/`JUMPX_BRIDGE_SHARED_SECRET`/`JUMPX_ORIGIN`)는 `.env.local.example`에 문서화했고, 로컬 `.env.local`에도 실제 값 채워둠(JUMP X 쪽과 동일한 공유 비밀키).
- 아직 안 한 것: 이 브랜치 push + PR (이 클라우드 세션은 GitHub 인증이 없어 push 불가 — 로컬 Claude Code에서 push 필요), 실제 엔드투엔드 테스트(전화번호 입력 → JUMP X 이동 → OTP 수신 → 로그인 완료까지 한 번 직접 확인).
