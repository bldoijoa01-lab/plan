import {
  CL,
  DEF_CAPS,
  DEF_DD,
  DEF_W,
  STUDY_BOOKS,
  doneDateOf,
} from '../core/units.js';
import { DEFAULT_MATRIX_RULES, normalizeMatrixState } from '../core/matrix.js';
import { defaultOneNoteConfig, normalizeNotesState } from '../core/onenote.js';
import { normalizeHubState } from '../core/hub.js';
import { defaultGcalConfig } from '../core/gcal.js';

export const WORKER_URL = 'https://study-plan.bldoijoa01.workers.dev';
export const TOKEN_KEY = 'uiToken_v1';
export const CACHE_KEY = 'plan_docs_cache_v2';
export const PENDING_KEY = 'plan_pending_writes_v2';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(val) {
  try {
    const clean = String(val || '').trim();
    if (clean) localStorage.setItem(TOKEN_KEY, clean);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota errors
  }
}

/**
 * 구글 캘린더 주소/iframe 코드/이메일 ID를 안전한 embed URL로 변환합니다.
 * @param {string} raw
 * @param {'WEEK'|'MONTH'|'AGENDA'} [mode]
 */
export function buildCalendarEmbedUrl(raw, mode = 'WEEK') {
  const txt = String(raw || '').trim();
  if (!txt) return '';

  let candidate = txt;
  const iframeMatch = /src\s*=\s*["']([^"']+)["']/i.exec(txt);
  if (iframeMatch) {
    candidate = iframeMatch[1].replace(/&amp;/g, '&');
  }

  try {
    if (/^https?:\/\//i.test(candidate)) {
      const u = new URL(candidate);
      if (!u.hostname.endsWith('google.com')) return '';
      if (u.pathname.includes('/calendar/embed')) {
        u.searchParams.set('mode', mode);
        if (!u.searchParams.get('ctz')) u.searchParams.set('ctz', 'Asia/Seoul');
        return u.toString();
      }
      const cid = u.searchParams.get('cid') || u.searchParams.get('src');
      if (cid) {
        return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(cid)}&ctz=Asia%2FSeoul&mode=${mode}`;
      }
      return '';
    }
  } catch {
    return '';
  }

  // Raw calendar ID or Gmail address
  if (candidate.includes('@')) {
    return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(candidate)}&ctz=Asia%2FSeoul&mode=${mode}`;
  }
  return '';
}

export function defaultConfig() {
  return {
    weights: { ...DEF_W },
    caps: { ...DEF_CAPS },
    exam: '2026-12-07',
    carry: Object.fromEntries(Object.keys(STUDY_BOOKS).map((b) => [b, 'ask'])),
    ddays: CL(DEF_DD),
    calendarUrl: '',
    calendarMode: 'WEEK',
    matrixRules: CL(DEFAULT_MATRIX_RULES),
    onenote: defaultOneNoteConfig(),
    gcal: defaultGcalConfig(),
  };
}

export function mergeConfig(raw) {
  const base = defaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...CL(raw),
    weights: { ...base.weights, ...(raw.weights || {}) },
    caps: { ...base.caps, ...(raw.caps || {}) },
    carry: { ...base.carry, ...(raw.carry || {}) },
    ddays: Array.isArray(raw.ddays) && raw.ddays.length ? CL(raw.ddays) : base.ddays,
    matrixRules: {
      ...base.matrixRules,
      ...(raw.matrixRules || {}),
    },
    onenote: {
      ...base.onenote,
      ...((raw && raw.onenote) || {}),
    },
    gcal: {
      ...base.gcal,
      ...((raw && raw.gcal) || {}),
    },
  };
}

export function normalizePlanItems(items) {
  if (!Array.isArray(items)) return [];
  return CL(items).map((it) => {
    if (it.done) {
      const dd = doneDateOf(it);
      if (dd) {
        it.done_date = dd;
        it.d = dd;
      }
    }
    return it;
  });
}

export function defaultHubBookmarks() {
  return normalizeHubState({});
}

/**
 * plan-data-export.json 형태({ plan, config, log })를 문서 맵({ [path]: data })으로 변환합니다.
 */
