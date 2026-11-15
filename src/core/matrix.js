import { addDay, diffDays, isValidIso } from './date.js';
import {
  BNAME,
  CL,
  DEF_DD,
  GENERAL_BOOK,
  STUDY_BOOKS,
  isGeneralItem,
  itemP,
  planDates,
} from './units.js';

export const QUADRANTS = {
  q1: {
    id: 'q1',
    title: '지금 하기',
    sub: '긴급 O · 중요 O',
    tone: 'bad',
  },
  q2: {
    id: 'q2',
    title: '계획하기',
    sub: '긴급 X · 중요 O',
    tone: 'ok',
  },
  q3: {
    id: 'q3',
    title: '위임·간단히',
    sub: '긴급 O · 중요 X',
    tone: 'warn',
  },
  q4: {
    id: 'q4',
    title: '버리기·나중에',
    sub: '긴급 X · 중요 X',
    tone: 'mute',
  },
};

export const QUAD_ORDER = ['q1', 'q2', 'q3', 'q4'];

export const DEFAULT_MATRIX_RULES = {
  urgentDays: 3,
  examUrgentDays: 7,
  includePlanDays: 1,
  importantKeywords: ['수행평가', '세특', '생기부', '기말', '시험'],
  examBooks: [
    '쎈',
    '원솔',
    '고쟁이',
    '기하강의',
    '역학',
    '세포',
    '물질',
    '문장개념노트',
    '문장문제편',
  ],
};

/**
 * 설정에 저장된 matrixRules와 기본값을 안전하게 병합합니다.
 * @param {object} cfg
 */
export function resolveMatrixRules(cfg) {
  const raw = (cfg && cfg.matrixRules) || {};
  return {
    urgentDays:
      raw.urgentDays != null && !Number.isNaN(Number(raw.urgentDays))
        ? Number(raw.urgentDays)
        : DEFAULT_MATRIX_RULES.urgentDays,
    examUrgentDays:
      raw.examUrgentDays != null && !Number.isNaN(Number(raw.examUrgentDays))
        ? Number(raw.examUrgentDays)
        : DEFAULT_MATRIX_RULES.examUrgentDays,
    includePlanDays:
      raw.includePlanDays != null && !Number.isNaN(Number(raw.includePlanDays))
        ? Number(raw.includePlanDays)
        : DEFAULT_MATRIX_RULES.includePlanDays,
    importantKeywords: Array.isArray(raw.importantKeywords)
      ? raw.importantKeywords.map((x) => String(x).trim()).filter(Boolean)
      : DEFAULT_MATRIX_RULES.importantKeywords.slice(),
    examBooks: Array.isArray(raw.examBooks)
      ? raw.examBooks.filter((b) => b in STUDY_BOOKS)
      : DEFAULT_MATRIX_RULES.examBooks.slice(),
  };
}

/**
 * 기본 matrixState 구조를 반환합니다.
 */
export function normalizeMatrixState(raw) {
  const st = raw && typeof raw === 'object' ? CL(raw) : {};
  return {
    tasks: Array.isArray(st.tasks) ? st.tasks : [],
    overrides: st.overrides && typeof st.overrides === 'object' ? st.overrides : {},
  };
}

/**
 * 단일 후보 항목의 긴급도·중요도와 자동 사분면을 계산합니다.
 * @param {object} item
 * @param {{ cfg?: object, todayIso: string, rules?: object }} ctx
 */
export function classifyMatrixCandidate(item, ctx) {
  const rules = ctx.rules || resolveMatrixRules(ctx.cfg);
  const todayIso = ctx.todayIso;
  const ddays = (ctx.cfg && ctx.cfg.ddays) || DEF_DD;
  const examBooksSet = new Set(rules.examBooks || []);

  let urgent = false;
  let important = false;
  const urgentReasons = [];
  const importantReasons = [];

  if (isValidIso(item.due)) {
    const left = diffDays(todayIso, item.due);
    if (left <= rules.urgentDays) {
      urgent = true;
      if (left < 0) urgentReasons.push(`마감 ${-left}일 지남`);
      else if (left === 0) urgentReasons.push('오늘 마감');
      else urgentReasons.push(`마감 D-${left}`);
    }
  }

  if (item.source === 'plan' && isValidIso(item.planDate)) {
    if (item.planDate < todayIso) {
      urgent = true;
      urgentReasons.push(`밀림 ${diffDays(item.planDate, todayIso)}일`);
    } else if (item.planDate === todayIso) {
      urgent = true;
      urgentReasons.push('오늘 배정');
    }
  }

  const upcomingExams = ddays.filter((x) => {
    if (!x || !isValidIso(x.d)) return false;
    const diff = diffDays(todayIso, x.d);
    return diff >= 0 && diff <= rules.examUrgentDays;
  });

  if (upcomingExams.length) {
    const isStudyOrExam =
      (item.bookId && examBooksSet.has(item.bookId)) ||
      (item.source === 'plan' && item.bookId !== GENERAL_BOOK) ||
      Boolean(item.examRelated);
    if (isStudyOrExam) {
      urgent = true;
      const soonest = upcomingExams
        .slice()
        .sort((a, b) => diffDays(todayIso, a.d) - diffDays(todayIso, b.d))[0];
      const diff = diffDays(todayIso, soonest.d);
      urgentReasons.push(
        `${soonest.n} ${diff === 0 ? 'D-DAY' : 'D-' + diff}`
      );
    }
  }

  if (item.important) {
    important = true;
    importantReasons.push('중요 ★');
  }

  if (item.bookId && examBooksSet.has(item.bookId)) {
    important = true;
    importantReasons.push('시험범위');
  }

  const haystack = `${item.cat || ''} ${item.title || ''}`.toLowerCase();
  for (const kw of rules.importantKeywords || []) {
    if (kw && haystack.includes(kw.toLowerCase())) {
      important = true;
      importantReasons.push(kw);
      break;
    }
  }

  const autoQuad = urgent
    ? important
      ? 'q1'
      : 'q3'
    : important
      ? 'q2'
      : 'q4';

  return {
    urgent,
    important,
    autoQuad,
    urgentReasons,
    importantReasons,
  };
}

