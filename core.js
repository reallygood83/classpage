export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

export function youtubeId(input) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    let id;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now);
}
export function daysUntil(date, today = todayKey()) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export function deadlineLabel(date) {
  const days = daysUntil(date);
  return days < 0 ? '마감' : days === 0 ? '오늘 마감' : `D-${days}`;
}
export function shortDate(date) {
  if (!date) return '날짜 없음';
  const [, month, day] = date.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}
export function totalPoints(student) {
  return (student.history || []).reduce((total, entry) => total + (Number.isSafeInteger(entry.amount) ? entry.amount : 0), 0);
}
export function makeDemo() {
  const date = offset => { const now = new Date(`${todayKey()}T00:00:00Z`); now.setUTCDate(now.getUTCDate() + offset); return now.toISOString().slice(0, 10); };
  return {
    id: 'demo', name: '2학년 3반', ownerUid: 'demo', published: false, version: 0,
    notices: [
      {id:'n1', title:'이번 주 우리 반 소식', category:'학급', body:'금요일 학급회의에서는 우리 반 독서 공간을 함께 꾸밀 예정입니다. 각자 좋아하는 책 한 권과 추천 이유를 준비해 주세요.', pinned:true, date:date(0)},
      {id:'n2', title:'체육대회 준비물 안내', category:'학교', body:'편한 운동화와 개인 물병을 챙겨 주세요. 자세한 일정은 담임 선생님의 안내를 확인해 주세요.', pinned:false, date:date(-1)},
      {id:'n3', title:'도서관에서 만나는 새로운 책', category:'학급', body:'점심시간에 도서관을 방문해 이번 달에 읽고 싶은 책을 골라 봅시다.', pinned:false, date:date(-2)}
    ],
    assessments: [
      {id:'a1', title:'나의 관점으로 쓰는 서평', subject:'국어', due:date(2), body:'선택한 책의 핵심 내용과 자신의 생각을 정리한 서평을 제출합니다.', done:false},
      {id:'a2', title:'생활 속 확률 탐구', subject:'수학', due:date(5), body:'일상에서 발견한 확률 사례를 조사하고 탐구 보고서를 작성합니다.', done:false},
      {id:'a3', title:'기후변화 해결 아이디어', subject:'통합과학', due:date(8), body:'모둠별로 실천 가능한 해결 아이디어를 발표합니다.', done:false}
    ],
    students: Array.from({length:6}, (_, i) => ({id:`s${i}`, alias:`${i+1}번`, history:[{id:`h${i}`, amount:[12,8,15,6,10,9][i], reason:'예시 칭찬 기록', date:date(-1)}]})),
    videos: [{id:'v1', title:'함께 생각하는 작은 도전', videoId:'5MgBikgcWnY', note:'영상을 보고 오늘 내가 도전하고 싶은 일을 나눠 봅시다.'}]
  };
}
