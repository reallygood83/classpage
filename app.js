import {escapeHTML as e, youtubeId, todayKey, daysUntil, deadlineLabel, shortDate, totalPoints, makeDemo} from './core.js';
import {REACTIONS, normalizeCommentInput, summarizeReactions} from './discussion.js';

const root = document.querySelector('#app');
const dialog = document.querySelector('#editor');
const params = new URLSearchParams(location.search);
const demo = params.get('demo') === '1';
const viewOnly = params.get('view') === '1';
let data = null, user = null, backend = null, unsubscribe = null, authUnsubscribe = null;
let section = 'home', filter = '전체', search = '', saving = false, classes = [], loading = !!params.get('class');
let toastTimer;
let editorVersion;
let activityStop = null, activityContext = '', activeVideoKey = null;
let activity = {comments:[], reactions:[]}, activityLoading = false, activityError = '';
let activityBusy = false;
const discussionDrafts = new Map();
const participantUid = () => demo ? 'demo-participant' : user?.uid;
function storedAlias() { try { return localStorage.getItem('classpage-discussion-alias') || ''; } catch { return ''; } }
function draftFor(key) { if(!discussionDrafts.has(key)) discussionDrafts.set(key,{alias:storedAlias(),body:'',parentId:''});return discussionDrafts.get(key); }
const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',
  notice:'<path d="M4 5h16v15H4zM8 3v4m8-4v4M8 11h8m-8 4h5"/>',
  assessment:'<path d="M7 3h10v4H7zM7 5H4v16h16V5h-3M8 12l2 2 5-5M8 18h8"/>',
  points:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  video:'<rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8"/>',
  book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v15"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.home}</svg>`;
const canEdit = () => data && !viewOnly && (demo || user?.uid === data.ownerUid);
const errorText = error => error?.code && backend ? backend.getErrorMessage(error) : error.message || '작업을 완료하지 못했습니다.';
const id = () => crypto.randomUUID();
const empty = (text, detail = '') => `<div class="empty">${icon('book')}<strong>${text}</strong><p>${detail}</p></div>`;
function toast(message) { clearTimeout(toastTimer); const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); toastTimer = setTimeout(() => el.classList.remove('visible'), 5000); }

