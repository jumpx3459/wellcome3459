# PROGRESS

마지막 업데이트: 2026-09-22

새 세션을 시작할 때 이 파일을 먼저 읽고, 아래 "다음에 할 일"부터 확인하세요.

## 프로젝트 개요

덤핑점핑(JumpX 알림 MVP) — B2B 덤핑정보 알림 웹앱.
Next.js 16 (App Router) + Supabase + Tailwind CSS v4. 자세한 배포/구조 설명은 `README.md` 참고.

## 브랜치 상태 (2026-09-14 해결됨)

이전에 로컬 `main`과 GitHub 저장소의 `origin/HEAD`가 가리키는 브랜치가 서로 달라
혼란이 있었으나, 사용자가 `git remote set-head origin -a`로 갱신 확인 → GitHub 쪽
기본 브랜치도 이미 `main`으로 바뀌어 있었음. 지금은 로컬 `main` = GitHub 기본 브랜치로
정리된 상태. (과거 `claude/dumping-alert-app-rb20gt` 브랜치는 더 이상 작업 기준이 아님)

## 현재 상태

- 기본 브랜치: `main` (로컬/GitHub 모두 일치, `origin/HEAD -> origin/main`)
- 열려 있는 PR: 없음
- 병합 완료 (기본 브랜치에 모두 반영됨): PR #1~#14 (견적함 메뉴+Toast, 회원가입 개선,
  PWA 배너 수정, 회원번호+추천 공유, 프로필/사업자인증, 관리자 다중계정 인증,
  mypage 관리자 인식 배지, 관리자 임명/비밀번호 변경, 디자인 토큰 v1 1라운드,
  디자인 토큰 v2 위계/액센트 재정비)
- GitHub Actions로 main push 시 Vercel 프로덕션 자동배포 (`.github/workflows/deploy.yml`)
- 로컬 git 사용자 정보 설정 완료 (이 저장소 한정): `user.name = kimkeeyong33-sys`, `user.email = kimkeeyong33@gmail.com`

## 최근 작업 (2026-09-22) — design-v2 전면 리디자인

Claude Design 세션(별도, GitHub 저장소 읽기전용 연결)이 몇 라운드에 걸쳐 만든
전체 화면 리디자인 목업(당근마켓 톤 리브랜딩 — 오렌지 #FF6F0F/#E25100 CTA,
다크 네이비 히어로)을 `feature/design-v2-full` 브랜치에서 로컬 구현. 6단계로
나눠 진행, 각 단계 tsc/build 통과 확인 후 커밋:

1. **색상 토큰 전면 교체** — `--color-brandOrange`/`--color-brandOrangeDeep`
   값 교체 + 신규 토큰(`--color-brandOrangeAccent`/`--color-navyDeepest`/
   `--color-toggleOn`) 추가. 45곳 inline hex 직접 사용처를 전부 찾아 교체.
2. **온보딩+가입+홈** — 온보딩 인트로를 자동 캐러셀→다크 히어로 정적 화면으로,
   가입 화면을 단일 스크롤 폼→4단계 위저드(카테고리→지역→알림채널→전화인증)로
   재구성. 홈은 비회원(기존 마케팅 랜딩 유지)/회원(신규 알림함 UI, 실제
   member_categories/regions 매칭) 분기.
3. **매물 리스트/상세** — 기존 구현이 이미 목업과 구조적으로 가까워서 정렬
   토글·할인율 배지 등 차이점만 반영.
4. **구매/판매 등록 폼** — 아코디언→상시 노출 칩 UI로, 이메일 알림 채널
   "준비중" placeholder 추가.
5. **MY 페이지** — 프로필 헤더를 다크 네이비 통계 카드로, "최근 받은 알림"
   신규 추가(기존에 아무도 안 읽던 `notification_logs` 테이블을 처음 조회).
   **이 과정에서 이 테이블에 RLS가 아예 빠져있던 보안 구멍 발견 → 수정 완료**
   (RLS 정책을 Supabase SQL Editor에서 직접 실행해 적용 확인함, 2026-09-22).
6. **어드민** — 목업이 데스크톱 사이드바+멀티패널 대시보드라 지금 구조(모바일
   싱글페이지)와 완전히 달라 구조 변경은 보류(백로그 항목 참고), 색상/일관성만
   수정: 파트너 승인 큐 버튼 그린→네이비 통일, 헤더 그라디언트 통일, 중복
   컬러 페어 정리.

전 과정에서 목업에 없지만 실제 서비스에 필요한 기능(사업자 회원 토글,
JUMP X 입찰 브릿지, 관심있어요 리드 캡처, 실제 SMS 인증 등)은 전부 보존하고
데모용 가짜 로직(더미 인증, 즉시발행 가정 등)은 채택하지 않음. PR은 아직 안
올림 — 로컬 확인 후 올릴 예정.

## 최근 작업 (2026-09-19)