export function exportJsonToDocs(payload) {
  const docs = {};
  if (!payload || typeof payload !== 'object') return docs;

  if (payload.plan && typeof payload.plan === 'object') {
    for (const [dateKey, val] of Object.entries(payload.plan)) {
      const rawItems = Array.isArray(val) ? val : val && val.items ? val.items : [];
      docs[`plan/${dateKey}`] = { items: normalizePlanItems(rawItems) };
    }
  }
  if (payload.config && typeof payload.config === 'object') {
    for (const [k, v] of Object.entries(payload.config)) {
      if (k === 'main') docs['config/main'] = mergeConfig(v);
      else docs[`config/${k}`] = CL(v);
    }
  }
  if (payload.log && typeof payload.log === 'object') {
    for (const [k, v] of Object.entries(payload.log)) {
      docs[`log/${k}`] = CL(v);
    }
  }
  if (payload.hub && typeof payload.hub === 'object') {
    for (const [k, v] of Object.entries(payload.hub)) {
      docs[`hub/${k}`] = CL(v);
    }
  }
  if (payload.matrix && typeof payload.matrix === 'object') {
    for (const [k, v] of Object.entries(payload.matrix)) {
      docs[`matrix/${k}`] = CL(v);
    }
  }
  if (payload.notes && typeof payload.notes === 'object') {
    docs['notes/main'] = normalizeNotesState(payload.notes.main || payload.notes);
  }
  return docs;
}

