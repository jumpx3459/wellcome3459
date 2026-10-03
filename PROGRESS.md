# PROGRESS

마지막 업데이트: 2026-10-03 (PR-D 관리자 매물 등록 폼 2단 — 커밋 1 2단·판매자 신청 폼 자리 이동·커밋 2 카드 제목·PC 사진 버튼·업로드 오류 상자, 브랜치 `feat/admin-deal-form-2col` / PR #47 PR-B 사진 업로드 병합 `eada5c1` / PR #46 PR-C1 관리자 카드 목록 병합 `9ee5715` / PR #45 /sell PC 2단 병합 `c5aca29` / PR #44 /sell·관리자 레이아웃 정리 병합 `849d069` / PR-A2 영상 업로드 보완 / PR #42 영상 직접 업로드 병합 `bae6df1`·운영 시험 / PR #41 번호 표시 통일 병합 `d5f5e78` / PR #40 F-2 거래 연결 DB 병합 `60646c0`·운영 SQL 실행 완료 / L-8 관리자 매물 [마감] 버튼 — 브랜치 `feat/admin-deal-close` / PR #31 VAPID lazy 초기화 — 병합 `f2dca21` / ① 관리자 역할 기반 최소판 — PR #30, SQL 1~5 실행 완료 / PR용 CI(chore/pr-ci) / J-2 사업자정보 푸터·관리자 대시보드 레이아웃 / J-1 로그인·가입 번호 자동완성 버그 / PR #26 커밋 K KPI 매일 저장·방문 기록·지표 정확도 — 병합 `c0c9c8a`·SQL 실행 완료 / PR #25 커밋 G 비회원 동의 기록·90일 자동 삭제 — 병합 `cf6093d`·SQL 실행 완료 / PR #24 커밋 D 사업자 정보 푸터·문의 경로 — 병합 `f24170c` / PR #23 커밋 E 판매자 표시 — 병합 `6dbe813`·SQL ①②③ 실행 완료 / PR #22 커밋 H: 판매 신청 회원 전용·업로드 인증·동의 상태 표시·확대 안내 — 병합 `8cf2f41` / PR #19 재발송 경로 제거·deals.status 제약 / PR #20 (광고)·수신거부·야간 보류 / PR #21 수신 동의 기록·약관·처리방침·icn1 / 공개일 10/7 연기)

새 세션을 시작할 때 이 파일을 먼저 읽고, 아래 "다음에 할 일"부터 확인하세요.

## 공개일

- **정식 공개: 2026-10-07** (2026-09-30 대표 결정으로 10/1 → 10/7 연기). 아래 백로그의 "공개 후 작업"은 10/7 기준.

## 결정 기록 (2026-09-30)

- **작업 순서: 커밋 H → E → G → F → D.**
- **비회원 연락처 보관: 수집일로부터 90일 후 자동 삭제** — 커밋 G에서 구현.
- **기존 회원 재동의 공지는 하지 않음** — 다음 방문 때 재동의 시트(ConsentGate)로만 받음.

## 용어 기준 (2026-09-29)

- **소비기한**: "유통기한"은 쓰지 않는다 (2023년 식품 표시제 변경). 재고 유형 near_expiry 라벨은 "소비기한 임박"(값은 그대로),
  보관조건 칸 이름도 "보관조건 · 소비기한". 새 문구·예시 매물·푸시 본문 모두 이 기준.
- **점핑매니저 연락**: "당일 연락"·"24시간 이내" 대신 "빠르게 연락드려요" 톤.
- **버튼**: 하단 고정은 `FloatingCTA`(판 없이 주황 버튼만 띄움), 본문은 `uiText` `BTN_CLASS`·`btnStyle`(주 버튼 주황 / 보조 버튼 테두리, 52px·17px/800). 주황은 주 버튼 전용.
- **PR 규칙 예외 기록 (2026-09-29)**: `86bb749`·`c5aac69`는 login·signup 파일을 건드렸지만 버튼 모양(className·style·import·고정 버튼 틀·하단 여백)만 바뀌고 로직 변경이 없어 main 직접 push (사용자 승인).

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
- 열려 있는 PR: 없음 — `feat/admin-deal-form-2col`(PR-D 관리자 매물 등록 폼 2단, 로컬 커밋 · push 전) (**PR #47 PR-B 사진 업로드는 2026-10-02 병합 · `eada5c1` · CI run 37015060343 · 배포 run 37015266907 성공 · 운영 /sell 200 · 운영 확인(10/3 대표) ①~⑧ 통과 · ⑨ 미실시 · ⑩ PR-C2로 이월** · **PR #46 PR-C1 관리자 카드 목록은 2026-10-02 병합 · `9ee5715` · CI run 36984328895 · 배포 run 36984572980 성공 · 운영 확인은 대표 확인 후** · **PR #45 /sell PC 2단은 2026-10-02 병합 · `c5aca29` · 배포 run 36981478699 · 운영 확인 통과** · **PR #44 /sell·관리자 레이아웃 정리는 2026-10-02 병합 · `849d069` · 배포 run 36978793197 성공** · **PR #43 PR-A2 영상 업로드 보완은 2026-10-02 병합 · `306e21b` · 배포 run 36975533440** · **PR #42 PR-A 영상 Storage 직접 업로드는 2026-10-02 병합 · `bae6df1` · 배포 run 36967938152 성공 · 프리뷰 없음 → 운영 시험** · **PR #41 번호 표시 통일·추천 목록 번호 가리기는 2026-10-02 병합 · `d5f5e78` · 배포 run 36964863033 성공** · **PR #40 F-2 거래 연결 DB는 2026-10-02 병합 · `60646c0` · 배포 run 36948686002 성공 · 운영 SQL 실행 완료(E2 생략)** · **PR #39 매물 폼 재배치 2차 + 푸터 "JumpX Inc."는 2026-10-01 병합 · `0ec592e` · 배포 run 36837013333 성공** · **PR #38 F-1 리드 보안은 2026-10-01 병합 · `ffc23aa` · 배포 run 36834546494 성공** · **PR #37 푸터 심볼·통신판매업 신고번호는 2026-10-01 병합 · `7eb809e` · 배포 run 36829390731 성공** · **PR #36 매물 폼 가로 넘침 + 재구성은 2026-10-01 병합 · `e49b2a6` · 배포 run 36828519187 성공** · **PR #34 PR-B 매물 등록 폼 UX는 2026-10-01 병합 · `56353a0` · 배포 run 36822399761 성공** · **PR #33 PR-A 푸시 구독 관리·매물명 검사는 2026-10-01 병합 · `98ca8f6` · 배포 run 36822109650 성공** · **PR #35 PR-C 안드로이드 뒤로가기는 2026-10-01 병합 · `5957964` · 배포 run 36821144848 성공** · **PR #32 L-8 매물 마감은 2026-10-01 병합 · 머지 커밋 `dde8015` · 배포 run 36808090081 성공** · **PR #31 VAPID lazy 초기화는 2026-10-01 병합 · `f2dca21`** · **PR #30 관리자 역할은 2026-10-01 병합 · `727418b`** · **PR #29 PR용 CI는 2026-10-01 병합 · 머지 커밋 `2b8f107`** · **PR #28 사업자정보 푸터·관리자 대시보드 레이아웃은 2026-10-01 병합 · 머지 커밋 `d0eb5a5`** · **PR #27 로그인 번호 자동완성 버그는 2026-10-01 병합 · 머지 커밋 `829d284`** · **PR #26 KPI 매일 저장·방문 기록은 2026-09-30 병합 · 머지 커밋 `c0c9c8a`** · **PR #25 비회원 동의 기록·90일 자동 삭제는 2026-09-30 병합 · 머지 커밋 `cf6093d`** · **PR #24 사업자 정보 푸터·문의 경로는 2026-09-30 병합 · 머지 커밋 `f24170c`** · **PR #23 판매자 표시는 2026-09-30 병합 · 머지 커밋 `6dbe813`** · **PR #22 판매 신청 회원 전용·업로드 인증·동의 상태 표시·확대 안내는 2026-09-30 병합 · 머지 커밋 `8cf2f41`** · **PR #21 수신 동의 기록·약관·처리방침은 2026-09-30 병합 · 머지 커밋 `b10a9c8`** · **PR #20 푸시 규칙((광고)·수신거부·야간 보류)은 2026-09-30 병합 · 머지 커밋 `1c4e68d`** · **PR #19 푸시 발송 보안·매물 상태 검증은 2026-09-30 병합 · 머지 커밋 `957620f`** · **PR #18 로그인 비밀번호 유도 후속은 2026-09-29 병합 · `b7be300`** · **PR #17 선택적 비밀번호 로그인은 2026-09-28 병합 완료 · 머지 커밋 `6465faa`** —
  사용자가 Supabase "Secure password change" 설정 후 병합 승인. 실제 설정→로그아웃→비밀번호 로그인 흐름은
  프로덕션에서 한 번 직접 확인 권장. PR #16 회원가입 3단계→2단계 통합은 2026-09-25 병합 · `5fb0375`)
- 병합 완료 (기본 브랜치에 모두 반영됨): PR #1~#14 (견적함 메뉴+Toast, 회원가입 개선,
  PWA 배너 수정, 회원번호+추천 공유, 프로필/사업자인증, 관리자 다중계정 인증,
  mypage 관리자 인식 배지, 관리자 임명/비밀번호 변경, 디자인 토큰 v1 1라운드,
  디자인 토큰 v2 위계/액센트 재정비), **PR #15 (design-v2 전면 리디자인, 2026-09-22
  병합 완료 · 머지 커밋 `e9e54b2`)** — 상세는 아래 "최근 작업 (2026-09-22)" 참고.
  이후 main에 직접 커밋으로 계속 진행 중(로그인 페이지, 판매 진입점 배너, 쪽지+업체명
  비공개 옵션 등) — 상세는 아래 "최근 작업 (2026-09-23)" 참고
- GitHub Actions로 main push 시 Vercel 프로덕션 자동배포 (`.github/workflows/deploy.yml`)
- 로컬 git 사용자 정보 설정 완료 (이 저장소 한정): `user.name = kimkeeyong33-sys`, `user.email = kimkeeyong33@gmail.com`

## 최근 작업 (2026-10-03) — PR-D 관리자 매물 등록 폼 2단 (브랜치 `feat/admin-deal-form-2col`, 로컬 커밋 · push 전)

- **PR #47 병합 `eada5c1`**(PR-B 사진 업로드 — 커밋 `a268646`·`9737639`) · CI run 37015060343 · 배포 run 37015266907 성공 · 운영 /sell 200.
  운영 확인(10/3 대표): ①~⑧ 통과 · ⑨ 미실시 · ⑩ PR-C2로 이월.
