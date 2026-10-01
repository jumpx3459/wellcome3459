@AGENTS.md

# 작업 규칙

1. 새 세션을 시작하면 항상 `PROGRESS.md`를 먼저 읽고 현재 상태(진행 상황, 다음에 할 일)를 파악한 뒤 작업을 시작한다.
2. **main 반영은 전부 PR로 한다 (2026-10-01, GitHub ruleset `main-protect`).** PR 필수 + CI `build` 통과 필수, 삭제·force push 차단,
   관리자도 main에 직접 push할 수 없다. 코드·SQL 기록·`PROGRESS.md` 한 줄까지 모두 브랜치 → PR → CI 초록 → merge.
   이 규칙은 전역 설정(~/.claude/CLAUDE.md)의 "main에 바로 커밋·푸시"보다 우선한다.
3. 작업 단위(기능 하나, 버그 수정 하나)가 끝나면 브랜치에 커밋한다. push·PR 생성·merge·운영 DB 실행은 대표 승인 후에 한다.
4. 큰 변경사항(새 기능 추가, 구조 변경 등)이 생기면 `PROGRESS.md`를 최신 상태로 업데이트한다(그 작업 PR 안에서).
   merge 뒤에야 알 수 있는 배포 run 기록 등은 다음 작업 PR의 `PROGRESS.md`에 넣는다.
5. 카카오 로그인, 경매/입찰 등 기존 핵심 기능을 건드리는 작업은 별도 브랜치·PR로 진행하고, 리뷰 포인트를 PR 설명에 적는다.
