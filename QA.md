# 검증 결과

2026-10-18, 로컬 `http://localhost:5173`에서 검증했습니다.

| 검증 | 결과 |
| --- | --- |
| 공지 등록, 수정, 검색, 삭제, 새로고침 후 예시 저장 유지 | 브라우저 통과 |
| 수행평가 등록, 종료, 다시 열기 | 브라우저 통과 |
| 학생 별칭 추가, 상점 부여, 이유 기록, 상점 취소 및 합계 | 브라우저 통과 |
| 외부 주소 거부, 유튜브 링크로 iframe 생성 | 브라우저 통과 |
| 학생 보기에서 편집, 삭제, 상점 부여 버튼 차단 | 브라우저 통과 |
| 데스크톱 1440px 및 모바일 390px 가로 넘침 | 없음 |
| 저장 데이터의 ID·상점 값에 HTML을 넣는 공격 | 모의 Firebase 데이터를 주입한 실제 브라우저에서 실행 차단 |
| 편집창이 열린 사이 구독 데이터 버전 변경 | 모의 Firebase 브라우저에서 저장 거부, 다른 창 변경 유지 |
| URL 파싱, HTML 이스케이프, 서울 날짜, 상점 합계 | Node 테스트 6개 통과 |
| JavaScript 구문 검사 및 Vercel 빌드 명령 | 통과 |
| 환경 변수 적용·필수 변수 누락 실패·정적 배포 파일 제한 | Node 테스트 4개 추가 통과 (전체 10개) |
| Firebase 어댑터 행동 | 모의 SDK 13개 시나리오 통과 |
| Firestore 규칙 | 실제 로컬 에뮬레이터 18개 권한 시나리오 통과 |
| 코드 검토 | 지적된 HTML 삽입·동시 편집 문제 수정 후 승인 |

예시 모드는 브라우저 localStorage를 사용합니다. Firebase 구독 UI 검증은 `.omo/evidence/ui/mock-firebase.js`를 브라우저 테스트에서만 가로채 사용했으며, 앱의 실제 모듈은 루트 `firebase.js`입니다.

영상 임베드 URL 생성을 확인했으며 특정 영상의 실제 재생 성공은 보장하지 않습니다. 모바일 스크린샷 저장은 자동화 도구 시간 초과로 완료하지 못했으나 DOM 너비 검증은 통과했습니다. 데스크톱 화면은 `artifacts/home-desktop.png`에 저장했습니다.

후속 운영 점검에서 Google 제공자 설정과 로그인 화면 연결, 운영 Firestore 규칙 배포 및 공개/비공개 접근을 확인했습니다. Vercel의 Firebase 변수 7개는 세 환경 모두 재조회해 일치함을 확인했고, 프로덕션 도메인을 Firebase 승인 도메인에 등록했습니다. 상세 결과와 검증 경계는 [FIREBASE-CHECK.md](FIREBASE-CHECK.md)에 기록했습니다. 실제 계정의 Google 로그인 완료는 아직 검증하지 않았습니다.

세부 권한 증거: `.omo/evidence/firebase/REPORT.md`, `rules-results.json`, `api-results.json`. 코드 검토: `.omo/evidence/classpage-code-review.md`.
