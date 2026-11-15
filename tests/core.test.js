import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  todayKst,
  addDay,
  diffDays,
  ddayLabel,
  lab,
  weekDatesOf,
  monthInfo,
} from '../src/core/date.js';
import {
  CL,
  capOf,
  itemP,
  sumP,
  parseUnits,
  unitsText,
  splitRangeUpTo,
  getBookProgress,
} from '../src/core/units.js';
import {
  applyAutoCarry,
  getOverdueItems,
  planClose,
  applyClosePlan,
} from '../src/core/carry.js';
import {
  buildMatrixBoard,
  classifyMatrixCandidate,
  inferOriginDateFromId,
  moveMatrixItemManual,
  resetMatrixItemToAuto,
  applyMatrixUndo,
} from '../src/core/matrix.js';
import {
  buildCalendarEmbedUrl,
  defaultConfig,
  exportJsonToDocs,
  mergeConfig,
} from '../src/services/store.js';
import {
  STICKY_COLORS,
  defaultOneNoteConfig,
  normalizeNotesState,
  normalizeStickyColor,
  noteToOneNoteHtml,
  parseOneNotePageHtml,
  planBidirectionalSync,
} from '../src/core/onenote.js';
import { safeUrl } from '../src/core/html.js';
import {
  renderAll,
  renderBookModal,
  renderBooksView,
  renderHome,
  renderSettings,
  renderToday,
  renderWeek,
} from '../src/views/schedule.js';
import {
  DEFAULT_HUB_DOCS,
  buildHubDocumentCatalog,
  detectBookmarkKind,
  normalizeHubState,
  renderHub,
  toggleHubStar,
} from '../src/views/hub.js';
import { renderMatrix } from '../src/views/matrix.js';
import {
  renderNotesView,
  renderTodayNoteWidget,
} from '../src/views/notes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_PATH = path.resolve(__dirname, '../data/plan-data-export.json');

test('KST date math works identically regardless of system TZ', () => {
  const ms = Date.UTC(2026, 10, 15, 16, 30, 0); // 2026-11-16 01:30 KST
  assert.equal(todayKst(ms), '2026-11-16');
  assert.equal(addDay('2026-11-15', 1), '2026-11-16');
  assert.equal(diffDays('2026-11-15', '2026-12-07'), 22);
  assert.equal(ddayLabel('2026-12-07', '2026-11-15'), 'D-22');
  assert.equal(ddayLabel('2026-11-15', '2026-11-15'), 'D-DAY');
  assert.equal(lab('2026-11-15'), '11/15 (일)');
  assert.deepEqual(weekDatesOf('2026-11-18'), [
    '2026-11-15',
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
  ]);
  const nov = monthInfo('2026-11');
  assert.equal(nov.pad, 0);
  assert.equal(nov.daysInMonth, 30);
});

test('range parsing and partial split (normal & code-type) preserve immutability', () => {
  const normal = {
    id: 's1',
    s: '수학',
    b: '쎈',
    t: '#444~466, #520',
    n: 24,
    done: false,
  };
  const parsed = parseUnits(normal);
  assert.equal(parsed.length, 24);
  assert.equal(parsed[0].p + parsed[0].n, '#444');
  assert.equal(parsed[23].p + parsed[23].n, '#520');

  const res = splitRangeUpTo(normal, '450', '2026-11-15');
  assert.equal(res.ok, true);
  assert.equal(res.completedAll, false);
  assert.equal(res.items.length, 2);
  assert.equal(res.items[0].t, '#444~450');
  assert.equal(res.items[0].n, 7);
  assert.equal(res.items[0].done, true);
  assert.equal(res.items[0].done_date, '2026-11-15');
  assert.equal(res.items[1].t, '#451~466, #520');
  assert.equal(res.items[1].n, 17);
  assert.equal(res.items[1].done, false);
  assert.equal(normal.n, 24);
  assert.equal(normal.done, false);

  const codeItem = {
    id: 'w1',
    s: '수학',
    b: '원솔',
    t: 'T05·15~19, T06·1',
    n: 6,
    done: false,
  };
  const codeSplit = splitRangeUpTo(codeItem, 'T05·18', '2026-11-15');
  assert.equal(codeSplit.ok, true);
  assert.equal(codeSplit.items[0].t, 'T05·15~18');
  assert.equal(codeSplit.items[0].n, 4);
  assert.equal(codeSplit.items[1].t, 'T05·19, T06·1');
  assert.equal(codeSplit.items[1].n, 2);

  const dupItem = {
    id: 'w2',
    s: '수학',
    b: '원솔',
    t: 'T05·1~2, T06·1~2',
    n: 4,
    done: false,
  };
  const dupErr = splitRangeUpTo(dupItem, '1', '2026-11-15');
  assert.equal(dupErr.ok, false);
  assert.match(dupErr.error, /같은 번호가 여러 곳에/);
  const exactOk = splitRangeUpTo(dupItem, 'T06·1', '2026-11-15');
  assert.equal(exactOk.ok, true);
  assert.equal(exactOk.items[0].t, 'T05·1~2, T06·1');
  assert.equal(unitsText(parseUnits(codeItem)), 'T05·15~19, T06·1');
});

