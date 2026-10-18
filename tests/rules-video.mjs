import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Run only against a local Firestore emulator; never accepts a production host.
const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8188';
assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
const project = 'demo-classpage';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const documentRoot = `projects/${project}/databases/(default)/documents`;
const classId = 'VideoRulesTest123456';
const classPath = `classes/${classId}`;
const video = { id: 'video-1', title: 'Discussion test', videoId: 'dQw4w9WgXcQ', note: 'Discuss together' };
const video2 = { ...video, id: 'video-2' };
const activity = `${classPath}/videoActivity/${video.id}`;
const evidenceDir = process.env.VIDEO_RULES_EVIDENCE || '.omo/evidence/video-security';
mkdirSync(evidenceDir, { recursive: true });
const results = [];
const report = () => writeFileSync(`${evidenceDir}/rules-results.json`, JSON.stringify({
  verifiedAt: new Date().toISOString(), invocation: 'node tests/rules-video.mjs', emulatorHost: host,
  rulesSha256: createHash('sha256').update(readFileSync('firestore.rules')).digest('hex'),
  passed: results.filter(item => item.pass).length, total: results.length, results,
}, null, 2));

function token(uid, provider = 'google.com') {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
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
function write(path, input, timestamp, mask) {
  const result = { update: { name: `${documentRoot}/${path}`, fields: fields(input) } };
  if (timestamp) result.updateTransforms = [{ fieldPath: timestamp, setToServerValue: 'REQUEST_TIME' }];
  if (mask) result.updateMask = { fieldPaths: mask };
  return { writes: [result] };
}
async function request(label, suffix, uid, body, expected, provider) {
  const response = await fetch(`${base}${suffix}`, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${token(uid, provider)}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  const pass = response.status === expected;
  results.push({ label, expected, actual: response.status, pass, ...(!pass ? { error: payload } : {}) });
  report();
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: ${response.status}`);
  return payload;
}
const commit = (label, uid, body, expected = 403, provider) => request(label, ':commit', uid, body, expected, provider);
const read = (label, path, uid = null, expected = 403) => request(label, `/${path}`, uid, null, expected);
const data = { ownerUid: 'teacher', name: 'Rule test class', notices: [], assessments: [], students: [],
  videos: [video, video2], published: false, version: 0 };
const comment = (overrides = {}) => ({ authorUid: 'student-a', alias: 'Student A', body: 'My view',
  parentId: '', video, deleted: false, ...overrides });
const addComment = (id, overrides = {}, key = video.id, timestamp = 'createdAt') => write(
  `${classPath}/videoActivity/${key}/comments/${id}`, comment(overrides), timestamp);
const reaction = (overrides = {}) => ({ authorUid: 'student-a', type: 'heart', video, ...overrides });
const react = (uid = 'student-a', overrides = {}, key = video.id, timestamp = 'updatedAt') => write(
  `${classPath}/videoActivity/${key}/reactions/${uid}`, reaction(overrides), timestamp);
const remove = id => write(`${activity}/comments/${id}`, { body: '', deleted: true }, null, ['body', 'deleted']);

// This suite owns an isolated demo emulator; reset it so fixtures are repeatable.
const cleanup = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, {
  method: 'DELETE', headers: { Authorization: 'Bearer owner' },
});
assert.equal(cleanup.status, 200, 'reset isolated demo emulator');
async function memberFixtures(enrolled) {
  const writes = ['student-a', 'student-b'].flatMap(uid => {
    const paths = [`classMembers/${classId}/students/${uid}`, `studentClasses/${uid}/classes/${classId}`];
    return paths.map(path => enrolled ? write(path, { classId, uid, ownerUid: 'teacher', alias: 'Student',
      joinCode: 'ABCDEFGHJK' }, 'joinedAt').writes[0] : { delete: `${documentRoot}/${path}` });
  });
  const response = await fetch(`${base}:commit`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer owner',
  }, body: JSON.stringify({ writes }) });
  assert.equal(response.status, 200, 'membership fixtures applied to isolated emulator');
}
await commit('teacher creates private class', 'teacher', write(classPath, data, 'updatedAt'), 200);
await commit('private class rejects student comment', 'student-a', addComment('private'));
await commit('private class rejects student reaction', 'student-a', react());
await commit('teacher comments in private class', 'teacher', addComment('teacher-private', { authorUid: 'teacher' }), 200);
await read('private comment hidden from guest', `${activity}/comments/teacher-private`);
await read('private comment hidden from student', `${activity}/comments/teacher-private`, 'student-a');
await read('private comment visible to teacher', `${activity}/comments/teacher-private`, 'teacher', 200);
await commit('teacher publishes class', 'teacher', write(classPath, { ...data, published: true, version: 1 }, 'updatedAt'), 200);
await read('public comments readable by guest', `${activity}/comments`, null, 200);
await read('public reactions readable by guest', `${activity}/reactions`, null, 200);
await commit('guest cannot comment', null, addComment('guest'));
await commit('guest cannot react', null, react());
await commit('non-Google account cannot comment', 'student-a', addComment('custom'), 403, 'custom');
await commit('non-Google account cannot react', 'student-a', react(), 403, 'password');
await commit('Google nonmember cannot comment on public class', 'student-a', addComment('outsider'));
await commit('Google nonmember cannot react on public class', 'student-a', react());
// Enrollment behavior has its own full rules suite; these fixtures isolate video rules.
await memberFixtures(true);
await commit('student creates root comment', 'student-a', addComment('root'), 200);
await commit('another student replies to root', 'student-b', addComment('reply', { authorUid: 'student-b', parentId: 'root' }), 200);
await read('public reply visible to guest', `${activity}/comments/reply`, null, 200);
await commit('author UID spoof denied', 'student-b', addComment('spoof'));
await commit('empty alias denied', 'student-a', addComment('alias-empty', { alias: '' }));
await commit('long alias denied', 'student-a', addComment('alias-long', { alias: 'x'.repeat(21) }));
await commit('non-string alias denied', 'student-a', addComment('alias-type', { alias: 4 }));
await commit('empty body denied', 'student-a', addComment('body-empty', { body: '' }));
await commit('long body denied', 'student-a', addComment('body-long', { body: 'x'.repeat(1001) }));
await commit('non-string body denied', 'student-a', addComment('body-type', { body: [] }));
await commit('extra comment fields denied', 'student-a', addComment('extra', { role: 'teacher' }));
await commit('deleted initial comment denied', 'student-a', addComment('deleted', { deleted: true }));
await commit('missing timestamp denied', 'student-a', addComment('time-missing', {}, video.id, null));
const wrongTimestamp = addComment('time-old', {}, video.id, null);
wrongTimestamp.writes[0].update.fields.createdAt = { timestampValue: '2020-01-01T00:00:00Z' };
await commit('stale creation timestamp denied', 'student-a', wrongTimestamp);
await commit('missing parent denied', 'student-a', addComment('orphan', { parentId: 'missing' }));
await commit('reply to reply denied', 'student-a', addComment('nested', { parentId: 'reply' }));
await commit('self parent denied', 'student-a', addComment('self', { parentId: 'self' }));
await commit('non-string parent denied', 'student-a', addComment('parent-type', { parentId: 1 }));
await commit('second video root created', 'student-a', addComment('other-video', { video: video2 }, video2.id), 200);
await commit('cross-video parent denied', 'student-a', addComment('cross', { parentId: 'other-video' }));
await commit('invented video denied', 'student-a', addComment('invented', { video: { ...video, id: 'missing' } }, 'missing'));
await commit('video path mismatch denied', 'student-a', addComment('mismatch', { video: video2 }));
await commit('changed video snapshot denied', 'student-a', addComment('stale-video', { video: { ...video, title: 'Different' } }));
await commit('author cannot edit comment body', 'student-a', write(`${activity}/comments/root`, { body: 'Rewritten' }, null, ['body']));
await commit('author cannot transfer comment', 'student-a', write(`${activity}/comments/root`, { authorUid: 'student-b' }, null, ['authorUid']));
await commit('student cannot delete another comment', 'student-b', remove('root'));
await commit('comment hard delete denied', 'student-a', { writes: [{ delete: `${documentRoot}/${activity}/comments/root` }] });
await commit('author soft deletes own comment', 'student-a', remove('root'), 200);
await commit('cannot restore deleted comment', 'student-a', write(`${activity}/comments/root`, { body: 'Restored', deleted: false }, null, ['body', 'deleted']));
await commit('cannot reply to deleted root', 'student-b', addComment('deleted-parent', { authorUid: 'student-b', parentId: 'root' }));
await commit('teacher soft deletes student reply', 'teacher', remove('reply'), 200);
await commit('student adds heart', 'student-a', react(), 200);
await commit('student switches to thumbs up', 'student-a', react('student-a', { type: 'thumbsUp' }), 200);
await commit('student switches to idea', 'student-a', react('student-a', { type: 'idea' }), 200);
await commit('student switches to clap', 'student-a', react('student-a', { type: 'clap' }), 200);
await commit('other student cannot replace reaction', 'student-b', react('student-a', { authorUid: 'student-b' }));
await commit('reaction document UID must match', 'student-a', react('student-b'));
await commit('reaction author UID must match', 'student-a', react('student-a', { authorUid: 'student-b' }));
await commit('unknown reaction type denied', 'student-a', react('student-a', { type: 'invalid' }));
await commit('extra reaction fields denied', 'student-a', react('student-a', { count: 999 }));
await commit('reaction video path mismatch denied', 'student-a', react('student-a', { video: video2 }));
await commit('reaction nonexistent video denied', 'student-a', react('student-a', { video: { ...video, id: 'missing' } }, 'missing'));
await commit('reaction missing timestamp denied', 'student-a', react('student-a', {}, video.id, null));
const oldReactionTime = react('student-a', {}, video.id, null);
oldReactionTime.writes[0].update.fields.updatedAt = { timestampValue: '2020-01-01T00:00:00Z' };
await commit('reaction stale timestamp denied', 'student-a', oldReactionTime);
await commit('other student cannot delete reaction', 'student-b', { writes: [{ delete: `${documentRoot}/${activity}/reactions/student-a` }] });
await commit('student removes own reaction', 'student-a', { writes: [{ delete: `${documentRoot}/${activity}/reactions/student-a` }] }, 200);
await commit('student recreates reaction', 'student-a', react(), 200);
// The following legacy revocation cases concern nonmembers. Enrolled private
// access and persistence through unpublish are verified in rules-enrollment.mjs.
await memberFixtures(false);
await commit('owner unpublishes class', 'teacher', write(classPath, { ...data, published: false, version: 2 }, 'updatedAt'), 200);
await read('unpublish revokes guest comment reads', `${activity}/comments`);
await read('unpublish revokes student comment reads', `${activity}/comments`, 'student-a');
await read('unpublish revokes student reaction reads', `${activity}/reactions`, 'student-a');
await commit('unpublish revokes new comments', 'student-a', addComment('revoked'));
await commit('unpublish revokes reaction changes', 'student-a', react('student-a', { type: 'clap' }));
await commit('unpublish revokes reaction deletion', 'student-a', { writes: [{ delete: `${documentRoot}/${activity}/reactions/student-a` }] });
await commit('teacher moderates private comment', 'teacher', remove('teacher-private'), 200);
assert.equal(results.filter(item => !item.pass).length, 0, 'all emulator security scenarios pass');
console.log(`PASS ${results.length} video activity rules scenarios`);
