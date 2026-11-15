import { addDay, dayOfWeek } from './date.js';
import { CL, capOf, fmt, itemP, parseUnits, planDates, sumP, unitsText } from './units.js';

/**
 * 항목의 이월 규칙을 반환합니다 ('ask' | 'auto' | 'drop').
 * @param {object} item
 * @param {object} cfg
 * @returns {'ask' | 'auto' | 'drop'}
 */
export function carryRuleOf(item, cfg) {
  const map = (cfg && cfg.carry) || {};
  return map[item.b] || 'ask';
}

/**
 * 기준일(todayIso) 이전 날짜에 남은 미완료(비기록) 항목을 모두 찾습니다.
 * @param {Record<string, object[]>} plans
 * @param {string} todayIso
 * @returns {Array<{ date: string, item: object }>}
 */
export function getOverdueItems(plans, todayIso) {
  const out = [];
  for (const d of planDates(plans)) {
    if (d >= todayIso) continue;
    for (const it of plans[d] || []) {
      if (!it.done && !it.x) {
        out.push({ date: d, item: CL(it) });
      }
    }
  }
  return out;
}

/**
 * 두 날짜 간 항목 이동을 수행한 새 plans 사본과 변경 여부를 반환합니다.
 */
export function movePlanItem(plans, fromDate, id, toDate) {
  if (!fromDate || !toDate || fromDate === toDate) {
    return { changed: false, plans: CL(plans) };
  }
  const next = CL(plans);
  const src = next[fromDate] || [];
  const idx = src.findIndex((i) => i.id === id);
  if (idx < 0) return { changed: false, plans: next };
  const [item] = src.splice(idx, 1);
  if (fromDate < toDate) {
    if (!item.from) item.from = fromDate;
  } else if (item.from && toDate <= item.from) {
    delete item.from;
  }
  next[fromDate] = src;
  next[toDate] = next[toDate] || [];
  next[toDate].push(item);
  return { changed: true, plans: next };
}

/**
 * 문제집/범위형 항목의 일부(startIdx~endIdx) 또는 전체를 다른 날짜로 이동합니다.
 */
export function movePlanSlice(plans, fromDate, id, toDate, startIdx = 0, endIdx = null) {
  if (!fromDate || !toDate || fromDate === toDate) {
    return { changed: false, plans: CL(plans) };
  }
  const srcList = (plans && plans[fromDate]) || [];
  const orig = srcList.find((i) => i.id === id);
  if (!orig) return { changed: false, plans: CL(plans) };

  const units = parseUnits(orig);
  if (!units || units.length <= 1) {
    return movePlanItem(plans, fromDate, id, toDate);
  }
  const s = Math.max(0, Math.min(units.length - 1, Number(startIdx) || 0));
  const e =
    endIdx == null
      ? units.length - 1
      : Math.max(s, Math.min(units.length - 1, Number(endIdx)));
  if (s === 0 && e === units.length - 1) {
    return movePlanItem(plans, fromDate, id, toDate);
  }

  const next = CL(plans);
  const nextSrc = next[fromDate] || [];
  const idx = nextSrc.findIndex((i) => i.id === id);
  if (idx < 0) return { changed: false, plans: next };

  const beforeU = units.slice(0, s);
  const movedU = units.slice(s, e + 1);
  const afterU = units.slice(e + 1);

  const stamp = Date.now().toString(36);
  const replacements = [];
  if (beforeU.length) {
    replacements.push({
      ...CL(orig),
      t: unitsText(beforeU),
      n: beforeU.length,
    });
  }
  if (afterU.length) {
    replacements.push({
      ...CL(orig),
      id: beforeU.length ? `${orig.id}r${stamp}` : orig.id,
      t: unitsText(afterU),
      n: afterU.length,
    });
  }
  nextSrc.splice(idx, 1, ...replacements);
  next[fromDate] = nextSrc;

  const movedPart = {
    ...CL(orig),
    id: `${orig.id}m${stamp}`,
    t: unitsText(movedU),
    n: movedU.length,
  };
  if (fromDate < toDate) {
    if (!movedPart.from) movedPart.from = fromDate;
  } else if (movedPart.from && toDate <= movedPart.from) {
    delete movedPart.from;
  }
  next[toDate] = next[toDate] || [];
  next[toDate].push(movedPart);

  return { changed: true, plans: next };
}

