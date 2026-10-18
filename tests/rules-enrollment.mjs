import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8188';
assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
const project = 'demo-classpage';
const root = `projects/${project}/databases/(default)/documents`;
const base = `http://${host}/v1/${root}`;
const evidence = process.env.ENROLLMENT_RULES_EVIDENCE || '.omo/evidence/enrollment-security';
mkdirSync(evidence, { recursive: true });
const results = [];
const record = () => writeFileSync(`${evidence}/rules-results.json`, JSON.stringify({
  verifiedAt: new Date().toISOString(), invocation: 'node tests/rules-enrollment.mjs', emulatorHost: host,
  rulesSha256: createHash('sha256').update(readFileSync('firestore.rules')).digest('hex'),
  total: results.length, passed: results.filter(item => item.pass).length, results,
}, null, 2));
function token(uid, provider = 'google.com') {
  const encode = input => Buffer.from(JSON.stringify(input)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: uid, user_id: uid, aud: project,
    iss: `https://securetoken.google.com/${project}`, iat: 1, exp: 9999999999,
    firebase: { sign_in_provider: provider } })}.`;
}
function value(input) {
  if (input === null) return { nullValue: null };
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return { integerValue: String(input) };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  return { mapValue: { fields: fields(input) } };
}
const fields = input => Object.fromEntries(Object.entries(input).map(([key, entry]) => [key, value(entry)]));
function write(path, data, timestamp, mask) {
  return { update: { name: `${root}/${path}`, fields: fields(data) },
    ...(timestamp ? { updateTransforms: [{ fieldPath: timestamp, setToServerValue: 'REQUEST_TIME' }] } : {}),
    ...(mask ? { updateMask: { fieldPaths: mask } } : {}),
  };
}
const remove = path => ({ delete: `${root}/${path}` });
async function request(label, suffix, uid, body, expected, provider) {
  const response = await fetch(`${base}${suffix}`, { method: body ? 'POST' : 'GET', headers: {
    'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid, provider)}` } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json();
  const pass = response.status === expected;
  results.push({ label, expected, actual: response.status, pass, ...(!pass ? { error: payload } : {}) });
  record();
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${response.status}`);
  return payload;
}
const commit = (label, uid, writes, expected = 403, provider) => request(label, ':commit', uid, { writes }, expected, provider);
const read = (label, path, uid = null, expected = 403, provider) => request(label, `/${path}`, uid, null, expected, provider);
function observed(label, condition) {
  results.push({ label, expected: true, actual: condition, pass: condition });
  record();
}
const classA = 'EnrollmentClassAAAAA';
const classB = 'EnrollmentClassBBBBB';
const missingClass = 'EnrollmentClassCCCCC';
const codeA = 'ABCDEFGHJK';
const codeB = 'LMNPQRSTUV';
const codeNew = 'WXYZ234567';
const codeInvalid = 'ZZZZZZZZZZ';
const video = { id: 'discussion', title: 'Discussion', videoId: 'dQw4w9WgXcQ', note: 'Share ideas' };
const classData = ownerUid => ({ ownerUid, name: 'Enrollment test', notices: [], assessments: [], students: [],
  videos: [video], published: false, version: 0 });
const settings = (classId, code, ownerUid) => write(`classEnrollment/${classId}`, { code, ownerUid }, 'updatedAt');
const mapping = (classId, code, ownerUid) => write(`classCodes/${code}`, { classId, ownerUid }, 'createdAt');
const setup = (classId, code, ownerUid) => [settings(classId, code, ownerUid), mapping(classId, code, ownerUid)];
const memberPath = (classId, uid) => `classMembers/${classId}/students/${uid}`;
const indexPath = (classId, uid) => `studentClasses/${uid}/classes/${classId}`;
function join(classId = classA, uid = 'student-a', ownerUid = 'teacher-a', code = codeA, changes = {}) {
  const data = { classId, uid, ownerUid, alias: 'Student', joinCode: code, ...changes };
  return [write(memberPath(classId, uid), data, 'joinedAt'), write(indexPath(classId, uid), data, 'joinedAt')];
}
const comment = (classId, uid, id) => write(`classes/${classId}/videoActivity/${video.id}/comments/${id}`, {
  authorUid: uid, alias: 'Student', body: 'A thought', parentId: '', video, deleted: false,
}, 'createdAt');
const reaction = (classId, uid) => write(`classes/${classId}/videoActivity/${video.id}/reactions/${uid}`, {
  authorUid: uid, type: 'heart', video,
}, 'updatedAt');

// Dedicated demo emulator reset: never runs against production.
const reset = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, {
  method: 'DELETE', headers: { Authorization: 'Bearer owner' },
});
assert.equal(reset.status, 200);
await commit('teacher A creates private class A', 'teacher-a', [write(`classes/${classA}`, classData('teacher-a'), 'updatedAt')], 200);
await commit('teacher B creates private class B', 'teacher-b', [write(`classes/${classB}`, classData('teacher-b'), 'updatedAt')], 200);
await commit('enrollment setting without code map denied', 'teacher-a', [settings(classA, codeA, 'teacher-a')]);
await commit('code map without enrollment denied', 'teacher-a', [mapping(classA, codeA, 'teacher-a')]);
await commit('other teacher cannot configure class A', 'teacher-b', setup(classA, codeA, 'teacher-b'));
await commit('student cannot configure class A', 'student-a', setup(classA, codeA, 'teacher-a'));
await commit('invalid code alphabet denied', 'teacher-a', setup(classA, '0000000000', 'teacher-a'));
await commit('short code denied', 'teacher-a', setup(classA, 'ABCDEFGHJ', 'teacher-a'));
await commit('long code denied', 'teacher-a', setup(classA, 'ABCDEFGHJKL', 'teacher-a'));
const extraSettings = setup(classA, codeA, 'teacher-a');
extraSettings[0].update.fields.role = value('admin');
await commit('extra enrollment setting field denied', 'teacher-a', extraSettings);
const extraMap = setup(classA, codeA, 'teacher-a');
extraMap[1].update.fields.public = value(true);
await commit('extra code mapping field denied', 'teacher-a', extraMap);
const wrongMapOwner = setup(classA, codeA, 'teacher-a');
wrongMapOwner[1].update.fields.ownerUid = value('teacher-b');
await commit('code map owner mismatch denied', 'teacher-a', wrongMapOwner);
const wrongMapClass = setup(classA, codeA, 'teacher-a');
wrongMapClass[1].update.fields.classId = value(classB);
await commit('code map class mismatch denied', 'teacher-a', wrongMapClass);
const staleSetup = setup(classA, codeA, 'teacher-a').map(({ updateTransforms, ...item }) => ({ ...item,
  update: { ...item.update, fields: { ...item.update.fields,
    [item.update.name.includes('/classEnrollment/') ? 'updatedAt' : 'createdAt']: { timestampValue: '2020-01-01T00:00:00Z' },
  } } }));
await commit('stale code settings timestamps denied', 'teacher-a', staleSetup);
await commit('teacher A atomically configures code', 'teacher-a', setup(classA, codeA, 'teacher-a'), 200);
await commit('teacher B atomically configures code', 'teacher-b', setup(classB, codeB, 'teacher-b'), 200);
await read('owner can read own code settings', `classEnrollment/${classA}`, 'teacher-a', 200);
await read('other teacher cannot read code settings', `classEnrollment/${classA}`, 'teacher-b');
await read('student cannot read code settings', `classEnrollment/${classA}`, 'student-a');
await read('guest cannot read code map', `classCodes/${codeA}`);
await read('non-Google cannot read code map', `classCodes/${codeA}`, 'student-a', 403, 'password');
await read('Google student resolves exact code', `classCodes/${codeA}`, 'student-a', 200);
await read('unknown code gives no match', `classCodes/${codeInvalid}`, 'student-a', 404);
await read('student cannot enumerate codes', 'classCodes', 'student-a');
await read('teacher cannot enumerate codes', 'classCodes', 'teacher-a');
await read('teacher cannot enumerate settings', 'classEnrollment', 'teacher-a');
await commit('owner cannot update existing code map', 'teacher-a', [write(`classCodes/${codeA}`, { classId: classB }, null, ['classId'])]);
await commit('owner cannot delete enrollment settings', 'teacher-a', [remove(`classEnrollment/${classA}`)]);
await read('student can read own missing membership', memberPath(classA, 'student-a'), 'student-a', 404);
await read('student cannot inspect another missing membership', memberPath(classA, 'student-b'), 'student-a');
await commit('guest cannot enroll', null, join());
await commit('non-Google cannot enroll', 'student-a', join(), 403, 'custom');
await commit('incorrect code cannot enroll', 'student-a', join(classA, 'student-a', 'teacher-a', codeInvalid));
await commit('other class code cannot enroll', 'student-a', join(classA, 'student-a', 'teacher-a', codeB));
await commit('nonexistent class cannot enroll', 'student-a', join(missingClass, 'student-a', 'teacher-a', codeA));
await commit('roster record alone cannot enroll', 'student-a', [join()[0]]);
await commit('student index alone cannot enroll', 'student-a', [join()[1]]);
await commit('student cannot enroll another UID', 'student-b', join());
await commit('spoofed UID field denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { uid: 'student-b' }));
await commit('spoofed class field denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { classId: classB }));
await commit('spoofed owner field denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { ownerUid: 'teacher-b' }));
await commit('empty alias denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { alias: '' }));
await commit('long alias denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { alias: 'x'.repeat(21) }));
await commit('non-string alias denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { alias: 7 }));
await commit('extra membership fields denied', 'student-a', join(classA, 'student-a', 'teacher-a', codeA, { role: 'teacher' }));
const missingTime = join().map(({ updateTransforms, ...item }) => item);
await commit('missing joinedAt denied', 'student-a', missingTime);
const staleTime = join().map(({ updateTransforms, ...item }) => ({ ...item, update: { ...item.update,
  fields: { ...item.update.fields, joinedAt: { timestampValue: '2020-01-01T00:00:00Z' } } } }));
await commit('stale joinedAt denied', 'student-a', staleTime);
const mismatch = join();
mismatch[1].update.fields.alias = value('Different');
await commit('mismatched counterpart data denied', 'student-a', mismatch);
await read('failed partial joins leave no roster row', memberPath(classA, 'student-a'), 'student-a', 404);
await read('failed partial joins leave no student index', indexPath(classA, 'student-a'), 'student-a', 404);
await commit('student A joins class A atomically', 'student-a', join(), 200);
await commit('student B joins class B atomically', 'student-b', join(classB, 'student-b', 'teacher-b', codeB), 200);
await commit('student A also joins class B', 'student-a', join(classB, 'student-a', 'teacher-b', codeB), 200);
const memberA = await read('student reads own membership', memberPath(classA, 'student-a'), 'student-a', 200);
const indexA = await read('student reads own class index', indexPath(classA, 'student-a'), 'student-a', 200);
observed('roster and student index persist identical fields', JSON.stringify(memberA.fields) === JSON.stringify(indexA.fields));
await commit('duplicate enrollment cannot overwrite immutable membership', 'student-a', join());
const duplicateAfter = await read('duplicate attempt preserves original enrollment', memberPath(classA, 'student-a'), 'student-a', 200);
observed('duplicate attempt preserves original timestamp and alias', JSON.stringify(memberA.fields) === JSON.stringify(duplicateAfter.fields));
await commit('student cannot change alias after enrollment', 'student-a', [write(memberPath(classA, 'student-a'), { alias: 'Changed' }, null, ['alias'])]);
await commit('teacher cannot rewrite membership ownership', 'teacher-a', [write(memberPath(classA, 'student-a'), { ownerUid: 'teacher-b' }, null, ['ownerUid'])]);
await commit('student cannot remove roster membership', 'student-a', [remove(memberPath(classA, 'student-a'))]);
await commit('student cannot remove class index', 'student-a', [remove(indexPath(classA, 'student-a'))]);
const rosterA = await read('teacher A lists class A roster', `classMembers/${classA}/students`, 'teacher-a', 200);
observed('class A roster contains only its enrolled student', rosterA.documents?.length === 1 && rosterA.documents[0].fields.uid.stringValue === 'student-a');
const rosterB = await read('teacher B lists class B roster', `classMembers/${classB}/students`, 'teacher-b', 200);
observed('class B roster contains both enrolled students', rosterB.documents?.length === 2);
await read('teacher A cannot list teacher B roster', `classMembers/${classB}/students`, 'teacher-a');
await read('teacher B cannot list teacher A roster', `classMembers/${classA}/students`, 'teacher-b');
await read('student cannot list own class roster', `classMembers/${classA}/students`, 'student-a');
await read('guest cannot list roster', `classMembers/${classA}/students`);
const ownClasses = await read('student A lists own classes', 'studentClasses/student-a/classes', 'student-a', 200);
observed('student index contains both class memberships', ownClasses.documents?.length === 2);
await read('student B cannot list student A index', 'studentClasses/student-a/classes', 'student-b');
await read('teacher cannot list student index', 'studentClasses/student-a/classes', 'teacher-a');
await read('enrolled student reads private class A', `classes/${classA}`, 'student-a', 200);
await read('nonmember student B cannot read private class A', `classes/${classA}`, 'student-b');
await commit('enrolled student cannot edit class', 'student-a', [write(`classes/${classA}`, { ...classData('teacher-a'), name: 'Changed', version: 1 }, 'updatedAt')]);
await commit('enrolled student cannot delete class', 'student-a', [remove(`classes/${classA}`)]);
await commit('enrolled student comments on private video', 'student-a', [comment(classA, 'student-a', 'private-member')], 200);
await commit('enrolled student reacts on private video', 'student-a', [reaction(classA, 'student-a')], 200);
await commit('nonmember cannot comment on private video', 'student-b', [comment(classA, 'student-b', 'private-outsider')]);
await commit('teacher publishes class A', 'teacher-a', [write(`classes/${classA}`, { ...classData('teacher-a'), published: true, version: 1 }, 'updatedAt')], 200);
await read('public class remains readable by guest', `classes/${classA}`, null, 200);
await read('public comments remain readable by nonmember', `classes/${classA}/videoActivity/${video.id}/comments`, 'student-b', 200);
await commit('Google nonmember cannot comment on public class', 'student-b', [comment(classA, 'student-b', 'public-outsider')]);
await commit('Google nonmember cannot react on public class', 'student-b', [reaction(classA, 'student-b')]);
await commit('enrolled student comments on public video', 'student-a', [comment(classA, 'student-a', 'public-member')], 200);
await commit('teacher unpublishes class A', 'teacher-a', [write(`classes/${classA}`, { ...classData('teacher-a'), version: 2 }, 'updatedAt')], 200);
await read('member keeps access after unpublish', `classes/${classA}`, 'student-a', 200);
await read('nonmember loses public access after unpublish', `classes/${classA}`, 'student-b');
await commit('other teacher cannot rotate code', 'teacher-b', [...setup(classA, codeNew, 'teacher-a'), remove(`classCodes/${codeA}`)]);
await commit('rotation without deleting old code denied', 'teacher-a', setup(classA, codeNew, 'teacher-a'));
await commit('old code deletion without rotation denied', 'teacher-a', [remove(`classCodes/${codeA}`)]);
await commit('rotation without new mapping denied', 'teacher-a', [settings(classA, codeNew, 'teacher-a'), remove(`classCodes/${codeA}`)]);
await commit('teacher cannot take another teachers code', 'teacher-a', [settings(classA, codeB, 'teacher-a'), mapping(classA, codeB, 'teacher-a'), remove(`classCodes/${codeA}`)]);
await commit('same batch cannot enroll with code being rotated away', 'teacher-a', [
  ...setup(classA, codeNew, 'teacher-a'), remove(`classCodes/${codeA}`),
  ...join(classA, 'teacher-a', 'teacher-a', codeA),
]);
await commit('teacher atomically rotates code', 'teacher-a', [...setup(classA, codeNew, 'teacher-a'), remove(`classCodes/${codeA}`)], 200);
await read('old code no longer resolves', `classCodes/${codeA}`, 'student-b', 404);
await read('new code resolves', `classCodes/${codeNew}`, 'student-b', 200);
await commit('stale code cannot enroll new student', 'student-b', join(classA, 'student-b', 'teacher-a', codeA));
await commit('new code enrolls new student', 'student-b', join(classA, 'student-b', 'teacher-a', codeNew), 200);
await read('existing membership survives code rotation', `classes/${classA}`, 'student-a', 200);
await commit('existing member still comments after rotation', 'student-a', [comment(classA, 'student-a', 'after-rotate')], 200);
assert.equal(results.filter(item => !item.pass).length, 0, 'all enrollment security scenarios pass');
console.log(`PASS ${results.length} enrollment rules scenarios`);
