import { dayOfWeek } from './date.js';

/**
 * 객체/배열을 깊은 복사해 저장소 참조 변이로 인한 UI 미반영 버그를 방지합니다.
 * @template T
 * @param {T} o
 * @returns {T}
 */
export function CL(o) {
  if (o === undefined) return undefined;
  return JSON.parse(JSON.stringify(o));
}

export const STUDY_SUBJ = ['국어', '수학', '영어', '과탐'];
export const ALL_SUBJ = ['국어', '수학', '영어', '과탐', '학교·할일'];

export const STUDY_BOOKS = {
  쎈: '수학',
  원솔: '수학',
  고쟁이: '수학',
  기하강의: '수학',
  역학: '과탐',
  세포: '과탐',
  물질: '과탐',
  알고리즘: '영어',
  자이: '영어',
  실전모의: '영어',
  모의오답: '영어',
  문장개념노트: '국어',
  문장문제편: '국어',
};

export const GENERAL_BOOK = '일반할일';
export const GENERAL_CATS = ['세특', '수행평가', '학교생활', '일반'];

export const BOOKS = {
  ...STUDY_BOOKS,
  [GENERAL_BOOK]: '학교·할일',
};

export const BNAME = {
  쎈: '기하 쎈',
  원솔: '수2 원솔',
  고쟁이: '미적I 고쟁이',
  기하강의: '기하 강의',
  알고리즘: '이명학 알고리즘',
  자이: '영어 자이',
  실전모의: '이명학 실전모의',
  모의오답: '기출모의 오답',
  문장개념노트: '문장 개념노트',
  문장문제편: '문장 문제편',
  역학: '역학',
  세포: '세포',
  물질: '물질',
  [GENERAL_BOOK]: '일반 할 일',
};

export const UNIT = {
  쎈: '문제',
  원솔: '문제',
  고쟁이: '문제',
  역학: '문제',
  세포: '문제',
  물질: '문제',
  기하강의: '강',
  알고리즘: '강',
  자이: '단위',
  실전모의: '회',
  모의오답: '회',
  문장개념노트: '개',
  문장문제편: '문제',
  [GENERAL_BOOK]: '개',
};

export const SH = {
  쎈: '쎈',
  원솔: '원솔',
  고쟁이: '고쟁',
  기하강의: '강의',
  알고리즘: '알고',
  자이: '자이',
  실전모의: '모의',
  모의오답: '오답',
  문장개념노트: '개념',
  문장문제편: '문제',
  역학: '역학',
  세포: '세포',
  물질: '물질',
  [GENERAL_BOOK]: '할일',
};

export const DEF_W = {
  쎈: 1,
  원솔: 2,
  고쟁이: 2,
  역학: 1,
  세포: 1,
  물질: 1,
  기하강의: 13,
  알고리즘: 10,
  자이: 1,
  실전모의: 23,
  모의오답: 10,
  문장개념노트: 10,
  문장문제편: 0.7,
};

export const PB = new Set([
  '쎈',
  '원솔',
  '고쟁이',
  '기하강의',
  '알고리즘',
  '실전모의',
  '모의오답',
  '역학',
  '세포',
  '물질',
  '문장문제편',
  '문장개념노트',
  '자이',
]);

export const SC = {
  국어: ['--kor', '--kor-bg'],
  수학: ['--math', '--math-bg'],
  영어: ['--eng', '--eng-bg'],
  과탐: ['--sci', '--sci-bg'],
  '학교·할일': ['--gen', '--gen-bg'],
};

export const DEF_DD = [
  { n: '기말고사', d: '2026-12-07' },
  { n: '수능', d: '2027-11-18' },
];

export const DEF_CAPS = { study: 70, off: 30 };

export const fmt = (x) => Math.round((Number(x) || 0) * 10) / 10;

export function isGeneralItem(it) {
  return Boolean(
    it && (it.kind === 'todo' || it.b === GENERAL_BOOK || it.s === '학교·할일')
  );
}

export function itemLabelPrefix(it) {
  if (!it) return '';
  if (isGeneralItem(it)) {
    return it.cat ? `[${it.cat}]` : BNAME[GENERAL_BOOK];
  }
  return BNAME[it.b] || it.b;
}

export function doneDateOf(it) {
  if (!it || !it.done) return '';
  return it.done_date || it.d || '';
}

export function weightOf(b, cfg) {
  if (cfg && cfg.weights && cfg.weights[b] != null) {
    return Number(cfg.weights[b]);
  }
  return DEF_W[b] != null ? DEF_W[b] : 1;
}

export function itemP(it, cfg) {
  if (!it || it.x) return 0;
  if (isGeneralItem(it)) {
    if (it.p != null && !Number.isNaN(Number(it.p))) return Number(it.p);
    return (Number(it.n) || 1) * 5;
  }
  return (Number(it.n) || 0) * weightOf(it.b, cfg);
}