export function createStore({ onStatusChange } = {}) {
  const writeQueues = new Map();
  const failedSaves = new Map();
  let lastError = '';
  let offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
  let cacheMem = null;

  function getCacheMap() {
    if (!cacheMem || typeof cacheMem !== 'object') {
      const loaded = readLocalJson(CACHE_KEY, {});
      cacheMem = loaded && typeof loaded === 'object' ? loaded : {};
    }
    return cacheMem;
  }

  // Load persisted failed writes if any
  const savedPending = readLocalJson(PENDING_KEY, {});
  if (savedPending && typeof savedPending === 'object') {
    for (const [p, entry] of Object.entries(savedPending)) {
      if (entry && entry.data !== undefined) failedSaves.set(p, entry);
    }
  }

  function persistPending() {
    const obj = {};
    for (const [p, entry] of failedSaves.entries()) obj[p] = entry;
    writeLocalJson(PENDING_KEY, obj);
  }

  function notify() {
    if (typeof onStatusChange === 'function') {
      onStatusChange(getStatus());
    }
  }

  function getStatus() {
    return {
      offline,
      failedCount: failedSaves.size,
      failedPaths: [...failedSaves.keys()],
      lastError,
      isError: failedSaves.size > 0 || Boolean(lastError),
    };
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      offline = false;
      notify();
      retryFailed();
    });
    window.addEventListener('offline', () => {
      offline = true;
      notify();
    });
  }

  async function apiCall(payload) {
    const token = getToken();
    if (!token) {
      const err = new Error('접속 토큰이 필요해요.');
      err.code = 'auth';
      throw err;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      offline = true;
      throw new Error('오프라인 상태예요. 인터넷 연결 후 다시 시도해 주세요.');
    }
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, token }),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      throw new Error(`서버 응답 오류 (${res.status})`);
    }
    if (!res.ok || !body || !body.ok) {
      const err = new Error((body && body.error) || `요청 실패 (${res.status})`);
      err.code = (body && body.code) || (res.status === 401 ? 'auth' : 'error');
      throw err;
    }
    offline = false;
    return body;
  }

  function updateCacheDoc(path, data) {
    const cache = getCacheMap();
    cache[path] = data;
    writeLocalJson(CACHE_KEY, cache);
  }

  function hydrateFromDocsMap(docsMap) {
    const plans = {};
    const logs = {};
    let cfg = defaultConfig();
    let hub = defaultHubBookmarks();
    let matrix = normalizeMatrixState({});
    let notes = normalizeNotesState({});

    for (const [path, raw] of Object.entries(docsMap || {})) {
      const val = CL(raw);
      if (path.startsWith('plan/')) {
        const d = path.slice(5);
        const items = Array.isArray(val) ? val : val && val.items ? val.items : [];
        plans[d] = normalizePlanItems(items);
      } else if (path === 'config/main') {
        cfg = mergeConfig(val);
      } else if (path.startsWith('log/')) {
        logs[path.slice(4)] = val || {};
      } else if (path === 'hub/bookmarks') {
        hub = normalizeHubState(val);
      } else if (path === 'matrix/state') {
        matrix = normalizeMatrixState(val);
      } else if (path === 'notes/main') {
        notes = normalizeNotesState(val);
      }
    }
    return { plans, cfg, logs, hub, matrix, notes };
  }

  async function boot() {
    const res = await apiCall({ action: 'boot' });
    let docs = res.docs || {};

    // 첫 실행 시 plan/* 문서가 비어 있으면 동봉된 plan-data-export.json을 가져와 이어서 사용
    const hasPlans = Object.keys(docs).some((k) => k.startsWith('plan/'));
    if (!hasPlans) {
      try {
        const seedRes = await fetch('./data/plan-data-export.json');
        if (seedRes.ok) {
          const seedJson = await seedRes.json();
          const seedDocs = exportJsonToDocs(seedJson);
          if (Object.keys(seedDocs).length) {
            await apiCall({ action: 'batch_set', docs: seedDocs });
            docs = { ...docs, ...seedDocs };
          }
        }
      } catch {
        // seed fetch fallback ignored if offline
      }
    }

    // Also merge any locally cached pending saves that failed earlier? No — keep server as source of truth unless retry clicked,
    // just persist latest server docs to local offline cache.
    cacheMem = CL(docs);
    writeLocalJson(CACHE_KEY, cacheMem);
    return hydrateFromDocsMap(docs);
  }

  function loadOfflineSnapshot() {
    const cache = getCacheMap();
    return hydrateFromDocsMap(cache);
  }

  function saveDoc(path, data) {
    const cloned = CL(data);
    updateCacheDoc(path, cloned);

    const prev = writeQueues.get(path) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        try {
          await apiCall({ action: 'set', path, data: cloned });
          failedSaves.delete(path);
          if (failedSaves.size === 0) lastError = '';
          persistPending();
          notify();
        } catch (err) {
          const msg = (err && err.message) || String(err);
          failedSaves.set(path, {
            path,
            data: cloned,
            error: msg,
            at: new Date().toISOString(),
          });
          lastError = `저장 실패 (${path}): ${msg}`;
          persistPending();
          notify();
        }
      });

    writeQueues.set(path, next);
    return next;
  }

  async function batchSetDocs(docsMap) {
    const cloned = CL(docsMap);
    const cache = getCacheMap();
    for (const [k, v] of Object.entries(cloned)) {
      cache[k] = v;
    }
    writeLocalJson(CACHE_KEY, cache);
    await apiCall({ action: 'batch_set', docs: cloned });
    for (const k of Object.keys(cloned)) failedSaves.delete(k);
    if (failedSaves.size === 0) lastError = '';
    persistPending();
    notify();
  }

  async function retryFailed() {
    if (!failedSaves.size) {
      lastError = '';
      notify();
      return true;
    }
    const batch = {};
    for (const [p, entry] of failedSaves.entries()) {
      batch[p] = CL(entry.data);
    }
    try {
      await apiCall({ action: 'batch_set', docs: batch });
      failedSaves.clear();
      lastError = '';
      persistPending();
      notify();
      return true;
    } catch (err) {
      lastError = `재시도 실패: ${(err && err.message) || err}`;
      notify();
      return false;
    }
  }

  return {
    boot,
    loadOfflineSnapshot,
    savePlan: (dateIso, items) =>
      saveDoc(`plan/${dateIso}`, { items: normalizePlanItems(items) }),
    saveCfg: (cfg) => saveDoc('config/main', CL(cfg)),
    saveLog: (dateIso, logObj) => saveDoc(`log/${dateIso}`, CL(logObj || {})),
    saveHub: (hubObj) => saveDoc('hub/bookmarks', normalizeHubState(hubObj)),
    saveMatrix: (matrixObj) =>
      saveDoc('matrix/state', normalizeMatrixState(matrixObj)),
    saveNotes: (notesObj) =>
      saveDoc('notes/main', normalizeNotesState(notesObj)),
    batchSetDocs,
    retryFailed,
    getStatus,
  };
}