/**
 * 공부 계획표(밀린·오늘·내일 미완료 항목)와 독립 할 일을 통합해 4분면별 항목을 구성합니다.
 */
export function buildMatrixBoard({ plans, cfg, matrixState, todayIso }) {
  const st = normalizeMatrixState(matrixState);
  const rules = resolveMatrixRules(cfg);
  const maxPlanDate = addDay(todayIso, Math.max(0, rules.includePlanDays));

  const candidates = [];

  for (const d of planDates(plans)) {
    if (d > maxPlanDate) continue;
    for (const it of plans[d] || []) {
      if (it.x || it.done) continue;
      const gen = isGeneralItem(it);
      candidates.push({
        key: `plan:${it.id}`,
        id: it.id,
        source: 'plan',
        planDate: d,
        bookId: it.b,
        subject: it.s,
        cat: it.cat || '',
        title: gen
          ? it.t
          : `${BNAME[it.b] || it.b} ${it.t}`,
        rangeText: it.t,
        p: itemP(it, cfg),
        due: it.due || '',
        important: Boolean(it.important),
        done: false,
      });
    }
  }

  for (const t of st.tasks) {
    candidates.push({
      key: `todo:${t.id}`,
      id: t.id,
      source: 'todo',
      planDate: '',
      bookId: '',
      subject: '학교·할일',
      cat: t.cat || '일반',
      title: t.title || '',
      p: 0,
      due: t.due || '',
      important: Boolean(t.important),
      done: Boolean(t.done),
      done_date: t.done_date || '',
    });
  }

  const quads = { q1: [], q2: [], q3: [], q4: [] };
  const doneTodos = [];

  for (const cand of candidates) {
    if (cand.done) {
      doneTodos.push(cand);
      continue;
    }
    const cls = classifyMatrixCandidate(cand, { cfg, todayIso, rules });
    const ov = st.overrides[cand.key];
    const isManual = Boolean(ov && ov.manual && QUADRANTS[ov.quad]);
    const quad = isManual ? ov.quad : cls.autoQuad;

    quads[quad].push({
      ...cand,
      ...cls,
      quad,
      manual: isManual,
      reasons: [...cls.importantReasons, ...cls.urgentReasons],
    });
  }

  return { quads, doneTodos, rules };
}

/**
 * 항목을 수동으로 지정한 사분면으로 이동하고 되돌리기 스냅샷을 반환합니다.
 */
export function moveMatrixItemManual(matrixState, itemKey, targetQuad) {
  if (!QUADRANTS[targetQuad]) return { changed: false, matrixState };
  const next = normalizeMatrixState(matrixState);
  const prevOverride = next.overrides[itemKey]
    ? CL(next.overrides[itemKey])
    : null;
  if (prevOverride && prevOverride.manual && prevOverride.quad === targetQuad) {
    return { changed: false, matrixState: next, undoEntry: null };
  }
  next.overrides[itemKey] = {
    quad: targetQuad,
    manual: true,
    updatedAt: new Date().toISOString(),
  };
  return {
    changed: true,
    matrixState: next,
    undoEntry: { itemKey, prevOverride },
  };
}

/**
 * 수동 고정 표시를 해제하고 자동 분류로 되돌립니다.
 */
export function resetMatrixItemToAuto(matrixState, itemKey) {
  const next = normalizeMatrixState(matrixState);
  const prevOverride = next.overrides[itemKey]
    ? CL(next.overrides[itemKey])
    : null;
  if (!prevOverride) {
    return { changed: false, matrixState: next, undoEntry: null };
  }
  delete next.overrides[itemKey];
  return {
    changed: true,
    matrixState: next,
    undoEntry: { itemKey, prevOverride },
  };
}

/**
 * 직전 이동/초기화 작업(undoEntry)을 되돌립니다.
 */
export function applyMatrixUndo(matrixState, undoEntry) {
  if (!undoEntry || !undoEntry.itemKey) {
    return { changed: false, matrixState };
  }
  const next = normalizeMatrixState(matrixState);
  if (undoEntry.prevOverride) {
    next.overrides[undoEntry.itemKey] = CL(undoEntry.prevOverride);
  } else {
    delete next.overrides[undoEntry.itemKey];
  }
  return { changed: true, matrixState: next };
}