function render() {
  if (!data) return renderWelcome();
  const nav = [['home','우리 반 홈'],['notice','공지 사항'],['assessment','수행평가'],['points','칭찬 상점'],['video','함께 보는 영상']];
  const active = nav.find(([key]) => key === section);
  const date = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'long', day:'numeric', weekday:'long'}).format(new Date());
  root.innerHTML = `<div class="shell">
    <aside class="sidebar"><a class="brand" href="/">${icon('book')}<span>클래스페이지<small>우리 반의 하루를 한곳에</small></span></a>
      <div class="class-badge"><span class="class-avatar">${icon('home')}</span><div><strong>${e(data.name)}</strong><small>${demo ? '예시 학급 · 이 기기에 저장' : canEdit() ? '선생님 관리 공간' : '학생 공유 공간'}</small></div></div>
      <p class="nav-label">CLASSROOM</p><nav>${nav.map(([key,label]) => `<button class="nav-item ${section===key?'active':''}" data-nav="${key}" ${section===key?'aria-current="page"':''}>${icon(key)}<span>${label}</span>${key==='assessment'?`<small>${data.assessments.filter(a=>!a.done&&daysUntil(a.due)>=0).length}</small>`:''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="sidebar-note">작은 소식이 모여<br>우리 반의 하루가 됩니다.</div>${canEdit()?'<button class="text-button" data-action="settings">학급 설정</button>':''}<a href="/" class="text-button">${demo?'예시 나가기':'학급 선택으로'}</a></div>
    </aside>
    <div class="main-wrap"><header class="topbar"><span>우리 반 / <strong>${active[1]}</strong></span><div class="top-actions">${canEdit()?`<button class="button secondary compact" data-action="share">${icon('share')} 학급 공유</button>`:''}<span class="user-chip">${canEdit()?'교사':'학생'}${demo?' · 예시':''}</span>${user?'<button class="text-button" data-action="logout">로그아웃</button>':''}</div></header>
    <main><div class="page-heading"><div><div class="eyebrow">${e(date)}</div><h1>${section==='home'?'반가워요, 우리 반!':active[1]}</h1><p>${{home:'오늘 꼭 알아야 할 소식, 여기서 함께 확인해요.',notice:'놓치지 말아야 할 학교와 학급의 소식입니다.',assessment:'미리 확인하고, 차근차근 준비해요.',points:'서로의 좋은 행동을 발견하고 응원해요.',video:'좋은 이야기는 함께 볼 때 더 커집니다.'}[section]}</p></div>${canEdit() && section!=='home'?`<button class="button primary" data-action="add">${icon('plus')} ${{notice:'공지 등록',assessment:'수행평가 등록',points:'학생 추가',video:'영상 추가'}[section]}</button>`:''}</div>
    ${demo?'<div class="demo-banner"><span>예시 학급입니다. 변경 내용은 이 브라우저에만 저장됩니다.</span><button data-action="reset-demo">예시 초기화</button></div>':''}
    ${section==='home'?renderHome():section==='notice'?renderNotices():section==='assessment'?renderAssessments():section==='points'?renderPoints():renderVideos()}
    <footer>클래스페이지 <span>우리 반을 잇는 작은 공간</span></footer></main></div></div>`;
  syncVideoActivity();
}

function renderWelcome() {
  stopVideoActivity();
  root.innerHTML = `<div class="welcome"><header><a class="brand" href="/">${icon('book')}<span>클래스페이지</span></a><span class="welcome-tag">FOR YOUR CLASSROOM</span></header>
  <main class="welcome-main"><div class="eyebrow">우리 반을 잇는 작은 공간</div><h1>우리 반의 모든 소식,<br><em>한 페이지에.</em></h1><p>쌓이는 공지와 수행평가 일정부터<br>작은 칭찬과 함께 보는 영상까지, 한곳에서 나눠요.</p>
  ${loading?'<div class="loading-panel" role="status">학급을 불러오는 중입니다…</div>':`<div class="welcome-actions">${user?'<button class="button primary" data-action="create">새 학급 만들기</button>':'<button class="button primary" data-action="login"><span class="google-g">G</span> Google로 선생님 로그인</button>'}<a class="button secondary" href="?demo=1">예시 학급 둘러보기 ${icon('arrow')}</a></div>${user?`<div class="class-list"><h2>내 학급</h2>${classes.length?classes.map(c=>`<a href="?class=${encodeURIComponent(c.id)}">${icon('home')} ${e(c.name)} ${icon('arrow')}</a>`).join(''):'<p>새 학급을 만들고 첫 소식을 전해 보세요.</p>'}</div><button class="text-button" data-action="logout">로그아웃</button>`:'<small class="welcome-help">학생은 선생님이 보내 준 학급 공유 링크로 들어오세요.</small>'}`}
  <div id="welcome-error" role="alert"></div>
  <div class="feature-grid">${[['notice','흩어진 공지, 한곳에','학급·학교 소식을 모아 확인해요.'],['assessment','마감일을 한눈에','수행평가를 여유 있게 준비해요.'],['points','작은 실천에 큰 칭찬','좋은 행동을 상점으로 기록해요.'],['video','함께 보고 이야기해요','유튜브 링크만으로 영상을 공유해요.']].map(([key,title,desc])=>`<article><div class="feature-icon ${key}">${icon(key)}</div><h2>${title}</h2><p>${desc}</p></article>`).join('')}</div>
  </main><footer>클래스페이지 · 우리 반의 하루를 한곳에</footer></div>`;
}

function noticeCard(n, compact=false) {
  return `<article class="notice-card ${n.pinned?'pinned':''}"><div class="card-top"><span class="tag ${n.category==='학교'?'lavender':'blue'}">${e(n.category)}</span>${n.pinned?'<span class="pinned-label">고정 공지</span>':''}<time>${shortDate(n.date)}</time></div><h3>${e(n.title)}</h3><p class="${compact?'clamp':''}">${e(n.body)}</p>${canEdit()?`<div class="card-actions"><button data-edit="notice:${e(n.id)}">수정</button><button data-delete="notice:${e(n.id)}">삭제</button></div>`:''}</article>`;
}
function assessmentCard(a) {
  const expired = daysUntil(a.due)<0;
  return `<article class="assessment-card ${a.done?'completed':''}"><div class="subject-icon">${e(a.subject.slice(0,1))}</div><div class="assessment-content"><span class="subject-name">${e(a.subject)}</span><h3>${e(a.title)}</h3><p>${e(a.body)}</p><time>마감 ${shortDate(a.due)}</time></div><div class="assessment-side"><span class="deadline ${expired||a.done?'muted':daysUntil(a.due)<=3?'urgent':''}">${a.done?'종료':deadlineLabel(a.due)}</span>${canEdit()?`<div class="card-actions"><button data-edit="assessment:${e(a.id)}">수정</button><button data-toggle="${e(a.id)}">${a.done?'다시 열기':'종료'}</button><button data-delete="assessment:${e(a.id)}">삭제</button></div>`:''}</div></article>`;
}
function renderHome() {
  const upcoming = [...data.assessments].filter(a=>!a.done&&daysUntil(a.due)>=0).sort((a,b)=>a.due.localeCompare(b.due));
  const notices = [...data.notices].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.date.localeCompare(a.date));
  return `<section class="hero-banner"><div class="hero-copy"><span class="hero-label">OUR CLASS, OUR STORY</span><h2>함께 만드는<br>더 좋은 우리 반</h2><p>소식을 확인하고, 서로를 응원하며, 함께 성장해요.</p><button data-nav="assessment">이번 주 수행평가 확인하기 ${icon('arrow')}</button></div><img class="hero-photo" src="assets/classroom-hero.jpg" width="1536" height="1024" alt="밝은 교실에서 함께 프로젝트를 준비하는 학생들의 AI 생성 이미지" fetchpriority="high"></section>
  <div class="stats-grid">${[['notice','새로운 소식',data.notices.length,'개의 공지'],['assessment','다가오는 수행평가',upcoming.length,'개의 일정'],['points','우리 반 칭찬',data.students.reduce((s,n)=>s+totalPoints(n),0),'점의 좋은 실천'],['video','함께 보는 영상',data.videos.length,'개의 이야기']].map(([key,label,count,unit])=>`<button class="stat-card" data-nav="${key}"><span class="stat-icon ${key}">${icon(key)}</span><span><small>${label}</small><strong>${count}<em>${unit}</em></strong></span>${icon('arrow')}</button>`).join('')}</div>
  <div class="home-grid"><section><div class="section-heading"><h2>우리 반 공지 <span>${data.notices.length}</span></h2><button data-nav="notice">전체 보기 ${icon('arrow')}</button></div><div class="notice-grid">${notices.slice(0,2).map(n=>noticeCard(n,true)).join('')||empty('아직 등록된 공지가 없어요','첫 소식을 기다리고 있어요.')}</div></section><section><div class="section-heading"><h2>다가오는 수행평가</h2><button data-nav="assessment">전체 보기 ${icon('arrow')}</button></div><div class="upcoming-list">${upcoming.slice(0,3).map(a=>`<button data-nav="assessment"><span class="deadline ${daysUntil(a.due)<=3?'urgent':''}">${deadlineLabel(a.due)}</span><span><small>${e(a.subject)}</small><strong>${e(a.title)}</strong></span><time>${shortDate(a.due)}</time></button>`).join('')||empty('다가오는 수행평가가 없어요')}</div></section></div>
  <div class="quick-note">${icon('points')}<div><strong>오늘 발견한 좋은 행동, 칭찬으로 남겨요.</strong><p>작은 배려와 꾸준한 노력이 우리 반을 더 따뜻하게 만듭니다.</p></div><button class="button secondary" data-nav="points">칭찬 상점 보기 ${icon('arrow')}</button></div>`;
}
function renderNotices() {
  const list = [...data.notices].filter(n=>(filter==='전체'||n.category===filter)&&`${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.date.localeCompare(a.date));
  return `<div class="toolbar"><div class="tabs">${['전체','학급','학교'].map(c=>`<button data-filter="${c}" class="${filter===c?'selected':''}" aria-pressed="${filter===c}">${c}</button>`).join('')}</div><input type="search" id="search" aria-label="공지 검색" placeholder="궁금한 공지를 검색해요" value="${e(search)}"></div><div class="notice-grid full">${list.map(n=>noticeCard(n)).join('')||empty('찾는 공지가 없어요','검색어를 바꾸거나 새 공지를 등록해 주세요.')}</div>`;
}
function renderAssessments() {
  const list = [...data.assessments].filter(a=>filter==='전체'||(filter==='진행 중'?!a.done&&daysUntil(a.due)>=0:a.done||daysUntil(a.due)<0)).sort((a,b)=>a.due.localeCompare(b.due));
  return `<div class="toolbar"><div class="tabs">${['전체','진행 중','마감·종료'].map(c=>`<button data-filter="${c}" class="${filter===c?'selected':''}" aria-pressed="${filter===c}">${c}</button>`).join('')}</div><span class="helper">날짜는 한국 시간 기준입니다.</span></div><div class="assessment-list">${list.map(assessmentCard).join('')||empty('등록된 수행평가가 없어요','과목별 일정과 준비할 내용을 알려 주세요.')}</div>`;
}
function renderPoints() {
  return `<div class="points-intro"><div><span class="eyebrow">EVERY LITTLE KINDNESS COUNTS</span><h2>좋은 행동이 차곡차곡</h2><p>경쟁보다 서로를 응원하는 칭찬을 모아요.</p></div><div class="points-total"><strong>${data.students.reduce((s,n)=>s+totalPoints(n),0)}</strong><span>우리 반이 모은 상점</span></div></div><div class="students-grid">${data.students.map(s=>`<article class="student-card"><span class="student-avatar">${e(s.alias.slice(0,2))}</span><h3>${e(s.alias)}</h3><strong class="point-number">${totalPoints(s)}<small>점</small></strong>${canEdit()?`<button class="button secondary" data-award="${e(s.id)}">${icon('plus')} 칭찬하기</button>`:''}<button class="history-button" data-history="${e(s.id)}">칭찬 기록 보기</button>${canEdit()?`<button class="student-delete" data-delete="points:${e(s.id)}" aria-label="${e(s.alias)} 삭제">×</button>`:''}</article>`).join('')||empty('함께할 학생을 추가해 주세요','실명 대신 번호나 별칭을 사용해 주세요.')}</div>`;
}
function renderVideos() {
  if(!data.videos.some(v=>v.id===activeVideoKey)) activeVideoKey=data.videos[0]?.id || null;
  return `<div class="video-grid">${data.videos.map(v=>`<article class="video-card"><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${e(v.videoId)}" title="${e(v.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="video-description"><span class="tag blue">함께 보는 영상</span><h3>${e(v.title)}</h3><p>${e(v.note)}</p><a target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/watch?v=${e(v.videoId)}">YouTube에서 보기 ↗</a>${canEdit()?`<div class="card-actions"><button data-edit="video:${e(v.id)}">수정</button><button data-delete="video:${e(v.id)}">삭제</button></div>`:''}</div>${v.id===activeVideoKey?discussionPanel(v):`<button class="discussion-open" data-discuss="${e(v.id)}">이 영상의 댓글·반응 보기 ${icon('arrow')}</button>`}</article>`).join('')||empty('함께 보고 싶은 영상을 담아 주세요','유튜브 주소를 넣으면 영상이 바로 표시됩니다.')}</div><p class="helper video-help">업로더가 임베딩을 제한한 영상은 YouTube에서 보기로 열어 주세요.</p>`;
}

function discussionPanel(video) {
  const draft=draftFor(video.id);
  return `<section id="video-community" class="video-community" aria-label="${e(video.title)} 댓글과 반응">
    <div class="community-heading"><h4>함께 나누는 생각</h4><span>${demo?'이 브라우저에 저장':'실시간 대화'}</span></div>
    <p class="community-guide">마음에 남은 장면, 서로 다른 생각을 나눠요.</p>
    <div class="reaction-group" aria-label="영상 반응"></div>
    ${participantUid()?`<form id="comment-form" data-video="${e(video.id)}"><label class="alias-label">참여 별칭<input name="alias" aria-label="참여 별칭" maxlength="20" placeholder="예: 7번 · 별빛" value="${e(draft.alias)}" required></label><div class="reply-context"></div><label class="comment-label">내 생각 남기기<textarea name="body" aria-label="내 생각 남기기" rows="3" maxlength="1000" placeholder="어떤 생각이 들었나요? 서로를 존중하며 이야기해요." required>${e(draft.body)}</textarea></label><div class="comment-submit"><span>실명·연락처 대신 별칭을 사용해요.</span><button type="submit" class="button primary compact">댓글 등록</button></div></form>`:`<div class="discussion-login"><p>댓글과 반응을 남기려면 Google로 로그인해 주세요.<br>친구들에게는 참여 별칭만 표시됩니다.</p><button class="button secondary compact" data-action="login">Google로 참여하기</button></div>`}
    <p class="activity-status" role="status"></p><div class="comment-list" aria-label="영상 댓글"></div>
    <p class="community-footnote">최근 댓글·답글 100개를 보여 줍니다. 공개 학급의 대화는 공유 링크로 볼 수 있어요.</p>
  </section>`;
}
function stopVideoActivity() {
  if(activityStop) activityStop();
  activityStop=null;activityContext='';activity={comments:[],reactions:[]};activityLoading=false;activityError='';
}
function readDemoActivity() {
  try { return JSON.parse(localStorage.getItem('classpage-video-activity-v1') || '{}'); } catch { return {}; }
}
function saveDemoActivity() {
  const all=readDemoActivity();all[activeVideoKey]=activity;
  localStorage.setItem('classpage-video-activity-v1',JSON.stringify(all));
}
function syncVideoActivity() {
  if(section!=='video'||!activeVideoKey||!data){stopVideoActivity();return;}
  const context=`${data.id}:${activeVideoKey}:${participantUid() || 'guest'}:${data.published}`;
  if(context===activityContext){refreshVideoActivity();return;}
  stopVideoActivity();activityContext=context;
  if(demo){const saved=readDemoActivity()[activeVideoKey];activity={comments:Array.isArray(saved?.comments)?saved.comments:[],reactions:Array.isArray(saved?.reactions)?saved.reactions:[]};refreshVideoActivity();return;}
  activityLoading=true;refreshVideoActivity();
  try { activityStop=backend.subscribeVideoActivity(data.id,activeVideoKey,current=>{
    if(activityContext!==context)return;activity=current;activityLoading=false;activityError='';refreshVideoActivity();
  },error=>{if(activityContext!==context)return;activityLoading=false;activityError=errorText(error);refreshVideoActivity();}); }
  catch(error){activityLoading=false;activityError=errorText(error);refreshVideoActivity();}
}
function commentTime(comment) {
  const value=comment.createdAt;
  const date=value?.toDate?value.toDate():new Date(typeof value==='string'?value:0);
  return date.getTime()?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(date):'방금';
}
function refreshVideoActivity() {
  const panel=document.querySelector('#video-community');if(!panel)return;
  const {counts,mine}=summarizeReactions(activity.reactions,participantUid());
  panel.querySelector('.reaction-group').innerHTML=REACTIONS.map(r=>`<button class="reaction-button ${mine===r.type?'selected':''}" data-reaction="${r.type}" aria-pressed="${mine===r.type}" aria-label="${e(r.label)} 반응 ${counts[r.type]}개" ${activityBusy||activityLoading||activityError?'disabled':''}><span aria-hidden="true">${r.emoji}</span> ${e(r.label)} <strong>${counts[r.type]}</strong></button>`).join('');
  const status=panel.querySelector('.activity-status');
  status.textContent=activityError|| (activityLoading?'대화를 불러오는 중입니다…':'');
  if(activityError)status.innerHTML=`${e(activityError)} <button class="text-button" data-action="retry-discussion">다시 시도</button>`;
  const submit=panel.querySelector('[type=submit]');if(submit)submit.disabled=activityBusy||activityLoading||!!activityError;
  const form=panel.querySelector('#comment-form');
  if(form){form.setAttribute('aria-busy',String(activityBusy));form.querySelectorAll('input,textarea').forEach(input=>{input.disabled=activityBusy;});}
  if(submit)submit.textContent=activityBusy?'등록 중…':'댓글 등록';
  const draft=draftFor(activeVideoKey), parent=activity.comments.find(c=>c.id===draft.parentId);
  const reply=panel.querySelector('.reply-context');
  if(reply)reply.innerHTML=draft.parentId?`<span>${e(parent?.alias || '이전 댓글')}에게 답글을 남기는 중</span><button type="button" data-action="cancel-reply" ${activityBusy?'disabled':''}>취소</button>`:'';
  const comments=[...activity.comments].sort((a,b)=>{
    const ms=c=>c.createdAt?.toMillis?.() || Date.parse(c.createdAt) || 0;
    return ms(a)-ms(b)||a.id.localeCompare(b.id);
  });
  const commentHTML=(c,isReply=false)=>`<article class="discussion-comment ${isReply?'is-reply':''}"><div class="comment-meta"><strong>${e(c.deleted?'삭제된 댓글':c.alias)}</strong><time>${e(commentTime(c))}</time>${c.authorUid===participantUid()&&!c.deleted?'<span class="my-comment">내 글</span>':''}</div>${isReply&&!comments.some(p=>p.id===c.parentId)?'<small class="orphan-reply">이전 댓글에 대한 답글</small>':''}<p class="comment-body ${c.deleted?'deleted':''}">${e(c.deleted?'삭제된 댓글입니다.':c.body)}</p><div class="comment-actions">${participantUid()&&!c.deleted&&!c.parentId?`<button data-reply="${e(c.id)}" ${activityBusy?'disabled':''}>답글</button>`:''}${!c.deleted&&(canEdit()||c.authorUid===participantUid())?`<button data-remove-comment="${e(c.id)}" ${activityBusy?'disabled':''}>${c.authorUid===participantUid()?'삭제':'선생님 삭제'}</button>`:''}</div></article>`;
  panel.querySelector('.comment-list').innerHTML=comments.filter(c=>!c.parentId||!comments.some(p=>p.id===c.parentId)).map(c=>commentHTML(c,!!c.parentId)+comments.filter(r=>r.parentId===c.id).map(r=>commentHTML(r,true)).join('')).join('')||(!activityLoading&&!activityError?'<p class="comments-empty">첫 번째 생각을 나눠 주세요.</p>':'');
}
async function submitComment(form) {
  if(activityBusy)return;
  const key=form.dataset.video, video=data?.videos.find(v=>v.id===key);
  if(!video||key!==activeVideoKey)throw new Error('영상을 다시 선택해 주세요.');
  if(!participantUid())throw new Error('Google로 로그인한 뒤 참여해 주세요.');
  const draft=draftFor(key), input=normalizeCommentInput({...draft,alias:form.elements.alias.value,body:form.elements.body.value});
  activityBusy=true;refreshVideoActivity();
  try {
    if(demo){
      if(input.parentId&&!activity.comments.some(c=>c.id===input.parentId&&!c.parentId&&!c.deleted))throw new Error('답글을 달 댓글을 다시 선택해 주세요.');
      activity.comments.push({id:id(),...input,authorUid:participantUid(),video:structuredClone(video),deleted:false,createdAt:new Date().toISOString()});
      activity.comments=activity.comments.slice(-100);saveDemoActivity();
    } else await backend.addVideoComment(data.id,video,input);
    try{localStorage.setItem('classpage-discussion-alias',input.alias);}catch{}
    discussionDrafts.set(key,{alias:input.alias,body:'',parentId:''});
    const currentForm=root.querySelector('#comment-form');
    if(currentForm?.dataset.video===key){currentForm.elements.body.value='';currentForm.elements.alias.value=input.alias;}
    toast(input.parentId?'답글을 남겼습니다.':'생각을 남겼습니다.');
  } finally {activityBusy=false;refreshVideoActivity();}
}
root.addEventListener('submit',event=>{if(event.target.id!=='comment-form')return;event.preventDefault();submitComment(event.target).catch(error=>toast(errorText(error)));});

const collections = {notice:'notices',assessment:'assessments',points:'students',video:'videos'};
function openDialog(title, content, submit, label='저장하기') {
  editorVersion=data?.version;
  dialog.innerHTML = `<form id="edit-form"><div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button type="button" class="close-button" data-close aria-label="닫기">×</button></div>${content}<p id="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close>취소</button>${submit?`<button class="button primary" type="submit">${label}</button>`:''}</div></form>`;
  dialog.showModal();
  dialog.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>dialog.close());
  dialog.querySelector('form').onsubmit=async event=>{ event.preventDefault(); const button=dialog.querySelector('[type=submit]'); if(!submit||button.disabled)return; button.disabled=true; try {await submit(new FormData(event.target)); dialog.close();} catch(error){dialog.querySelector('#form-error').textContent=errorText(error);button.disabled=false;} };
}
const field = (label,name,value='',type='text',max=120) => `<label>${label}<input name="${name}" type="${type}" value="${e(value)}" required ${type==='text'?`maxlength="${max}"`:''}></label>`;
const area = (label,name,value='',required=false) => `<label>${label}<textarea name="${name}" rows="4" maxlength="2000" ${required?'required':''}>${e(value)}</textarea></label>`;
async function mutate(change) {
  if(!canEdit()) throw new Error('학급을 만든 선생님만 수정할 수 있습니다.');
  if(saving) throw new Error('저장이 끝난 뒤 다시 시도해 주세요.');
  if(dialog.open && editorVersion!==data.version) throw new Error('편집 중 다른 창에서 내용이 변경되었습니다. 창을 닫고 최신 내용을 확인한 뒤 다시 입력해 주세요.');
  saving=true;
  try {
    const next=structuredClone(data); change(next);
    if(demo) { next.version++; localStorage.setItem('classpage-demo-v1',JSON.stringify(next)); }
    else next.version=await backend.saveClass(data.id,next);
    data=next; render(); toast(demo?'예시 학급에 저장했습니다.':'저장했습니다.');
  } finally { saving=false; }
}
function editItem(kind,itemId) {
  if(!canEdit()) return;
  const item=data[collections[kind]].find(i=>i.id===itemId)||{};
  const titles={notice:'공지',assessment:'수행평가',points:'학생',video:'영상'};
  let content;
  if(kind==='notice') content=field('공지 제목','title',item.title)+`<label>분류<select name="category"><option ${item.category==='학급'?'selected':''}>학급</option><option ${item.category==='학교'?'selected':''}>학교</option></select></label>`+area('공지 내용','body',item.body,true)+`<label class="checkbox"><input type="checkbox" name="pinned" ${item.pinned?'checked':''}> 중요한 공지로 고정</label>`;
  if(kind==='assessment') content=field('과목','subject',item.subject,'text',30)+field('수행평가 제목','title',item.title)+field('마감일','due',item.due||todayKey(),'date')+area('준비할 내용 · 제출 방법','body',item.body);
  if(kind==='points') content='<p class="dialog-helper">학생에게 보여 줄 번호나 별칭을 입력하세요.</p>'+field('번호 또는 별칭','alias',item.alias,'text',20);
  if(kind==='video') content=field('영상 제목','title',item.title)+field('유튜브 주소','url',item.videoId?`https://www.youtube.com/watch?v=${item.videoId}`:'','url')+area('함께 나눌 이야기','note',item.note);
  openDialog(`${titles[kind]} ${itemId?'수정':'등록'}`,content,async form=>{
    const values=Object.fromEntries(form); for(const key of Object.keys(values)) if(typeof values[key]==='string') values[key]=values[key].trim();
    for(const key of kind==='points'?['alias']:kind==='assessment'?['subject','title','due']:['title']) if(!values[key]) throw new Error('필수 항목을 입력해 주세요.');
    if(kind==='notice') { if(!values.body)throw new Error('공지 내용을 입력해 주세요.'); values.pinned=form.has('pinned');values.date=item.date||todayKey(); }
    if(kind==='assessment') { if(!/^\d{4}-\d{2}-\d{2}$/.test(values.due))throw new Error('마감일을 확인해 주세요.'); values.done=item.done||false; }
    if(kind==='points') { if(data.students.some(s=>s.alias===values.alias&&s.id!==itemId))throw new Error('이미 사용 중인 번호 또는 별칭입니다.'); values.history=item.history||[]; }
    if(kind==='video') { values.videoId=youtubeId(values.url); delete values.url;if(!values.videoId)throw new Error('올바른 유튜브 영상 주소를 넣어 주세요.'); }
    await mutate(next=>{const list=next[collections[kind]]; const index=list.findIndex(i=>i.id===itemId); if(index<0){const limit={notice:100,assessment:100,points:60,video:50}[kind];if(list.length>=limit)throw new Error(`최대 ${limit}개까지 등록할 수 있습니다.`);list.push({id:id(),...values});}else list[index]={...item,...values};});
  });
}
function history(studentId) {
  const s=data.students.find(s=>s.id===studentId);
  openDialog(`${e(s.alias)}의 칭찬 기록`, `<p class="dialog-helper">지금까지 모은 상점 <strong>${totalPoints(s)}점</strong></p><div class="history-list">${[...s.history].reverse().map(h=>`<div><span><strong>${h.amount>0?'+':''}${e(h.amount)}점</strong><small>${shortDate(h.date)}</small></span><p>${e(h.reason)}</p>${canEdit()&&h.amount>0&&!s.history.some(x=>x.undoOf===h.id)?`<button type="button" data-undo="${e(h.id)}" data-student="${e(s.id)}">취소</button>`:''}</div>`).join('')||'<p>아직 칭찬 기록이 없어요.</p>'}</div>`,null);
}
async function share() {
  if(demo) return openDialog('예시 학급 공유 안내','<p class="dialog-helper">예시 학급은 이 브라우저에만 저장됩니다. 실제 학생과 공유하려면 Google 로그인 후 학급을 만들어 주세요.</p>',null);
  openDialog('학생에게 학급 공유',`<p class="dialog-helper">공유를 켜면 이 링크를 가진 누구나 공지, 수행평가, 별칭과 상점, 영상을 볼 수 있습니다.</p><label class="checkbox"><input name="published" type="checkbox" ${data.published?'checked':''}> 학생 공유 켜기</label><label>학생 공유 링크<input readonly value="${e(`${location.origin}${location.pathname}?class=${encodeURIComponent(data.id)}&view=1`)}" onclick="this.select()"></label><p class="helper">설정을 저장한 후 위 링크를 복사해 전달하세요. 공유를 끄면 학생 접근이 차단됩니다.</p>`,async form=>mutate(next=>{next.published=form.has('published');}),'공유 설정 저장');
}

root.addEventListener('input', event=>{
  if(event.target.closest('#comment-form')&&['alias','body'].includes(event.target.name))draftFor(activeVideoKey)[event.target.name]=event.target.value;
  if(event.target.id==='search'){const position=event.target.selectionStart;search=event.target.value;render();const input=document.querySelector('#search');input.focus();input.setSelectionRange(position,position);}
});
root.addEventListener('click', async event=>{
  const button=event.target.closest('button');if(!button)return;
  try {
    if(button.dataset.discuss){activeVideoKey=button.dataset.discuss;render();return;}
    if(button.dataset.reply){draftFor(activeVideoKey).parentId=button.dataset.reply;refreshVideoActivity();root.querySelector('[name=body]')?.focus();return;}
    if(button.dataset.reaction){
      if(!participantUid()){toast('Google로 로그인한 뒤 반응을 남겨 주세요.');return;}
      if(activityBusy||activityLoading||activityError)return;
      const video=data.videos.find(v=>v.id===activeVideoKey);if(!video)return;
      activityBusy=true;refreshVideoActivity();
      try{
        if(demo){const mine=activity.reactions.find(r=>r.authorUid===participantUid());activity.reactions=activity.reactions.filter(r=>r.authorUid!==participantUid());if(mine?.type!==button.dataset.reaction)activity.reactions.push({id:participantUid(),authorUid:participantUid(),type:button.dataset.reaction,video:structuredClone(video),updatedAt:new Date().toISOString()});saveDemoActivity();}
        else await backend.toggleVideoReaction(data.id,video,button.dataset.reaction);
      }finally{activityBusy=false;refreshVideoActivity();}
      return;
    }
    if(button.dataset.removeComment){
      const key=activeVideoKey,classId=data.id,commentId=button.dataset.removeComment;
      openDialog('댓글 삭제','<p class="dialog-helper">이 댓글을 삭제할까요? 답글은 대화의 흐름을 위해 남겨 둡니다.</p>',async()=>{
        if(demo){const comment=activity.comments.find(c=>c.id===commentId);if(!comment||key!==activeVideoKey)throw new Error('댓글을 다시 선택해 주세요.');comment.body='';comment.deleted=true;saveDemoActivity();refreshVideoActivity();}
        else await backend.deleteVideoComment(classId,key,commentId);
        toast('댓글을 삭제했습니다.');
      },'삭제하기');return;
    }
    if(button.dataset.nav){section=button.dataset.nav;filter='전체';search='';render();window.scrollTo(0,0);return;}
    if(button.dataset.filter){filter=button.dataset.filter;render();return;}
    if(button.dataset.edit){editItem(...button.dataset.edit.split(':'));return;}
    if(button.dataset.delete){const [kind,itemId]=button.dataset.delete.split(':');openDialog('삭제 확인','<p class="dialog-helper">이 항목을 삭제할까요? 학생을 삭제하면 해당 학생의 칭찬 기록도 함께 삭제됩니다.</p>',async()=>mutate(next=>{next[collections[kind]]=next[collections[kind]].filter(i=>i.id!==itemId);}),'삭제하기');return;}
    if(button.dataset.toggle){await mutate(next=>{const a=next.assessments.find(a=>a.id===button.dataset.toggle);a.done=!a.done;});return;}
    if(button.dataset.award){const s=data.students.find(s=>s.id===button.dataset.award);openDialog(`${e(s.alias)} 칭찬하기`,`<label>부여할 상점<input name="amount" type="number" min="1" max="100" step="1" value="1" required></label>`+field('칭찬 이유','reason','','text',120),async form=>{const amount=Number(form.get('amount'));const reason=form.get('reason').trim();if(!Number.isInteger(amount)||amount<1||amount>100||!reason)throw new Error('1~100 사이 정수와 칭찬 이유를 입력하세요.');await mutate(next=>{const student=next.students.find(s=>s.id===button.dataset.award);if(student.history.length>=200)throw new Error('학생별 칭찬 기록은 200개까지 저장할 수 있습니다.');student.history.push({id:id(),amount,reason,date:todayKey()});});},'상점 주기');return;}
    if(button.dataset.history){history(button.dataset.history);return;}
    const action=button.dataset.action;
    if(action==='cancel-reply'){draftFor(activeVideoKey).parentId='';refreshVideoActivity();return;}
    if(action==='retry-discussion'){stopVideoActivity();syncVideoActivity();return;}
    if(action==='add')editItem(section);
    if(action==='share')await share();
    if(action==='settings')openDialog('학급 설정',field('학급 이름','name',data.name,'text',60),async form=>{const name=form.get('name').trim();if(!name)throw new Error('학급 이름을 입력하세요.');await mutate(next=>{next.name=name;});});
    if(action==='reset-demo')openDialog('예시 초기화','<p class="dialog-helper">이 브라우저에서 수정한 예시 내용을 초기화할까요?</p>',async()=>{const next=makeDemo();localStorage.setItem('classpage-demo-v1',JSON.stringify(next));localStorage.removeItem('classpage-video-activity-v1');discussionDrafts.clear();stopVideoActivity();data=next;render();toast('예시 학급을 초기화했습니다.');},'초기화');
    if(action==='login'){button.disabled=true;try{await ensureBackend();await backend.login();}finally{button.disabled=false;}}
    if(action==='logout'){await backend.logout();if(!params.get('class')){if(unsubscribe)unsubscribe();data=null;classes=[];location.href=location.pathname;}}
    if(action==='create')openDialog('새 학급 만들기',field('학급 이름','name','','text',60),async form=>{const name=form.get('name').trim();if(!name)throw new Error('학급 이름을 입력하세요.');const classId=await backend.createClass(name);location.href=`?class=${encodeURIComponent(classId)}`;},'학급 만들기');
  } catch(error){toast(errorText(error));}
});
dialog.addEventListener('click',async event=>{const button=event.target.closest('[data-undo]');if(!button||button.disabled)return;button.disabled=true;try{await mutate(next=>{const s=next.students.find(s=>s.id===button.dataset.student);const h=s.history.find(h=>h.id===button.dataset.undo);if(s.history.some(x=>x.undoOf===h.id))throw new Error('이미 취소된 기록입니다.');if(s.history.length>=200)throw new Error('기록이 가득 차 취소 기록을 저장할 수 없습니다.');s.history.push({id:id(),amount:-h.amount,reason:`취소: ${h.reason}`,date:todayKey(),undoOf:h.id});});dialog.close();history(button.dataset.student);}catch(error){toast(errorText(error));button.disabled=false;}});

function watchClass(classId) {
  if(unsubscribe) unsubscribe();
  loading=true;
  const fail = error => {loading=false;data=null;render();document.querySelector('#welcome-error').textContent=errorText(error);};
  try {
    unsubscribe=backend.subscribeClass(classId,current=>{loading=false;if(!current){fail(new Error('학급을 찾을 수 없습니다. 선생님께 링크를 확인해 주세요.'));return;}data=current;render();},fail);
  } catch(error) { fail(error); }
}

let backendPromise;
async function ensureBackend(){
  if(!backendPromise)backendPromise=import('./firebase.js').then(module=>{
    backend=module;
    authUnsubscribe=backend.observeAuth(async current=>{
      user=current;
      if(params.get('class')) watchClass(params.get('class'));
      else if(!data){try{classes=user?await backend.listClasses(user.uid):[];}catch(error){toast(backend.getErrorMessage(error));}render();}
      else if(data)render();
    });return module;
  }).catch(error=>{backendPromise=null;throw error;});
  return backendPromise;
}
async function init(){
  if(demo){try{const saved=JSON.parse(localStorage.getItem('classpage-demo-v1')||'null');data=saved?.id==='demo'?saved:makeDemo();}catch{data=makeDemo();toast('기존 예시 저장을 읽을 수 없어 새 예시를 열었습니다.');}loading=false;render();return;}
  render();
  try{
    await ensureBackend();
  }catch(error){loading=false;render();document.querySelector('#welcome-error').textContent=backend?.getErrorMessage(error)||'Firebase 연결을 시작하지 못했습니다. 인터넷 연결을 확인하거나 예시 학급을 열어 주세요.';}
}
init();
