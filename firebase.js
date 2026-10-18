import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, updateDoc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { REACTIONS, normalizeCommentInput } from './discussion.js';
import { normalizeClassCode, normalizeStudentAlias, generateClassCodeValue } from './enrollment.js';

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

function enrollmentRef(classId) {
  classRef(classId);
  return doc(db, 'classEnrollment', classId);
}

function membershipRef(classId, uid) {
  classRef(classId);
  return doc(db, 'classMembers', classId, 'students', uid);
}

export async function getEnrollment(classId) {
  currentUser();
  const snapshot = await getDoc(enrollmentRef(classId));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function generateClassCode(classId) {
  const user = currentUser();
  const parent = classRef(classId);
  const enrollment = enrollmentRef(classId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateClassCodeValue();
    const codeRef = doc(db, 'classCodes', code);
    try {
      return await runTransaction(db, async (transaction) => {
        const classSnapshot = await transaction.get(parent);
        if (!classSnapshot.exists() || classSnapshot.data().ownerUid !== user.uid) {
          fail('permission-denied', '학급을 만든 선생님만 참여 코드를 관리할 수 있습니다.');
        }
        const current = await transaction.get(enrollment);
        const collision = await transaction.get(codeRef);
        if (collision.exists()) fail('classpage/code-collision', '다른 학급 코드와 겹쳤습니다. 새 코드를 다시 만듭니다.');
        transaction.set(enrollment, { code, ownerUid: user.uid, updatedAt: serverTimestamp() });
        transaction.set(codeRef, { classId, ownerUid: user.uid, createdAt: serverTimestamp() });
        if (current.exists()) transaction.delete(doc(db, 'classCodes', current.data().code));
        return code;
      });
    } catch (error) {
      if (error.code !== 'classpage/code-collision' || attempt === 4) throw error;
    }
  }
}

export async function joinClassByCode(inputCode, inputAlias) {
  const user = currentUser();
  const code = normalizeClassCode(inputCode);
  const alias = normalizeStudentAlias(inputAlias);
  return runTransaction(db, async (transaction) => {
    const mapping = await transaction.get(doc(db, 'classCodes', code));
    if (!mapping.exists()) fail('classpage/invalid-code', '사용할 수 없는 학급 코드입니다. 선생님께 현재 코드를 확인해 주세요.');
    const { classId, ownerUid } = mapping.data();
    const memberRef = membershipRef(classId, user.uid);
    const indexRef = doc(db, 'studentClasses', user.uid, 'classes', classId);
    const member = await transaction.get(memberRef);
    const index = await transaction.get(indexRef);
    if (member.exists() && index.exists()) return classId;
    if (member.exists() || index.exists()) fail('classpage/membership-incomplete', '학급 등록 정보가 일치하지 않습니다. 선생님께 문의해 주세요.');
    const membership = { classId, uid: user.uid, ownerUid, alias, joinCode: code, joinedAt: serverTimestamp() };
    transaction.set(memberRef, membership);
    transaction.set(indexRef, membership);
    return classId;
  });
}

export async function getClassMembership(classId) {
  const user = currentUser();
  const snapshot = await getDoc(membershipRef(classId, user.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function listJoinedClasses() {
  const user = currentUser();
  const memberships = await getDocs(collection(db, 'studentClasses', user.uid, 'classes'));
  const joined = await Promise.all(memberships.docs.map(async (item) => {
    const snapshot = await getDoc(classRef(item.id));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return { id: item.id, name: data.name, ownerUid: data.ownerUid, alias: item.data().alias };
  }));
  return joined.filter(Boolean);
}

export function subscribeClassMembers(classId, onData, onError) {
  currentUser();
  classRef(classId);
  return onSnapshot(collection(db, 'classMembers', classId, 'students'), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ uid: item.id, alias: item.data().alias, joinedAt: item.data().joinedAt })));
  }, onError);
}

function activityRef(classId, videoKey, name) {
  const parent = classRef(classId);
  if (typeof videoKey !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(videoKey)) {
    fail('classpage/invalid-video', '영상 정보를 다시 확인해 주세요.');
  }
  return collection(parent, 'videoActivity', videoKey, name);
}

export function subscribeVideoActivity(classId, videoKey, onData, onError) {
  const state = { comments: [], reactions: [] };
  const ready = new Set();
  const stops = [];
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    stops.forEach((stop) => stop());
  };
  const reportError = (error) => {
    if (!active) return;
    cleanup();
    onError?.(error);
  };
  for (const [name, constraints] of [['comments', [orderBy('createdAt', 'desc'), limit(100)]], ['reactions', [limit(1000)]]]) {
    if (!active) break;
    try {
      const target = query(activityRef(classId, videoKey, name), ...constraints);
      const stop = onSnapshot(target, (snapshot) => {
        if (!active) return;
        state[name] = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
        ready.add(name);
        if (ready.size === 2) onData({ comments: [...state.comments], reactions: [...state.reactions] });
      }, reportError);
      if (active) stops.push(stop);
      else stop();
    } catch (error) {
      reportError(error);
    }
  }
  return cleanup;
}

export async function addVideoComment(classId, video, input) {
  const user = currentUser();
  const normalized = normalizeCommentInput(input);
  const target = doc(activityRef(classId, video?.id, 'comments'));
  await setDoc(target, { authorUid: user.uid, ...normalized, video: structuredClone(video), createdAt: serverTimestamp(), deleted: false });
  return target.id;
}

export async function deleteVideoComment(classId, videoKey, commentId) {
  currentUser();
  if (typeof commentId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(commentId)) {
    fail('classpage/invalid-comment', '삭제할 댓글을 다시 확인해 주세요.');
  }
  await updateDoc(doc(activityRef(classId, videoKey, 'comments'), commentId), { body: '', deleted: true });
}

export async function toggleVideoReaction(classId, video, type) {
  const user = currentUser();
  if (!REACTIONS.some((reaction) => reaction.type === type)) {
    fail('classpage/invalid-reaction', '사용할 수 없는 반응입니다.');
  }
  const target = doc(activityRef(classId, video?.id, 'reactions'), user.uid);
  const videoData = structuredClone(video);
  return runTransaction(db, async (transaction) => {
    const previous = await transaction.get(target);
    if (previous.exists() && previous.data().type === type) {
      transaction.delete(target);
      return null;
    }
    transaction.set(target, { authorUid: user.uid, type, video: videoData, updatedAt: serverTimestamp() });
    return type;
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
