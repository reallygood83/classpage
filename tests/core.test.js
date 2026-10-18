import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeId, escapeHTML, daysUntil, todayKey, totalPoints, makeDemo} from '../core.js';

test('YouTube 링크 유형을 처리하고 외부 주소와 스크립트를 거부한다', () => {
  for (const url of ['https://youtu.be/dQw4w9WgXcQ?si=test','https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12','https://youtube.com/shorts/dQw4w9WgXcQ','https://m.youtube.com/live/dQw4w9WgXcQ','https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ']) assert.equal(youtubeId(url), 'dQw4w9WgXcQ');
  for (const url of ['javascript:alert(1)','https://youtube.com.evil.org/watch?v=dQw4w9WgXc','https://example.org/dQw4w9WgXc','https://youtube.com/watch?v=bad','not a url']) assert.equal(youtubeId(url), null);
});
test('사용자 입력 HTML을 이스케이프한다', () => assert.equal(escapeHTML('<img src=x onerror="x"> &'), '&lt;img src=x onerror=&quot;x&quot;&gt; &amp;'));
test('서울 날짜와 마감일은 시간대와 무관하게 계산된다', () => {
  assert.equal(todayKey(new Date('2026-10-18T16:00:00Z')), '2026-10-19');
  assert.equal(daysUntil('2026-11-01','2026-10-31'),1);
  assert.equal(daysUntil('2026-10-17','2026-10-18'),-1);
});
test('상점은 기록 합계이며 취소를 반영한다', () => assert.equal(totalPoints({history:[{amount:3},{amount:2},{amount:-3}]}),2));
test('저장 데이터의 상점 문자열과 비정수는 합계에 삽입되지 않는다', () => assert.equal(totalPoints({history:[{amount:'<img src=x onerror=alert(1)>'},{amount:2},{amount:1.2}]}),2));
test('예시는 실제 학급과 구분되고 만료되지 않는 일정이 있다', () => { const demo=makeDemo(); assert.equal(demo.id,'demo'); assert.equal(demo.published,false); assert.ok(demo.assessments.every(item=>daysUntil(item.due)>=0)); });