1. **GitHub Actions 자동배포** — `.github/workflows/deploy.yml` 추가, `VERCEL_TOKEN`/
   `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` 시크릿 등록. 초기 빌드 실패 2건을 순차로 해결:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`(형식이 URL-safe base64가 아니었음, 새 키 재발급)와
   `NEXT_PUBLIC_SUPABASE_URL`(값 손상) — 둘 다 Vercel REST API로 직접 재등록.
   `ADMIN_SESSION_SECRET`/`NEXT_PUBLIC_SITE_URL`(`https://www.dumpingjumping.com`)도
   신규 등록. → `main`에 직접 커밋(설정/인프라 작업, 화면 기능 아님).
2. **디자인 토큰 v1 — 1라운드 (PR #13, 병합됨)** — `src/styles/design-tokens.css` 신설
   (globals.css에서 import), `@theme`에 `--color-urgent`/`--color-verified`/
   `--color-line`/`--radius-token`(12px) 추가(기존 `--color-brandOrange`/`--color-orange`는
   그대로 유지). `lucide-react` 도입 → `BottomNav` 이모지 아이콘 교체, `✓`/`✅`/`✔` 혼용을
   `CheckCircle`로 통일(mypage/admin/signup/buy/sell). `/deals`, `/deals/[id]`의
   `CountdownBadge`(마감임박 카운트다운, 기존엔 `--color-orange`가 아니라 하드코딩된
   `#C2410C`였음)를 `--color-urgent`로 재색상화. 홈 화면 미리보기 카드의 아이콘 박스
   `rounded-xl`→`rounded-token` 1곳만 적용. `feature/design-tokens-v1` 브랜치 + PR #13,
   **병합 완료, 프로덕션 배포 확인됨**.
3. **디자인 토큰 v2 — 위계/액센트 재정비 (PR #14, 병합됨)** — Step 1 grep 조사(아이콘
   스타일/카테고리 색/선택 상태 로직/CTA 색/블루 배너/파트너 배지 6개 항목) → 정책
   확정 후 적용:
   - 지역 선택칩 `bg-navy` → 오렌지(`#F2891F`)로 카테고리와 통일 (signup/mypage/buy/
     sell 4개 파일, 아코디언 요약 배지 포함 총 7곳)
   - 소비자 화면 솔리드 네이비 CTA 3곳(mypage 설정저장/공유, deals/[id] JUMP X
     이동하기) → 오렌지 그라디언트로 통일. admin 대시보드 13곳은 내부 운영툴이라는
     이유로 의도적으로 네이비 유지
   - `admin/page.tsx`의 `focus:border-trustBlue`(`@theme`에 없는 죽은 색 참조) →
     `focus:border-navy`
   - `sell.tsx` 카테고리 선택기가 혼자 `categoryColors[c].solid`(무지개색)를 쓰던 것
     발견 → 균일 오렌지로 통일 (`categoryColors` 자체는 매물 카드 표시용으로 계속 사용)
   - `BottomNav` 아이콘을 outline→filled로: `lucide-react`는 outline 전용 설계라
     fill 강제 적용 시 Search/Bell/Handshake/User가 깨짐(SVG 소스 직접 확인) →
     진짜 solid weight를 제공하는 `@phosphor-icons/react`로 5개 교체(Flame만 단일
     도형이라 lucide 유지)
   - 추가 라운드: (A) "카테고리 선택 전부 오렌지로 보임" 제보 → Playwright로 `/signup`
     실제 렌더링 후 computed style 측정, 재현 안 됨(코드 정상) 확인. (B) 홈 화면
     로고만 `h-10`(나머지 9개 화면은 이미 `h-8`) → `h-8`로 통일, 히어로 카피(신뢰배지+
     헤드라인+설명)는 마케팅 자산이라 유지 결정. (C) "전국 화물 배차 신청" 배너를
     메인 재고 흐름에서 빼서 페이지 최하단 "점프엑스 생태계 서비스" 구역으로 이동
   - 병합 후 실서비스(dumpingjumping.com)에서 로고 크기(`h-8`)/배너 순서(구매희망→
     생태계 서비스→화물배차)/BottomNav phosphor 아이콘 렌더링을 직접 HTML grep으로
     재확인 완료
   - **다음 라운드 대기 중**: Step 4(매물 상세 정보 위계, 라벨/값 대비), Step 5(마감임박
     vs 할인율 배지 색 거리 확보), 화물배차 배너 대안 노출 위치(거래완료/낙찰 화면)
     검토, "카테고리/지역 선택 UI 인기항목+더보기" 구조 개선(별도 기능 개발 과제로 분류)

## 최근 작업 (2026-09-14)

1. **PC 가로 스크롤 칩 넘기기 개선** — 홈 카테고리 칩, 구매 등록 페이지의 카테고리/희망지역
   칩에 마우스 사용자를 위한 좌우 화살표 버튼(`hidden md:flex`)과 세로 휠→가로 스크롤 변환을
   추가하는 재사용 컴포넌트 `src/components/CategoryScroller.tsx` 신설. → `main`에 직접 커밋.
2. **매물 공유 링크에 추천인 코드 반영** — `src/app/deals/[id]/page.tsx`의 `handleShare`가
   로그인한 회원의 `ref_code`를 붙여서 공유하도록 수정 (`?ref=` 쿼리, 기존 `resolve-ref`/가입
   흐름과 동일한 규칙). → `main`에 직접 커밋.
3. **관리자 계정을 mypage에서 인식** — `admin_users.phone` 컬럼 추가 + `/api/is-admin` 라우트
   + mypage 네이비 배지/`/admin` 이동 링크. → `feature/admin-mypage-badge` 브랜치 + PR #11,
   **병합됨**.
4. **관리자 임명/해제 + 비밀번호 변경 UI** — SQL Editor에서 직접 insert하던 관리자 등록을
   대시보드 UI로 이전. `create_admin_user`/`update_admin_password` SQL 함수(둘 다 public/
   anon/authenticated에서 EXECUTE 권한 회수) + `/api/admin/admins`(GET/POST/DELETE) +
   `/api/admin/change-password` + 회원 목록의 "관리자로 임명" 버튼·"관리자 목록" 섹션·
   "비밀번호 변경" 모달. 카카오 로그인·경매 등 기존 핵심 기능은 아니지만 "관리자 권한"
   관련이라 CLAUDE.md 4번 규칙에 따라 `feature/admin-manage-admins` 브랜치 + PR #12로 진행 (main에
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

- [x] PR #12 병합됨 (2026-09-14) — `create_admin_user`/`update_admin_password` 함수가 Supabase에 실제로 생성돼 있는지는 git 이력만으론 확인 불가, 관리자 임명 기능 써볼 때 한 번 확인 권장
- [x] PR #11 병합됨 — `admin_users.phone` 컬럼 추가 + 기존 관리자 계정에 실제 번호 채우기는 여전히 Supabase SQL Editor에서 수동 실행 필요 (schema.sql 해당 주석 참고, 아직 실행 확인 안 됨)
- [x] Supabase 대시보드 → Storage에 `business-licenses` 버킷 생성 완료 (2026-09-03, 사용자 확인)
- [ ] 실제 Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql`의 마이그레이션 블록을 아직 실행 안 했다면 실행 필요 — `member_no`, `name`/`email`/`business_license_path` 컬럼과 `protect_business_verified` 트리거까지 전부 포함 (이 세션엔 연결된 Supabase 프로젝트가 없어 로컬에서 직접 검증하지 못했음)
- [ ] 위 두 가지가 끝나면, 실제 업로드 → 관리자 열람 → 인증 완료 처리까지 전체 흐름을 한 번 직접 확인해보는 걸 권장
- [x] 디자인 토큰 v2 "위계/액센트 재정비" — PR #14 병합 완료, 프로덕션 배포 확인됨. 상세는 위 "최근 작업 (2026-09-19)" 참고
- [ ] 디자인 토큰 v3 (다음 라운드): Step 4(매물 상세 정보 위계), Step 5(마감임박 vs 할인율 배지 색 거리)
- [ ] 전국 화물 배차 배너 — 대안 노출 위치(거래완료/낙찰 화면) 검토 (현재 하단 분리만 적용됨, 거래완료/낙찰 전용 화면이 있는지부터 확인 필요)
- [ ] 카테고리/지역 선택 UI — "인기 항목 1~2개 노출 + 더보기" 구조 개선 (별도 기능 개발 과제): 신규 공용 컴포넌트 설계(다중선택 mypage.tsx vs 단일선택 buy.tsx 겸용), mypage/buy/signup 3개 파일 리팩터, `member_categories`/`member_regions` 집계 쿼리 신규 개발(없으면 고정 목록으로 시작 가능)
- [ ] "견적함" 실제 기능 기획/개발 (현재는 "준비중" 자리표시자만 있음)
- [ ] (선택) `Toast.tsx`를 다른 화면에서도 재사용할 만한 곳이 있는지 점검
- [ ] 어드민 데스크톱 전면 재구축 (2번째 운영자 생기면 검토) — Claude Design 목업(design-reference/, `덤핑점핑 어드민.dc.html`)이 사이드바+스탯카드+멀티패널 데스크톱 대시보드로 그려져 있는데, 지금 `admin/page.tsx`는 사이드바 없는 모바일 싱글페이지 구조라 구조 자체가 다름. design-v2 6단계에서는 구조 변경 없이 색상/일관성만 맞췄고(파트너 승인 버튼 네이비 통일 등), 전면 재구축은 운영자가 한 명뿐인 지금은 과잉투자라 보류. 목업 원본은 이 저장소를 처음 만든 로컬 환경의 design-reference/ 폴더에 보존돼 있음 — 다만 .gitignore 처리돼 있어 git에는 없고 그 로컬 디스크에만 있음. 다른 환경에서 재구축을 시작한다면 원본 zip(Claude Design 세션 산출물)을 다시 받아와야 함.

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