/**
 * 'auto' 규칙 교재의 지난 미완료 항목을 todayIso로 자동 이월합니다.
 * @param {Record<string, object[]>} plans
 * @param {object} cfg
 * @param {string} todayIso
 * @returns {{ changed: boolean, touchedDates: string[], plans: Record<string, object[]> }}
 */
export function applyAutoCarry(plans, cfg, todayIso) {
  const next = CL(plans);
  const touched = new Set();
  for (const d of planDates(next)) {
    if (d >= todayIso) continue;
    const list = next[d] || [];
    const remain = [];
    for (const it of list) {
      if (!it.done && !it.x && carryRuleOf(it, cfg) === 'auto') {
        if (!it.from) it.from = d;
        next[todayIso] = next[todayIso] || [];
        next[todayIso].push(it);
        touched.add(d);
        touched.add(todayIso);
      } else {
        remain.push(it);
      }
    }
    if (remain.length !== list.length) {
      next[d] = remain;
    }
  }
  return {
    changed: touched.size > 0,
    touchedDates: [...touched].sort(),
    plans: next,
  };
}

/**
 * '오늘은 여기까지' 마무리 시 미완료 항목 이동 계획을 계산합니다(원본 무변경).
 * @param {{ plans: Record<string, object[]>, cfg: object, todayIso: string, mode?: 'next'|'spread', keepIds?: Set<string>|string[] }} opts
 */
