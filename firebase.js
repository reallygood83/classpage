import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, onSnapshot, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = 'ko';
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function currentUser() {
  if (!auth.currentUser) fail('classpage/login-required', '먼저 Google 계정으로 로그인해 주세요.');
  return auth.currentUser;
}

function classRef(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{20}$/.test(id)) {
    fail('classpage/invalid-id', '학급 주소가 올바르지 않습니다. 공유 링크를 확인해 주세요.');
  }
  return doc(db, 'classes', id);
}

function validName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
    fail('classpage/invalid-name', '학급 이름을 1~60자로 입력해 주세요.');
  }
  return name.trim();
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function login() {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export function logout() {
  return signOut(auth);
}

export async function createClass(name) {
  const user = currentUser();
  const ref = doc(collection(db, 'classes'));
  await setDoc(ref, {
    ownerUid: user.uid,
    name: validName(name),
    notices: [], assessments: [], students: [], videos: [],
    published: false,
    version: 0,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listClasses(uid) {
  if (currentUser().uid !== uid) fail('permission-denied', '본인이 만든 학급만 조회할 수 있습니다.');
  const result = await getDocs(query(collection(db, 'classes'), where('ownerUid', '==', uid)));
  return result.docs.map((item) => ({ id: item.id, name: item.data().name, ownerUid: item.data().ownerUid }));
}

export function subscribeClass(id, onData, onError) {
  return onSnapshot(classRef(id), (snapshot) => {
    onData(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null);
  }, onError);
}

export async function saveClass(id, data) {
  const user = currentUser();
  const ref = classRef(id);
  const name = validName(data.name);
  if (!Number.isSafeInteger(data.version) || data.version < 0 || typeof data.published !== 'boolean') {
    fail('classpage/invalid-data', '학급 정보가 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.');
  }
  for (const [field, maximum] of Object.entries({ notices: 100, assessments: 100, students: 60, videos: 50 })) {
    if (!Array.isArray(data[field]) || data[field].length > maximum) {
      fail('classpage/limit', `${({ notices: '공지', assessments: '수행평가', students: '학생', videos: '영상' })[field]}은 최대 ${maximum}개까지 저장할 수 있습니다.`);
    }
  }
  const content = structuredClone({ name, notices: data.notices, assessments: data.assessments, students: data.students, videos: data.videos, published: data.published });
  if (new TextEncoder().encode(JSON.stringify(content)).length > 700000) {
    fail('classpage/limit', '학급 자료가 너무 큽니다. 오래된 공지나 자료를 정리해 주세요.');
  }
  const expectedVersion = data.version;
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) fail('classpage/not-found', '학급을 찾을 수 없습니다.');
    const stored = snapshot.data();
    if (stored.ownerUid !== user.uid) fail('permission-denied', '학급을 만든 선생님만 수정할 수 있습니다.');
    if (stored.version !== expectedVersion) {
      fail('classpage/conflict', '다른 창에서 학급이 변경되었습니다. 최신 내용을 확인한 뒤 다시 입력해 주세요.');
    }
    const version = expectedVersion + 1;
    transaction.update(ref, { ...content, version, updatedAt: serverTimestamp() });
    return version;
  });
}

export function getErrorMessage(error) {
  const messages = {
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 로그인해 주세요.',
    'auth/cancelled-popup-request': '이미 열린 로그인 창에서 로그인을 완료해 주세요.',
    'auth/popup-blocked': '브라우저에서 팝업을 허용한 뒤 다시 로그인해 주세요.',
    'auth/unauthorized-domain': '이 주소의 Google 로그인이 아직 설정되지 않았습니다. Firebase Authentication의 승인된 도메인에 현재 주소를 등록해 주세요.',
    'auth/operation-not-allowed': 'Firebase Authentication에서 Google 로그인 제공자를 활성화해 주세요.',
    'auth/configuration-not-found': 'Firebase Authentication에서 Google 로그인을 먼저 설정해 주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인한 뒤 다시 로그인해 주세요.',
    'auth/invalid-api-key': 'Firebase 앱 설정을 확인해 주세요.',
    'permission-denied': '접근 권한이 없습니다. 학급 공개 여부, 로그인 계정, Firestore 보안 규칙을 확인해 주세요.',
    'unavailable': '서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    'resource-exhausted': 'Firebase 사용량 한도에 도달했습니다. 프로젝트 사용량을 확인해 주세요.',
    'failed-precondition': 'Firestore 데이터베이스와 설정을 확인해 주세요.',
  };
  if (error?.code?.startsWith('classpage/')) return error.message;
  return messages[error?.code] || '작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
