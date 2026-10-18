# Firebase 운영 점검

점검일: 2026-10-18 (한국 시간). 대상 프로젝트: `classpage-6fe5c`.

## Google 로그인

- 앱은 Firebase SDK 13.0.0의 `GoogleAuthProvider`와 `signInWithPopup`을 사용합니다.
- 운영 프로젝트의 `google.com` 제공자 활성화와 OAuth 클라이언트 설정을 관리 API로 확인했습니다.
- 승인 도메인은 `localhost`, `classpage-6fe5c.firebaseapp.com`, `classpage-6fe5c.web.app`, `classpage-khaki.vercel.app`입니다. Vercel 도메인 추가 후 관리 API로 다시 조회해 확인했습니다.
- 로컬 앱의 실제 로그인 버튼을 눌러 Firebase 인증 핸들러를 거쳐 Google 계정 로그인 화면으로 연결되는 것을 확인했습니다.
- 해당 브라우저에는 Google 로그인 세션이 없어 이메일/비밀번호 입력 화면에서 멈췄습니다. 본인의 계정으로 로그인 완료 후 학급 생성·저장을 실행하는 전체 흐름은 아직 검증하지 않았습니다.
- Vercel `classpage` 프로젝트의 Production·Preview·Development에 Firebase 웹 설정 변수 7개를 등록했습니다. 빌드는 환경 변수로 `dist/firebase-config.js`를 생성합니다. Preview의 개별 호스트에서 로그인하려면 해당 도메인도 추가해야 합니다.

## Firestore 규칙

기본 `(default)` 데이터베이스는 Standard 에디션이며 서울 리전 `asia-northeast3`에 있습니다.

점검 당시 운영 규칙은 모든 읽기·쓰기를 차단하는 기본 규칙이었습니다. 이 상태에서는 로그인 후에도 학급을 저장할 수 없어, 검증한 저장소의 `firestore.rules`를 운영 프로젝트에 배포했습니다.

```sh
firebase deploy --only firestore:rules --project classpage-6fe5c --non-interactive
```

배포 후 서버 규칙을 다시 받아 로컬 규칙과 SHA-256이 일치하는 것을 확인했습니다.

- 규칙 버전: `ba4ae4cd-4f3d-45cd-b89f-966012a4c5a6`
- SHA-256: `5e320cabc3bbfecad4260f51284032a5ad937adc190691ac36aadaf7f54a2729`
- 게시 시각: 2026-10-18 16:49:49 한국 시간.

운영 서버에서는 이번 검사만을 위해 만든 빈 테스트 학급으로 다음을 확인했습니다.

| 요청 | 실제 HTTP 응답 |
| --- | --- |
| 비로그인 사용자의 비공개 학급 읽기 | 403 |
| 비로그인 사용자의 학급 생성 | 403 |
| 공개 학급의 비로그인 읽기 | 200 |
| 공개 학급의 비로그인 수정 | 403 |
| 비로그인 사용자의 학급 전체 목록 조회 | 403 |
| 공유 해제 후 비로그인 읽기 | 403 |

테스트 자료 준비·공유 상태 전환·정리는 관리 API로 수행했습니다. 따라서 위 운영 검사는 교사 로그인 후 소유자 쓰기의 성공을 증명하지 않습니다. 소유자 생성/수정, 다른 교사의 접근 거부, 소유권 변경 거부, 버전 충돌 및 배열 상한은 별도의 실제 Firestore 에뮬레이터 18개 시나리오에서 모두 통과했습니다. 모의 SDK 어댑터 검사 13개, Node 테스트 6개와 빌드 검사도 통과했습니다.

일회성 운영 테스트 학급은 삭제하고 관리 API의 404 응답으로 제거를 확인했습니다. 기존 학급 자료는 변경하지 않았습니다.

규칙은 학급 소유자만 편집하도록 제한하고, 공개한 학급만 링크를 가진 사람이 읽도록 허용합니다. 배열 내부 항목의 전체 스키마를 서버 규칙에서 개별 검증하는 구조는 아니며, 학생 공유 링크는 학생 신원을 인증하지 않습니다. 학생 정보에는 번호나 별칭을 사용하세요.

## 배포 후 마지막 확인

실제 Vercel 주소에서 본인 계정으로 Google 로그인 → 학급 생성 → 공지 저장 → 공유 켜기 → 로그아웃한 브라우저에서 읽기 → 공유 해제 순서로 확인합니다.

## 공식 문서

- [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin)
- [프로젝트 인증 설정 조회](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/getConfig)
- [Google 제공자 설정 조회](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects.defaultSupportedIdpConfigs/get)
- [보안 규칙 배포](https://firebase.google.com/docs/rules/manage-deploy)