export function planClose({ plans, cfg, todayIso, mode = 'next', keepIds = new Set() }) {
  const keepSet = keepIds instanceof Set ? keepIds : new Set(keepIds);
  const un = (plans[todayIso] || [])
    .filter((i) => !i.done && !i.x)
    .map((i) => CL(i));

  const dts = planDates(plans);
  const last = dts.length ? dts[dts.length - 1] : todayIso;
  let days = [];
  for (let d = addDay(todayIso, 1); d <= last; d = addDay(d, 1)) {
    days.push(d);
  }
  if (!days.length) days = [addDay(todayIso, 1)];

  const before = {};
  const after = {};
  for (const d of days) {
    before[d] = sumP(plans[d] || [], cfg);
    after[d] = before[d];
  }

  const moves = [];
  const keeps = [];
  for (const i of un) {
    if (carryRuleOf(i, cfg) === 'drop' || keepSet.has(i.id)) {
      keeps.push(i);
    } else {
      moves.push(i);
    }
  }

  const dest = {};
  let simulatedPlans = null;
  let spreadTouched = null;
  if (mode === 'next') {
    for (const i of moves) {
      dest[i.id] = days[0];
      after[days[0]] = fmt(after[days[0]] + itemP(i, cfg));
    }
  } else {
    const wEnd = addDay(todayIso, 7 - dayOfWeek(todayIso));
    const wd = days.filter((d) => d <= wEnd);
    const pool = wd.length ? wd : [days[0]];
    const sorted = moves.slice().sort((a, b) => itemP(b, cfg) - itemP(a, cfg));
    for (const i of sorted) {
      const p = itemP(i, cfg);
      let target = pool.find((d) => after[d] + p <= capOf(d, plans, cfg));
      if (!target) {
        target = pool.reduce(
          (best, d) =>
            after[d] / Math.max(1, capOf(d, plans, cfg)) <
            after[best] / Math.max(1, capOf(best, plans, cfg))
              ? d
              : best,
          pool[0]
        );
      }
      dest[i.id] = target;
      after[target] = fmt(after[target] + p);
    }

    // 이번주 안에서 나눠서 이동 시 같은 교재의 미완료 항목을 교재 순서(번호/단원 순)에 맞춰 재정렬
    const sim = CL(plans);
    const touched = new Set();
    for (const it of moves) {
      const target = dest[it.id];
      const res = movePlanItem(sim, todayIso, it.id, target);
      if (res.changed) {
        sim[todayIso] = res.plans[todayIso];
        sim[target] = res.plans[target];
        touched.add(todayIso);
        touched.add(target);
      }
    }

    const compareBookOrder = (a, b) => {
      const ua = parseUnits(a);
      const ub = parseUnits(b);
      if (ua && ua.length && ub && ub.length) {
        const pCmp = String(ua[0].p || '').localeCompare(String(ub[0].p || ''), 'ko', {
          numeric: true,
        });
        if (pCmp !== 0) return pCmp;
        return ua[0].n - ub[0].n;
      }
      if (ua && ua.length) return -1;
      if (ub && ub.length) return 1;
      return String((a && a.t) || '').localeCompare(String((b && b.t) || ''), 'ko', {
        numeric: true,
      });
    };

    const movedIds = new Set(moves.map((m) => m.id));
    const movedBooks = new Set(moves.map((m) => m.b).filter(Boolean));
    for (const book of movedBooks) {
      const entries = [];
      for (const d of pool) {
        const list = sim[d] || [];
        list.forEach((it, idx) => {
          if (!it.done && !it.x && it.b === book) {
            entries.push({ date: d, idx, item: it });
          }
        });
      }
      if (entries.length <= 1) continue;
      const slots = entries.map((e) => ({ date: e.date, idx: e.idx }));
      const ordered = entries
        .map((e, origPos) => ({ item: e.item, origPos }))
        .sort((a, b) => compareBookOrder(a.item, b.item) || a.origPos - b.origPos)
        .map((x) => x.item);

      slots.forEach((slot, k) => {
        const nextItem = ordered[k];
        if (sim[slot.date][slot.idx] !== nextItem) {
          sim[slot.date][slot.idx] = nextItem;
          touched.add(slot.date);
        }
        if (movedIds.has(nextItem.id)) {
          dest[nextItem.id] = slot.date;
        }
      });
    }

    for (const d of days) {
      after[d] = sumP(sim[d] || [], cfg);
    }
    simulatedPlans = sim;
    spreadTouched = [...touched].sort();
  }

  const moveP = fmt(moves.reduce((a, i) => a + itemP(i, cfg), 0));
  const keepP = fmt(keeps.reduce((a, i) => a + itemP(i, cfg), 0));
  const freeSum = (loadMap) =>
    fmt(
      days.reduce(
        (a, d) => a + Math.max(0, capOf(d, plans, cfg) - loadMap[d]),
        0
      )
    );

  return {
    un,
    moves,
    keeps,
    dest,
    days,
    before,
    after,
    moveP,
    keepP,
    freeBefore: freeSum(before),
    freeAfter: freeSum(after),
    simulatedPlans,
    spreadTouched,
  };
}

/**
 * planClose 결과를 실제로 plans 사본에 적용합니다.
 */
export function applyClosePlan({ plans, cfg, todayIso, mode = 'next', keepIds = new Set() }) {
  const summary = planClose({ plans, cfg, todayIso, mode, keepIds });
  if (mode === 'spread' && summary.simulatedPlans) {
    return {
      plans: summary.simulatedPlans,
      touchedDates: summary.spreadTouched || [],
      summary,
    };
  }
  let next = CL(plans);
  const touched = new Set();
  for (const it of summary.moves) {
    const target = summary.dest[it.id];
    const res = movePlanItem(next, todayIso, it.id, target);
    if (res.changed) {
      next = res.plans;
      touched.add(todayIso);
      touched.add(target);
    }
  }
  return {
    plans: next,
    touchedDates: [...touched].sort(),
    summary,
  };
}