export function sumP(items, cfg, filterFn) {
  const list = Array.isArray(items) ? items : [];
  const filtered = filterFn ? list.filter(filterFn) : list;
  return fmt(filtered.reduce((acc, it) => acc + itemP(it, cfg), 0));
}

export function capOf(dateIso, plans, cfg) {
  if (plans && plans[dateIso + '#cap'] != null) {
    return Number(plans[dateIso + '#cap']);
  }
  const caps = (cfg && cfg.caps) || DEF_CAPS;
  const wd = dayOfWeek(dateIso);
  return [1, 3, 4, 5].includes(wd)
    ? Number(caps.study ?? 70)
    : Number(caps.off ?? 30);
}

export function planDates(plans) {
  return Object.keys(plans || {})
    .filter((k) => !k.includes('#'))
    .sort();
}

export function liveItems(items) {
  return (items || []).filter((i) => !i.x);
}

const NK = (x) => String(x).replace(/[·\s.#]/g, '').toUpperCase();

/**
 * 문제집/코드형 범위 텍스트를 단위 배열로 전개합니다.
 * 예: "T05·15~19, T06·1" -> [{p:'T05·', n:15}, ..., {p:'T06·', n:1}]
 * @param {{ t: string, n: number }} it
 * @returns {Array<{ p: string, n: number }> | null}
 */
export function parseUnits(it) {
  if (!it || typeof it.t !== 'string') return null;
  const out = [];
  for (const seg of it.t.split(/,\s*/)) {
    const m = /^(.*?)(\d+)(?:~(\d+))?([^\d~,\s]*)$/.exec(seg.trim());
    if (!m) return null;
    const a = Number(m[2]);
    const b = m[3] ? Number(m[3]) : a;
    const s = m[4] || '';
    if (b < a || b - a > 5000) return null;
    for (let n = a; n <= b; n++) {
      out.push(s ? { p: m[1], n, s } : { p: m[1], n });
    }
  }
  return out.length === it.n ? out : null;
}

/**
 * 단위 배열을 연속 구간 문자열로 압축합니다.
 * @param {Array<{ p: string, n: number, s?: string }>} units
 * @returns {string}
 */
export function unitsText(units) {
  const g = [];
  units.forEach((x) => {
    const l = g[g.length - 1];
    const xs = x.s || '';
    if (l && l.p === x.p && l.s === xs && l.b + 1 === x.n) {
      l.b = x.n;
    } else {
      g.push({ p: x.p, s: xs, a: x.n, b: x.n });
    }
  });
  return g
    .map((r) => (r.a === r.b ? `${r.p}${r.a}${r.s}` : `${r.p}${r.a}~${r.b}${r.s}`))
    .join(', ');
}

/**
 * 문제집/코드형 항목을 사용자가 입력한 번호(input)까지 부분 완료 처리합니다.
 * 원본 item은 변경하지 않고 새 객체 배열을 반환합니다.
 * @param {object} it
 * @param {string} input
 * @param {string} doneDate
 * @returns {{ ok: boolean, error?: string, completedAll?: boolean, items?: object[] }}
 */
export function splitRangeUpTo(it, input, doneDate) {
  const u = parseUnits(it);
  if (!u) {
    return { ok: false, error: '분할할 수 없는 범위 형식이에요.' };
  }
  const v = String(input || '').trim();
  if (!v) {
    return { ok: false, error: '번호를 적어 주세요.' };
  }
  let idx = u
    .map((x, i) => (NK(x.p + x.n + (x.s || '')) === NK(v) ? i : -1))
    .filter((i) => i >= 0);
  if (!idx.length && /^\d+$/.test(v)) {
    idx = u.map((x, i) => (x.n === Number(v) ? i : -1)).filter((i) => i >= 0);
  }
  if (!idx.length) {
    return { ok: false, error: '이 항목 범위 안에 없는 번호예요: ' + it.t };
  }
  if (idx.length > 1) {
    return {
      ok: false,
      error: '같은 번호가 여러 곳에 있어요. T06·5처럼 앞부분까지 적어 주세요.',
    };
  }
  const k = idx[0];
  if (k === u.length - 1) {
    const doneAll = CL(it);
    doneAll.done = true;
    doneAll.done_date = doneDate;
    doneAll.d = doneDate;
    return { ok: true, completedAll: true, items: [doneAll] };
  }
  const doneU = u.slice(0, k + 1);
  const restU = u.slice(k + 1);
  const donePart = {
    ...CL(it),
    id: `${it.id}d${Date.now().toString(36)}`,
    t: unitsText(doneU),
    n: doneU.length,
    done: true,
    done_date: doneDate,
    d: doneDate,
  };
  const restPart = {
    ...CL(it),
    t: unitsText(restU),
    n: restU.length,
    done: false,
  };
  delete restPart.done_date;
  delete restPart.d;
  return { ok: true, completedAll: false, items: [donePart, restPart] };
}

/**
 * 교재별 남은 분량과 완료 현황 요약을 계산합니다.
 */
export function remainByBook(plans, cfg) {
  const r = {};
  for (const d of planDates(plans)) {
    for (const i of plans[d] || []) {
      if (i.x) continue;
      const o = r[i.b] || (r[i.b] = { n: 0, dn: 0, p: 0, dp: 0 });
      o.n += Number(i.n) || 0;
      const p = itemP(i, cfg);
      if (i.done) {
        o.dn += Number(i.n) || 0;
        o.dp = fmt(o.dp + p);
      } else {
        o.p = fmt(o.p + p);
      }
    }
  }
  return r;
}

/**
 * 특정 교재의 전체 진도 및 날짜별 작업 내역을 계산합니다(교재 진도 팝업용).
 * @param {Record<string, object[]>} plans
 * @param {string} bookId
 * @param {object} cfg
 */
export function getBookProgress(plans, bookId, cfg) {
  const rows = [];
  const extraRows = [];
  for (const d of planDates(plans)) {
    for (const it of plans[d] || []) {
      if (it.b !== bookId) continue;
      const entry = {
        planDate: d,
        item: CL(it),
        p: itemP(it, cfg),
        doneDate: doneDateOf(it),
      };
      if (it.x) extraRows.push(entry);
      else rows.push(entry);
    }
  }
  const totalN = fmt(rows.reduce((a, r) => a + (Number(r.item.n) || 0), 0));
  const doneN = fmt(
    rows.reduce((a, r) => a + (r.item.done ? Number(r.item.n) || 0 : 0), 0)
  );
  const totalP = fmt(rows.reduce((a, r) => a + r.p, 0));
  const doneP = fmt(rows.reduce((a, r) => a + (r.item.done ? r.p : 0), 0));
  const remainP = fmt(totalP - doneP);
  const pct = totalN ? Math.round((doneN / totalN) * 100) : 0;
  return {
    bookId,
    name: BNAME[bookId] || bookId,
    subject: BOOKS[bookId] || '학교·할일',
    unit: UNIT[bookId] || '개',
    weight: weightOf(bookId, cfg),
    totalN,
    doneN,
    totalP,
    doneP,
    remainP,
    pct,
    rows,
    extraRows,
  };
}

/**
 * 모든 학습 교재의 계획 범위를 날짜 전체에서 검사해 중복·누락 구간을 찾습니다.
 * @param {Record<string, object[]>} plans
 */
export function auditBookRanges(plans) {
  const byBook = new Map();
  for (const d of planDates(plans)) {
    for (const it of plans[d] || []) {
      if (!it || it.x || !STUDY_BOOKS[it.b]) continue;
      const units = parseUnits(it);
      if (!units || !units.length) continue;
      if (!byBook.has(it.b)) byBook.set(it.b, new Map());
      const prefixMap = byBook.get(it.b);
      for (const u of units) {
        const key = `${u.p}\0${u.s || ''}`;
        if (!prefixMap.has(key)) prefixMap.set(key, new Map());
        const numMap = prefixMap.get(key);
        if (!numMap.has(u.n)) numMap.set(u.n, []);
        numMap.get(u.n).push({ date: d, id: it.id, done: Boolean(it.done) });
      }
    }
  }

  const books = [];
  let duplicateCount = 0;
  let gapCount = 0;

  for (const [bookId, prefixMap] of byBook.entries()) {
    const dupUnits = [];
    const dupDatesSet = new Set();
    const gapUnits = [];

    const keys = [...prefixMap.keys()].sort((a, b) =>
      String(a).localeCompare(String(b), 'ko', { numeric: true })
    );

    for (const key of keys) {
      const [p, s] = key.split('\0');
      const numMap = prefixMap.get(key);
      const nums = [...numMap.keys()].sort((a, b) => a - b);
      if (!nums.length) continue;

      for (const n of nums) {
        const occ = numMap.get(n);
        if (occ.length > 1) {
          dupUnits.push(s ? { p, n, s } : { p, n });
          for (const o of occ) dupDatesSet.add(o.date);
        }
      }

      const minN = nums[0];
      const maxN = nums[nums.length - 1];
      for (let n = minN; n <= maxN; n++) {
        if (!numMap.has(n)) {
          gapUnits.push(s ? { p, n, s } : { p, n });
        }
      }
    }

    if (dupUnits.length || gapUnits.length) {
      duplicateCount += dupUnits.length;
      gapCount += gapUnits.length;
      books.push({
        bookId,
        name: BNAME[bookId] || bookId,
        duplicateText: dupUnits.length ? unitsText(dupUnits) : '',
        duplicateCount: dupUnits.length,
        duplicateDates: [...dupDatesSet].sort(),
        gapText: gapUnits.length ? unitsText(gapUnits) : '',
        gapCount: gapUnits.length,
      });
    }
  }

  return {
    hasIssues: books.length > 0,
    duplicateCount,
    gapCount,
    books,
  };
}