test('load P, weekday baseline caps, and book progress calculation', () => {
  const cfg = {
    weights: { 쎈: 1, 원솔: 2, 물질: 2.5 },
    caps: { study: 70, off: 30 },
  };
  const items = [
    { id: '1', s: '수학', b: '쎈', t: '#1~10', n: 10, done: true, done_date: '2026-11-14' },
    { id: '2', s: '과탐', b: '물질', t: '#1~4', n: 4, done: false },
    { id: '3', s: '과탐', b: '물질', t: '#595~641', n: 47, done: true, x: true },
    { id: '4', kind: 'todo', s: '학교·할일', b: '일반할일', cat: '세특', t: '세특 확인', n: 1, p: 5, done: false },
  ];
  assert.equal(itemP(items[0], cfg), 10);
  assert.equal(itemP(items[1], cfg), 10);
  assert.equal(itemP(items[2], cfg), 0);
  assert.equal(itemP(items[3], cfg), 5);
  assert.equal(sumP(items, cfg), 25);
  assert.equal(sumP(items, cfg, (i) => i.done), 10);

  assert.equal(capOf('2026-11-15', {}, cfg), 30);
  assert.equal(capOf('2026-11-16', {}, cfg), 70);
  assert.equal(capOf('2026-11-17', {}, cfg), 30);

  const prog = getBookProgress({ '2026-11-12': [items[2]], '2026-11-15': [items[1]] }, '물질', cfg);
  assert.equal(prog.totalN, 4);
  assert.equal(prog.doneN, 0);
  assert.equal(prog.remainP, 10);
  assert.equal(prog.extraRows.length, 1);
});

test('carry rules (auto/ask/drop) and planClose spread mode', () => {
  const cfg = {
    weights: { 쎈: 1, 원솔: 2, 알고리즘: 10 },
    caps: { study: 70, off: 30 },
    carry: { 쎈: 'auto', 원솔: 'ask', 알고리즘: 'drop' },
  };
  const plans = {
    '2026-11-14': [
      { id: 'a1', s: '수학', b: '쎈', t: '#1~10', n: 10, done: false },
      { id: 'a2', s: '수학', b: '원솔', t: 'T01·1~5', n: 5, done: false },
      { id: 'a3', s: '영어', b: '알고리즘', t: '11강', n: 1, done: false },
    ],
    '2026-11-15': [
      { id: 'b1', s: '수학', b: '원솔', t: 'T02·1~10', n: 10, done: false },
      { id: 'b2', s: '수학', b: '쎈', t: '#11~25', n: 15, done: false },
      { id: 'b3', s: '영어', b: '알고리즘', t: '12강', n: 1, done: false },
    ],
    '2026-11-16': [
      { id: 'c1', s: '수학', b: '쎈', t: '#26~85', n: 60, done: false },
    ],
    '2026-11-17': [],
  };

  const carried = applyAutoCarry(plans, cfg, '2026-11-15');
  assert.equal(carried.changed, true);
  assert.equal(carried.plans['2026-11-14'].length, 2);
  const carriedA1 = carried.plans['2026-11-15'].find((i) => i.id === 'a1');
  assert.ok(carriedA1);
  assert.equal(carriedA1.from, '2026-11-14');
  assert.equal(plans['2026-11-14'].length, 3);

  const overdue = getOverdueItems(carried.plans, '2026-11-15');
  assert.equal(overdue.length, 2);

  const preview = planClose({ plans, cfg, todayIso: '2026-11-15', mode: 'spread' });
  assert.equal(preview.keeps.map((i) => i.id).join(','), 'b3');
  assert.equal(preview.dest.b1, '2026-11-17');
  assert.ok(preview.dest.b2);

  const applied = applyClosePlan({ plans, cfg, todayIso: '2026-11-15', mode: 'next' });
  assert.equal(applied.plans['2026-11-15'].length, 1);
  assert.equal(applied.plans['2026-11-16'].length, 3);
  assert.equal(applied.plans['2026-11-16'].find((i) => i.id === 'b1').from, '2026-11-15');
});

