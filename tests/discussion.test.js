import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCommentInput, summarizeReactions, REACTIONS } from '../discussion.js';

test('댓글은 양끝 공백을 정리하고 원문과 답글 연결을 보존한다', () => {
  assert.deepEqual(normalizeCommentInput({ alias: '  12번  ', body: '  생각 하나\n생각 둘  ' }), { alias: '12번', body: '생각 하나\n생각 둘', parentId: '' });
  assert.deepEqual(normalizeCommentInput({ alias: '학생', body: '<좋아요>', parentId: 'comment-123' }), { alias: '학생', body: '<좋아요>', parentId: 'comment-123' });
});

test('별명과 댓글의 빈 값, 타입, 길이 및 답글 경로를 검증한다', () => {
  for (const alias of ['', ' \n ', '가'.repeat(21), null, 12]) assert.throws(() => normalizeCommentInput({ alias, body: '댓글' }), /별명/);
  for (const body of ['', '\n ', '가'.repeat(1001), null, 12]) assert.throws(() => normalizeCommentInput({ alias: '학생', body }), /댓글/);
  for (const parentId of ['a/b', '../x', ' ', 'x'.repeat(129), null, 1]) assert.throws(() => normalizeCommentInput({ alias: '학생', body: '댓글', parentId }), /답글/);
  assert.equal(normalizeCommentInput({ alias: '가'.repeat(20), body: '나'.repeat(1000) }).body.length, 1000);
});

test('반응 집계는 사용자별 한 표와 내 선택을 제공한다', () => {
  assert.deepEqual(summarizeReactions([
    { authorUid: 'a', type: 'heart' }, { authorUid: 'b', type: 'idea' },
    { authorUid: 'c', type: 'heart' }, { authorUid: 'd', type: 'clap' },
  ], 'b'), { counts: { heart: 2, thumbsUp: 0, idea: 1, clap: 1 }, mine: 'idea' });
  assert.equal(summarizeReactions([{ authorUid: 'a', type: 'heart' }], null).mine, null);
});

test('중복 사용자와 유효하지 않은 반응은 집계를 오염시키지 않는다', () => {
  const result = summarizeReactions([
    { authorUid: 'a', type: 'thumbsUp' }, { authorUid: 'a', type: 'heart' },
    { authorUid: 'b', type: '__proto__' }, { authorUid: '', type: 'heart' },
    null, { type: 'clap' }, { authorUid: 'c', type: 'invalid' },
  ], 'a');
  assert.deepEqual(result, { counts: { heart: 0, thumbsUp: 1, idea: 0, clap: 0 }, mine: 'thumbsUp' });
  assert.deepEqual(REACTIONS.map(({ type }) => type), ['heart', 'thumbsUp', 'idea', 'clap']);
  assert.equal(REACTIONS.every(({ label, emoji }) => label && emoji), true);
});
