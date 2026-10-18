import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClassCode, normalizeStudentAlias, generateClassCodeValue } from '../enrollment.js';

test('학급 코드는 공백과 하이픈을 제거하고 대문자로 정규화한다', () => {
  assert.equal(normalizeClassCode(' abcd-ef 2345 '), 'ABCDEF2345');
  assert.equal(normalizeClassCode('ABCDEF2345'), 'ABCDEF2345');
  for (const input of ['', 'ABC', 'ABCDEFGHIJ', 'ABCDEO2345', 'ABCDE12345', 'ABCDE02345', 'ABCDEF23456', '../ABC2345', null, 123]) {
    assert.throws(() => normalizeClassCode(input), /학급 코드/);
  }
});

test('학생 별명은 앞뒤 공백을 제거하고 1~20자 경계를 검증한다', () => {
  assert.equal(normalizeStudentAlias('  12번 별명  '), '12번 별명');
  assert.equal(normalizeStudentAlias('가'.repeat(20)).length, 20);
  for (const value of ['', ' \n ', '가'.repeat(21), null, 1]) assert.throws(() => normalizeStudentAlias(value), /별명/);
});

test('코드 생성기는 32자 alphabet으로 모든 바이트를 편향 없이 변환한다', () => {
  let calls = 0;
  const random = { getRandomValues(bytes) {
    calls++;
    bytes.set([248, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    return bytes;
  } };
  assert.equal(generateClassCodeValue(random), 'SZ23456789');
  assert.equal(calls, 1);
  const frequencies = new Map();
  for (let byte = 0; byte < 256; byte++) {
    const character = generateClassCodeValue({ getRandomValues: bytes => bytes.fill(byte) })[0];
    frequencies.set(character, (frequencies.get(character) || 0) + 1);
  }
  assert.equal(frequencies.size, 32);
  assert.equal([...frequencies.values()].every(count => count === 8), true);
  assert.throws(() => generateClassCodeValue({}), /안전한/);
});

test('실제 Web Crypto 난수로 생성한 코드는 유효한 10자리이다', () => {
  for (let i = 0; i < 30; i++) {
    const code = generateClassCodeValue();
    assert.equal(normalizeClassCode(code), code);
    assert.equal(code.length, 10);
  }
});
