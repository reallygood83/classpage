const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function normalizeClassCode(input) {
  if (typeof input !== 'string') throw new Error('선생님이 알려 준 10자리 학급 코드를 입력해 주세요.');
  const code = input.replace(/[\s-]/g, '').toUpperCase();
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/.test(code)) {
    throw new Error('학급 코드는 혼동하기 쉬운 문자를 제외한 영문·숫자 10자리입니다.');
  }
  return code;
}

export function normalizeStudentAlias(input) {
  if (typeof input !== 'string' || !input.trim() || input.trim().length > 20) {
    throw new Error('학급에서 사용할 별명 또는 번호를 1~20자로 입력해 주세요.');
  }
  return input.trim();
}

export function generateClassCodeValue(random = globalThis.crypto) {
  if (typeof random?.getRandomValues !== 'function') throw new Error('안전한 학급 코드를 만들 수 없는 브라우저입니다.');
  const cutoff = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let code = '';
  while (code.length < 10) {
    const bytes = random.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < cutoff) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === 10) return code;
    }
  }
  return code;
}
