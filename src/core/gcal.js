import { KST_OFFSET_MS, addDay, todayKst } from './date.js';

export function defaultGcalConfig() {
  return { clientId: '', hiddenCalendarIds: [] };
}

export function safeCssColor(c, fallback = '#4285f4') {
  const s = String(c || '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
}

function hmKst(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * Google Calendar API 이벤트 → 앱 표시용 항목(KST 기준 날짜).
 * endDate는 포함(inclusive) 날짜입니다.
 */
export function gcalEventToItem(ev, cal = {}) {
  if (!ev || ev.status === 'cancelled') return null;
  const s = ev.start || {};
  const e = ev.end || {};
  let startDate = '';
  let endDate = '';
  let allDay = false;
  let time = '';
  if (s.date) {
    allDay = true;
    startDate = s.date;
    const exclusiveEnd = e.date || addDay(s.date, 1);
    endDate = addDay(exclusiveEnd, -1);
    if (endDate < startDate) endDate = startDate;
  } else if (s.dateTime) {
    const sMs = Date.parse(s.dateTime);
    if (!Number.isFinite(sMs)) return null;
    startDate = todayKst(sMs);
    const eMs = Date.parse(e.dateTime || s.dateTime);
    endDate = Number.isFinite(eMs) ? todayKst(Math.max(sMs, eMs - 1)) : startDate;
    time = hmKst(sMs);
  } else {
    return null;
  }
  return {
    id: `${cal.id || 'cal'}:${ev.id}`,
    title: String(ev.summary || '(제목 없음)'),
    startDate,
    endDate,
    allDay,
    time,
    calId: cal.id || '',
    calName: cal.summary || '',
    color: safeCssColor(cal.backgroundColor),
    link: ev.htmlLink || '',
    location: ev.location || '',
  };
}

/**
 * 이벤트 목록을 날짜별 맵으로 펼칩니다 (여러 날 일정은 각 날짜에 표시).
 */
export function groupGcalByDate(items, dates) {
  const set = new Set(dates);
  const map = {};
  for (const it of items) {
    let d = it.startDate;
    let guard = 0;
    while (d <= it.endDate && guard < 62) {
      if (set.has(d)) (map[d] = map[d] || []).push(it);
      d = addDay(d, 1);
      guard += 1;
    }
  }
  for (const k of Object.keys(map)) {
    map[k].sort(
      (a, b) =>
        (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) ||
        String(a.time).localeCompare(String(b.time)) ||
        a.title.localeCompare(b.title)
    );
  }
  return map;
}