test('Eisenhower matrix auto classification (today-only), manual pin, and undo', () => {
  const cfg = {
    weights: { 쎈: 1, 실전모의: 23 },
    ddays: [{ n: '기말고사', d: '2026-12-07' }],
    matrixRules: {
      urgentDays: 3,
      examUrgentDays: 7,
      importantKeywords: ['세특', '수행평가'],
      examBooks: ['쎈'],
    },
  };

  assert.equal(inferOriginDateFromId('11-12-4', '2026-11-15'), '2026-11-12');
  assert.equal(inferOriginDateFromId('11-16-1', '2026-11-15'), '');
  assert.equal(inferOriginDateFromId('12-30-1', '2027-01-02'), '2026-12-30');

  const q1 = classifyMatrixCandidate(
    {
      id: '1',
      source: 'plan',
      planDate: '2026-11-15',
      carriedFrom: '2026-11-13',
      bookId: '쎈',
      title: '기하 쎈 #1~5',
    },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q1.urgent, true);
  assert.equal(q1.important, true);
  assert.equal(q1.autoQuad, 'q1');

  const q2 = classifyMatrixCandidate(
    { id: '2', source: 'plan', planDate: '2026-11-15', bookId: '쎈', title: '기하 쎈 #6~10' },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q2.urgent, false);
  assert.equal(q2.important, true);
  assert.equal(q2.autoQuad, 'q2');

  const q3 = classifyMatrixCandidate(
    {
      id: '3',
      source: 'plan',
      planDate: '2026-11-15',
      carriedFrom: '2026-11-14',
      bookId: '실전모의',
      title: '실전모의 1회',
    },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q3.urgent, true);
  assert.equal(q3.important, false);
  assert.equal(q3.autoQuad, 'q3');

  const q4 = classifyMatrixCandidate(
    { id: '4', source: 'plan', planDate: '2026-11-15', bookId: '실전모의', title: '실전모의 2회' },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q4.urgent, false);
  assert.equal(q4.important, false);
  assert.equal(q4.autoQuad, 'q4');

  const examSoon = classifyMatrixCandidate(
    { id: '5', source: 'plan', planDate: '2026-12-02', bookId: '쎈', title: '기하 쎈' },
    { cfg, todayIso: '2026-12-02' }
  );
  assert.equal(examSoon.urgent, true);
  assert.equal(examSoon.autoQuad, 'q1');

  const plans = {
    '2026-11-14': [
      { id: 'past1', s: '수학', b: '쎈', t: '#1~3', n: 3, done: false },
    ],
    '2026-11-15': [
      { id: '11-13-1', s: '수학', b: '쎈', t: '#1~5', n: 5, done: false },
      { id: 'p1', s: '수학', b: '쎈', t: '#6~10', n: 5, done: false },
      { id: 'p2', kind: 'todo', s: '학교·할일', b: '일반할일', cat: '세특', t: '생기부 세특 확인', n: 1, p: 5, due: '2026-11-17', done: false },
      { id: 'p4', s: '영어', b: '실전모의', t: '2회', n: 1, from: '2026-11-14', done: false },
      { id: 'p5', s: '영어', b: '실전모의', t: '3회', n: 1, done: false },
    ],
    '2026-11-16': [
      { id: 'p3', s: '영어', b: '실전모의', t: '1회', n: 1, done: false },
    ],
  };
  let matrixState = {
    tasks: [
      { id: 'm1', title: '수행평가 자료 제출', cat: '수행평가', due: '2026-11-17', important: false, done: false },
      { id: 'm2', title: '책상 정리', cat: '일반', due: '', important: false, done: false },
    ],
    overrides: {},
  };

  let board = buildMatrixBoard({ plans, cfg, matrixState, todayIso: '2026-11-15' });
  const allBoardIds = [
    ...board.quads.q1,
    ...board.quads.q2,
    ...board.quads.q3,
    ...board.quads.q4,
  ].map((x) => x.id);
  assert.equal(allBoardIds.includes('past1'), false);
  assert.equal(allBoardIds.includes('p3'), false);

  assert.ok(board.quads.q1.some((x) => x.id === '11-13-1'));
  assert.ok(board.quads.q1.some((x) => x.id === 'p2'));
  assert.ok(board.quads.q1.some((x) => x.id === 'm1'));
  assert.ok(board.quads.q2.some((x) => x.id === 'p1'));
  assert.ok(board.quads.q3.some((x) => x.id === 'p4'));
  assert.ok(board.quads.q4.some((x) => x.id === 'p5'));
  assert.ok(board.quads.q4.some((x) => x.id === 'm2'));

  const mv = moveMatrixItemManual(matrixState, 'todo:m2', 'q2');
  assert.equal(mv.changed, true);
  matrixState = mv.matrixState;

  board = buildMatrixBoard({ plans, cfg, matrixState, todayIso: '2026-11-15' });
  const movedCard = board.quads.q2.find((x) => x.id === 'm2');
  assert.ok(movedCard);
  assert.equal(movedCard.manual, true);

  const undone = applyMatrixUndo(matrixState, mv.undoEntry);
  assert.equal(undone.changed, true);
  board = buildMatrixBoard({ plans, cfg, matrixState: undone.matrixState, todayIso: '2026-11-15' });
  assert.ok(board.quads.q4.some((x) => x.id === 'm2'));

  const mv2 = moveMatrixItemManual(matrixState, 'plan:p5', 'q1');
  const rst = resetMatrixItemToAuto(mv2.matrixState, 'plan:p5');
  assert.equal(rst.changed, true);
  assert.equal(rst.matrixState.overrides['plan:p5'], undefined);
  assert.ok(CL(rst.matrixState));
});

