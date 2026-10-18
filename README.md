# 우리반 Classpage

고등학교 학급의 공지, 수행평가, 칭찬 상점, 함께 볼 유튜브 영상을 한곳에 모으는 정적 웹 앱입니다. 교사는 Google 계정으로 로그인해 학급을 만들고 편집합니다. 학생은 공개된 학급 링크를 열어 로그인 없이 읽고, Google 로그인 후 영상에 댓글·답글과 반응을 남길 수 있습니다.

2026-10-18 운영 점검: Google 제공자 활성화·로그인 화면 연결을 확인했고, Firestore 규칙을 실제 프로젝트에 배포했습니다. `classpage-khaki.vercel.app`도 승인 도메인에 등록했습니다. [상세 점검 결과](FIREBASE-CHECK.md)를 참고하세요. 본인 계정의 로그인 완료는 별도로 확인해야 합니다.

## 실행

Node.js와 Python 3가 설치된 환경에서 프로젝트 폴더를 열고 실행합니다.

```sh
npm run dev
```

브라우저에서 <http://localhost:5173>을 엽니다. 파일을 직접 더블클릭하는 `file://` 방식은 ES 모듈과 Google 로그인에 적합하지 않습니다. npm 패키지 설치 없이 실행하며 Firebase SDK는 공식 CDN의 **13.0.0**을 사용합니다.

화면의 체험 모드는 가상 학급을 현재 브라우저에 저장합니다. Firebase에 저장되거나 다른 학생의 기기로 공유되는 실제 학급이 아닙니다. 실제 학급은 Google 로그인과 아래 Firebase 설정을 완료한 뒤 사용합니다. 브라우저 저장 공간을 지우면 체험 데이터도 삭제됩니다.

## Firebase 최초 설정

연결된 Firebase 프로젝트는 `classpage-6fe5c`입니다. 로컬 개발용 웹 앱 설정은 `firebase-config.js`에 들어 있습니다. Vercel에서는 빌드 시 환경 변수로 설정 모듈을 생성합니다. Analytics는 초기화하지 않습니다.

