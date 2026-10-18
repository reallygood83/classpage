export const REACTIONS = [
  { type: 'heart', label: '좋아요', emoji: '❤️' },
  { type: 'thumbsUp', label: '최고예요', emoji: '👍' },
  { type: 'idea', label: '새롭게 알았어요', emoji: '💡' },
  { type: 'clap', label: '응원해요', emoji: '👏' },
];

export function normalizeCommentInput({ alias, body, parentId = '' }) {
  if (typeof alias !== 'string' || !alias.trim() || alias.trim().length > 20) {
    throw new Error('별명을 1~20자로 입력해 주세요.');
  }
  if (typeof body !== 'string' || !body.trim() || body.trim().length > 1000) {
    throw new Error('댓글을 1~1000자로 입력해 주세요.');
  }
  if (typeof parentId !== 'string' || (parentId !== '' && !/^[A-Za-z0-9_-]{1,128}$/.test(parentId))) {
    throw new Error('답글을 달 댓글을 다시 선택해 주세요.');
  }
  return { alias: alias.trim(), body: body.trim(), parentId };
}

export function summarizeReactions(reactions, uid) {
  const counts = Object.fromEntries(REACTIONS.map(({ type }) => [type, 0]));
  const seen = new Set();
  let mine = null;
  for (const reaction of reactions) {
    if (!reaction || typeof reaction.authorUid !== 'string' || !reaction.authorUid
      || !Object.hasOwn(counts, reaction.type) || seen.has(reaction.authorUid)) continue;
    seen.add(reaction.authorUid);
    counts[reaction.type] += 1;
    if (uid && reaction.authorUid === uid) mine = reaction.type;
  }
  return { counts, mine };
}
