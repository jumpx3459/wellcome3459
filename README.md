# 덤핑점핑 (JumpX 알림 MVP)

회원가입 → 알림 리스트 → 매물 상세, 판매자 신청 → 관리자 승인까지 이어지는
B2B 덤핑정보 알림 웹앱입니다. Next.js(App Router) + Supabase + Tailwind CSS로 만들었습니다.

## 지금 바로 로컬에서 확인하기 (Supabase 없이도 동작)

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속. `.env.local`이 없으면 자동으로 목업 데이터(`src/lib/mockData.ts`)로
동작하니, 화면 흐름만 먼저 확인하고 싶을 땐 이대로 써도 됩니다.

## 실제 서비스로 배포하기 — 순서대로 따라하세요

### 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트 생성
2. 왼쪽 메뉴 **SQL Editor** → `supabase/schema.sql` 내용 전체 복사해서 실행
   (members, deals, categories, regions, interests, seller_requests 등 테이블과 보안 정책이 한 번에 생성됩니다)
3. **Authentication → Sign In / Providers → Kakao** 활성화
   - [Kakao Developers](https://developers.kakao.com)에서 애플리케이션 생성 → **제품 설정 → 카카오 로그인** 활성화
   - **Redirect URI**에 Supabase가 안내하는 콜백 주소(`https://프로젝트ID.supabase.co/auth/v1/callback`)를 그대로 등록
   - Kakao 앱의 **REST API 키**와 **제품 설정 → 카카오 로그인 → 보안 → Client Secret**(발급 후 활성화)을 Supabase의 Kakao provider 설정 화면 Client ID / Client Secret란에 각각 입력 후 저장
4. **Project Settings → API**에서 아래 3개 값 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (절대 외부 노출 금지, 서버에서만 사용)

### 2. 환경변수 설정

`.env.local.example`을 복사해서 `.env.local` 생성 후 위에서 받은 값 채우기:

```bash
cp .env.local.example .env.local
```

### 3. 웹 푸시 알림 준비 (카카오 알림톡 대신 — 알라미처럼 기기에 직접 알림)

카카오 채널 심사나 템플릿 승인 없이, 브라우저/PWA에 바로 알림을 띄우는 방식입니다.

1. 터미널에서 키 쌍 생성:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. 출력된 Public Key → `.env.local`의 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
3. 출력된 Private Key → `.env.local`의 `VAPID_PRIVATE_KEY` (절대 외부 노출 금지)
4. 끝입니다 — 별도 외부 서비스 가입이나 심사가 필요 없어요.

> 주의: 웹 푸시는 **HTTPS 환경**에서만 동작합니다 (localhost는 예외). Vercel에 배포하면 자동으로 HTTPS가 적용되니 실제 테스트는 배포 후 진행하세요.
> 아이폰은 Safari에서 "홈 화면에 추가"(PWA 설치) 해야만 알림을 받을 수 있어요. 회원가입 화면에서 아이폰으로 접속하면 자동으로 안내 문구가 뜹니다.

### 4. 정부지원금 정보 탭 준비 (선택 — 안 하면 데모 데이터로 동작)

매물이 없어도 열어볼 이유를 만들기 위한 기능입니다. 기업마당(중소벤처기업부) 공식 오픈 API를 씁니다.

1. https://www.bizinfo.go.kr 접속 → 정책정보 > 정책정보 개방 > **지원사업정보 API** > "사용신청" 클릭
2. 승인 후 발급되는 인증키(`crtfcKey`)를 `.env.local`의 `BIZINFO_API_KEY`에 입력
3. 키를 넣지 않으면 `/support` 화면은 자동으로 데모 데이터(`src/lib/support.ts`)로 동작합니다 — 화면 확인만 할 땐 이 단계 건너뛰어도 됩니다

### 5. 매물 사진 (Supabase Storage)

판매자 신청·관리자 등록 화면에서 기본 최대 6장까지 사진(실물·박스·라벨 등)을 첨부할 수 있어요 (추천 리워드로 회원별 슬롯이 더 늘어날 수 있어요).

1. Supabase 대시보드 → **Storage** → "New bucket" → 이름 `deal-images`, **Public bucket** 체크
2. 업로드는 `/api/upload`가 서버(service_role 키)를 통해 대신 처리하므로 별도 Storage 정책 설정은 필요 없어요
3. 사진 없이 등록된 매물은 카테고리 아이콘으로 자동 대체돼요 (리스트 썸네일 · 상세 히어로 모두)

### 6. 관리자 계정·로그인

`/admin`은 관리자 계정(`admin_users` 테이블)별 **휴대폰 번호 + 비밀번호**로 로그인합니다(`ADMIN_PASSWORD` 환경변수는 더 이상 쓰지 않음).
- 역할: 최고관리자 / 관리자 / 점핑매니저 — 관리자 임명·해제·역할 변경은 관리자 화면에서 최고관리자가 합니다.
- 필요한 환경변수: `ADMIN_SESSION_SECRET`(32자 이상 임의 문자열, 없거나 짧으면 관리자 로그인이 거부됨), `FOUNDER_ADMIN_PHONE`(창업자 계정 보호, 선택).
- 같은 번호로 15분 안에 5회 틀리면 15분 잠깁니다. 앱으로 들어갈 수 없을 때는 `docs/ops/admin-emergency.md`의 SQL 절차를 따르세요.

### 7. SEO / 검색엔진 등록용 사이트 주소 설정

`.env.local`의 `NEXT_PUBLIC_SITE_URL`에 실제 배포 주소를 넣어주세요 (커스텀 도메인 연결 전이면
Vercel 기본 주소, 연결 후면 `https://www.dumpingjumping.com` 등으로). 이 값이 `/robots.txt`,
`/sitemap.xml`, Open Graph 링크에 그대로 쓰입니다. Vercel에도 같은 값을 환경변수로 등록해야
실제 배포본에 반영돼요.

등록 후 [Google Search Console](https://search.google.com/search-console)에 사이트를 추가하고
`https://주소/sitemap.xml`을 제출하면 색인 작업이 빨라집니다.

### 8. Vercel로 배포

1. 이 코드를 GitHub 저장소에 push
2. https://vercel.com 에서 **New Project** → 방금 만든 저장소 선택
3. **Environment Variables**에 `.env.local`과 동일한 값들을 그대로 입력
4. Deploy 클릭 → 몇 분 후 `https://프로젝트명.vercel.app` 주소로 접속 가능
5. 커스텀 도메인 연결하려면 Vercel 프로젝트 **Settings → Domains**에서 원하는 도메인을 등록

## 매물 등록 흐름 (판매자 신청 → 관리자 승인 → 자동 알림)

1. **판매자**: `/sell` 페이지에서 누구나 로그인 없이 매물 등록을 신청할 수 있어요 (사진 첨부 가능). 제출하면 `seller_requests` 테이블에 `pending` 상태로 저장됩니다.
2. **관리자**: `/admin` 페이지 비밀번호로 들어가면 대기 중인 신청을 확인하고, "매물로 등록하기"를 눌러 마감시간·최종 가격을 정해서 실제 `deals`로 확정할 수 있어요. 신청 없이 전화로 들어온 물량은 "새 매물 직접 등록"으로 바로 넣으면 됩니다.
3. 매물이 확정되는 즉시 해당 카테고리·지역 구독자에게 **자동으로 웹 푸시가 발송**돼요. 알림은 등록할 때 한 번만 나가고, 별도 재발송 경로는 없어요 (진행 중이고 마감 전인 매물에만 발송).
4. 진행 중인 매물은 `/admin`에서 재고 수정·마감 연장·조기 마감이 가능하고, 마감이 지난 매물은 `/deals` 리스트에서 자동으로 사라져요.
5. 회원이 매물 상세에서 "관심있어요"를 누르면 `/admin` 대시보드 최상단에 **리드로 즉시 표시**돼요. 전화번호와 사업자 여부가 함께 보이고, 연락하고 나면 "연락완료"로 체크해서 관리할 수 있어요.
   - 아직 회원가입을 안 한 사람이 매물 상세에서 "관심있어요"를 누르면 회원가입 화면으로 이동하고, 가입을 마치면 자동으로 원래 매물로 돌아와 관심 표시가 이어집니다.

## 비공개 베타 체크리스트

- 커뮤니티 일부에게 먼저 링크 공유
- `notification_logs`, `interests` 테이블로 반응률·전환율 확인
- 회원가입 화면의 "개인정보 처리방침" 링크(`/privacy`)와 알림 해지(`/unsubscribe`) 흐름 사전 확인

## 기술 스택

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- Supabase (Postgres + Auth + Storage + Realtime)
- 웹 푸시 (`web-push`, VAPID 키 기반)

## 디렉터리 구조

```
src/
  app/
    page.tsx                       홈
    signup/page.tsx                 ① 회원가입 (카테고리/지역 선택 + 기기 알림 권한 요청)
    deals/page.tsx                   ② 알림 리스트 (카운트다운 실시간 갱신, 대표사진)
    deals/[id]/page.tsx              ③ 매물 상세 (사진 갤러리, 점핑매니저 배너)
    sell/page.tsx                    판매자 매물 등록 신청 (공개, 사진 첨부)
    admin/page.tsx                   관리자 대시보드 (비밀번호 보호, 신청 승인 + 매물 등록/관리)
    support/page.tsx                 정부지원금 정보
    privacy/page.tsx                 개인정보 처리방침 · 이용약관
    unsubscribe/page.tsx             알림 해지 · 탈퇴
    buy/ logistics/ mypage/ tools/   구매/물류/마이페이지/도구 관련 화면
    api/
      push/subscribe/route.ts      푸시 구독 정보 저장
      push/status/route.ts         내 알림 상태 조회 (다른 기기 구독 수 등)
      upload/route.ts              매물 사진 업로드 (Supabase Storage)
      admin/deals/route.ts         관리자 매물 등록 (등록 즉시 자동 알림 발송)
      admin/deals/manage/route.ts  진행 중인 매물 조회/수정/조기마감
      admin/interests/route.ts     관심표시(리드) 조회 · 연락완료 처리
      admin/seller-requests/route.ts  판매자 신청 조회/승인/거절
      seller-requests/route.ts     판매자 신청 접수
      unsubscribe/route.ts         알림 해지 처리
  components/
    CountdownBadge.tsx              실시간 카운트다운 배지
    ImageUploader.tsx                사진 첨부 공용 컴포넌트 (기본 최대 6장)
    VideoUploader.tsx                영상 첨부 컴포넌트
    SplashScreen.tsx                 스플래시 화면
  lib/
    supabase.ts                     Supabase 클라이언트 (env 없으면 null → 목업 데이터로 대체)
    mockData.ts                     로컬 데모용 목업 데이터 (카테고리 9종 · 전국 17개 지역)
    format.ts                       카운트다운/가격 포맷 유틸
    pushClient.ts                   브라우저 알림 권한 요청 + 푸시 구독
    sendPush.ts                      웹 푸시 발송 공용 로직
    support.ts                      정부지원금 데모 데이터
public/
  sw.js                           서비스워커 (백그라운드 알림 수신)
  manifest.json                    PWA 매니페스트 (홈 화면 추가용)
  images/manager.png               점핑매니저 인물 이미지
supabase/
  schema.sql                      DB 스키마 (그대로 실행하면 됨)
```

## 향후 확장 아이디어

- 하향/상향/역경매/공동구매 등 다양한 거래 방식으로 확장 (Supabase Realtime으로 실시간 가격 갱신, Postgres RPC/트랜잭션으로 동시 입찰 정합성 보장)
- 알림 클릭률·전환율 통계 대시보드 (`notification_logs`, `interests` 집계)
- 카카오 비즈니스 인증 통과 후 `phone_number` 스코프로 전화번호 자동 수집 (현재는 로그인 후 직접 입력)
- 이미지 갤러리 라이트박스(확대보기)