- 발견(10/3): 오프라인에서 토큰 갱신 실패 → `authFetch`가 가짜 401 "로그인이 필요합니다."(사진·영상 업로드·/sell 제출 시 비회원 안내로 바뀜) · 하단 탭도 비회원("알림")으로 표시 → PR-D 다음 별도 PR.
- **커밋 1 — 관리자 매물 등록 폼 2단** (화면만, 칸·검증·저장·서버·DB 변경 없음):
  - `DealForm`에 `wide`(= 대시보드 `isDesktop`) — PC 보기면 2단: 왼쪽(필수 정보 + 제품 상세·거래 조건·판매자 정보 묶음) / 오른쪽 360~420px(사진·영상·필수 안내·🌙·오류·[매물 등록 확정] sticky, 아래 여백 12px — 관리자는 하단 탭바 없음).
    폭 제한 `max-w-[720px]`은 PC 보기에서 해제(본문 1136px 전체). 화면 폭(`lg:`)이 아니라 `isDesktop` 기준이라 "📱 모바일 보기"는 1단 그대로.
    /sell(#45)과 같은 방식(두 열 틀이 좁을 땐 `display:contents` + `order`) — 틀 요소가 그대로라 보기 전환해도 다시 마운트 안 됨.
  - 대시보드: 새 매물 폼 자리(`newDealBlock`)를 PC·모바일 보기에서 같은 트리 위치로(바깥 틀만 `contents` ↔ 1200px 틀) — 예전엔 보기 전환 시 폼이 통째로 다시 마운트돼 입력·업로드가 사라졌음.
  - 판매자 신청 [매물로 등록하기] → 카드 안(3열 카드 폭 ~370px)이 아니라 새 매물 자리(`#deal-form-slot`, 전체 폭)에서 같은 `DealForm`(prefill + requestId) 열고 그 자리로 스크롤.
    폼 위 띠 "판매자 신청 '<매물명>'을 매물로 등록 중 · [취소]". 미리 채움 값은 `requestPrefill()`로 뺐을 뿐 그대로, 등록 후 신청 처리·목록 갱신 로직 그대로.
  - 매물 등록 폼은 한 자리에 하나만(새 매물 ↔ 신청 ↔ 긴급 공지). 작성 중(첫 값과 달라짐·사진/영상 상태 변화)이면 바꾸기 전 "작성 중인 내용이 사라져요. 계속할까요?" — [취소]·[닫기]는 확인 없이 닫음.
- **커밋 2 — 사용 편의** (화면만):
  - 대시보드 카드 제목 전부 `UI_SECTION`(18px/800 검정) + 건수는 회색 보통 글씨 "(n건)"·"(n건 대기)"·"(n건 미연락)"·"(n명)" — 진행 중인 매물·판매자 신청·파트너 신청·실적·이런 재고 찾습니다·최근 가입 회원·관리자 목록. 아이콘은 있던 카드만.
  - `ImageUploader` PC(pointer: fine): 점선 칸 안 버튼 모양 [📁 사진 파일 선택] + "또는 사진을 여기로 끌어다 놓으세요 · 여러 장 한 번에 선택 가능"(누르면 예전처럼 파일 선택, 여러 장). 휴대폰 문구 그대로.
  - 업로드 오류 문구 상자: `FormField.tsx` `UPLOAD_ERROR_STYLE`(16px 굵게, #E5484D, 바탕 #FDECEC, 8px 12px, 둥근 모서리) — 사진(목록 아래)·영상(주황 제거). 문구 내용은 그대로. /sell·관리자 새 매물·수정·긴급 공지 공통.
- 확인: build 통과, 새 lint 0(기존 SessionCountdown 1건). 운영 요청 없는 브라우저 시험 — 로컬 dev(Supabase 주소 더미) + Playwright로 `/admin` 실제 화면에 /api 전부 가짜 응답, localhost 밖 요청 차단(임시 페이지 없이 진행):
  1280px 2단(왼쪽 644px·오른쪽 417px), 묶음 펼친 채 스크롤 시 버튼 화면 아래 고정 · 📱 1단 · 사진 올리는 중 📱↔💻 전환해도 "사진 올리는 중…"·진행률·썸네일 유지(업로드 요청 1번) ·
  신청 폼 미리 채움(매물명·단가·수량·지역)·띠·[취소] · 확인 창 양방향(취소하면 그대로 / 손대지 않은 폼은 창 없이 교체) · 카드 제목 8개 18px/800 · 사진 400·영상 열기 실패 오류 상자 스타일.

## 최근 작업 (2026-10-02) — PR-B 사진 업로드 (PR #47, 브랜치 `feat/photo-upload`, 병합 `eada5c1`)

- **PR #46 병합 `9ee5715`**(PR-C1 관리자 카드 목록) · CI run 36984328895 · 배포 run 36984572980 성공 · 운영 확인 결과는 대표 확인 후.
- 결정: 헤더 "🔔 미연락 리드 n건"·"조치 필요"의 미연락 숫자 기준 통일(연락 안 함 AND 진행중)은 PR-C2(대시보드 숫자 분리)에서.
- **커밋 1 — 사진 미업로드 제출 차단** (화면만, 서버·DB 변경 없음):
  - `ImageUploader`: `onStatusChange({ uploading, failed })` + ref(`retryFailed`·`removeFailed`). 실패한 사진은 목록에 남고 썸네일 덮개 "실패 / 다시 시도"(탭하면 그 장만 재업로드) + × 유지.
    업로드는 예전처럼 장당 순차 요청. 칸 자리를 index 대신 id로 찾음(올리는 중 ×로 지워도 결과가 다른 칸에 안 붙음).
    `onChange`는 올라간 사진 목록이 바뀔 때만 effect에서 호출(예전 setState 갱신 함수 안 호출 → React "while rendering" 경고 제거). prop 안 넘기면 예전과 같음.
  - 적용 폼 4곳: /sell · 관리자 새 매물(DealForm) · 관리자 매물 수정 · 부동산·설비(긴급 공지, NoticeForm — 같은 폼).
    올리는 중 → 버튼 비활성 + "사진 올리는 중…"(영상과 동시면 "사진·영상 올리는 중…", `uploadingLabel`).
    실패 사진 있는 채 제출 → `VideoNotUploadedSheet` 재사용(title·reselectLabel prop 추가) "사진 n장이 올라가지 않았어요" [다시 시도] / [빼고 등록].
    영상도 안 올라갔으면 사진 시트 → 영상 시트 순서로 하나씩.
  - 관리자 수정: 시트 제목 "새 사진 n장…", [빼고 저장]은 실패한 새 사진만 뺌(불러온 deal.images는 file이 없어 실패 상태가 될 수 없음).
    사진 관리 닫기도 영상처럼 숨기기만(예전엔 닫으면 업로더가 사라져 올리던 사진이 조용히 빠짐).
  - 확인(임시 페이지 + Playwright, /api/upload 가짜 응답, 운영 요청 없음): 3장 중 2장 실패 → 버튼 "사진 올리는 중…" 비활성 → 실패 2칸 표시 →
    제출 시 "사진 2장이 올라가지 않았어요" → [다시 시도] 성공 → 기존 사진 유지 / 실패 1장 [빼고 등록] → 올라간 사진만 제출. 콘솔 경고 없음.
- **커밋 2 — 사진 업로드 사용 편의** (화면만, 서버·DB 변경 없음, 라이브러리 추가 없음):
  - 커밋 1 보충 확인: 관리자 수정 사진 관리를 닫아도(숨김) 업로더가 살아 있어 올리는 중·실패가 저장 차단에 반영, 시트 [다시 시도]는 사진 관리를 다시 열고 재업로드(코드 확인).
  - ×를 썸네일 안쪽 오른쪽 위로(보이는 원 20px, 누르는 자리 32px). 썸네일 목록은 가로 스크롤 대신 줄바꿈.
  - 끌어다 놓기: 사진 영역 전체가 받는 곳, 드래그 중 점선 테두리 강조. 사진만 받고 나머지는 토스트 "사진 파일만 올릴 수 있어요".
    파일 드롭은 `dataTransfer.types`에 "Files"가 있을 때만, 썸네일 순서 끌기는 자체 형식(`application/x-dj-photo`)이라 서로 안 섞임.
  - 붙여넣기: 사진 영역(tabIndex=0)을 클릭·포커스했을 때만. `globalPaste` prop(/sell만 켬)이면 문서 어디서든 — 단 input·textarea·select·contenteditable 포커스면 무시. 관리자 화면은 끔.
  - 최대 장수: 기본값을 `photoLimit.ts`의 `BASE_PHOTO_SLOTS`(6)로, 부동산·설비(긴급 공지) 폼은 `MAX_PHOTO_SLOTS`(16). 고르기·드롭·붙여넣기로 넘치면 남은 칸만 받고 "최대 n장까지 올릴 수 있어요".
  - 순서 변경: PC(pointer: fine)는 썸네일 끌어서 이동, 터치 기기는 썸네일 아래 ◀▶(32px, 맨 앞 ◀·맨 뒤 ▶ 비활성). 첫 장에 "대표 사진" 띠. 저장 images = 화면 순서, 올리는 중인 사진도 id로 이동.
  - 진행률: 라벨 옆 "올리는 중 2/5장"(이번 묶음 기준, 올리는 중에 더 고르면 같은 묶음에 더함). 전체 "4/6"은 그대로.
  - 자동 재시도: 네트워크 오류·5xx만 0.8초 뒤 1회. 4xx(형식·크기·한도)와 HEIC는 바로 실패, 서버 문구를 목록 아래 빨간 글씨로.
  - HEIC(type image/heic·heif 또는 확장자 .heic·.heif, type 빈 값도 받음): 줄이기·업로드 실패 시 "아이폰 사진(HEIC)은 JPG로 바꿔 올려주세요". 파일 선택 accept에 .heic,.heif 추가.
  - 문구: PC "클릭하거나 사진을 끌어다 놓으세요 (여러 장 가능)" / 터치 "탭해서 사진 선택 …" 그대로. 영상 PC "🎬 클릭해서 영상 선택"(끌어다 놓기는 없음) — VideoUploader 공용이라 관리자 새 매물·수정에도 적용.
    pointer 판별은 새 훅 `src/lib/usePointerFine.ts`(첫 화면은 터치 기준). 사진 영역 포커스 테두리는 앱 공통 `:focus-visible`(주황) 그대로, 터치 기기는 탭해도 포커스 안 줌.
  - 확인(임시 페이지 + Playwright, /api/upload 가짜 응답, 운영 요청 없음): PC 1280 — 문구·드롭(사진 2+txt 1 → 2장+토스트, txt만 → 무시+토스트)·"올리는 중 1/2장"·
    글자 칸 포커스 붙여넣기 무시·본문 붙여넣기(globalPaste)·globalPaste 없을 때 본문 무시/영역 클릭 후 받음·한도 5에서 3장 드롭 → 1장+토스트·끌어서 마지막→첫 장(대표 사진 이동).
    재시도 — 503 후 200: 요청 2번·성공 / 400: 1번·실패+서버 문구 / 네트워크 오류: 2번·실패. HEIC 가짜 파일: 요청 0번·HEIC 문구, type 빈 .heif 드롭도 받아서 실패 처리.
    휴대폰 375(터치) — 탭 문구·◀▶ 맨 앞/맨 뒤 비활성·끌기 꺼짐·▶ 이동 후 images 순서·× 32×32 썸네일 안·가로 넘침 없음.

## 최근 작업 (2026-10-02) — PR-C1 관리자 대시보드 카드 목록 공통 틀 (PR #46, 브랜치 `feat/admin-card-list`, 병합 `9ee5715`)

- **PR #45 병합 `c5aca29`**(/sell PC 2단 — 커밋 `16fe7a3`·`ca2e9ae`·`98e3a78`) · CI run 36981280014 · 배포 run 36981478699 · 운영 확인 통과.
- 화면만 변경(API·DB·조회 로직 그대로). 새 컴포넌트 `src/components/admin/AdminListCard.tsx`:
  제목·건수·접기/펼치기(초기 상태 그대로) + 펼치면 기본 5건, 넘으면 하단 [전체 보기 (n건)] ↔ [줄이기 ▲].
  [줄이기] 후 카드 제목이 화면 밖이면 제목으로 스크롤. 카드 안쪽 스크롤(maxHeight 480 + overflow-y-auto) 제거 — 💻 3단에서도 카드가 페이지 흐름대로 길어짐.
  가로 넘침은 `overflow-x: clip`(auto·hidden은 세로 축까지 auto로 바뀌어 다시 안쪽 스크롤이 생김).
- 적용: 관심 표시한 회원 · 대기 중인 판매자 신청 · 진행 중인 매물(접기 없음 그대로) · 공식 점핑파트너 신청 · 점핑파트너 실적 · 이런 재고 찾습니다 · 최근 가입 회원.
  최근 가입 회원만 5건 줄이기 없이 기존 20건씩 [더보기] 유지(안쪽 스크롤만 제거). 관리자 목록은 원래 고정 높이가 없어 그대로.
- 정렬(조치 필요 먼저, 같은 묶음 안은 API 순서 = 최신순): 관심 표시 = 카드 "미연락" 배지 기준(미연락 + 결과 진행중) /
  파트너 신청 = 심사중 먼저 / 구매 요청 = 미연락 → 연락했지만 매칭 결과 대기 → 끝난 건.
  관심 표시 카드 제목 "n건 미연락"도 같은 기준(연락 안 함 AND 결과 진행중)으로 셈. 구매 요청은 제목 숫자·[구매자 연락 전] 버튼·정렬이 모두 contacted 기준이라 그대로.
  최근 가입 회원 20건 더보기·MOQ 휠 막기(판매자 신청 등록 폼 포함)는 대표 확인 후 유지.
  판매자 신청은 API가 대기(pending)만 줘서 그대로, 진행 중 매물은 API가 closes_at 오름차순(마감 임박 순)이라 그대로, 파트너 실적 그대로.
- 소형: 구매 요청 카드 번호 `formatPhone` 표시(010-3441-3459). 관리자 수정 재고 칸·새 매물/신청 등록 폼 MOQ 칸(이 페이지 type=number 둘 다) `onWheel` 시 blur.
- 확인(Playwright·가짜 응답, 운영 요청 없음, 375·1280): 가로 넘침 0, 4개 카드 overflow-y visible·max-height none·안쪽 스크롤 없음,
  5건 + [전체 보기 (9건)] → 9건 → [줄이기] 후 5건·제목 화면 안, 정렬 순서, 재고 칸 휠 후 값 그대로·포커스 해제, 빈 목록(데모 모드)도 정상.

## 최근 작업 (2026-10-02) — /sell PC 2단 (PR #45, 브랜치 `feat/sell-pc-2col`, 병합 `c5aca29`)

- **PR #44 병합 `849d069`**(/sell·관리자 레이아웃 정리) · 배포 run 36978793197 성공.
- **PR-A2 운영 시험** — 결과: (비워둠)
- 화면 1024px(lg) 이상에서만 2단(왼쪽 1fr : 오른쪽 clamp(360px, 38%, 420px), 간격 32px). 그 미만은 #44 그대로(폼 내용 560px 이상 인라인 버튼 / 미만 FloatingCTA).
  - 왼쪽: 완전 무료 카드 → 필수 정보(상품명 / 판매·정상 단가 / 수량·지역 + 연락처) → [필수] 판매자 확인 → 제품 상세·거래 조건·판매자 정보(접기).
    수량·지역·연락처는 왼쪽 묶음 내용 680px 이상일 때만 3칸, 미만은 2칸이고 연락처는 다음 줄 전체(반 칸이면 예시 문구가 잘림). 지금 폭(셸 1160px → 왼쪽 최대 668px)에선 항상 2칸.
  - 오른쪽: 사진 → 영상 → 🔔 안내 → 오류 문구 → 등록 버튼. 안쪽 스크롤 없이 페이지와 함께 스크롤(행 높이만큼 늘어남, self-stretch),
    등록 버튼(+ 오류 문구)만 맨 아래(mt-auto)에서 sticky bottom = 하단 탭(--nav-bottom, safe-area 포함) + 12px — 오른쪽이 길어도·왼쪽 끝까지 내려도 버튼 보임, 탭바에 안 가림.
  - 칸은 한 벌만(업로더 다시 마운트 없음): 왼쪽·오른쪽 묶음이 lg 미만에선 `display:contents`라 칸들이 바깥 세로 줄에 서고 `order`로 예전 순서(① → 사진·영상 → 동의·접기 → 🔔 → 버튼).
    lg에선 각 묶음이 `@container`라 칸 수가 묶음 폭 기준. 인라인 버튼은 한 개(lg에선 오른쪽 맨 아래), FloatingCTA는 #44 useLayoutEffect(wideForm) 그대로.
  - 등록 버튼 묶음은 흰 배경 + 아래 padding으로 탭바까지 틈을 채워 뒤 내용이 비치지 않음(1024px 이상만).
  - AppShell /sell 폭 lg 1008 → 1160px(내용 1120px). 다른 화면은 그대로.
- 할인율: 별도 줄 없앰 → 정상 단가 라벨 옆 배지 "27% 할인"(값 없으면 없음, 80% 이상 주황). 판매가 ≥ 정상가 안내·가격 확인(ConfirmWarnings)은 정상 단가 칸 아래로. 모든 폭.
- 확인(로컬 데모 모드, headless 1440·1280·1024·1023·800·390): 보이는 등록 버튼 1개, 폭 바꿔도 업로더 DOM·입력값 그대로, 가로 넘침 0, 2단에서 상품명 누락 → 왼쪽 칸 스크롤·포커스.
  오른쪽에 가짜 1500px 블록(사진 6장·영상 대신) 넣고 1440·1280·1024 맨 위·중간·맨 아래, 접기 3개 펼친 왼쪽 중간·맨 아래 모두 버튼이 탭바 위에 보임. 1024에서 지역 안내·연락처 예시 안 잘림.
- 원인만 기록(수정 안 함): ① 하단 탭바는 AppShell과 별개로 `fixed max-w-md`(448px)라 넓어진 /sell 셸과 폭이 다름. ② (추정) ImageUploader 썸네일 줄이 `overflow-x-auto`라 세로도 잘려서 썸네일 오른쪽 위 × 버튼(-top-1.5)이 잘림.

## 최근 작업 (2026-10-02) — /sell·관리자 레이아웃 정리 (PR #44, 브랜치 `feat/layout-cleanup`)

- **PR #43 병합 `306e21b`**(영상 업로드 보완: 자르기 미지원 안내·영상 미업로드 제출 차단) · 배포 run 36975533440.
- 하단 버튼: /sell은 폼 내용 폭이 560px 이상(@container 2칸 기준)이면 하단 고정 버튼 숨기고 폼 맨 끝 인라인 버튼(오류 문구는 버튼 바로 위, 영상 올리는 중 비활성·미업로드 창 동일). 모바일은 고정 버튼 유지 + 오류 알약 뜰 때 아래 여백 +44px.
  관리자 새 매물 폼은 원래 FloatingCTA가 아니라 폼 맨 끝 인라인 버튼이라 변경 없음.
- 폼 폭 960 → 720px(/sell·관리자 새 매물, 관리자 바깥 틀 1200 유지) — 2칸: 상품명 전체 / 판매·정상 단가 / 할인율 한 줄 / 수량·지역 / 연락처(관리자는 지역 상세). FORM_ROW3는 내용 폭 최대 692px라 3칸(840px~)은 이 폼에선 안 나옴(다른 화면 사용처 없음).
- 수량 칸 type=text + 천 단위 쉼표(저장 시 숫자 변환): /sell·관리자 새 매물. 관리자 수정 재고 칸 inputMode=numeric. 정상 단가 아래 "판매 단가와 같은 단위로 적어주세요"(/sell·관리자 새 매물).
- /sell 매물명·수량·연락처 누락: 첫 누락 칸으로 스크롤·포커스·빨간 테두리, 안내 문구에서 판매 단가·재고 위치 제거.
- 가로 밀림 대비: 관리자 판매자 신청 카드 video playsInline, Toast 줄바꿈 허용(max-w calc(100vw-32px)).

## 최근 작업 (2026-10-01) — 매물 폼 가로 넘침 + 재구성 (PR #36, 브랜치 `fix/form-overflow`)

- 증상: 운영 안드로이드 크롬(홈 화면 앱) 관리자 "새 매물 직접 등록"이 좌우로 밀림(왼쪽 흰 띠·오른쪽 잘림), 터치 시 흔들림.
- 원인: AppShell 감싸개의 `overflow-x-hidden`이 스크롤 영역이라, 화면보다 넓은 요소가 있으면 입력칸을 누를 때 브라우저가 감싸개를 옆으로 스크롤함.
  넓은 요소는 PR-B에서 들어간 `input type=date`(안드로이드 크롬은 날짜 글자+달력 아이콘 고유 최소 폭) — 데스크톱 크롬 흉내에선 재현 안 됨(360·390·412 넘침 0).
  매물 상세 360px의 매니저 배지 줄(flex-nowrap)도 카드 안에서 22px 넘침.
- 수정: date 입력칸 기본 모양 끄고 block·min-width 0(globals.css), AppShell 감싸개 `overflow-x: clip`(스크롤 영역이 아니라 밀릴 수 없음, 미지원 브라우저는 hidden 그대로 — body엔 안 씀),
  보관 조건 버튼 min-w-0, 상세 배지 줄 줄바꿈 허용.
- 매물 폼 재구성(대표 [통합] 지시, 관리자 "새 매물 직접 등록"·/sell 같은 순서 — 항목·저장 그대로, 예외: /sell 재고 위치 필수 — 폼 + 서버 400 field "region", 없는 지역도 400):
  ① 필수 정보(항상): 상품명 · 재고 총수량+단위 · 단가 기준 · 판매 단가 · 재고 위치 · 연락처(/sell) / 관리자는 지역 상세
  ② 사진·영상(항상) "사진이 있으면 더 빨리 연결돼요" / ③ 거래 조건(기본 펼침): 카테고리·재고 유형·마감까지 / 정상 단가·MOQ·할인율 / 보관·소비기한
  ④ 상품 상세(접힘): 포장·규격·원산지·설명·PID·CSV / ⑤ 판매자 정보(접힘): /sell 업체명·담당자명·공개 설정, 관리자 판매자 표시 → 판매자 확인 동의 → 등록 버튼.
  묶음 제목 "○개 입력됨"(기본값 제외), 접힌 묶음 칸 오류 → 펼치고 스크롤, 소비기한 임박이면 ③ 펼침. `src/components/FormAccordion.tsx`.
  재고 유형·재고 위치는 드롭다운. 필수는 주황 "*"만(회색 (선택)/(필수) 없음 — 업로더 포함), 선택 상태는 회색 테두리+채움+✓(주황은 필수·주 버튼·오류), 오류 테두리 빨강.
  칸 수: 폼 폭 기준(@container) 1칸 → 2칸(560px~) → 3칸(840px~), 폼 최대 960px. /sell은 PC에서 AppShell 폭 sm 680·lg 1008(하단 탭·고정 버튼 448 그대로).
  휴대폰: 한 줄 하나, 재고 총수량+단위는 한 줄. 판매·정상 단가는 다른 묶음(①·③)이라 나란히 못 둠.
  카테고리 칩(공용, /buy 포함): 접힌 2줄 밖 칩은 Tab 제외(예전엔 안 보이는 칩에 포커스가 가며 상자가 스크롤됨), 폭 변화 시 다시 잼(ResizeObserver).
  관리자 "수정" 화면은 재고·사진·영상·판매자 표시뿐이라 대상 칸 없음.
- 확인: 360·390·412·1280·1920 — /sell·관리자 폼·매물 상세 가로 넘침 0. 동작 23/24(나머지 1건은 PC 3칸에서 칸 단위로 Tab이 이동하는 정상 동작을 검사식이 잡은 것):
  Tab 순서, 묶음 기본 펼침/접힘, (선택)/(필수) 글자 없음, 지역 미선택 거부(폼·서버), 접힌 ③ 소비기한·카테고리 오류 펼침+스크롤, 접힌 ④ 설명 경고 펼침, "1개 입력됨", 판매 신청 승인 이어받기.

## 최근 작업 (2026-10-01) — 푸터 점프엑스 심볼 + 통신판매업 신고번호 (PR #37, 브랜치 `feat/footer-jumpx-logo`)

- BusinessFooter 첫 줄 "점프엑스 주식회사 사업자 정보 ›" 오른쪽 끝에 심볼(높이 28px·폭 38px, `<img srcset>` 1x/2x, alt "점프엑스 주식회사", 링크 없음).
  펼치기 버튼은 글자 폭만큼이라 터치 영역이 로고와 안 겹침, 접힘·펼침 모두 보임. 영문 태그라인·"JUMP X.INC" 글자 없음. 컴포넌트 하나라 푸터 7곳 공통.
- 파일(대표 제공, 투명 PNG): `public/brand/jumpx-symbol-56.png`(1x, 76×56, 5,969B) · `jumpx-symbol-112.png`(2x, 151×112, 16,272B).
- 확인: 375·1920px × 7곳(비회원 홈·회원 홈·/deals·비회원 MY·회원 MY·/privacy·/terms) 14/14 — 높이 28px, 버튼과 겹침 없음, 클릭해도 이동·펼침 없음.
- 통신판매업 신고 완료(2026-10-01): `businessInfo.ts` mailOrderNo = "2026-화도수동-0622" → 푸터 펼침 목록 사업자등록번호 다음 줄에 표시(null이면 숨김 그대로). "신고 예정" 문구는 다른 곳에 없음(/terms·/privacy·/en은 사업자 정보 미표기, 푸터만).
- 매물 폼 Tab 순서(대표 확인 요청): 코드 변경 없음 — 줄마다 별도 grid라 DOM이 이미 줄(행) 순서·칸은 왼→오. 칸 안 여러 줄(카테고리 칩 등)은 그 칸을 다 돈 뒤 오른쪽 칸으로 감(표준 칸 순서).

## 최근 작업 (2026-10-01) — F-1 리드 보안 (브랜치 `feat/lead-guard`, 코드만·DB 변경 없음)

- F-0 조사(거래 연결 설계 전): 관심 리드는 회원 `interests`(브라우저 직접 저장, unique deal+member)·비회원 `quick_leads`(서버 저장, 중복·횟수 제한 없었음).
  관리자 리드 처리 담당자·감사 기록 없음, 관리자 직접 등록 매물은 실제 판매자 정보 저장 안 됨, members.phone은 가입 때 인증 번호와 대조 안 함,
  거래 상담 제3자 제공 동의 저장 구조 없음(문서 20: 매물별 동의라 연결 기록 표에), 문자 직접 발송 코드 없음. → F-2(SQL)·F-3(동의 시트)·F-4(관리자 처리)로.
- `/api/quick-interest`: dealId uuid + 실제 매물 + 진행 중(status active·마감 시각 전, 아니면 409), 번호 normalizeKoreanPhone 후 01[016789] 10~11자리,
  IP 10분 10회·같은 번호 10분 3회(429, `src/lib/rateLimit.ts` 서버 메모리), 같은 매물+같은 번호(예전 "8210…" 저장 행 포함)면 저장·알림 없이 200 { duplicate },
  동의 + 동의 문구 버전(consentVersion) 필수 — 시각·버전은 서버가 기록. 번호는 "010…" 형식으로 저장.
- `/api/admin/notify-lead`: 같은 매물에 2분 안 리드(토큰 있으면 그 회원 interests, 없으면 interests 또는 quick_leads)가 있을 때만 푸시, 없으면 204. 기존 IP·회원 제한 유지.
- 회원 관심(interests): RLS `interests_self`가 마감을 안 봄 → 이번엔 화면에서 막음(status closed는 원래 버튼 없음, 마감 시각 지난 active도 막음). DB 정책은 F-2 SQL.
- 매물 상세: 이미 관심 표시한 매물이면 "관심 표시 완료 · 점핑매니저가 빠르게 연락드려요"(비활성, 흰 바탕 — 흐린 회색은 뒤 내용과 섞여 안 읽힘).
  회원은 interests 조회, 비회원은 이 기기 localStorage(`dj_quick_interest_deals`). 같은 번호 재접수는 "이미 접수됐어요, 빠르게 연락드려요".
- 관리자 interests PATCH: outcome pending·completed·no_deal만, 성사 금액 0 이상 숫자(또는 null), contacted boolean, 감사 로그 `lead_update`(리드 id·매물 id·이전→이후).
- 확인: 로컬 dev + 가짜 Supabase 26/26.

## 최근 작업 (2026-10-01) — 매물 폼 재배치 2차 + 푸터 "JumpX Inc." (브랜치 `feat/form-order-v2`)

- 관리자 "새 매물 직접 등록"·/sell 같은 순서(저장 항목·검증 그대로): ① 필수 정보 — 상품명 / [판매 단가 | 원 / 단위] · 정상 단가(같은 단위 자동) · 할인율 /
  [재고 총수량 | 단위] · 재고 위치 · 연락처(/sell, 관리자는 지역 상세) → ② 사진·영상 → ③ 판매자 확인 동의(/sell) → ④ 제품 상세(접힘: MOQ·마감까지·보관·소비기한·포장·규격·원산지·설명)
  → ⑤ 거래 조건(접힘: 카테고리·재고 유형·PID·CSV, 관리자는 제목에 "필수 1개") → ⑥ 판매자 정보(접힘) → 등록 버튼.
- "단가 기준" 칸은 판매 단가 옆 단위 드롭다운으로 합침(price_unit 그대로, 기본 = 수량 단위, 일괄이면 최소주문 숨김). 정상 단가 옆 단위는 자동("원 / kg"·"원 (전체)").
- 소비기한 임박 → 제품 상세 자동 펼침(소비기한 필수 그대로), 관리자 카테고리 미입력 → 거래 조건 자동 펼침·스크롤, 동의 미체크 → 동의 칸으로 스크롤.
- 판매자 확인 사항 첫 줄: "매물 정보(아래 선택 정보 포함)를 사실대로 적었어요." (consent.ts + docs/legal 7-2, TERMS_VERSION은 그대로 2026-10-07).
- 푸터: X 심볼 오른쪽 "JumpX Inc."(#1C5FAE, 14px 굵게) 한 묶음 28px, 링크 없음, 글자는 aria-hidden(이미지 alt가 상호).
- `.gitignore`에 `public/Claude outputs/`(대표 측 앱이 잘못 만든 문서 폴더 — public/이라 서빙 경로, 커밋 금지. 파일 2개는 대표가 저장소 밖으로 옮김, .gitignore 유지).
- 확인: 360·390·1280 가로 넘침 0, 동작 29/32(나머지 3건은 /sell 입력칸 자체에 min-w-0가 있어 검사식이 칸 단위 비교를 못 한 것 — 실제 순서 입력→단위 정상), 승인 이어받기·푸터 확인.

## 최근 작업 (2026-10-01) — F-2 거래 연결 DB (PR #40, 머지 `60646c0` · 배포 run 36948686002 성공 · 운영 SQL 2026-10-02 실행)

- **운영 SQL 실행 기록(2026-10-02, 대표)**: 공용 함수 `touch_updated_at` + A→B→C→D → E1 → **E2-backup·E2 생략**(운영 E2-0 `mismatch 0`·`no_auth_phone 0`·`dup_after 0` —
  바꿀 행이 없어 생략, 백업 표 `members_phone_backup_20261001` 미생성) → F(확인 `policies 4`·`old_policy 0`) → G(확인 `linked_fk 1`·set null).
  `_check.sql` E2 관련 조회(E2-backup·E2 후)는 미실행 — 파일에 "E2 생략 시 실행 안 함" 표시(feat/phone-display).

- 파일: `supabase/migrations/20261001_f2_connections.sql`(실행, 블록 A→B→C→D→E1→E2-backup→E2→F→G, 맨 아래 되돌리기) · `20261001_f2_connections_check.sql`(블록별 확인 조회, 한 행씩) · schema.sql에 같은 내용(E2는 주석).
- A `deal_connections`(연결 1건 = 1행): deal_id **on delete restrict**(아래 보완) + deal_title_snapshot,
  buyer_member_id(set null)/buyer_phone(010… 숫자), source interest·quick_lead·admin + source_id(FK 없음), 7-1 동의 consent_at·version,
  status requested→accepted→seller_confirmed→buyer_confirmed→contact_sent→closed, closed ⇔ result(success·failed·cancelled), result_amount·reason,
  단계별 시각, assigned_admin_id → admin_users(set null), retention_until(칸만), updated_at 트리거. 진행 중 (deal, 회원)/(deal, 번호) 부분 unique, (status, updated_at)·담당자 인덱스.
  "구매자 회원 또는 번호 필수"는 check 대신 insert 트리거(check면 회원 탈퇴 set null이 막힘). contact_sent_at은 동의가 있어야 함.
- B `deal_connection_events`(단계 이력: step·method phone·sms·kakao·app·alimtalk·system·actor person·system·template_key·memo).
- C `deal_seller_private`(매물 1개당 판매자 비공개 정보: seller_request_id(set null)·source seller_request·admin_direct·상호·담당자·연락처(숫자 8~11자리)·memo·상호 안내 허락·만든 관리자·retention_until).
- D A·B·C RLS 켜고 정책 없음 + anon·authenticated 권한 회수(관리자 API는 service role).
- E1 members.phone = 인증 번호(auth.users.phone) 정규화("010…" = kpi_norm_phone): 가입은 새 트리거 `members_enforce_phone`(인증 번호 없으면 거부),
  수정은 기존 `protect_member_columns`의 `phone := old.phone` 한 줄을 "인증 번호(없으면 기존)"로. `member_auth_phone()`은 RPC로 못 부르게 실행 권한 회수.
  E2 기존 행 형식 통일은 따로 — E2-0(형식 분포·불일치·정규화 뒤 겹침 dup_after 0) 먼저.
- F interests 정책 "interests_self"(for all)를 동작별로 나누고 insert에만 "deals.status = 'active' · closes_at > now()" — 확인 파일에 rollback 테스트.
  quick_leads는 공개 insert 정책 없음 + /api/quick-interest가 같은 검사(F-1) → 코드 변경 없음. 상세 화면은 RLS 거부(42501)를 "이미 마감된 매물이에요"로.
- 보완(대표 검토): 연결 기록은 지우지 않는다 — `deal_connections.deal_id` **on delete restrict + not null**(연결 기록이 있는 매물은 삭제 대신 마감,
  관리자 삭제 API가 23503을 "거래 연결 기록이 있는 매물은 삭제할 수 없어요. 마감 처리해 주세요."로, 관리자 화면은 실패 안내를 토스트로 — 예전엔 실패해도 표시 없음).
  `deal_connection_events`는 restrict + 수정·삭제 금지 트리거(service role 포함). E2 앞 백업 표 `members_phone_backup_20261001`(RLS·권한 회수, 되돌리기 = 백업에서 복원,
  백업 표 삭제는 공개 전 확인 후 — 주석만). 블록 G: `seller_requests.linked_deal_id` FK를 on delete set null로 다시 만듦(승인된 매물 삭제가 FK 오류로 실패하던 것).
  E1은 가입(insert)에서 클라이언트 번호 대신 인증 번호로 덮어쓰고, 인증 번호가 없으면 예외(가입은 문자 인증 뒤에만 members를 만들어 정상 경로에선 항상 있음).
  관심 취소(delete)는 마감 조건 없음 — F-test에 마감 매물 관심 취소 성공 케이스.
- 남은 것 → **feat/phone-display에서 처리**: 관리자 지정(/api/admin/admins)의 admin_users.phone = members.phone 그대로 비교 → E2 뒤 정규화 비교로(다음 코드 PR).
  members.phone 원문 표시(E2 뒤 "010…" 하이픈 없음): 관리자 회원 목록·리드 목록(tel 링크)·판매 신청 카드·관리자 지정 시트, MY 추천 회원 목록·/mypage/referrals(my-referrals API 원문).
  MY 내 번호·sell/buy 연락처 자동 입력은 이미 형식 맞춤.

## 최근 작업 (2026-10-02) — PR-A2: 영상 업로드 보완 (브랜치 `feat/video-upload-guard`, 화면만 · 서버·DB·사진 경로 변경 없음)

- 배경(운영 시험 10/2): PR-A 직접 업로드 정상 — PC 크롬 잘라낸 webm 5.03MB Storage 저장·관리자 재생 ✓.
  아이폰 Safari 신규 회원이 15초 넘는 영상 선택 → 자르기 화면만 뜨고 업로드 안 됨(Storage 파일 없음) → 그대로 제출돼 seller_requests 4건 video_url NULL.
- VideoUploader: 자르기 가능 여부를 기능으로 판별(video.captureStream/mozCaptureStream + MediaRecorder webm). 미지원 + 15초 초과면 자르기 화면 대신
  "아이폰에서는 15초 이하 영상만…" + [다시 고르기], 선택은 지움. 지원 브라우저 자르기 흐름은 그대로. 열 수 없는 영상(메타데이터 오류)은 "길이 확인 중"에 멈추던 것 → 거절로.
  부모에 상태 알림(onStatusChange): idle · uploading(길이 확인·자르기·올리는 중) · pending(골랐지만 자르기 대기) · done · failed(올리기 실패) · rejected(형식·크기·길이·자르기 미지원).
  ref: reselect()(선택 지우고 파일 창 다시 열기 — 입력칸은 항상 둠) · clear().
- 제출 막기(/sell·관리자 새 매물 DealForm·관리자 매물 수정 ActiveDealCard): uploading이면 버튼 비활성 + "영상 올리는 중…",
  failed·rejected·pending이면 `VideoNotUploadedSheet`("영상이 올라가지 않았어요" + [다시 고르기] / [영상 빼고 등록](수정은 "영상 빼고 저장")) — 영상 빼고만 video 없이 제출.
  관리자 수정의 영상 관리 칸은 닫아도 숨기기만(업로드 상태 유지).
- 추가: 자르기 미지원 안내 문구 → "이 브라우저에서는 15초 넘는 영상을 자를 수 없어요. 아이폰은 사진 앱 → 편집에서 길이를 줄이고, PC는 크롬에서 올려주세요."(Mac Safari 포함).
- 추가: 관리자 매물 수정 — 기존 영상이 있는데 새 영상이 안 올라갔으면 시트 버튼 "기존 영상 유지하고 저장"(기존 video_url 그대로, 예전엔 ×로 비운 뒤라 null로 지워짐),
  기존 영상 없으면 "영상 빼고 저장"(null). 기존 영상 삭제는 ×로 비우고 새 영상 없이 저장할 때만 null. manage API는 videoUrl 미전송이면 안 바꿈(서버 변경 없음).
- 조사만(변경 없음): 사진 올리는 중 제출 — ImageUploader는 다 올라간 사진 URL만 부모에 알려서, 올리는 중·실패한 사진은 조용히 빠진 채 제출됨(/sell·관리자 같음).

## 최근 작업 (2026-10-02) — PR-A: 영상 Storage 직접 업로드 (PR #42, 머지 `bae6df1` · 배포 run 36967938152 성공 · 프리뷰 없음 → 운영 시험)

- 운영 시험(대표, 10/2): PC 크롬 잘라낸 webm 5.03MB 업로드·Storage 저장·관리자 재생 ✓ / 아이폰 Safari 15초 초과 영상 미업로드 발견 → PR-A2.

- 배경(업로드 조사): 사진·영상 모두 /api/upload(Vercel 함수)를 거쳐 요청 4.5MB 한도 적용. 사진은 1600px JPEG 축소 + 장당 1요청이라 문제없음(변경 없음),
  영상은 원본 그대로라 휴대폰 영상 대부분이 413으로 실패(서버 25MB 제한은 도달 불가).
- 새 API `POST /api/upload/video-url`(인증은 /api/upload와 같음 — 회원 토큰·관리자 x-admin-key, 아니면 401): { contentType, size, ext } →
  contentType 기본형 정규화("video/webm;codecs=…" → "video/webm") 후 mp4·quicktime·webm·3gpp만, size ≤ 50MB(52428800) → 경로 `video-{uuid}.{ext}`(버킷 루트)로
  createSignedUploadUrl → { path, token, signedUrl, contentType, publicUrl }.
- VideoUploader: 15초 자르기 유지, 최종 파일 50MB 넘으면 올리기 전에 막음("영상은 50MB 이하만…"), 서명 URL로 XHR PUT + 진행률 막대.
  요청 방식은 supabase-js 2.110.8 `uploadToSignedUrl`(Blob)과 같게: PUT signedUrl · 헤더 apikey·Authorization Bearer anon·x-upsert false ·
  multipart(cacheControl 3600 + ""=파일, 파트 형식은 기본형). 형식이 비어 오면(일부 PC .mov) 확장자로 정함. 공용 값 `src/lib/videoUpload.ts`.
- 저장 검사 `src/lib/videoUploadServer.ts` checkDealVideoUrl: /api/seller-requests·/api/admin/deals·/api/admin/deals/manage — deal-images 공개 URL 접두사 +
  `video-{uuid}.{ext}`(확장자 영문·숫자 1~16자 — 2026-09-30 전 파일 이름 확장자 "MOV" 등 호환) + Storage에 실제 있는지(exists). 비어 있음 허용,
  manage는 이미 저장된 값과 같으면 그대로 통과.
- /api/upload: 사진 경로 그대로, 영상 분기는 남김(예전 클라이언트 호환) + 형식 기본형 정규화. uploadClient: JSON이 아닌 응답(413 등)을 상태 코드 안내 JSON으로.
- 버킷 설정(대표 실행 예정): deal-images file_size_limit 52428800 · allowed_mime_types 사진 4종(jpeg·png·webp·gif) + 영상 4종 — 코드 값과 같음.
- 보완: 직접 업로드 FormData의 파일 파트 형식은 Blob.type에서 옴 → `new Blob([file], { type: 기본형 })`으로 다시 감싸 보냄(감싸지 않으면
  잘라낸 webm은 "video/webm;codecs=…", 형식 빈 .mov·.mp4는 "application/octet-stream"). /api/upload 영상 분기도 Storage에 기본형 contentType.
  관리자 매물 수정(manage PATCH) 실패 시 영상 검사 실패(field "video")는 서버 이유를 토스트로, 그 외는 예전 문구.

## 최근 작업 (2026-10-02) — 번호 표시 통일 + 추천 목록 번호 가리기 (PR #41, 머지 `d5f5e78` · 배포 run 36964863033 성공)

- 공통 유틸 `src/lib/phone.ts`(import 없음 — 서버·브라우저 공용): `normalizePhone`(저장·비교, "+82"/"82"+11~12자리 → "0…") ·
  `formatPhone`(010-1234-5678 · 011-123-4567 · 02-/031-/070- · 1588-1234, 모르면 원문) · `maskPhone`(010-****-5678, 모르면 "비공개").
  통합: auth.ts `normalizeKoreanPhone`은 이름만 남기고 normalizePhone을 가리킴(로그인·가입 호출부 그대로), `formatKoreanPhone`·`formatContactPhone` 삭제 → formatPhone
  (mypage·buy·sell), kpiExclusion·unsubscribe·admins·quick-interest의 복사본 normalizePhone → 공용. `toLocalPhone`("0010…" 방어)·signup 화면 `maskPhone`은 그대로.
- 표시 통일(formatPhone): 관리자 회원 목록·리드(tel 링크 값은 원문)·판매 신청 카드·관리자 목록·관리자 지정 시트.
- 추천 목록 번호 가리기: `/api/my-referrals` 응답 자체를 maskPhone 값으로(MY 추천 목록·/mypage/referrals가 같은 API) — 추천인에게 전체 번호가 안 감.
  관리자 화면·관리자 API만 전체 번호. /mypage/referrals 검색은 가린 값 기준(뒤 4자리로 찾기).
- 관리자 지정 중복 확인: `admin_users` 번호 전체를 읽어 normalizePhone으로 members.phone(E1 이후 "010…")과 비교 — "+8210…"·하이픈 행도 "이미 관리자"로 잡음.
  관리자 화면의 [관리자로 임명] 버튼 숨김(adminPhones)도 같은 비교로.
- 조사(코드 변경 없음): 긴급 공지 푸시는 즉시 발송(/api/admin/notices → sendNoticePush)·아침 cron(/api/cron/morning-push → sendNoticePush) 모두
  `sendNoticePush`가 `member_consent_latest`의 deal_alert_ad agreed=true 회원만 남김(sendPush.ts 297·320행).

## 백로그 (2026-10-01)

- **F-3**: 동의 버전을 동의 종류별로(지금은 전부 `TERMS_VERSION` 2026-10-07 하나 — 판매자 확인 사항 첫 줄 문구 변경 뒤에도 유지, 현재 동의 기록은 내부 테스트뿐이라 대표 결정).
- **공개 후 별도 PR**: 로그인·가입 완료 후 이동(`router.push` — login/page.tsx·signup/page.tsx)을 `router.replace`로 — 지금은 로그인 화면이 기록에 남아
  홈에서 뒤로가기를 한 번 더 눌러야 종료될 수 있음(PR-C #35 리뷰 포인트). 카카오/로그인 핵심 기능이라 별도 브랜치·PR.

## 배포 기록 (2026-10-01)

- (2026-10-02) PR #42 PR-A 영상 Storage 직접 업로드 — 병합 `bae6df1` · 배포 run 36967938152 성공(약 1분 19초). PR 프리뷰 배포 없음(배포는 main push만) → 운영에서 시험.
- (2026-10-02) PR #41 번호 표시 통일·추천 목록 번호 가리기 — 병합 `d5f5e78` · 배포 run 36964863033 성공.
- (2026-10-02) PR #40 F-2 거래 연결 DB — 병합 `60646c0` · 배포 run 36948686002 성공. 운영 SQL은 merge 전 대표 실행(E2-backup·E2 생략, 위 F-2 항목).
- PR #39 매물 폼 재배치 2차 + 푸터 "JumpX Inc." — 병합 `0ec592e` · 배포 run 36837013333 성공.
- PR #38 F-1 리드 보안 — 병합 `ffc23aa` · 배포 run 36834546494 성공.
- PR #37 푸터 점프엑스 심볼 + 통신판매업 신고번호 — 병합 `7eb809e` · 배포 run 36829390731 성공.
- PR #36 매물 폼 가로 넘침 + 재구성 — 병합 `e49b2a6` · 배포 run 36828519187 성공. 안드로이드 실기기 확인 필요(date 칸 폭은 데스크톱에서 재현 안 됨).
- PR #34 PR-B 매물 등록 폼 UX — 병합 `56353a0` · 배포 run 36822399761 성공 (SQL ② 실행 뒤). 운영 화면 코드에 새 문구 포함 확인(로그인 없이), 화면 표시는 대표 확인.
- PR #35 PR-C 안드로이드 뒤로가기 — 병합 `5957964` · 배포 run 36821144848 성공.
- 운영 SQL 실행(대표, 2026-10-01): ① `20261001_push_tracking.sql` → 확인 new_cols 5 · fk 1 / ② `20261001_deal_form_fields.sql` → 확인 new_cols 5 · checks 2 · anon_expiry true · anon_storage true · anon_seller false.
- PR #33 PR-A 푸시 구독 관리·매물명 검사 — 병합 `98ca8f6` · 배포 run 36822109650 성공 (SQL ① 실행 뒤).

## 최근 작업 (2026-10-01) — PR-B: 매물 등록 폼 UX (브랜치 `feat/deal-form-ux`, PR-A 브랜치 위에서 시작)

- 관리자 DealForm·/sell 공통. 순서: 재고 총수량(+단위) → 최소주문수량(오른쪽에 "kg 이상", 일괄이면 숨김) → 단가 기준 → 판매 단가(필수, 왼쪽)·정상 단가(선택, 오른쪽, 아래 "○% 할인으로 보여요").
  "총 수량" → "재고 총수량"(문구·서버 메시지). 판매가 ≥ 정상가 안내·확인 유지. 할인율 80% 이상이면 확인 후 저장("정상가를 다시 확인해 주세요…", 서버 422 `warnings.price`).
- 포장 단위·규격·원산지: 자유 입력 + 예시 칩/datalist (`src/lib/dealFields.ts` 예시 목록 한 곳, `src/components/DealFormInputs.tsx`).
- 보관 조건(상온/냉장/냉동 버튼)과 소비기한(날짜) 분리 — 새 컬럼 `storage_type`·`expiry_date`(deals·seller_requests). 재고 유형 "소비기한 임박"이면 소비기한 필수(폼·서버 400 `field:"expiryDate"`).
  예전 `storage_condition`은 그대로 두고 새 칸이 비면 화면에 표시. 새 칸으로 저장할 때도 예전 칸에 "냉동 · ~2026.10.20까지"를 같이 남김.
- /sell에 정상 단가 추가 → `seller_requests.original_price`, 승인 시 관리자 폼으로 이어받음(보관·소비기한도). 예전 신청 승인은 "신청서 기존 입력" 안내 + 그대로 저장.
- 상세: "보관 ❄️ 냉동" · "소비기한 ~2026.10.20까지" 행. /deals 카드·홈 미리보기: "⏰ 소비기한 ~2026.10.20까지". 푸시 본문은 그대로.
- 글자: 매물 등록 폼만 입력 16px·라벨 15px 굵게·안내 14px·버튼/칩 15px (`DEAL_*` in FormField.tsx). buy 등 다른 폼은 그대로. /sell 하단 고정 등록 버튼(공용)은 그대로.
- SQL: `supabase/migrations/20261001_deal_form_fields.sql` — **2026-10-01 대표 운영 DB 실행 완료**(new_cols 5 · checks 2 · anon_expiry/storage true · anon_seller false). 컬럼 5개(null 허용·기본값 없음, backfill 없음) + deals 새 컬럼 anon·authenticated select 권한(컬럼 단위 권한이라 필수).
  SQL 전 배포돼도 동작(조회는 새 컬럼 빼고 다시, 저장도 빼고 다시 — 판매 신청의 정상 단가는 설명 끝에). 순서: SQL → 확인 쿼리 → merge.
- 확인: 로컬 dev + 가짜 Supabase — API 20/20, 브라우저 375·1920 38/38, SQL 전(가짜 서버가 새 컬럼 거부) 4/4 + 홈 미리보기.

## 최근 작업 (2026-10-01) — PR-A: 푸시 구독 관리 [10] + 매물명 검사 [11] (PR #33, 브랜치 `feat/push-and-title-guard`)

- **[10] 푸시 구독 관리**: MY 알림 카드에 "이 기기: 안드로이드 크롬 · 마지막 알림 …" + [이 기기 알림 끄기](`/api/push/unsubscribe` — 본인 그 기기 구독만 삭제).
  발송 실패 403도 죽은 구독으로 삭제(410·404와 같이, 500 등은 유지). 브라우저 구독 키 ≠ 현재 VAPID 공개키면 앱 열 때(ActiveDayPing)·MY 카드에서
  자동 재구독(옛 endpoint 삭제). 발송 성공 시 `push_subscriptions.last_success_at`, 구독 저장 시 `user_agent`. `notification_logs`에
  `subscription_id`·`error_code`·`error_message`. 새 컬럼이 없어도 코드가 동작(없으면 빼고 다시 저장).
  - SQL: `supabase/migrations/20261001_push_tracking.sql` — **2026-10-01 대표 운영 DB 실행 완료**(new_cols 5 · fk 1). 순서: SQL 실행 → 확인 쿼리(new_cols=5, fk=1) → 머지.
- **[11] 매물명 검사** (`src/lib/titleGuard.ts` 한 곳, 관리자 폼·/sell·두 API 공통): 정리(앞뒤 공백·연속 공백·관리자 "[테스트] " 띄어쓰기),
  막기(빨강·서버 400 `{error, field:"title"}`): 2자 미만·60자 초과·숫자/기호만·연락처/링크/메신저 ID·회원 폼 "[테스트]".
  확인 후 저장(주황·서버 422 `needsConfirm` → [확인했어요 · 그대로 저장] → `confirmWarnings:true`): 자음·모음만, 같은 글자 4번+, 이모지 3개+,
  과장 표현(`EXAGGERATION_WORDS`), 같은 판매자 같은 이름 진행 중 매물. 설명의 연락처·링크는 경고만. 칸 바로 아래 안내 + 첫 문제 칸으로 스크롤.
- 확인: 로컬 dev + 가짜 Supabase·가짜 푸시 서버 — API·푸시 38/38, 브라우저 MY 카드 3/3, 두 폼 빨강/주황/그대로 저장 UI 확인.
  미확인: 매물 푸시 실패 시 notification_logs error_code 기록(테스트 시각이 야간 보류라 매물 푸시가 보류됨 — 공지·관리자 경로로 확인).
- 카카오 로그인(`signInWithOAuth('kakao')`) 코드 없음 — 주석 3곳만 남음.

## 최근 작업 (2026-10-01) — L-8: 관리자 진행 중 매물 [마감] 버튼 (PR #32, 머지 `dde8015`, 배포 run 36808090081 성공)

- 진행 중 매물 카드: [✏️ 수정] [⏹ 마감] [🗑️ 삭제(최고관리자에게만 보임)]. [마감] → 확인 → `status: "closed"`(manage PATCH 허용값) →
  진행 중 목록에서 빠짐(매물 상세·/deals 지난 매물에 "마감됨"으로 조회), 안내는 대시보드 토스트(카드가 사라져도 보이게). 관리자·최고관리자 모두 가능.
  펼친 화면의 "조기 마감"도 같은 동작. 서버가 감사 로그 `deal_close`(제목·이전 상태) 기록 — 이미 closed면 기록 안 함.
- 삭제 버튼 노출은 로그인 때 받은 역할 기준(화면) — 역할이 바뀌면 다시 로그인해야 버튼이 맞게 보임. 서버는 요청마다 DB 역할로 막음.
- 확인: 로컬 dev + 가짜 Supabase — 관리자 카드 버튼 [수정·마감], 마감 후 목록에서 빠짐·DB closed·deal_close 1건(관리자), 최고관리자 카드 [수정·마감·삭제].

## 최근 작업 (2026-10-01) — PR-C: 안드로이드 뒤로가기 (브랜치 `fix/android-back`, main 기준)

- 조사: 하단 탭·로고·해시 링크(/mypage#referral·#alerts)가 전부 Link push라 탭을 누를 때마다 기록이 쌓였고, 시트·모달은 기록이 없어 뒤로가기가 모달 대신 페이지를 떠났음.
  /deals 카테고리·지역·정렬·진행중/지난 매물은 원래 상태값만(기록 없음). 홈 루트 종료 처리 없음.
- 하단 탭·로고·해시 이동·홈 카테고리 칩 = `TabLink`(src/components/TabLink.tsx → src/lib/appNav.ts `navTab`):
  홈에서 나갈 때만 push(뒤로 = 홈), 탭끼리는 replace, 홈으로는 쌓인 만큼 되돌아감(`goHome` → history.go) — 홈에서 뒤로 = 앱 종료.
  공유 링크로 바로 들어와 홈을 안 거친 경우 홈은 replace. 상세·buy·sell ← 버튼의 "기록 없음" 처리도 goHome, 추천 내역 ←는 진짜 뒤로.
- 매물 상세 진입 등 화면 들어가기는 그대로 push.
- 시트·모달 = `useBackToClose`(src/lib/useBackToClose.ts): 열면 기록 1개(같은 주소 pushState), 뒤로가기 = 그 모달만 닫기, 버튼으로 닫으면 기록 되돌림.
  적용: 사진 뷰어(상세·회원 홈), JumpX 미리보기, QR, 설치 안내 2종, 인앱 브라우저 안내, 견적함, 처리방침 시트, 알림 켜기 동의 시트, /deals 카테고리·지역 패널.
  재동의 시트(ConsentGate — 닫을 수 없음)·온보딩/재방문 전체 화면(홈)·로그인 비밀번호 권유 시트는 제외.
- AppShell: 같은 주소 popstate(모달 닫기)에 "뒤로가기 플래그"가 남던 문제 수정, replace 이동은 이동 횟수에 안 셈.
- 확인: 로컬 dev + 가짜 Supabase, 브라우저 뒤로가기(=안드로이드 뒤로) 19/19 — 탭 4번 후 뒤로 = 홈 → 뒤로 = 앱 밖, 바로 진입 후 홈 탭 → 뒤로 = 앱 밖,
  상세 사진 뷰어 뒤로 = 뷰어만, 카테고리 패널 뒤로 = 패널만, 해시 탭 반복해도 기록 그대로.
- 남은 것: 로그인·가입 완료 후 이동(router.push)은 로그인 화면이 기록에 남음 — 핵심 기능이라 이번엔 안 건드림(로고 링크만 TabLink).

## 최근 작업 (2026-10-01) — 배포 실패 복구: VAPID 키 lazy 초기화 (PR #31, 머지 `f2dca21`)

- **배포**: Deploy run 36801642439 success, 커밋 `f2dca21` — ① 코드·새 ADMIN_SESSION_SECRET(64자) 이 배포부터 적용(기존 관리자 세션 로그아웃).
- **운영 확인 (2026-10-01, 대표)**: 번호+비밀번호 관리자 로그인 성공, 감사 로그 login_success·members_list_view·interests_list_view 기록,
  PC 테스트 푸시 수신 → **Sensitive VAPID 키가 런타임에 주입됨 확인**.
- **① 마이그레이션 6번 운영 실행 완료**: 예전 `verify_admin_login(text)` 삭제(old_fn false · new_fn true).

- **증상**: PR #30 merge(`727418b`) 후 배포 run 36800475722 build 실패 — `Vapid private key must be a URL safe Base 64`. 운영은 PR #29 배포 그대로 유지.
- **원인**: 대표가 `VAPID_PRIVATE_KEY`·`ADMIN_SESSION_SECRET`을 Vercel Sensitive로 전환 → GitHub Actions의 `vercel pull`로는 값이 비어 내려옴.
  Vercel 문서: Sensitive 값은 "Vercel build 컨테이너 안의 build와 런타임"에서만 쓰임 — 우리 build는 Actions(컨테이너 밖)라 비고, 배포된 함수(런타임)엔 주입됨.
  sendPush.ts가 모듈 로드 때 `setVapidDetails`를 호출해 build 중 페이지 데이터 수집에서 예외.
- **수정**: VAPID는 실제 발송 직전에 1회 설정(lazy). 키가 없거나 형식이 틀리면 발송만 실패(에러 로그, 매물 알림은 notification_logs failed), build·다른 기능 영향 없음.
  `FOUNDER_ADMIN_PHONE`도 요청 때 읽게. 모듈 로드 때 예외를 내는 비밀 env는 이 둘 말고 없음(ADMIN_SESSION_SECRET·CRON_SECRET·SERVICE_ROLE·BIZINFO·JUMPX_*는 이미 요청 때 읽음).
- **확인**: 잘못된 형식·빈 값 VAPID로 로컬 build 통과, 수정 전 코드는 같은 오류로 실패(재현).
- **VAPID 키는 재생성 금지**(구독 끊김). 예전 값은 Vercel에서 다시 볼 수 없지만 런타임에는 그대로 주입됨. 로컬 `.env.local`의 키 쌍은 운영과 다름(공개키 앞자리 비교) — 복구용으로 못 씀.

## 최근 작업 (2026-10-01) — ① 관리자 역할 기반 최소판 (PR #30, 머지 `727418b` — 첫 배포 실패, 위 VAPID 수정으로 재배포)

- **보안**: `ADMIN_SESSION_SECRET` 없거나 32자 미만이면 토큰 발급·검증 모두 거부(fail-closed, "dev-secret" 대체 삭제).
  로그인 = **휴대폰 번호 + 비밀번호**(그 번호의 계정 1건만 검증, 예전엔 비밀번호만으로 맞는 첫 계정). 같은 번호 15분 5회 실패 → 15분 잠금
  (`admin_login_failures`, 성공 시 그 번호 기록 삭제), IP 제한(메모리)도 유지. 토큰에는 id·exp만, **요청마다 DB에서 이름·역할 재조회** →
  해제·역할 변경 즉시 반영. `/api/admin/notify-lead`: dealId uuid·실제 매물만, IP 10분 10회·회원 10분 5회·같은 매물 10분 1회, 토큰이 오면 관심 표시 확인.
- **역할**: `admin_users.role`에 점핑매니저 추가(최고관리자/관리자/점핑매니저). `requireRole` — 403 `{ error: "권한이 없어요", required }`.
  최고관리자만: 매물 영구 삭제(deals/manage DELETE)·공식 파트너 승인/거절(partner-requests PATCH)·긴급 공지(notices POST)·관리자 임명/해제/역할 변경.
  창업자(FOUNDER_ADMIN_PHONE) 보호 유지. **점핑매니저는 F(거래 연결) 전까지 아무에게도 지정하지 않음**(API도 최고관리자·관리자만 지정 허용).
  관리자 화면은 403이면 "최고관리자만 할 수 있어요"(버튼 숨김은 공개 후). 공식 파트너 "해제" 기능은 원래 없음.
- **감사 로그 `admin_audit_logs`**: 로그인 성공·실패·잠금, 매물 영구 삭제, 파트너 승인·거절, 긴급 공지, 관리자 임명·해제·역할 변경,
  회원·리드 목록 조회(members·interests API 호출 단위). 번호는 뒤 4자리만, 비밀번호·토큰 없음.
- **SQL — 1~5 운영 DB 실행 완료 (2026-10-01, 대표)**: 확인 조회 전부 기대값(role_ok · new_fn · anon/authenticated 실행 불가 · service_role 실행 가능 ·
  crypt_test 0 · 두 표 RLS·anon 차단 · 감사 로그 0행 · 전체 확인 7칸 true). verify 함수 search_path = public, extensions(운영 pgcrypto).
  **6번(예전 `verify_admin_login(text)` 삭제)은 대표가 ① 배포 후 번호+비밀번호 로그인 확인 뒤 별도 실행.**
- SQL 파일: `supabase/migrations/20261001_admin_roles_base.sql`(schema.sql에도 같은 내용) — 역할 제약, `verify_admin_login(p_phone, p_password)`,
  예전 `verify_admin_login(text)` 실행 권한 회수(공개 키로 호출될 수 있었음), `admin_login_failures`, `admin_audit_logs`. 배포 순서는 파일 맨 위.
- **문서**: `docs/ops/admin-emergency.md`(로그인 불가 시 SQL로 잠금 해제·비밀번호 재설정·최고관리자 지정/해제·계정 생성/삭제). CLAUDE.md 규칙 2를
  main-protect ruleset 기준으로 고침(메모리의 같은 규칙은 삭제).
- **확인**: 로컬 dev + 가짜 Supabase 서버(운영 호출 없음)로 31개 시나리오 통과(로그인·잠금·403·역할 즉시 반영·해제 즉시 401·위조 토큰·notify-lead·감사 로그),
  짧은 비밀값 fail-closed, 관리자 화면 번호 칸·403 안내.
- **운영 env (2026-10-01, 대표)**: `ADMIN_SESSION_SECRET`를 새 64자 값으로 교체·Secret 전환(다음 main 배포부터 적용, 기존 관리자 세션 전부 로그아웃),
  사용하지 않던 `ADMIN_PASSWORD` 삭제(코드 참조 없음 — README 옛 안내도 이 PR에서 수정).
- SQL 2번 블록: 실행 권한 회수는 public·anon·authenticated만, service_role은 명시 grant로 유지 — 운영 main 로그인(service_role로 예전 함수 호출)은 ① 배포 전까지 그대로 동작.
- ① 배포 후 대표가 김현정을 최고관리자로 지정 예정. 관리자 4명(최고관리자 1·관리자 3), phone 누락·형식 오류·중복 0 사전 확인 완료.

## 최근 작업 (2026-10-01) — PR용 CI (PR #29, 머지 `2b8f107`)

- **배포**: Deploy run 36791504072 success, 커밋 `2b8f107`. GitHub ruleset `main-protect`(Active): PR 필수(승인 0) + `build` 통과 필수 +
  삭제·force push 차단, 관리자 우회는 PR에서만 — 관리자도 main 직접 push 불가.

- `.github/workflows/ci.yml`: main 대상 pull_request마다 Node 24(npm 캐시) → `npm ci` → `npm run build`(필수) → `npm run lint`(continue-on-error).
  비밀값·env 없이 빌드(Supabase 미설정이면 데모 모드). 같은 PR에 새 push가 오면 이전 실행 취소.
- 저장소 보호 규칙(Require status checks: `build`)은 대표가 GitHub 설정에서 직접.

## 최근 작업 (2026-10-01) — J-2: 사업자정보 푸터 · 관리자 로그인 헤더 · 관리자 대시보드 레이아웃 (PR #28, 머지 `d0eb5a5`)

- **배포**: GitHub Actions run 36790627658 success, 커밋 `d0eb5a5`. 운영 / 푸터(비로그인, 읽기만): 회색 배경 #F2F4F6, 펼침 항목 전부·카카오톡 채널·
  보호책임자·호스팅 표시, 신고번호 줄 숨김. /admin 로그인 화면 "관리자" 라벨 확인. 💻 3단은 관리자 로그인이 필요해 대표 확인.

- **BusinessFooter(당근 스타일)**: "점프엑스 주식회사 사업자 정보 ›"(누르면 펼침·화살표 회전) · 펼침: 대표·주소·사업자등록번호·통신판매업 신고번호(null이면 숨김)·
  고객센터(+카카오톡 채널 @덤핑점핑 /chat)·이메일·개인정보 보호책임자(이름만)·호스팅 서비스 제공자(Vercel Inc.) · 항상 보임: 통신판매중개자 고지 ·
  링크 줄(이용약관·**개인정보처리방침**·English). 옅은 회색 배경 #F2F4F6 폭 전체 + 상단 구분선 + 위아래 24px, 글자 #5B6470(대비 5.4:1),
  비회원 홈은 고정 CTA 높이만큼 아래 여백. 7곳 공통(비회원 홈·회원 홈·/deals·MY·비로그인 MY·/terms·/privacy). 상호는 첫 줄로 충분, QR 없음.
- **관리자 로그인**: 🔒 대신 작은 로고 + 검은 "관리자" 라벨.
- **관리자 대시보드(레이아웃만)**: 💻 3칸 격자(행 높이가 가장 긴 카드에 맞춰져 빈칸) → CSS columns 3단 세로 흐름, 순서 관심 표시 → 판매 신청 →
  진행 중 매물 → 파트너 신청 → 실적 → 찾습니다 → 회원 → 관리자. 💻 0건 카드 한 줄("없어요"), 관리자 목록 카드 형태. 📱·자동은 기존 1열 순서.
  하단 여백 6rem + 안전 영역. ("관리자 목록 스크롤 안 됨"은 버그 아님 — 접힌 목록이 맨 아래 여백 없이 붙어 끝난 것처럼 보였음)
- **schema.sql**: `protect_member_privileged` + `members_protect_privileged` 트리거 — 2026-10-01 대표 운영 DB 실행, 운영 정의와 대조 완료(동일).

## 최근 작업 (2026-10-01) — J-1: 로그인·가입 휴대폰 번호 자동완성 버그 (PR #27, 머지 `829d284`)

- **배포**: GitHub Actions run 36787920323 success, 커밋 `829d284`. 운영 /login 번호 칸 type=tel·autocomplete=username·maxLength 없음,
  "+82 10-3441-3459" 붙여넣기 → "010-3441-3459" 표시 확인(읽기만). PR용 CI는 없음(deploy.yml은 main push만) — 브랜치 build·lint로 대신.

- **증상**: 비밀번호 로그인에서 칸에 010-3441-3459가 보이는데 "휴대폰 번호를 정확히 입력해주세요".
- **원인**: 비밀번호 관리자·자동완성이 입력 이벤트 없이 칸에 값만 채워 phone state가 비어 있었음(검증 규칙·+82 변환 문제 아님).
  덤으로 `formatPhoneTyping`이 "+82 10-3441-3459"를 앞 11자리로 잘라 "821-0344-1345"로 만들던 문제도 있었음.
- **수정**: `normalizeKoreanPhone`(auth.ts) — 하이픈·공백 제거, "+82 10-…"·"8210…" → "010…", 검증·입력칸 하이픈·+82 변환 공용,
  검증 01[016789] 10~11자리. 로그인(비밀번호·인증번호 받기)·가입(인증번호 받기)에서 누르는 순간 ref로 칸 값을 다시 읽음,
  비밀번호 칸 focus 때 번호 반영, 인증번호 받기 버튼은 형식으로 비활성화하지 않음. 번호 칸 type=tel·autoComplete=username,
  비밀번호 칸 current-password. **maxLength는 두지 않음**("+82 …" 16글자 자동완성이 먼저 잘림). 서버 전송 형식은 그대로 +8210….
- **확인**: 375px, 직접 입력·+82 붙여넣기·이벤트 없는 자동완성 3가지 × 비밀번호 로그인·OTP 로그인·가입 모두 통과(가짜 응답).
- **보류 중인 J-2**(`fix/admin-footer`): 사업자정보 푸터 당근 스타일·관리자 로그인 헤더·protect_member_privileged 기록 — 푸터 항목 보완(호스팅 제공자 등)
  + schema 함수 본문 대조 후 진행. 관리자 목록 스크롤(2번)은 375px Chrome에서 재현 안 됨 — 기기·브라우저·목록 정보 대기.

## 최근 작업 (2026-09-30) — 커밋 K: KPI 매일 저장 + 방문 기록 + 지표 정확도 (PR #26, 머지 `c0c9c8a`)

- **배포**: GitHub Actions run 36700810051 success, 커밋 `c0c9c8a`. 관리자 화면("관리자·테스트 계정 6명" 안내·KPI 기록 9/29 한 줄)은
  관리자 로그인이 필요해 Claude가 직접 못 봄 — 대표 확인 필요.

- **SQL 운영 DB 실행 완료 (2026-09-30, 대표)**: 트리거 members_protect_is_test(protect_member_columns는 그대로), kpi_excluded_phones(설립자 번호는 생략 —
  is_test로 처리), 테스트 표시 member_no 13·15·17·18·19·20(6명), cron `kpi-daily-snapshot` jobid 3, 첫 저장 2026-09-29(excluded 6 · 회원 0 · 도달 0 · 진행 매물 0).
- **kpi_daily** — schema.sql 맨 끝 커밋 K 블록: 매일 00:05 KST(`5 15 * * *` UTC) `kpi_snapshot()`이 전날(한국 날짜) 한 줄 저장.
  상태값(회원·알림 도달 가능·진행 매물·미연락 등, 실행 시점 값)과 그날 흐름값(가입·리드·알림 발송/클릭·방문 회원), 방문 회원 1일/7일.
- **제외 기준 `kpi_excluded_members`**: `members.is_test`(회원 본인 변경 불가 — 트리거 members_protect_is_test) · admin_users 번호 ·
  `kpi_excluded_phones`(설립자 번호 — admin_users에 넣으면 관리자 로그인이 생겨 별도 표). 매물은 제목 "[테스트]" 제외. 번호는 `kpi_norm_phone`으로 형식 통일.
- **방문 기록 `member_active_days`**(member_id, active_date KST, PK 둘): `ActiveDayPing`(AppShell, 관리자 화면 제외)이 로그인 세션이면
  하루 1번 `/api/active-day` → 토큰으로 회원 판별해 upsert(중복 무시). 비회원·가입 전은 기록 안 함. RLS 정책 없음(서버만), 탈퇴 시 cascade.
- **대시보드**: `/api/admin/dashboard-metrics`가 관리자·테스트 계정·[테스트] 매물을 빼고 DB count(head, exact)로 전체 회원·사업자 인증·오늘 신규가입·
  미연락 리드·재고문의 미연락·대기 판매신청·오늘 등록매물 계산. 알림 활성은 구독 + push_opt_out=false(kpi_daily와 같은 기준).
  뷰가 없으면(SQL 전) 관리자 번호만 제외. 화면 "KPI 기록" 표(kpi_daily 최근 30일, `/api/admin/kpi-daily`).
- **푸시 만료 구독 정리**: 발송 결과 410·404면 그 push_subscriptions 행 삭제(매물·긴급 공지·관리자 알림), 삭제 건수 로그. 다른 오류는 유지.

## 최근 작업 (2026-09-30) — 커밋 G: 비회원 동의 기록 · 90일 자동 삭제 · 문구 정리 (PR #25, 머지 `cf6093d`)

- **배포**: GitHub Actions run 36698222651 success, 커밋 `cf6093d`. 운영 /privacy에 "수집일로부터 90일 후 자동 삭제"·국외 이전 비고(서울) 표시, "상담 종료 후 30일" 없음.

- **비회원 동의 기록**: `/api/quick-interest`·`/api/buy-requests`가 `privacy_consented_at = now()`, `privacy_consent_version = TERMS_VERSION('2026-10-07')` 저장
  (컬럼은 운영 DB에 이미 있음).
- **90일 자동 삭제 — 운영 DB 실행 완료 (2026-09-30, 대표)**: cron `purge-nonmember-contacts` active · nullable 4 · 함수 실행 권한 anon·authenticated false ·
  카운트 합계 변화 없음(interest 3 · quick_lead 2). schema.sql 맨 끝 커밋 G 블록: quick_leads 전체·buy_requests 중 member_id 없는 행의 연락처를
  수집일(created_at) 90일 후 null + `anonymized_at`. 행·구매 희망 내용·동의 기록은 남김. `purge_nonmember_contacts()`(security definer,
  anon/authenticated 실행 불가) + pg_cron `purge-nonmember-contacts` 매일 03:10 KST(`10 18 * * *` UTC). phone·contact_phone NOT NULL 해제 포함.
  - 카운트 트리거(interest_count·quick_lead_count)는 `after insert or delete`만 → update(연락처 비우기)로는 줄지 않음.
  - admin_category_kpis의 actor_key('q:'‖phone·'b:'‖contact_phone)는 최근 7일 활동자 수에만 쓰여 90일 지난 행 영향 없음.
  - 탈퇴 시 번호 마스킹(`/api/unsubscribe`)은 like 조회라 null 행은 자연히 제외.
  - 관리자 화면: 비운 행은 "연락처 삭제됨 (수집 90일 경과)" 표시(구매 희망 카드·관심 표시 목록).
- **문구 90일 통일**: 비회원 폼 동의 "보유: 수집일로부터 90일", 처리방침 "수집일로부터 90일 후 자동 삭제", consent-texts 6-4에 같은 줄.
- **처리방침 국외 이전**: 표에 "비고" 열 — Vercel "서버 실행 지역은 대한민국(서울)이며, 운영 기록 등 일부 처리는 미국에서 이뤄질 수 있어요".
- **비로그인 MY "로그인이 필요해요" 화면**에 BusinessFooter.

## 최근 작업 (2026-09-30) — 커밋 D: 운영 사업자 정보 푸터 + 문의 경로 정리 (PR #24, 머지 `f24170c`)

- **배포**: GitHub Actions run 36696038097 success, 커밋 `f24170c`. 운영 확인(비로그인, 읽기만): 비회원 홈·/deals·/terms·/privacy 하단 푸터
  (사업자등록번호·고객센터 줄·링크 줄 표시, 신고번호 줄 숨김), 단독 English 링크 없음, /en 연락처 info@jumpx.co.kr, Supabase 조회 오류 없음.
  회원 홈·MY 푸터는 로그인이 필요해 운영에서 직접 못 봄(로컬 가짜 응답으로 확인) — 대표 폰에서 한 번 확인 권장.

- **`src/lib/businessInfo.ts`**: 상호·대표·사업자등록번호·주소·고객센터(070-4006-0890 / info@jumpx.co.kr / 카카오톡 채널 `/chat`, 검색 ID @덤핑점핑)·
  개인정보 보호책임자·호스팅. 통신판매업 신고번호 `mailOrderNo`는 null → 푸터에서 줄 숨김(신고 후 값만 넣으면 표시). 계좌·법인번호·팩스 없음.
- **`BusinessFooter`**: 기본 접힘 "점프엑스 주식회사 사업자 정보 ▾" + 항상 보이는 "이용약관 · **개인정보처리방침** · English", 펼치면 전체 항목 +
  "덤핑점핑은 판매자와 구매자를 연결하는 서비스로, 거래 당사자가 아닙니다." 1280px 이상(xl)만 채널 QR(api.qrserver.com — 추천 QR과 같은 방식). 글자 13px.
  위치: 회원 홈·비회원 홈·/deals·MY 맨 아래, /terms·/privacy 하단. 회원·비회원 홈의 단독 English 링크는 푸터로 이동(제거).
- **문의 경로 통일 (`ContactLinks`)**: 카카오톡 채널 채팅·전화·이메일. `/unsubscribe`(예전 /support 오연결)·`/sell` 비회원 안내에 적용.
  채널 추가(공지 소식)용 `/friend` 링크(KakaoChannelButton·가입 화면)는 문의 목적이 아니라 그대로.
- **확인 (Playwright·가짜 응답)**: 390px·1280px 6개 화면 — 접힘/펼침 문구, 신고번호 줄 숨김, 최소 13px, 하단 탭·고정 버튼과 겹침 없음, QR은 1280px만.
## 최근 작업 (2026-09-30) — 커밋 E: 판매자 표시 (PR #23, 머지 `6dbe813`)

- **기준**: 약관 제2조 7호·제10조 3항·제12조 4항, consent-texts 7-2. 공개 시점 매물은 모두 중개(대리 게시) — "회사 직접 판매" 선택지 없음.
  상수·판정은 `src/lib/sellerDisplay.ts` (`resolveSellerDisplay`·`publicSellerName`·`isReservedSellerName`).
- **매물 상세 판매자 칸 항상 표시**: 상호 공개면 상호, 그 외(비공개·값 없음·예전 임의 이름) "비공개 판매자 · 점핑매니저가 연결해드려요".
- **임의 번호 이름 폐지**: `maskedSellerName`("{카테고리} 판매자 #NNNN") 삭제 → "비공개 판매자". 기존 값 바꾸는 SQL은 schema.sql 커밋 E 블록 ①.
- **관리자 "판매자 표시"**(`SellerDisplayPicker`): 대리 게시(비공개, 기본) / 대리 게시(상호 공개 + 상호 입력). 새 매물·판매신청 승인
  (신청서가 공개+업체명이면 상호 공개로 시작)·진행 중 매물 수정(manage PATCH `sellerPublic`·`sellerCompanyName`). 관리자 입력은 사칭 검사 예외.
- **판매 신청 폼**: 업체명·"업체명 공개 설정 (기본: 비공개)"을 "상세 정보 추가" 밖으로, [필수] 판매자 확인 사항(7-2 전문) 체크.
  `/api/seller-requests`는 `sellerTermsAgreed` 필수(400 `sellerTerms`) → `member_consents`에 seller_terms(source `sell`) 기록 후 신청 저장,
  `is_anonymous`는 명시적 공개(false)만 공개. 상호에 점프엑스·jumpx·덤핑점핑·dumpingjumping(대소문자·공백 무시) → 400 `companyName`.
- **seller_member_id 공개 조회 차단**: 매물 상세·MY 쪽지 조회에서 컬럼 제거, 컬럼 권한 SQL(블록 ③). service role(관리자 API·푸시·서버)은 영향 없음.
  쪽지(`MESSAGES_ENABLED=false`)를 다시 켤 땐 판매자 판별·보내기를 서버 API로(주석의 messages_insert_valid 정책도 이 컬럼을 읽음).
- **본문 없는 요청 401**: `/api/upload`·`/api/seller-requests`가 본문 없음·형식 오류에 500 → 401 (운영 확인에서 발견, 별도 커밋).
- **배포**: GitHub Actions run 36695104244 success, 커밋 `6dbe813`. 운영 확인(읽기만): 본문 없는 비로그인 POST `/api/upload`·`/api/seller-requests` → 401,
  마감 매물 상세 판매자 칸 "비공개 판매자 · 점핑매니저가 연결해드려요".
- **SQL — 운영 DB 실행 완료 (2026-09-30, 대표)** — schema.sql 맨 끝 커밋 E 블록:
  ② `member_consents.source`에 `sell` (merge 전 실행, check 제약 2개 확인)
  ① 임의 이름 → "비공개 판매자": 대상 5건(모두 closed) → 그룹 결과 1줄(비공개 판매자·true·5)
  ③ `deals` select 권한을 seller_member_id 제외 컬럼만: has_column_privilege false·false·true·true.
  ③ 이후 운영 읽기 점검(비로그인): 비회원 홈·/deals(진행 중·지난 매물)·지난 매물 상세·공유 미리보기(og:title 정상)·sitemap.xml 모두 200,
  Supabase 조회 오류·permission denied 없음. 되돌리기: `grant select on public.deals to anon, authenticated;`
  **주의: deals에 새 컬럼을 추가하면 anon·authenticated에 select 권한을 따로 줘야 화면에서 읽힘.**
- **확인 (Playwright 390px·가짜 응답)**: 상세 판매자 칸 4경우, 판매 폼(기본 비공개·7-2 전문·미동의 차단·전송값), 관리자 새 매물·수정 PATCH·승인 prefill,
  로컬 서버 본문 없음·토큰 없음 401.

## 최근 작업 (2026-09-30) — 커밋 H: 동의 상태 표시·확대 안내·판매 신청 회원 전용·업로드 인증 (PR #22, 머지 `8cf2f41`)

- **배포**: GitHub Actions run 36692102850 success, 커밋 `8cf2f41`. 운영 확인(읽기만, 본문 없이 비로그인 POST):
  `/api/upload`·`/api/seller-requests` 모두 **500** — 인증 전에 본문(formData/json)을 읽다 실패. 인증 없는 요청은 거부되지만
  401이 아님 → 본문 읽기 실패 시 401을 돌려주도록 커밋 E 브랜치에서 수정.
- **판매 신청은 회원 전용 (대표 결정 (d))**: `/sell`은 비회원(로그인 안 함·가입 전=members 행 없음)이면 폼 대신
  `SellGuestNotice` — "판매 신청은 회원만 할 수 있어요 / 휴대폰 인증 1분이면 가입할 수 있어요" + [로그인·가입]
  (`/login?returnTo=/sell`, 가입으로 넘어가도 returnTo 유지) + "가입이 어려우면 점핑매니저에게 문의하세요" →
  카카오톡 채널 홈(`https://pf.kakao.com/_xcFZrX`). 별도 1:1 상담 창구·전화번호는 없음.
  `/api/seller-requests`는 회원 토큰 필수(없음·무효·members 행 없음 → 401), `seller_member_id`는 토큰의 회원.
- **작성 중 내용 유지**: `/sell` 입력값·올린 사진/영상 URL을 sessionStorage `dj_sell_draft`에 보관(매니페스트 표 제외),
  신청 중 401(세션 끊김)이면 안내 화면으로 바꾸고 로그인 후 돌아오면 복원. 접수 완료 시 삭제.
- **`/api/upload` 인증**: 회원 토큰(authFetch) 또는 관리자 `x-admin-key`(checkAdminAuth) 없으면 401.
  사진 JPG·PNG·WEBP·GIF 20MB, 영상 MP4·MOV·WEBM·3GP 25MB, 확장자는 형식에서 결정. 회원 사진 한도는 토큰 회원 기준,
  관리자는 최대치. 업로드 호출은 `src/lib/uploadClient.ts` — `ImageUploader`·`VideoUploader`에 `adminKey` prop
  (관리자 화면 5곳 전달), 회원 화면·MY 프로필 사진은 authFetch.
- **MY 푸시 카드**: 구독 중인데 `deal_alert_ad` 동의가 없으면 "동의 필요"(주황) + [동의하고 알림 받기](source mypage),
  초록 "알림 받는 중"은 구독+동의 모두일 때만. **긴급 공지 토글**: 동의 없으면 흐리게·비활성 + 안내(값 유지).
- **확대 안내**: 매물 상세 첫 방문 1회 `ZoomTip`(localStorage `dj_zoom_tip_seen`), 사진 전체 화면 열 때 2.5초 안내,
  PhotoViewer 두 손가락 시작에서 preventDefault(가로 넘기기가 먼저 잡히는 경우 방지) + iOS gesture* 차단.
- **회귀 확인 (Playwright·가짜 응답, 운영 DB 요청 없음)**: 회원 판매 신청+사진(토큰), 초안 복원·401 시 유지·완료 후 삭제,
  관리자 매물 등록 사진·영상·긴급 공지 사진(x-admin-key), 프로필 사진(토큰), 실제 로컬 서버에서 비회원 업로드·위조 관리자 키·
  비회원 판매 신청 → 401. **실기기 확인은 배포 후** (알림 카드 3상태, 핀치 확대, 회원 판매 신청 1건).
- 기존 경고(이번 범위 밖): `ImageUploader`가 setItems 갱신 함수 안에서 부모 onChange를 불러 React
  "Cannot update a component while rendering" 콘솔 경고 — 동작엔 문제없음.

## 최근 작업 (2026-09-30) — 커밋 A: 푸시 발송 보안 + 매물 상태 검증 (PR #19, 머지 `957620f`)

- **`/api/push/send` 삭제**: 인증 없이 매물 id만 알면 구독자 전원에게 재발송 가능했음. 코드 내 호출처 없어 라우트 제거
  (중간 커밋에서 관리자 인증을 붙였다가 삭제로 결정). 매물 알림은 관리자 등록(`/api/admin/deals` POST) 시
  `sendDealPush` 직접 호출 1회뿐 — 수동 재발송 경로 없음.
- **`sendDealPush` 발송 조건**: 매물을 다시 조회해 `status = 'active'`이고 `closes_at`이 지나지 않았을 때만 발송,
  아니면 `[sendDealPush] skip …` 로그 + `{ sentCount: 0, total: 0, skipped }`. 마감 시간을 과거로 등록하면 알림 안 나감.
- **`/api/admin/deals/manage` PATCH**: `status`는 `active`·`closed`만 허용, 그 외 400 `{ error, field: "status" }`.
  `sold_out`은 사용처 없어 제외.
- **`deals.status` DB 제약 — 운영 DB 실행 완료 (2026-09-30, 대표)**: ① 기존 값 closed 5건 → ② `set not null` →
  ③ `deals_status_check (status in ('active','closed'))` not valid → validate 통과. status 값을 늘리려면 이 check와
  manage API의 `DEAL_STATUSES`를 같이 바꿀 것.
- **실기기 확인**: merge 후 첫 실매물 등록으로 진행 (알림 1회 수신 + 조기 마감 동작).
- **2026-09-30 조사 메모 (미착수)**: 가입 화면 약관·마케팅 동의가 DB에 저장되지 않음(동의 시각 없음, 마케팅 동의 =
  카카오 채널 토글 `kakao` 초기값 true), 푸시 본문에 "(광고)"·수신거부 안내 없음, 21~08시 발송 제한 없음.
  → 푸시 쪽 3개는 아래 커밋 B(PR #20)로 해결. **동의 저장(컬럼·시각)은 아직 미착수.**

## 최근 작업 (2026-09-30) — 커밋 C: 수신 동의 기록·가입/알림 켜기·약관·처리방침 (PR #21, 머지 `b10a9c8`)

- **배포**: GitHub Actions run 36685603805 success, 커밋 `b10a9c8`. 운영 확인(읽기만): `/api/cron/morning-push` 인증 없이 → 401,
  `x-vercel-id: icn1::icn1::…` → **함수 실행 지역 icn1(서울)** 확인. `/terms`·`/privacy` 200(약관 제1조~부칙, 처리방침 국외 이전·Twilio 표시).
- **운영 DB SQL 실행 완료 (2026-09-30, 대표)**: `member_consents` + `member_consent_latest` 뷰(tables 2 · RLS true · policy 1 ·
  security_invoker=true · rows 0), 비회원 동의 컬럼 `quick_leads`·`buy_requests`의 `privacy_consented_at`·`privacy_consent_version`(4개).
- **`member_consents`**: 동의/철회를 한 줄씩 추가만(수정·삭제 없음), 타입별 최신은 `member_consent_latest` 뷰. RLS 본인 조회만,
  기록은 `/api/consents`(토큰→회원 id, 약관 버전 `2026-10-07` 서버 상수). consent_type 8개: tos·privacy·eligibility(필수) /
  deal_alert_ad·kakao_marketing(선택) / night_ad(예약)·seller_terms(커밋 E)·biz_info(공개 후). 상수·문구는 `src/lib/consent.ts`.
- **문구 기준**: `docs/legal/terms-2026-10-07.md`(약관 전문, `/terms`가 빌드 때 렌더링), `docs/legal/consent-texts-2026-10-07.md`(동의 문구·처리방침 수정안).
  원본 파일은 이후 에디터가 역슬래시 이스케이프로 다시 저장했지만 문구 동일 — 커밋된 판 유지(대표 결정).
- **발송 대상**: sendDealPush·sendNoticePush는 `deal_alert_ad` 최신 agreed=true 회원만 → **기존 회원은 재동의 전까지 알림 안 감.**
  동의 조회 실패는 `consent_error`로 발송 중단(push_sent_at 선점 전).
- **가입**: [필수] 이용약관(/terms)·개인정보(보기 → 수집·이용 전문 시트)·"사업 목적으로 이용하며, 만 14세 이상입니다"(eligibility),
  [선택] 매물 알림·카카오톡 채널 소식(기본 false). 앱 푸시 필수 조건 제거, 카카오 채널 추가 토글은 동의와 분리(기본 꺼짐).
- **알림 켜기**(PushStatusCard): 매물 알림 동의 없으면 동의 시트 → 저장(push_enable)과 구독을 같은 클릭에서 시작.
- **재동의**(ConsentGate, AppShell): tos·privacy·eligibility 중 하나라도 기록 없으면 닫을 수 없는 시트(필수 3 + 선택 2), 거부 시 이용 불가 안내 + 로그아웃·탈퇴.
  동의/철회 안내 "…동의하셨어요 / 동의를 철회하셨어요 (YYYY.MM.DD, 덤핑점핑)" — 날짜는 저장된 created_at의 한국 날짜.
- **MY**: 매물 알림·카카오 소식 동의 토글(mypage). 매물 알림 철회 시 발송만 제외, 기기 구독은 유지.
- **비회원 폼**(매물 상세 번호만 남기기·구매 희망 등록): [필수] 개인정보 수집·이용 동의, API는 `privacyConsent=true` 필수(400 field privacyConsent).
  **동의 시각 컬럼은 생겼지만 API가 아직 안 채움 — 후속 커밋 필요.**
- **처리방침**: 수집 항목 표(비회원 관심·구매 희망 포함), 제3자 제공 신설(+ 커밋 F 전 임시 문구 "문자로 동의 받은 뒤에만 제공" — F 배포 시 삭제),
  위탁(Supabase·Vercel·Twilio·푸시 서비스), 국외 이전(Twilio·Vercel, 미국, privacy@twilio.com·privacy@vercel.com), 보유 기간
  (인증번호 기록 30일, 비회원 연락처 상담 종료 후 30일), 광고성 정보, 보호책임자(직책 없음), 시행일 2026-10-07, 맨 아래 /terms 링크.
- **`vercel.json`**: `"regions": ["icn1"]` + 아침 8시 cron.
- **남은 것**: 비회원 동의 컬럼 채우기, "상담 종료 후 30일" 자동 삭제(종료 시각 기록 + pg_cron) 미구현, icn1 전환 뒤 국외 이전 표의 Vercel 줄 유지 여부 판단,
  기존 회원 재동의 안내(공지 여부), 판매자 표시 후속은 커밋 E(관리자 직접 등록 표시·임의 이름 규칙·seller_member_id 공개 차단), 연결 동의는 커밋 F.

## 최근 작업 (2026-09-30) — 커밋 B: 푸시 규칙 (광고)·수신거부·야간 보류 (PR #20, 머지 `1c4e68d`)

- **배포**: GitHub Actions run 36646944955 success, 커밋 `1c4e68d`. 운영 `/api/cron/morning-push` 인증 없이 GET → 401 확인.
- **제목·본문**: 매물 `(광고) 덤핑점핑 · 새 매물` / `{재고 유형 · }{매물명} · {할인율 · }{가격}` + 줄바꿈 + `알림 끄기: MY > 이 기기 푸시 알림`
  (할인율은 정상가 있을 때만). 공지 `(광고) 덤핑점핑 · 긴급 공지 · {카테고리}`, 본문 끝 같은 안내. sw.js 기본 제목 `(광고) 덤핑점핑`.
- **1회 발송**: `push_sent_at is null` 조건부 update로 선점한 쪽만 발송(등록 즉시·cron 공통). DB 오류는 `claim_error`로 구분(로그·미발송).
- **야간 보류**: 한국 시간 21:00~07:59 등록분은 `held`(push_sent_at 비움) → `/api/cron/morning-push`가 아침 8시 발송.
  `vercel.json` crons `0 23 * * *`(UTC 23시 = KST 08시, Pro). 인증 `Authorization: Bearer CRON_SECRET`, 값이 없거나 비면 무조건 401.
  야간에 수동 호출해도 held 유지. 관리자 매물·공지 등록 화면에 "밤 9시~아침 8시 등록분은 아침 8시에 발송돼요".
- **완료된 운영 작업 (2026-09-30, 대표)**: `push_sent_at` 컬럼(deals·urgent_notices) + 기존 행 backfill(deals_null 0, notices_null 0),
  Vercel `CRON_SECRET` 등록(Production 전용, Sensitive).
- **sw.js**: requireInteraction false, 진동 `[200,100,200]`. 문구 "즉시/바로/실시간 알려드려요" → "빠르게"(9곳, /en은 그대로).
- **확인 남음**: Vercel 대시보드 Cron Jobs에 `/api/cron/morning-push` 등록 여부, 첫 아침 8시 실행 로그(`[morning-push] deals=… notices=…`),
  첫 주간 실매물 등록 시 알림 1회·제목·본문 표시.

## 최근 작업 (2026-09-29) — 인앱 안내·가독성 2차·요청 연결·보안·/en·토큰·safe-area·재고 유형 (main 직접 커밋) + 로그인 후속은 PR #18

- **인앱 브라우저·iPhone 미설치 안내**(68b54fd, 6827b76): 카카오톡 등 인앱이면 첫 진입 하단 시트 + 주황 띠 +
  "크롬/사파리로 열기", iPhone 미설치면 홈 화면 추가 안내. 설치 배너와 역할 분리.
- **가독성 2차**(fb701aa): 섹션 제목·카드·서비스 타일·하단 탭 크기 체계. 마이페이지 견적함은 "곧 오픈" 예고 카드 +
  오픈 알림 신청(`feature_waitlist`, QUOTES_ENABLED=false).
- **입력 개선**: 연락처 "001034413459" 표시 버그(3c18251), 희망 단가 기준 단위 `hope_price_unit`(5cf8803),
  연락처 칸 사무실 번호 허용 + 매물 가격 "2,000원/kg" 단위 표시(18e93d0), buy·sell 카테고리 자동 추천 정리(8ea0553).
- **구매 요청 회원 연결**(6b65ddf): `buy_requests.member_id` + 마이페이지 "내 구매 요청".
- **보안 정리**(118d4dc, 34d27d9): 요청 테이블 공개 insert 정책 제거, `protect_member_columns` 트리거(referred_by·
  member_no·phone·사업자등록증·ref_code는 한 번 정해지면 고정) 기록. **재가입 시 추천인 보너스 +2 중복 지급 버그 수정**
  (기존 회원이면 referred_by 안 보냄). 실제 회원 6명 referred_by/보너스 영향 없음 확인.
- **영문 소개 `/en`**(85055de, 10e888b): 해외 투자자·파트너용 1페이지. 회사명 "JumpX Inc.", 로드맵 3단계.
  JumpingBid 표기는 제거(내부 ID `jumpingbid_admin_session`, sw.js 태그 `jumpingbid-deal`은 그대로 두기로 함).
- **예시 미디어**(1fc029f, 5b5a14b): 브랜드 노출·출처 미확인 파일 삭제, EXAMPLE_MEDIA_ENABLED=false. VAPID 연락처 교체.
- **토큰 만료 401 버그**(00511cd): `src/lib/authFetch.ts` — 호출 직전 최신 토큰(60초 내 만료면 갱신), 401이면
  refreshSession 후 1회 재시도, 그래도 실패면 `dj:auth-expired` → `AuthExpiredNotice`. `/api/push/status` 신설,
  PushStatusCard "다른 기기 N대에서 알림 받는 중". **로그인 필요한 API 호출은 fetch 대신 authFetch로 쓸 것.**
- **iPhone 홈 화면 앱 safe-area**(e934fda): `viewportFit: "cover"`, globals.css `--sat`/`--sab`/`--nav-bottom`,
  BottomNav `NAV_BOTTOM`. 고정 CTA가 있는 화면은 하단 여백(상세 148·홈 156·buy 148·sell/signup 168).
  JUMP X 브릿지 섹션 숨김(JUMPX_BRIDGE_ENABLED=false).
- **재고 유형 `stock_type`**(a676112): `src/lib/stockType.ts` 7종, sell 칩·관리자 폼 선택(승인 시 이어받기),
  두 API 400 `field: "stockType"`, 카드·상세·홈 배지(`StockTypeBadge`), 푸시 본문 앞에 유형.
- **로그인 개선**(b936f0e main 직접 · 후속 98ad01a는 **PR #18**, 2026-09-29 병합 · 머지 커밋 `b7be300`): 마지막 로그인 방식 기억(`dj_login_method`), 탭별 14px 안내, 비밀번호 탭
  [인증번호로 로그인](번호 유지), 비밀번호 로그인 실패 시 한 문구로 안내(번호별 "비밀번호 없음"을 알려주면 회원 여부가
  드러나서 구분 안 함), 인증번호 로그인 직후 비밀번호 없으면 권유 시트 1회(`dj_pw_prompt_dismissed`, returnTo 유지).
  보유 여부는 서버 `app_metadata.has_password`(`/api/auth/password-status`, `/api/auth/mark-password`) —
  마이페이지 비밀번호 설정·비밀번호 로그인 성공 시 표시. 번호는 010-1234-5678로 보이고 저장·전송은 숫자만.
- **다음 할 일**: 국내산갈치(84b0b35c) 테스트 매물 마감 처리, 실제 iPhone 홈 화면 앱에서 safe-area 한 번 확인,
  비밀번호 설정→로그아웃→비밀번호 로그인 흐름 프로덕션 확인. 운영 DB에 테스트 계정·행을 만드는 확인은 사용자에게 먼저 물어볼 것.

## 최근 작업 (2026-09-28, 2차 세션) — 푸시·보안·정식 주소·회원 홈·가독성 (전부 main 직접 커밋)

- **푸시 알림 켜기**: 마이페이지 `PushStatusCard`(꺼짐/차단/비정식 주소/켜짐), 권한 요청은 버튼 클릭 안에서만.
  기기에 구독이 있으면 조용히 1회 재저장. `/api/push/subscribe`는 Origin이 정식 주소/localhost일 때만,
  회원 id는 access token에서(예전엔 body memberId를 믿었음). `explicit` 플래그 + `members.push_opt_out`
  (SQL 실행 완료): "알림만 끄기"한 회원은 조용한 재저장 안 됨, sendDealPush/sendNoticePush에서도 제외.
- **`/api/unsubscribe` 보안**: 로그인 필수(토큰), 알림 끄기(push_off)와 탈퇴(withdraw, confirm 필수) 분리.
  탈퇴 시 FK(cascade 없음: referred_by, seller_member_id) 먼저 비우고, 판매신청·구매요청·비회원 리드 연락처
  마스킹(`010-****-****`), OTP 로그 삭제, auth 계정 삭제. OTP 로그 30일 정리 pg_cron 잡(jobid 1) 실행 완료.
- **정식 주소 통일**: `src/lib/siteUrl.ts`(SITE_URL). `src/proxy.ts`가 프로덕션 `*.vercel.app` 페이지 요청을
  www로 308(/api, /_next, /sw.js 제외 — 운영 curl로 308 확인). sw.js는 vercel.app에서만 알림 클릭 시 정식 주소로.
  공유·QR·OG·robots·sitemap 전부 SITE_URL. **SITE_URL 바꾸면 public/sw.js 상수도 같이 바꿀 것.**
- **쪽지 기능 숨김**: `src/lib/features.ts` MESSAGES_ENABLED=false, messages insert 정책 전부 drop(실행 완료).
  재오픈 절차는 schema.sql "[재오픈용]" 주석(insert 정책·read_at update 정책·새 쪽지 알림).
- **매물 표시**: `formatDealLocation`("대구 · 가락동"/지역만/상세만/"전국"), `NoPhotoPlaceholder`, 상세 빈 섹션 숨김.
- **줄바꿈**: globals.css `word-break: keep-all` 전역 + 문장 중간 `<br>`은 `hidden sm:inline`.
- **관리자 매물 폼**: 라벨·필수(*)·칸별 검증·첫 누락 칸 포커스, `/api/admin/deals` 400 `{error, field}`,
  판매신청 승인 시 카테고리/지역 기본값(첫 항목) 채우기 제거. MOQ > 총수량은 sell/관리자 폼·두 API 모두 400.
- **회원 홈 = 내 조건 매물만**: 매칭 규칙 `src/lib/dealMatching.ts`(sendDealPush와 공유, 전후 발송 대상 동일 검증),
  예시 카드 규칙 `src/lib/exampleDeals.ts`. 온보딩 고정 통계(17건/41%/3분)와 "조건 넓히면 주 N건" 추정치 제거 —
  **확인 안 된 숫자는 표시 금지.** 하단 탭: 세션 확인 전 4번째 칸 자리표시, #referral일 때만 "공유" 활성.
- **가독성**: `src/lib/rem.ts` rem(px) — 인라인 fontSize·text-[Npx] 전부 rem, 최소 13px.
  **새 인라인 글씨 크기는 숫자 대신 rem(px)으로 쓸 것.** 큰 글씨 모드는 만들지 않기로 함.
- **다음 할 일**: 카카오 인앱 브라우저/iPhone 미설치 구분 안내(inapp_browser, ios_needs_install),
  국내산갈치(84b0b35c)는 카테고리·지역 기본값이 자동 입력된 테스트 매물 → 마감 처리.

## 최근 작업 (2026-09-28) — 긴급 공지(부동산·설비 처분) 신규

- **🆕 긴급 공지** (`0429ee3`, `c87e3ff`): 재고 매물(deals)과 완전히 분리된 공지판. `urgent_notices` 테이블(공개 조회 RLS)
  + `members.notice_alerts_opt_in`(기본 꺼짐, 마이페이지 토글). 관리자 화면에서 등록(등록 즉시 opt-in 회원에게 푸시)·목록·마감.
  공개 목록 `/notices`, "점핑 서비스" 타일(홈·마이페이지, 3열→2x2). SQL은 Supabase 실행 확인 후 push.
  구인/구직은 직업안정법상 신고 요건 때문에 의도적으로 제외. **부동산 공지의 중개행위 해당 여부는 별도 법률 검토 필요.**
- 기타 (2026-09-28): 비밀번호 로그인 PR #17 병합(`6465faa`), 뒤로가기 `src/lib/appNav.ts`, 온보딩 미결정 이탈자 3일 후 재노출,
  매물 사진 6장 + 브라우저 리사이즈·장당 업로드(`src/lib/resizeImage.ts`), 관리자 관심 수 회원/비회원 구분(`quick_lead_count`).
- **남은 이슈**: 영상 업로드는 15초 길이 제한만 있고 크기 축소가 없어 Vercel 4.5MB 본문 한도에 대부분 걸릴 가능성 —
  Supabase Storage 서명 업로드 URL로 직접 올리는 방식으로 바꿔야 함. 푸시 대상 id를 `.in()` URL로 넘기는 구조라 대상이
  수백 명을 넘으면 URL 길이 초과 가능(sendDealPush/sendNoticePush 공통).

## 최근 작업 (2026-09-27) — 패치 연속 적용 (전부 main 직접 커밋)

다른 세션에서 만든 `.patch`를 `git am`으로 연속 적용. 패치 내용 오류는 별도 fix 커밋으로 보정.

- **🆕 점핑파트너 (DB 변경 포함, `e6a3695`)**:
  - `/p/[slug]` 영업용 데모 스킨 — `src/lib/partners.ts` 배열에 파트너 추가(현재 `demo`만).
    기존 deals 데이터를 읽고 이름·강조색만 교체. AppShell에서 `/p/` 경로는 바텀탭 숨김.
  - `/mypage/referrals` 내 추천 회원 대시보드(목록·필터·검색 + 컨택 메모).
    `members.referral_note` 컬럼 추가 — Supabase SQL 실행 확인(REST 조회로 컬럼 존재 검증) 후 push.
    메모 저장은 `/api/my-referrals` PATCH(서버에서 `referred_by = 요청자` 검증 후 service_role 갱신).
- **🆕 공개 통계 API `/api/public-stats`** (`e9f69fc`): 인증 사업자 수만 반환. 홈 신뢰 배지는
  30개 이상일 때만 "전국 N개 사업자가 함께하는 중", 아니면 무숫자 카피. 하드코딩 "890명+"는 전부 제거.
- **공통 UI 정리**: buy/sell 헤더를 deals와 같은 구조(로고+Powered by / 라벨+로테이션 / 좌측 타이틀)로,
  하단 고정 CTA 4곳(buy/sell/signup/deal상세)을 홈과 같은 반투명 블러 카드로 통일.
  buy/sell 카테고리는 자동 추천 시 "추천됨 · 수정" 한 줄로 접힘. deals 필터는 커스텀 드롭다운.
- **카피**: "재고"→"상품" 부분 통일(홈 히어로·온보딩·카테고리 섹션·signup 1단계·buy 타이틀).
  나머지 "재고" 표기(`OnboardingIntro.tsx:88`의 "이런 재고 찾습니다", 홈 진입 카드 등)는 아직 그대로.
- **이미지**: `manager.png`/`manager-cut.png` 리사이즈+PNG8로 약 85% 경량화, `manager-cut.png`에
  흰 외곽선 추가. 색 배경 위 캐릭터는 전부 `manager-cut.png`로 교체.
- **보정 커밋에서 배운 것**: Tailwind v4에서 `fixed`와 `relative`를 같이 쓰면 `relative`가 이김
  (CSS 출력 순서) — 고정 요소에 `relative` 넣지 말 것. 한국어 큰 헤드라인은 `break-keep` 필수
  (없으면 "잡으/세요."처럼 어절 중간 줄바꿈). 홈 히어로 헤드라인은 24px — 360px 이상에서 2줄.
- **⚠️ Supabase 관리자용 RPC 권한**: `revoke all on function ... from public`만으로는 anon/authenticated의
  EXECUTE가 안 빠져서, 공개 anon 키로 `/rest/v1/rpc/admin_category_kpis`가 실데이터를 반환했음(실측).
  `admin_partner_referral_stats`/`admin_category_kpis`에 `revoke execute ... from anon, authenticated`
  추가 후 SQL 실행 → anon 42501, service_role 정상 확인. **새 security definer 함수는 반드시 두 역할에서도
  revoke하고, anon 키로 호출해 42501이 나는지 확인할 것.** (기존 `update_admin_password`는 anon 거부 확인됨)

- **카테고리 이름 정리 (DB 변경 포함)**: `냉동냉장식품`→`수산·축산물`, `농수축산물`→`농산물`.
  categories는 id로 참조되므로 rename SQL 두 줄로 기존 매물/회원 관심 카테고리 자동 반영.
  Supabase에서 SQL 실행 확인 후 코드 push(배포 순서 규칙 준수). `schema.sql` 시드도 새 이름으로.
- **하단 고정 CTA (buy/sell/signup)**: `position: sticky`가 실제론 전혀 안 떠 있었음 —
  루트 래퍼의 `overflow-x-hidden` 단독 설정이 overflow-y를 auto로 만들어 스크롤 없는 래퍼가
  sticky 기준이 됨. `fixed` + `bottom: NAV_HEIGHT`(탭바 위) + 폼 하단 여백 132px로 교체.
  **앞으로 이 앱에서 sticky는 동작하지 않는다고 보고 fixed를 쓸 것.**
- **`RotatingUrgencyTag`** 공통 컴포넌트(⏰ 기한임박 매물 → 📦 과잉재고 정리 …): deals/buy/sell/
  signup/홈(게스트 온보딩·회원 AlertInboxHome)/마이페이지에 노출. 회원 홈 헤더도 fixed로 바꾸면서
  높이를 Playwright로 실측(77.3px) → `INBOX_HEADER_HEIGHT = 78`. 헤더 문구/폰트 바꾸면 다시 잴 것.
- **`EcosystemGrid`** 공통 컴포넌트(화물배차/계산기/정부지원금 3열 타일): 홈·마이페이지. `/logistics?tab=fx`로 탭 지정 가능.
- **관리자**: 진행 중 매물 카드 → 요약 행 + [수정] 펼침, 저장 버튼 통합(재고·사진·영상), 영상 관리 추가,
  저장 실패 시 실패 토스트(응답 상태 확인). 구매요청 카드 전화번호 tel: 링크.
- **🏗 구조 변경 — 앱 폭 래퍼 이동**: 루트 `layout.tsx`의 `max-w-md` 래퍼를 `AppShell`로 옮김.
  회원 화면은 동일 클래스(픽셀 비교로 무변화 확인), `/admin`만 전체 폭을 받고 `admin/page.tsx`가
  화면별로 폭 제한(로그인·📱모드 = max-w-md, 💻/자동(≥1024px) = 최대 1200px). 관리자 PC 모드는
  지표·진행 중 매물까지만 PC 배치이고 나머지 섹션(판매자 신청/재고 찾습니다 등)은 아직 세로 나열.
- 로컬 개발 참고: `node_modules`에 `pretendard`가 빠져 있어 dev 서버가 전 페이지 컴파일 실패하던 것
  `npm install`로 해결(lockfile 변화 없음). Playwright + Chromium 로컬 설치돼 있어 렌더 실측 가능.

## 최근 작업 (2026-09-23) — 쪽지(회원간 메시지) + 매물 등록 업체명 비공개 옵션

판매자가 흥정 부담 없이 등록할 수 있게 `/sell`에 "업체명 비공개로 등록" 체크박스를
추가하고, 구매자가 판매자에게 직접 쪽지를 보낼 수 있는 기능을 신설. `seller_requests`는
비로그인도 제출 가능한 공개 폼이라, 로그인한 판매자에게만 쪽지가 켜지도록 설계
(비로그인 제출 매물은 기존 "관심있어요 · 점핑매니저 연결" 플로우 그대로 유지).

- **DB**: `seller_requests`/`deals`에 `seller_member_id`/`is_anonymous` 컬럼(+`deals`에는
  `seller_display_name`도) 추가, 신규 `messages` 테이블(RLS: 본인이 보내거나 받은 것만
  select, 본인이 sender인 것만 insert) 신설. `supabase/schema.sql` 맨 끝에 마이그레이션
  블록 추가, Supabase SQL Editor에서 실행 완료 확인함(2026-09-23).
- **sell/page.tsx**: `isAnonymous`/`memberId` state + 업체명 입력 아래 비공개 체크박스.
  체크하면 구매자에게는 실제 업체명 대신 `{카테고리} 판매자 #{4자리 랜덤}` 형태의 익명
  표시명이 노출됨(점핑매니저=관리자에게는 항상 실제 업체명 그대로 전달).
- **api/admin/deals/route.ts**: 매물 승인(`requestId` 경유) 시 `seller_requests`에서
  `is_anonymous`/`seller_member_id`/`company_name`을 먼저 조회해서 `deals`에
  `seller_display_name`(마스킹 여부 반영)까지 함께 저장. 관리자가 `requestId` 없이 직접
  등록하는 경우는 세 필드 전부 기본값(null/false) 그대로.
- **deals/[id]/page.tsx**: `seller_display_name`이 있을 때만 판매자 카드 노출, 로그인
  회원이고 본인 매물이 아닐 때만(`memberId !== deal.seller_member_id`) "💬 쪽지 보내기"
  버튼 노출 → `messages` insert.
- **mypage/page.tsx**: 쪽지함 섹션(관심 매물 ↔ 판매 등록 배너 사이) — `deal_id`+상대방
  기준으로 스레드 묶어서 표시, 스레드별 인라인 답장 입력.

### 🔴 배포 순서 사고 (2026-09-23) — 코드 먼저 push, 마이그레이션 나중에 실행

이번 작업에서 스키마 마이그레이션(`schema.sql` 새 블록)을 사용자가 Supabase SQL
Editor에서 실행하기 **전에** 코드를 먼저 main에 push해버려서, 실제로 짧은 시간 동안
프로덕션 `/api/seller-requests`가 `"Could not find the 'is_anonymous' column"` 에러로
**실제 판매 등록이 막히는 장애**가 발생했음(`vercel curl`로 직접 재현/확인). 사용자가
마이그레이션을 실행한 뒤 재확인해서 정상화됐고(`{"ok":true}` 200 재확인, 테스트로
생성된 가짜 신청 2건은 어드민 승인 없이 DB에서 직접 delete로 정리 — 실사용자에게 푸시
안 나감), 이번 건 자체는 해소·종료됐음.

**재발 방지 규칙 (앞으로 계속 적용)**: 새 컬럼/테이블을 요구하는 코드 변경은 반드시
**"SQL 마이그레이션을 사용자가 먼저 실행 확인 → 그다음 코드 push"** 순서로 진행할 것.
지금까지처럼 "코드 먼저, 마이그레이션은 나중에 안내"하는 순서는 금지 — 스키마가 걸린
작업일 때는 커밋은 로컬에 만들어두고, push 전에 반드시 마이그레이션 SQL을 사용자에게
먼저 전달하고 실행 확인을 받은 뒤에 push할 것.

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
데모용 가짜 로직(더미 인증, 즉시발행 가정 등)은 채택하지 않음.
`feature/design-v2-full` → **PR #15, 2026-09-22 main에 병합 완료(머지 커밋
`e9e54b2`), GitHub Actions 자동배포로 프로덕션(dumpingjumping.com) 반영 확인됨**
(핵심 화면 5개 — 홈/signup/sell/mypage/admin — 전부 200 + 정상 타이틀 응답
curl로 확인. 단, 이 세션엔 브라우저 접근이 없어 육안 확인은 못 했음 — 사용자가
직접 육안 확인 필요).

### PR #15 프리뷰 리뷰 중 발견/수정 (2026-09-22)

- **프리뷰 피드백 4건 반영**: 판매 등록 폼 연락처 자동 채움(로그인 회원의
  `members.phone`), 마이페이지 헤더 라벨 명확화("사업자 인증 대기중"),
  파트너 섹션 문구를 "관리할 수 있다"는 과장 없이 정직하게 수정, MY페이지
  3번째 통계 타일("추천 회원" 수, `referrals.length`) 추가.
- **🔴 회원가입 4단계 최종 제출 시 about:blank 버그 — 원인 확정, 수정 완료**:
  카카오 채널 연동 시 팝업 차단 회피용으로 빈 창을 미리 열어두는데(`window.open`),
  그 직후 `subscribeToPush()`가 브라우저 알림 권한 네이티브 다이얼로그를 기다리며
  무한정 멈출 수 있어 미리 연 창이 리다이렉트되지 못한 채 about:blank로 방치됐음
  (모바일에서는 새 탭이 즉시 전면으로 전환되므로 "쓰던 탭이 블랭크됐다"처럼 보임).
  리디자인 이전 원본 코드에도 있던 순서 문제(회귀 아님) — members upsert 성공 직후
  카카오 창을 먼저 리다이렉트시키고 푸시 권한 요청은 그 다음으로 미루도록 수정.
  사용자가 실기기로 재현 테스트 후 **해결 확인** (accounts.kakao.com 정상 이동).
- **🔴 로그인 회원용 홈(알림함)에 판매 등록 진입점 없음 — 수정 완료**: 리디자인 전
  마케팅 홈에 있던 "판매 등록" 배너가 회원용 알림함 홈(`AlertInboxHome.tsx`)으로
  분기하면서 빠졌던 걸 발견, 알림 조건 카드 아래에 `/sell` 배너로 복원.
  (`BottomNav`에는 원래부터 판매 탭이 없었음 — 확인됨.)
- **세션 소실 버그(간헐적, "이미 가입된 번호" 인증 후 mypage 세션 없음) — 낮은
  우선순위로 관찰 계속 중 (머지 후에도 유지)**: devtools 대신 localStorage 기반
  디버그 로그(`src/lib/debugLog.ts` + 전역 `DebugPanel.tsx`, `AppShell.tsx`에 마운트)로
  재현 시도했으나 정상 트레이스만 확인됨 (재현 안 됨). 코드 버그로 확정되지 않아서
  디버그 인프라는 **머지 후에도 계속 유지** — 세션 버그가 몇 차례 더 관찰돼서
  완전히 해소됐다고 판단될 때 제거. `debugLog`/`DebugPanel` 호출부는
  `signup/page.tsx`, `mypage/page.tsx`, `AppShell.tsx`, `DebugPanel.tsx`,
  `lib/debugLog.ts` 5개 파일에 한정돼 있음. **단, `DebugPanel.tsx`가 hostname이
  `dumpingjumping.com`(www 포함)일 때는 렌더링 자체를 안 하도록 가드 추가** —
  일반 사용자에게는 안 보이고, 프리뷰(`*.vercel.app`)/로컬에서는 계속 보여서
  관찰 가능. `debugLog()`의 localStorage 기록 자체는 프로덕션에서도 계속 동작.
- **휴대폰 번호 형식 검증 보강**: `sendOtp()`에만 있던 형식 검증(`/^01[0-9]{8,9}$/`)을
  `lib/auth.ts`의 `isValidKoreanPhone()`으로 단일화해서 signup 사전체크/버튼
  비활성화, sell/buy `submit()`, `/api/seller-requests`·`/api/buy-requests` 서버
  라우트까지 전부 동일 규칙 적용(이전엔 클라이언트를 우회해 직접 POST하면 형식
  검증 없이 저장 가능했음). sell 폼의 연락처 자동입력이 `members.phone` 정규화
  형식(`+8210...`)을 그대로 채워서 로그인 회원이 자동입력값 그대로 제출하면
  방금 추가한 검증에 걸리는 문제를 같이 발견 → `fromE164Phone()` 역변환 헬퍼로
  로컬 형식(`010...`) 표시하도록 수정. `/api/seller-requests`·`/api/buy-requests`를
  `vercel curl`로 직접 실행해서 정상/비정상 번호 각각 기대대로 동작하는지 확인함.
- **최종 스모크테스트(2026-09-22)**: tsc/eslint/build 전부 통과 확인. `npx eslint src`
  전체 스캔에서 `admin/page.tsx:246`(`SessionCountdown`의 `useState(expiresAt - Date.now())`,
  react-hooks/purity 에러) 1건 발견 — **git diff로 main 대비 미변경 확인, 리디자인
  이전부터 있던 기존 버그라 이번 PR 범위 밖**으로 판단, 손대지 않음. 다음에 이
  파일을 건드릴 일이 생기면 (mypage에서 이미 썼던 `dealUrgencyState()` 패턴처럼)
  `Date.now()`를 헬퍼로 감싸서 같이 고칠 것. → **다음에 할 일에 백로그 등록.**

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

- [ ] **관리자 리드 목록: 공식 파트너 리드 배지 + 상단 정렬** (10/7 공개 후 작업, 2026-09-29 백로그): "점핑매니저 우선 연결" 실구현 — 지금은 MY 문구만 있고 리드 목록은 파트너 여부로 정렬·표시하지 않음
- [ ] **관리자 목록 패널 안쪽 글자 통일** (10/7 공개 후 작업, 2026-09-29 백로그): 최근 가입 회원·판매신청·재고문의 등 패널 안 13.5·15.8px 약 52곳을 uiText 기준(라벨 14·본문 15·카드 제목 17/800)으로
- [ ] **핵심 지표에서 관리자·테스트 계정 제외 옵션** (10/7 공개 후 작업, 2026-09-29 백로그): /api/admin/dashboard-metrics의 알림 활성 회원 비율·전환율·7일 추세 계산 시 관리자 번호·[테스트] 매물/계정 제외 토글
- [ ] **목록 썸네일** (10/7 공개 후 작업, 2026-09-29 백로그): Supabase 이미지 변환(`render/image`, width 480) 적용 — Pro 요금제 필요, 변환 사용량 확인. 지금은 업로드 시 긴 변 1600px 한 벌만 있고 목록은 첫 카드 외 lazy 로딩으로만 버팀
- [ ] **회원 홈 크게 보기에도 넘기기·확대 적용 검토** (10/7 공개 후 작업, 2026-09-29 백로그): 상세는 `PhotoViewer`(넘기기·1/N·핀치 확대), 회원 홈(AlertInboxHome)은 영상 겸용 기존 보기 그대로
- [ ] **썸네일 목록 카드 배지 위치** (10/7 공개 후 작업, 2026-09-29 백로그): 비회원 홈 미리보기(56px)·회원 홈 5건 이상(64px) 썸네일 목록은 할인율·남은 시간이 글줄 안/오른쪽 위 그대로 — 넓은 카드(`DealCardMedia`: 할인율 왼쪽 위·남은 시간 오른쪽 위)와 맞출지 검토
- [ ] **PR 프리뷰 배포 워크플로** (10/7 공개 후 작업, 2026-09-29 백로그): 지금 GitHub Actions는 main push 시 프로덕션 배포만 하고
  Vercel Git 연동 프리뷰도 꺼져 있음(마지막 기록 2026-09-15) → PR 브랜치에 `vercel deploy`(--prod 없이) 워크플로 추가해 폰으로 먼저 확인할 수 있게
- [ ] **`VAPID_PRIVATE_KEY`·`ADMIN_SESSION_SECRET` Sensitive 전환** (10/7 공개 후, 2026-09-30 백로그): Vercel 환경변수 타입만
  Sensitive로 바꾸고 값은 그대로 유지(바꾸면 기존 푸시 구독·관리자 세션이 깨짐). 전환 후 재배포 → 푸시 발송·관리자 로그인 확인
- [ ] **푸시 발송 중 실패 시 남은 구독자 누락** (10/7 공개 후 재시도 설계 검토, 2026-09-30 백로그): sendDealPush/sendNoticePush는
  push_sent_at을 먼저 선점한 뒤 보내는 중복 방지 우선 구조 — 발송 도중 함수가 죽거나 시간 초과되면 남은 구독자는 다시 받지 못함
  (예: notification_logs 기준 미발송 구독자만 재시도)
- [ ] **할인율 근거 검수** (2026-09-30 백로그): 푸시·카드의 할인율(예: 36%↓)은 판매자가 입력한 정상가(original_price) 기준 —
  관리자 검수(매물 등록 확정) 때 정상가 근거(견적서·납품가 등)를 확인하는 절차/체크 항목 추가
- [ ] **admin/page.tsx `SessionCountdown` 린트 에러 (기존, 리디자인 이전부터)** (2026-09-30 백로그, 예전 :246 항목과 합침 — 지금 305행):
  `useState(expiresAt - Date.now())`가 `react-hooks/purity` 에러(렌더 중 Date.now 호출). 빌드는 통과, eslint만 실패 —
  초기값을 useEffect에서 계산하거나 mypage `dealUrgencyState()`처럼 `Date.now()`를 헬퍼로 감싸서 정리
- [ ] **deploy.yml `paths-ignore` (`*.md`, `docs/**`)** (2026-09-30 백로그): 지금은 PROGRESS.md 같은 문서만 바뀐 push도
  운영 배포가 한 번 더 돎 → 문서만 바뀐 push는 배포 생략
- [ ] **`.gitattributes` 줄바꿈 통일 (`* text=auto eol=lf`)** (보류, 2026-09-30 백로그): 저장소는 LF인데 이 PC는
  `core.autocrlf=true`라 작업 폴더가 CRLF — 작업 폴더를 그대로 비교하는 도구에서 파일 전체가 바뀐 것처럼 보일 수 있음(PR #19 확인 때 실제 변경은 2줄뿐이었음)
- [x] **컨택 메모 `referral_notes` 테이블 분리** (2026-09-27, `81a60c4`): `members.referral_note`
  노출 문제(추천받은 회원 본인이 자기 메모를 읽고 수정 가능)를 정책 없는 RLS 테이블 +
  service_role API 전용으로 해결. `schema.sql` 맨 끝 `referral_notes` 블록 Supabase SQL Editor
  실행 완료(2026-09-27) — 테이블 생성, 기존 메모 이관, `members.referral_note` 비움까지 확인.
- [ ] 비워진 `members.referral_note` 컬럼 자체는 다른 참조 없는지 한 번 더 확인 후 별도 drop
- [x] buy/sell/매물상세 뒤로가기 — `src/lib/appNav.ts`(sessionStorage에 앱 내 이동 기록, AppShell이 pathname 변경 시 기록)로
  "앱 안에서 왔으면 router.back(), 아니면 홈" 통일 (2026-09-28, `7e4f350`). 브라우저/제스처 뒤로가기(popstate) 시엔
  카운터를 줄이도록 보완(`32e2d3e`). 앞으로가기도 감소로 처리되는 등 어긋나도 항상 "홈으로" 쪽으로만 틀려 앱 밖 이탈은 없음
- [x] `create_admin_user` anon 실행 불가 확인 (2026-09-28, 제약 위반 인자로 안전하게 호출 → 42501)
- [ ] 인덱스 7개(0012) 생성 여부 — SQL Editor에서 `select indexname from pg_indexes where indexname like '%_idx';`로 확인
- [x] 약관 "보기"가 이용약관·개인정보 모두 `/privacy`로 연결됨 → PR #21(2026-09-30)에서 이용약관은 `/terms`(약관 전문), 개인정보는 수집·이용 전문 시트로 분리 완료
- [x] **`/api/upload`가 로그인 없이 누구나 호출 가능** (2026-09-27 발견) → 2026-09-30 커밋 H: 판매 신청을 회원 전용으로 바꾸고
  업로드는 회원 토큰 또는 관리자 키만 허용(401) + 형식·크기 검사
- [x] **`/unsubscribe` "고객센터(문의하기)"가 `/support`(지원사업 목록)로 잘못 연결** → 커밋 D에서 카카오톡 채널 채팅·070-4006-0890·info@jumpx.co.kr로 수정
- [x] **/en 연락처 admin@jumpx.co.kr → info@jumpx.co.kr** (2026-09-30 대표 결정, 커밋 D). 푸시 VAPID `mailto:admin@`(sendPush.ts)은 기술 설정이라 그대로
- [ ] **`deals.closed_at`** (커밋 K 백로그): 매물이 실제로 마감된 시각 — 진행 매물 수 과거 재계산·마감 소요 시간 지표용
- [ ] **대시보드 기간 전환 (오늘/7일/30일/전체)** (커밋 K 백로그)
- [ ] **연결 지표 컬럼** (커밋 F 이후, 커밋 K 백로그): 연락처 제공 동의·연결 요청·연결 완료 건수를 kpi_daily에
- [ ] **4주 리텐션·코호트 화면** (커밋 K 백로그): member_active_days 기반
- [ ] **판매자 재등록률** (커밋 K 백로그): 같은 판매자(seller_member_id)의 두 번째 판매 신청 비율
- [ ] **매물 첫 관심까지 걸린 시간** (커밋 K 백로그): deals.created_at → 첫 interests/quick_leads created_at
- [ ] **공식 파트너 "해제" 기능** (① 백로그): 지금은 승인·거절만 있음 — is_official_partner를 false로 돌리는 최고관리자 전용 API·감사 로그
- [ ] **`ImageUploader` 렌더 중 setState 경고** (2026-09-30 백로그): setItems 갱신 함수 안에서 `emitChange`(부모 onChange) 호출 →
  React 콘솔 경고. 갱신 후 useEffect로 onChange를 부르는 식으로 정리

- [ ] **쪽지/업체명 비공개 기능 — 관리자 승인 경로 자연 확인 대기** (2026-09-23):
  마이그레이션 실행 후 공개 API(`/api/seller-requests`)는 재검증 완료, 하지만
  관리자 승인(`/api/admin/deals`)이 `seller_requests`에서 판매자 정보를 조회해
  `deals.seller_display_name`을 채우는 새 로직은 실제 승인 케이스로 아직
  검증 안 됨 — 사용자 판단으로 "다음 실제 매물 승인 때 자연 확인"하기로 하고
  종료. 만약 다음 승인 때 에러 나면 `api/admin/deals/route.ts`의
  `maskedSellerName()`/`sr.seller_member_id` 부분부터 확인할 것.
- [x] **PR #15 병합 완료 (2026-09-22, 머지 커밋 `e9e54b2`)** — design-v2 전면
  리디자인. GitHub Actions 자동배포로 프로덕션 반영 확인(curl로 홈/signup/sell/
  mypage/admin 5개 화면 200 응답 + 타이틀 확인). **사용자 직접 육안 확인 아직
  안 됨** — 브라우저 접근이 없는 세션이라 이 부분만 사용자가 확인 필요
- [ ] **세션 소실 버그 관찰 계속** — 몇 차례 더 재현/관찰해서 완전히 해소됐다고
  판단되면 디버그 인프라(`src/lib/debugLog.ts`, `src/components/DebugPanel.tsx`,
  `AppShell.tsx`의 마운트, `signup/page.tsx`·`mypage/page.tsx`의 `debugLog()`
  호출부) 통째로 제거할 것. 현재는 프로덕션(dumpingjumping.com)에서는 hostname
  가드로 패널이 안 보이고, 프리뷰/로컬에서는 계속 보임
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
