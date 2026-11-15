/**
 * KST (Asia/Seoul, UTC+9) 기준 공용 날짜·시간·D-day 계산 모듈.
 * 모든 날짜 문자열은 YYYY-MM-DD 형식이며 브라우저/서버 로컬 타임존에 무관하게 일관되게 동작합니다.
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 86400000;
export const WD_KO = ['일', '월', '화', '수', '목', '금', '토'];
export const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * 주어진 epoch ms(기본 Date.now())의 KST 기준 YYYY-MM-DD 문자열을 반환합니다.
 * @param {number} [nowMs]
 * @returns {string}
 */
export function todayKst(nowMs = Date.now()) {
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * KST 기준 현재 시:분(HH:MM)을 반환합니다.
 * @param {number} [nowMs]
 * @returns {string}
 */
export function timeKstHm(nowMs = Date.now()) {
  const shifted = new Date(nowMs + KST_OFFSET_MS);
  return (
    String(shifted.getUTCHours()).padStart(2, '0') +
    ':' +
    String(shifted.getUTCMinutes()).padStart(2, '0')
  );
}

/**
 * YYYY-MM-DD 문자열 유효성을 검사합니다.
 * @param {string} s
 * @returns {boolean}
 */
export function isValidIso(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * YYYY-MM-DD 문자열을 UTC 자정 기준 타임스탬프와 요일 정보로 파싱합니다.
 * @param {string} s
 * @returns {{ y: number, m: number, d: number, utcMs: number, wd: number }}
 */
export function parseIso(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d);
  const wd = new Date(utcMs).getUTCDay();
  return { y, m, d, utcMs, wd };
}

/**
 * YYYY-MM-DD 기준 n일 전/후의 YYYY-MM-DD 문자열을 반환합니다.
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
export function addDay(s, n) {
  const { y, m, d } = parseIso(s);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return (
    dt.getUTCFullYear() +
    '-' +
    String(dt.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(dt.getUTCDate()).padStart(2, '0')
  );
}

/**
 * fromIso에서 toIso까지 일수 차이(toIso - fromIso)를 정수로 반환합니다.
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {number}
 */
export function diffDays(fromIso, toIso) {
  return Math.round((parseIso(toIso).utcMs - parseIso(fromIso).utcMs) / DAY_MS);
}

/**
 * YYYY-MM-DD의 요일 인덱스(0=일 .. 6=토)를 반환합니다.
 * @param {string} s
 * @returns {number}
 */
export function dayOfWeek(s) {
  return parseIso(s).wd;
}

/**
 * 아티팩트 형식 라벨(예: '11/15 (일)')을 반환합니다.
 * @param {string} s
 * @returns {string}
 */
export function lab(s) {
  if (!isValidIso(s)) return String(s || '');
  const { m, d, wd } = parseIso(s);
  return `${m}/${d} (${WD_KO[wd]})`;
}

/**
 * 짧은 날짜 형식(예: '11/15')을 반환합니다.
 * @param {string} s
 * @returns {string}
 */
export function shortDate(s) {
  if (!isValidIso(s)) return String(s || '');
  const { m, d } = parseIso(s);
  return `${m}/${d}`;
}

/**
 * D-day 배지 문자열을 반환합니다. ('D-DAY' | 'D-22' | 'D+1')
 * @param {string} targetIso
 * @param {string} todayIso
 * @returns {string}
 */
export function ddayLabel(targetIso, todayIso) {
  const n = diffDays(todayIso, targetIso);
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

/**
 * 기준 날짜가 포함된 주(일~토)의 7개 날짜 배열을 반환합니다.
 * @param {string} anchorIso
 * @returns {string[]}
 */
export function weekDatesOf(anchorIso) {
  const start = addDay(anchorIso, -dayOfWeek(anchorIso));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDay(start, i));
}

/**
 * YYYY-MM 문자열에서 n개월 이동한 YYYY-MM을 반환합니다.
 * @param {string} ym
 * @param {number} n
 * @returns {string}
 */
export function addMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0');
}

/**
 * YYYY-MM 기준 월간 달력 정보를 반환합니다.
 * @param {string} ym
 * @returns {{ year: number, month: number, pad: number, daysInMonth: number, dates: string[] }}
 */
export function monthInfo(ym) {
  const [year, month] = ym.split('-').map(Number);
  const pad = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates = [];
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    );
  }
  return { year, month, pad, daysInMonth, dates };
}