1. [Firebase Console](https://console.firebase.google.com/project/classpage-6fe5c/overview)에서 프로젝트를 엽니다.
2. **Authentication → Sign-in method → Google**을 활성화합니다. 프로젝트 표시 이름과 지원 이메일을 지정하고 저장합니다.
3. **Authentication → Settings → Authorized domains**에서 `localhost`와 실제 Vercel 배포 도메인(예: `선택한프로젝트.vercel.app`)을 추가합니다. `https://`, 경로, 포트는 넣지 않습니다. 별도 커스텀 도메인이나 Preview 주소에서 로그인하려면 그 정확한 도메인도 추가해야 합니다.
4. **Firestore Database → Create database**에서 기본 `(default)` 데이터베이스를 만들고 **프로덕션 모드**를 선택합니다. 학교 사용 위치에 맞는 리전을 선택합니다.
5. **Firestore Database → Rules**에 이 프로젝트의 `firestore.rules` 전체를 붙여 넣고 **게시(Publish)**합니다. 테스트 모드의 전체 허용 규칙을 그대로 두지 마세요.

Firebase CLI를 이미 사용한다면 5번 대신 프로젝트 루트에서 다음 명령으로 규칙을 배포할 수 있습니다. 이 명령은 실제 프로젝트의 규칙을 변경하므로 대상 프로젝트를 확인합니다.

```sh
firebase login
firebase deploy --only firestore:rules --project classpage-6fe5c
```

CLI가 없다면 Firebase Console의 Rules 게시 방식으로 완료할 수 있습니다. 이 저장소의 파일만 GitHub/Vercel에 올리는 것으로 Firebase 로그인 제공자나 Firestore 규칙이 활성화되지는 않습니다.

## 학급 운영

1. Google 로그인 후 학급을 만듭니다. 새 학급은 비공개로 시작합니다.
2. 공지와 수행평가 일정, 학생별 상점, 유튜브 링크를 입력합니다.
3. 학생에게 보여줄 준비가 되면 학급 공개를 켜고 공유 링크를 전달합니다. 교실 전자칠판에서도 같은 링크를 열 수 있습니다.
4. 공개를 끄면 소유자를 제외한 접근이 차단됩니다. 교사는 본인 계정으로 다시 로그인해 자료를 이어서 편집할 수 있습니다.

상점에는 학생 번호나 별명을 사용하세요. **공개 학급 링크를 가진 사람은 학급의 공지, 수행평가, 학생 별명·상점, 영상 정보를 모두 읽을 수 있습니다.** 링크는 학생 전용 인증을 제공하지 않으며 외부에 재전달될 수 있습니다. 학급 목록은 소유자만 조회하고, 수정도 해당 학급을 만든 Google 계정만 가능합니다.

유튜브는 링크에서 영상 ID를 추출해 임베드합니다. 영상 업로더가 외부 재생을 차단했거나 영상을 삭제·비공개 처리하면 재생되지 않을 수 있으므로 유튜브 원본 링크로 확인하세요.

### 영상 토론과 반응

학생 공유 링크에서 **함께 보는 영상 → Google로 참여하기**를 선택합니다. 참여 별칭(1~20자)을 입력하고 댓글(1~1,000자)을 남깁니다. 댓글의 **답글**로 서로의 생각에 응답할 수 있습니다. 한 단계 답글을 지원하며, 다른 영상의 대화는 분리됩니다.

하트·최고·새롭게 알았어요·응원해요 반응 중 영상마다 한 가지를 선택합니다. 같은 반응을 다시 누르면 취소되고 다른 반응을 누르면 바뀝니다. 댓글과 반응은 실시간으로 갱신되며, 새 대화가 도착해도 입력창이나 영상 iframe을 다시 만들지 않습니다. 최근 댓글·답글 100개와 최대 1,000명의 반응을 표시합니다.

본인 댓글은 직접 삭제할 수 있고, 학급을 만든 교사는 관리 화면에서 모든 댓글을 삭제할 수 있습니다. 삭제된 글은 본문을 비우고 답글을 보존합니다. 별칭은 학생 신원을 인증하지 않으며 Google 계정 UID로 작성 권한을 구분합니다. 이메일이나 Google 프로필 이름은 댓글 문서에 저장하지 않습니다. 공개 학급의 댓글도 링크를 가진 사람이 읽을 수 있으므로 학생은 번호·별칭을 사용하고 개인정보를 입력하지 않도록 안내하세요.

공유를 끄면 학생의 대화 읽기·쓰기도 차단됩니다. 영상을 삭제하면 화면에서 해당 대화가 사라지고 새 글·반응 추가가 차단됩니다. 이전 대화 문서는 별도로 보존되므로 학급을 다시 공개한 동안 알려진 경로로 읽을 수 있습니다. 체험 모드의 댓글·반응은 현재 브라우저에만 저장됩니다.

## GitHub 업로드

대상 저장소: <https://github.com/reallygood83/classpage>

아직 Git 저장소가 아닌 새 작업 폴더이고 원격 저장소가 비어 있다면:

```sh
git init -b main
git remote add origin https://github.com/reallygood83/classpage.git
git add index.html app.js core.js discussion.js firebase.js firebase-config.js scripts styles.css package.json vercel.json firebase.json firestore.rules .firebaserc .gitignore README.md tests assets QA.md FIREBASE-CHECK.md
git commit -m "Give teachers one shared classroom page"
git push -u origin main
```

이미 원격 저장소에 커밋이 있다면 먼저 별도 폴더에 복제하고 이 앱 파일을 복사한 뒤 변경사항을 확인해 커밋·푸시합니다. 강제 푸시는 사용하지 않습니다.

```sh
git clone https://github.com/reallygood83/classpage.git
cd classpage
git status
```

웹 Firebase 설정의 API 키는 클라이언트 앱 식별용 설정입니다. 데이터 접근은 `firestore.rules`와 로그인 권한으로 제한합니다. 서비스 계정 JSON, 개인 액세스 토큰, `.env` 비밀값은 저장소에 넣지 않습니다.

## Vercel 배포

1. Vercel에서 **Add New → Project**를 선택합니다.
2. GitHub의 `reallygood83/classpage`를 가져옵니다.
3. **Framework Preset: Other**, **Root Directory: 저장소 루트**, **Build Command: `npm run build`**, **Output Directory: `dist`**로 설정합니다. 빌드는 JavaScript 구문 검사 후 공개 앱 파일과 이미지·폰트, Firebase 설정 모듈만 `dist/`에 생성합니다. npm 의존성 설치는 필요하지 않습니다.
4. Deploy 후 발급된 도메인을 Firebase Authentication의 Authorized domains에 등록합니다.
5. 배포 주소에서 Google 로그인 → 학급 생성 → 내용 저장 → 공개 → 로그아웃한 브라우저에서 공유 링크 조회까지 확인합니다. 다른 Google 계정으로 수정할 수 없는지도 확인합니다.

현재 Vercel `classpage` 프로젝트의 Production·Preview·Development에 아래 변수를 등록했습니다. 환경 변수 변경은 새 배포부터 반영됩니다.

| 변수 | 용도 |
| --- | --- |
| `FIREBASE_API_KEY` | 웹 앱 API 키 |
| `FIREBASE_AUTH_DOMAIN` | 인증 도메인 |
| `FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID |
| `FIREBASE_STORAGE_BUCKET` | 저장소 버킷 |
| `FIREBASE_MESSAGING_SENDER_ID` | 발신자 ID |
| `FIREBASE_APP_ID` | 웹 앱 ID |
| `FIREBASE_MEASUREMENT_ID` | 선택적 Analytics 식별자 |

Vercel 빌드는 앞의 필수 변수 6개가 누락되면 실패합니다. 로컬 빌드는 기본값을 사용하며, 같은 이름의 셸 환경 변수로 덮어쓸 수 있습니다. Firebase Web SDK 설정은 브라우저에 전달되는 공개 클라이언트 설정입니다. Firebase Admin SDK 비밀키는 사용하지 않습니다. 실제 Firebase 설정, 규칙 게시, GitHub 업로드, Vercel 배포는 각각 별도 작업입니다.

## 저장 구조와 검증

`classes/{자동생성 20자 ID}` 문서에 `ownerUid`, `name`, `notices`, `assessments`, `students`, `videos`, `published`, `version`, `updatedAt`을 저장합니다. 교사 UID는 수정할 수 없습니다. 저장할 때 기존 `version`이 일치하는지 트랜잭션으로 확인하고 하나 증가시켜 다른 창의 변경을 조용히 덮어쓰지 않도록 합니다. 충돌 안내가 뜨면 최신 내용을 확인한 다음 다시 입력합니다.

영상 대화는 `classes/{classId}/videoActivity/{영상 항목 ID}/comments/{commentId}`, 반응은 같은 경로의 `reactions/{Google UID}`에 저장합니다. 학급 자료와 독립적으로 저장해 동시 대화가 학급 버전 충돌을 일으키지 않습니다. `firestore.rules`의 댓글·반응 규칙까지 Firebase에 게시해야 실제 학생의 참여가 가능합니다. 신규 댓글·반응은 현재 학급의 영상과 일치하는지, 로그인된 작성자 소유인지 서버 규칙에서 확인합니다.

한 학급의 제한은 이름 60자, 공지 100개, 수행평가 100개, 학생 60명, 영상 50개입니다. Firestore 규칙은 최상위 필드·타입·배열 개수를 검증합니다. 클라이언트는 저장 자료의 JSON 크기를 700KB 이하로 제한합니다.

```sh
npm run check
npm test
```

기능별 로컬 검증 결과는 [QA.md](QA.md)에 정리했습니다.

위 검사는 로컬 코드 검사입니다. Google OAuth와 배포된 Firestore 규칙은 실제 Firebase 프로젝트를 설정한 뒤 별도로 확인해야 합니다.

## 공식 문서

- [Firebase CDN 모듈 설정](https://firebase.google.com/docs/web/alt-setup)
- [Google 로그인 설정](https://firebase.google.com/docs/auth/web/google-signin)
- [Firestore 트랜잭션](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore 쿼리와 보안 규칙](https://firebase.google.com/docs/firestore/security/rules-query)
- [Vercel 정적 프로젝트와 빌드 설정](https://vercel.com/docs/builds/configure-a-build)