test('Calendar URL normalizer, bookmark detection, and real export data render cleanly', () => {
  assert.equal(
    buildCalendarEmbedUrl('user@gmail.com', 'MONTH'),
    'https://calendar.google.com/calendar/embed?src=user%40gmail.com&ctz=Asia%2FSeoul&mode=MONTH'
  );
  assert.equal(
    buildCalendarEmbedUrl(
      '<iframe src="https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com&amp;ctz=Asia/Seoul"></iframe>',
      'WEEK'
    ),
    'https://calendar.google.com/calendar/embed?src=abc%40group.calendar.google.com&ctz=Asia%2FSeoul&mode=WEEK'
  );
  assert.equal(buildCalendarEmbedUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(detectBookmarkKind('https://docs.google.com/spreadsheets/d/123'), 'sheet');
  assert.equal(detectBookmarkKind('https://docs.google.com/document/d/123'), 'docs');

  const rawExport = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
  const docs = exportJsonToDocs(rawExport);
  assert.ok(docs['plan/2026-11-15']);
  assert.ok(docs['config/main']);
  assert.equal(docs['plan/2026-11-12'].items[0].done_date, '2026-11-12');

  const plans = {};
  for (const [k, v] of Object.entries(docs)) {
    if (k.startsWith('plan/')) plans[k.slice(5)] = v.items;
  }
  const cfg = mergeConfig(docs['config/main'] || defaultConfig());

  const state = {
    REAL: '2026-11-15',
    cur: '2026-11-15',
    calM: '2026-11',
    plans,
    cfg,
    logs: {},
    hub: { items: [{ id: '1', name: '세특 시트', url: 'https://docs.google.com/spreadsheets/d/x', kind: 'sheet', group: '학교', order: 1 }] },
    matrix: { tasks: [], overrides: {} },
    adding: true,
    addKind: 'todo',
    moving: null,
    asking: null,
    askMsg: '',
    closing: true,
    closeMode: 'spread',
    closeKeep: new Set(),
    closeHours: null,
    closeFeel: null,
    closedMsg: '',
    openC: new Set(),
    rulesOpen: true,
    selB: new Set(),
    bookModalId: '쎈',
    bookModalFilter: 'all',
    hubAdding: false,
    hubEditId: null,
    hubGroupFilter: 'all',
    hubCalEdit: false,
    matrixAdding: false,
    matrixDoneOpen: false,
    matrixUndo: [],
  };

  const todayHtml = renderToday(state);
  assert.match(todayHtml, /data-act="bookpop" data-b="쎈"/);
  assert.match(todayHtml, /일반 할 일/);

  const weekHtml = renderWeek(state);
  assert.match(weekHtml, /이번주 계획 현황/);
  assert.match(weekHtml, /data-act="bookpop"/);

  const allHtml = renderAll(state);
  assert.match(allHtml, /2026년 11월/);

  const modalHtml = renderBookModal(state);
  assert.match(modalHtml, /기하 쎈/);
  assert.match(modalHtml, /남은 부하/);

  const hubHtml = renderHub(state);
  assert.match(hubHtml, /구글 캘린더/);
  assert.match(hubHtml, /세특 시트/);

  const matrixHtml = renderMatrix(state);
  assert.match(matrixHtml, /지금 하기/);
  assert.match(matrixHtml, /계획하기/);

  const homeHtml = renderHome(state);
  assert.match(homeHtml, /오늘 목표/);
  assert.match(homeHtml, /지금 바로 할 일/);
  assert.match(homeHtml, /오늘 과목별 진행 현황/);
  assert.match(homeHtml, /빠른 워크스페이스/);

  const booksHtml = renderBooksView(state);
  assert.match(booksHtml, /교재별 진도 필터/);
  assert.match(booksHtml, /전체 누적 진행 현황/);

  const setHtml = renderSettings(state);
  assert.match(setHtml, /아이젠하워 매트릭스 자동 분류 규칙/);

  const setStudyHtml = renderSettings({ ...state, settingsSection: 'study' });
  assert.match(setStudyHtml, /하루 기준 부하/);
  assert.doesNotMatch(setStudyHtml, /접속 토큰 및 데이터 백업/);

  const setRulesHtml = renderSettings({ ...state, settingsSection: 'rules' });
  assert.match(setRulesHtml, /아이젠하워 매트릭스 자동 분류 규칙/);
  assert.doesNotMatch(setRulesHtml, /하루 기준 부하/);

  const setSyncHtml = renderSettings({ ...state, settingsSection: 'sync' });
  assert.match(setSyncHtml, /접속 토큰 및 데이터 백업/);
  assert.doesNotMatch(setSyncHtml, /Microsoft OneNote 양방향 메모 연동/);
  assert.doesNotMatch(setSyncHtml, /하루 기준 부하/);
});

test('OneNote XHTML serialization, HTML parsing, bidirectional sync planner, and Notes view render', () => {
  const sampleNote = {
    id: 'n_test_1',
    title: '미적분 오답 정리 & <핵심>',
    subject: '수학',
    date: '2026-11-15',
    pinned: true,
    createdAt: '2026-11-15T01:00:00.000Z',
    updatedAt: '2026-11-15T02:00:00.000Z',
    content: '첫째 줄 정리\n\n- [ ] 다시 풀어보기\n- [x] 개념 노트 필기',
  };

  const xhtml = noteToOneNoteHtml(sampleNote);
  assert.match(xhtml, /<title>미적분 오답 정리 &amp; &lt;핵심&gt;<\/title>/);
  assert.match(xhtml, /data-tag="to-do"/);
  assert.match(xhtml, /data-tag="to-do:completed"/);

  const parsed = parseOneNotePageHtml(xhtml);
  assert.equal(parsed.title, '미적분 오답 정리 & <핵심>');
  assert.equal(parsed.subject, '수학');
  assert.equal(parsed.date, '2026-11-15');
  assert.equal(parsed.embeddedNoteId, 'n_test_1');
  assert.equal(parsed.content, sampleNote.content);

  // OneNote 클라이언트가 만든 순수 HTML 페이지도 깔끔하게 파싱
  const onAppHtml = `
    <html>
      <head><title>외부 원노트 메모</title></head>
      <body>
        <div style="position:absolute">
          <p>오늘 물리 1단원 요약</p>
          <p data-tag="to-do">기출 10문제 풀기</p>
          <p data-tag="to-do:completed">오답 체크</p>
        </div>
      </body>
    </html>
  `;
  const parsedExt = parseOneNotePageHtml(onAppHtml);
  assert.equal(parsedExt.title, '외부 원노트 메모');
  assert.equal(
    parsedExt.content,
    '오늘 물리 1단원 요약\n- [ ] 기출 10문제 풀기\n- [x] 오답 체크'
  );

  // 양방향 동기화 플래너 검증
  const localState = normalizeNotesState({
    deletedPageIds: ['pg-del-local'],
    items: [
      {
        id: 'n_create',
        title: '새 로컬 메모',
        content: '본문',
        dirty: true,
        updatedAt: '2026-11-15T05:00:00.000Z',
      },
      {
        id: 'n_push_upd',
        title: '로컬이 최신인 메모',
        content: '수정됨',
        onenotePageId: 'pg-push-upd',
        onenoteSectionId: 'sec-1',
        remoteModifiedAt: '2026-11-15T01:00:00.000Z',
        updatedAt: '2026-11-15T04:00:00.000Z',
        dirty: true,
      },
      {
        id: 'n_pull_upd',
        title: '원노트가 최신인 메모',
        content: '구버전',
        onenotePageId: 'pg-pull-upd',
        onenoteSectionId: 'sec-1',
        remoteModifiedAt: '2026-11-15T01:00:00.000Z',
        updatedAt: '2026-11-15T01:00:00.000Z',
        dirty: false,
      },
      {
        id: 'n_del_remote',
        title: '원노트에서 지워진 메모',
        content: '삭제 예정',
        onenotePageId: 'pg-gone',
        onenoteSectionId: 'sec-1',
        remoteModifiedAt: '2026-11-15T01:00:00.000Z',
        dirty: false,
      },
    ],
  });

  const remotePages = [
    { id: 'pg-del-local', title: '로컬서 삭제한 메모', lastModifiedDateTime: '2026-11-15T01:00:00.000Z' },
    { id: 'pg-push-upd', title: '구버전', lastModifiedDateTime: '2026-11-15T02:00:00.000Z' },
    { id: 'pg-pull-upd', title: '원노트 수정판', lastModifiedDateTime: '2026-11-15T06:00:00.000Z' },
    { id: 'pg-new-remote', title: '원노트에서 새로 쓴 메모', lastModifiedDateTime: '2026-11-15T07:00:00.000Z' },
  ];

  const syncPlan = planBidirectionalSync({
    localState,
    remotePages,
    sectionId: 'sec-1',
  });

  assert.deepEqual(syncPlan.toDeleteRemote, ['pg-del-local']);
  assert.deepEqual(syncPlan.toCreateRemote.map((x) => x.id), ['n_create']);
  assert.deepEqual(syncPlan.toUpdateRemote.map((x) => x.id), ['n_push_upd']);
  assert.deepEqual(
    syncPlan.toPullRemote.map((x) => x.remote.id),
    ['pg-pull-upd', 'pg-new-remote']
  );
  assert.equal(syncPlan.toPullRemote[0].localItem.id, 'n_pull_upd');
  assert.equal(syncPlan.toPullRemote[1].localItem, null);
  assert.deepEqual(syncPlan.deletedRemotelyLocalIds, ['n_del_remote']);

  assert.equal(detectBookmarkKind('https://www.onenote.com/notebooks'), 'onenote');

  const notesHtml = renderNotesView({
    REAL: '2026-11-15',
    cur: '2026-11-15',
    cfg: { onenote: defaultOneNoteConfig() },
    notes: normalizeNotesState({
      items: [
        {
          ...sampleNote,
          onenotePageId: 'pg-1',
          onenoteWebUrl: 'https://onedrive.live.com/edit.aspx?resid=123',
          onenoteClientUrl: 'onenote:https://d.docs.live.net/123',
        },
      ],
    }),
    oneNoteAuth: { accessToken: 'tok', userName: '테스트 계정', mode: 'pkce' },
    notesSelectedId: 'n_test_1',
    notesConnectOpen: true,
    notesAuthTab: 'pkce',
  });
  assert.match(notesHtml, /Microsoft OneNote 양방향 메모장/);
  assert.match(notesHtml, /data-act="on-sync"/);
  assert.match(notesHtml, /data-act="note-chk-tog"/);
  assert.match(notesHtml, /OneNote 웹에서 열기/);
  assert.match(notesHtml, /OneNote 앱에서 열기/);
});

test('Hub document catalog, OneNote memo integration, star toggle persistence, and search/category render', () => {
  assert.equal(detectBookmarkKind('https://drive.google.com/file/d/abc/view', '기하.pdf'), 'pdf');
  assert.equal(detectBookmarkKind('https://drive.google.com/file/d/abc/view', '탐구보고서.hwp'), 'hwp');
  assert.equal(detectBookmarkKind('https://docs.google.com/presentation/d/abc/edit'), 'slide');
  assert.equal(detectBookmarkKind('#note:n1'), 'onenote');

  const initHub = normalizeHubState({});
  assert.equal(initHub.initialized, true);
  const expectedDefaults = DEFAULT_HUB_DOCS.filter((d) => d.defaultStarred);
  assert.equal(initHub.items.length, expectedDefaults.length);

  // 기본 즐겨찾기 전부 해제 후 다시 normalize해도 빈 상태가 유지되는지 검증
  let emptied = initHub;
  for (const def of expectedDefaults) {
    emptied = toggleHubStar(emptied, def.id, {});
  }
  assert.equal(emptied.items.length, 0);
  assert.equal(emptied.unstarredIds.length, expectedDefaults.length);
  const reloadedEmpty = normalizeHubState(emptied);
  assert.equal(reloadedEmpty.items.length, 0);

  // 카탈로그에 기본 문서 + 사용자 문서 + 원노트 메모 통합 검증
  const notesState = normalizeNotesState({
    items: [
      {
        id: 'n_hub_1',
        title: '생명과학 실험 가설 메모',
        subject: '과탐',
        date: '2026-11-15',
        updatedAt: '2026-11-15T04:00:00.000Z',
        content: '대조군 설정',
      },
    ],
  });

  let hubWithCustom = normalizeHubState({
    ...reloadedEmpty,
    customDocs: [
      {
        id: 'custom_1',
        name: '사용자 개인 정리표',
        url: 'https://docs.google.com/spreadsheets/d/custom1',
        kind: 'sheet',
        group: '학교·세특',
        modifiedAt: '2026-11-15',
      },
    ],
  });

  // 문서 즐겨찾기 설정 토글 (PDF + OneNote 메모 + 커스텀)
  hubWithCustom = toggleHubStar(hubWithCustom, 'gd_mech_final', notesState);
  hubWithCustom = toggleHubStar(hubWithCustom, 'note:n_hub_1', notesState);
  hubWithCustom = toggleHubStar(hubWithCustom, 'custom_1', notesState);

  assert.equal(hubWithCustom.items.length, 3);
  assert.ok(hubWithCustom.items.some((x) => x.id === 'gd_mech_final'));
  assert.ok(hubWithCustom.items.some((x) => x.noteId === 'n_hub_1'));

  const catalog = buildHubDocumentCatalog(hubWithCustom, notesState);
  assert.ok(catalog.length >= DEFAULT_HUB_DOCS.length + 2);
  assert.equal(catalog.find((d) => d.id === 'gd_mech_final').starred, true);
  assert.equal(catalog.find((d) => d.id === 'note:n_hub_1').starred, true);
  assert.equal(catalog.find((d) => d.id === 'custom_1').isCustom, true);

  // 다시 해제하면 customDocs에는 여전히 남아 있고 items에서만 제거됨
  const afterUnstar = toggleHubStar(hubWithCustom, 'custom_1', notesState);
  assert.equal(afterUnstar.items.some((x) => x.id === 'custom_1'), false);
  const afterCatalog = buildHubDocumentCatalog(afterUnstar, notesState);
  assert.equal(afterCatalog.find((d) => d.id === 'custom_1').starred, false);

  const renderedHub = renderHub({
    cfg: defaultConfig(),
    hub: hubWithCustom,
    notes: notesState,
    hubAdding: false,
    hubEditId: null,
    hubGroupFilter: 'all',
    hubCalEdit: false,
    hubSearch: '생명과학',
  });
  assert.match(renderedHub, /전체 문서 목록/);
  assert.match(renderedHub, /생기부_통합관리_BCI_생명과학_수정\.xlsx/);
  assert.match(renderedHub, /생명과학 실험 가설 메모/);
  assert.match(renderedHub, /data-act="hubstar"/);

  const renderedHome = renderHome({
    REAL: '2026-11-15',
    cur: '2026-11-15',
    plans: {},
    cfg: defaultConfig(),
    logs: {},
    hub: hubWithCustom,
    matrix: { tasks: [], overrides: {} },
    notes: notesState,
  });
  assert.equal(renderHomeHtmlCheck(renderedHome), true);
  assert.match(renderedHome, /data-act="go-hub"/);
  assert.doesNotMatch(renderedHome, /data-v="notes"/);
});

function renderHomeHtmlCheck(html) {
  return typeof html === 'string' && html.length > 0;
}

test('Sticky Notes colors, OneNote metadata color round-trip, and AADSTS700016 login fix UI', () => {
  assert.equal(STICKY_COLORS.length, 7);
  assert.equal(normalizeStickyColor('pink'), 'pink');
  assert.equal(normalizeStickyColor('invalid-color'), 'yellow');
  assert.equal(defaultOneNoteConfig().tenant, 'consumers');

  const stickyNote = {
    id: 'n_sticky_1',
    title: '물리 세특 아이디어',
    subject: '물리',
    date: '2026-11-15',
    color: 'blue',
    pinned: true,
    createdAt: '2026-11-15T01:00:00.000Z',
    updatedAt: '2026-11-15T02:00:00.000Z',
    content: '간섭 무늬 실험 정리\n- [ ] 자료 찾기',
  };
  const html = noteToOneNoteHtml(stickyNote);
  assert.match(html, /data-plan-color="blue"/);
  assert.match(html, /\[색상: blue\]/);

  const parsed = parseOneNotePageHtml(html);
  assert.equal(parsed.color, 'blue');
  assert.equal(parsed.content, stickyNote.content);

  const notesState = normalizeNotesState({
    items: [
      {
        ...stickyNote,
        onenotePageId: 'pg-sticky',
        onenoteWebUrl: 'https://onedrive.live.com/edit.aspx?resid=999',
        onenoteClientUrl: 'onenote:https://d.docs.live.net/999',
      },
    ],
  });

  const notesViewHtml = renderNotesView({
    REAL: '2026-11-15',
    cur: '2026-11-15',
    cfg: { onenote: defaultOneNoteConfig() },
    notes: notesState,
    oneNoteAuth: { accessToken: 'tok', userName: '테스트', mode: 'pkce' },
    notesSelectedId: 'n_sticky_1',
    notesConnectOpen: true,
    notesAuthTab: 'pkce',
  });
  assert.match(notesViewHtml, /notes-layout/);
  assert.match(notesViewHtml, /data-act="on-pkce-consumers"/);
  assert.match(notesViewHtml, /data-act="on-tenant-preset"/);
  assert.match(notesViewHtml, /AADSTS700016/);
  assert.match(notesViewHtml, /data-act="note-chk-tog"/);

  const todayNoteHtml = renderTodayNoteWidget({
    REAL: '2026-11-15',
    cur: '2026-11-15',
    notes: notesState,
    oneNoteAuth: null,
  });
  assert.match(todayNoteHtml, /today-note-list/);
  assert.match(todayNoteHtml, /data-act="note-today-add"/);
});

test('Google Calendar events: KST dates, all-day exclusive end, multi-day grouping', async () => {
  const { gcalEventToItem, groupGcalByDate } = await import('../src/core/gcal.js');
  const cal = { id: 'c1', summary: '학교', backgroundColor: '#16a765' };
  const timed = gcalEventToItem({ id: 'e1', summary: '면담', start: { dateTime: '2026-11-15T14:30:00Z' }, end: { dateTime: '2026-11-15T15:30:00Z' } }, cal);
  assert.equal(timed.startDate, '2026-11-15');
  assert.equal(timed.time, '23:30');
  const crossing = gcalEventToItem({ id: 'e2', summary: '야간', start: { dateTime: '2026-11-15T14:00:00Z' }, end: { dateTime: '2026-11-15T16:00:00Z' } }, cal);
  assert.equal(crossing.startDate, '2026-11-15');
  assert.equal(crossing.endDate, '2026-11-16');
  const allDay = gcalEventToItem({ id: 'e3', summary: '수련회', start: { date: '2026-11-17' }, end: { date: '2026-11-20' } }, cal);
  assert.equal(allDay.endDate, '2026-11-19');
  assert.equal(allDay.allDay, true);
  assert.equal(gcalEventToItem({ id: 'x', status: 'cancelled' }, cal), null);
  const map = groupGcalByDate([timed, allDay], ['2026-11-15', '2026-11-18', '2026-11-20']);
  assert.equal(map['2026-11-15'].length, 1);
  assert.equal(map['2026-11-18'].length, 1);
  assert.equal(map['2026-11-20'], undefined);
  const html = renderAll({
    REAL: '2026-11-15', cur: '2026-11-15', calM: '2026-11', plans: {}, cfg: { ...defaultConfig(), gcal: { clientId: 'x.apps.googleusercontent.com', hiddenCalendarIds: [] } },
    logs: {}, selB: new Set(), gcalByMonth: { '2026-11': [timed, allDay] },
  });
  assert.match(html, /class="gev"/);
  assert.match(html, /수련회/);
  assert.match(html, /data-act="calpop"/);

  const { renderCalDayModal } = await import('../src/views/schedule.js');
  const modalHtml = renderCalDayModal({
    REAL: '2026-11-15',
    calModalDate: '2026-11-15',
    plans: {
      '2026-11-15': [
        { id: '1', s: '수학', b: '쎈', t: '#1~5', n: 5, done: false },
      ],
    },
    cfg: defaultConfig(),
    logs: { '2026-11-15': { hours: 4, feel: '보통', note: '집중 잘됨' } },
    selB: new Set(),
    gcalByMonth: { '2026-11': [timed] },
  });
  assert.match(modalHtml, /data-act="calpop-goto"/);
  assert.match(modalHtml, /기하 쎈/);
  assert.match(modalHtml, /5문제/);
  assert.match(modalHtml, /면담/);
  assert.match(modalHtml, /집중 잘됨/);
});

test('Weekly drag/context-menu move and partial workbook range move modal', async () => {
  const { movePlanSlice } = await import('../src/core/carry.js');
  const { renderToday, renderWeek, renderMoveCalModal } = await import('../src/views/schedule.js');

  const todayHtml = renderToday({
    REAL: '2026-11-15',
    cur: '2026-11-15',
    plans: {
      '2026-11-15': [
        { id: 'w1', s: '수학', b: '쎈', t: '#1~10', n: 10, done: false },
      ],
    },
    cfg: defaultConfig(),
    logs: {},
    closing: false,
    adding: false,
    addKind: 'book',
  });
  assert.match(todayHtml, /data-it-d="2026-11-15" data-it-id="w1"/);
  assert.doesNotMatch(todayHtml, /data-act="menu"/);

  const plans = {
    '2026-11-15': [
      { id: 'w1', s: '수학', b: '쎈', t: '#1~10', n: 10, done: false },
    ],
  };

  // Partial range move: #4~7 (indices 3..6)
  const partial = movePlanSlice(plans, '2026-11-15', 'w1', '2026-11-18', 3, 6);
  assert.equal(partial.changed, true);
  assert.equal(partial.plans['2026-11-15'].length, 2);
  assert.equal(partial.plans['2026-11-15'][0].t, '#1~3');
  assert.equal(partial.plans['2026-11-15'][1].t, '#8~10');
  assert.equal(partial.plans['2026-11-18'].length, 1);
  assert.equal(partial.plans['2026-11-18'][0].t, '#4~7');
  assert.equal(partial.plans['2026-11-18'][0].n, 4);
  assert.equal(partial.plans['2026-11-18'][0].from, '2026-11-15');

  // Weekly view renders draggable rows and droppable day cards
  const weekHtml = renderWeek({
    REAL: '2026-11-15',
    cur: '2026-11-15',
    plans,
    cfg: defaultConfig(),
    openC: new Set(),
    rulesOpen: false,
  });
  assert.match(weekHtml, /draggable="true" data-wdrag-d="2026-11-15" data-wdrag-id="w1"/);
  assert.match(weekHtml, /data-wdrop-d="2026-11-18"/);

  // Move calendar modal renders plans-only calendar + range selectors
  const moveHtml = renderMoveCalModal({
    REAL: '2026-11-15',
    plans,
    cfg: defaultConfig(),
    moveModal: { fromDate: '2026-11-15', id: 'w1', ym: '2026-11', startIdx: 2, endIdx: 5 },
    gcalByMonth: { '2026-11': [{ id: 'g1', title: '숨겨져야함', startDate: '2026-11-15', endDate: '2026-11-15', allDay: true, color: '#4285f4' }] },
  });
  assert.match(moveHtml, /movepop-cal/);
  assert.match(moveHtml, /data-mpop-drag="1"/);
  assert.match(moveHtml, /data-mpop-drop="2026-11-18"/);
  assert.match(moveHtml, /data-act="movepop-start"/);
  assert.match(moveHtml, /data-act="movepop-end"/);
  assert.match(moveHtml, /#3~6/);
  assert.equal(/숨겨져야함/.test(moveHtml), false);
});
