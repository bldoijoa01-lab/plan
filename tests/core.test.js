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
import { safeUrl } from '../src/core/html.js';
import {
  renderAll,
  renderBookModal,
  renderSettings,
  renderToday,
  renderWeek,
} from '../src/views/schedule.js';
import { detectBookmarkKind, renderHub } from '../src/views/hub.js';
import { renderMatrix } from '../src/views/matrix.js';

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
  assert.ok(carried.plans['2026-11-15'].some((i) => i.id === 'a1'));
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
});

test('Eisenhower matrix auto classification, manual pin, and undo', () => {
  const cfg = {
    weights: { 쎈: 1, 실전모의: 23 },
    ddays: [{ n: '기말고사', d: '2026-12-07' }],
    matrixRules: {
      urgentDays: 3,
      examUrgentDays: 7,
      includePlanDays: 1,
      importantKeywords: ['세특', '수행평가'],
      examBooks: ['쎈'],
    },
  };

  const q1 = classifyMatrixCandidate(
    { id: '1', source: 'plan', planDate: '2026-11-15', bookId: '쎈', title: '기하 쎈 #1~5' },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q1.autoQuad, 'q1');

  const q2 = classifyMatrixCandidate(
    { id: '2', source: 'plan', planDate: '2026-11-16', bookId: '쎈', title: '기하 쎈 #6~10' },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q2.autoQuad, 'q2');

  const q3 = classifyMatrixCandidate(
    { id: '3', source: 'plan', planDate: '2026-11-15', bookId: '실전모의', title: '실전모의 1회' },
    { cfg, todayIso: '2026-11-15' }
  );
  assert.equal(q3.autoQuad, 'q3');

  const examSoon = classifyMatrixCandidate(
    { id: '4', source: 'plan', planDate: '2026-12-03', bookId: '쎈', title: '기하 쎈' },
    { cfg, todayIso: '2026-12-02' }
  );
  assert.equal(examSoon.urgent, true);
  assert.equal(examSoon.autoQuad, 'q1');

  const plans = {
    '2026-11-15': [
      { id: 'p1', s: '수학', b: '쎈', t: '#1~5', n: 5, done: false },
      { id: 'p2', kind: 'todo', s: '학교·할일', b: '일반할일', cat: '세특', t: '생기부 세특 확인', n: 1, p: 5, due: '2026-11-25', done: false },
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
  assert.ok(board.quads.q1.some((x) => x.id === 'p1'));
  assert.ok(board.quads.q1.some((x) => x.id === 'p2'));
  assert.ok(board.quads.q1.some((x) => x.id === 'm1'));
  assert.ok(board.quads.q4.some((x) => x.id === 'p3'));
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

  const mv2 = moveMatrixItemManual(matrixState, 'plan:p3', 'q1');
  const rst = resetMatrixItemToAuto(mv2.matrixState, 'plan:p3');
  assert.equal(rst.changed, true);
  assert.equal(rst.matrixState.overrides['plan:p3'], undefined);
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

  const setHtml = renderSettings(state);
  assert.match(setHtml, /아이젠하워 매트릭스 자동 분류 규칙/);
});
