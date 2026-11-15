import {
  addDay,
  addMonth,
  ddayLabel,
  lab,
  todayKst,
} from './core/date.js?v=20261115-16';
import {
  BNAME,
  BOOKS,
  CL,
  DEF_DD,
  GENERAL_BOOK,
  PB,
  STUDY_BOOKS,
  parseUnits,
  planDates,
  splitRangeUpTo,
} from './core/units.js?v=20261115-16';
import {
  applyAutoCarry,
  applyClosePlan,
  movePlanItem,
} from './core/carry.js?v=20261115-16';
import {
  applyMatrixUndo,
  moveMatrixItemManual,
  resetMatrixItemToAuto,
  resolveMatrixRules,
} from './core/matrix.js?v=20261115-16';
import {
  DEFAULT_ONENOTE_CLIENT_ID,
  defaultOneNoteConfig,
  normalizeNotesState,
} from './core/onenote.js?v=20261115-16';
import {
  normalizeHubState,
  toggleHubStar,
} from './core/hub.js?v=20261115-16';
import { esc } from './core/html.js?v=20261115-16';
import {
  buildCalendarEmbedUrl,
  createStore,
  defaultConfig,
  defaultHubBookmarks,
  exportJsonToDocs,
  getToken,
  mergeConfig,
  setToken,
} from './services/store.js?v=20261115-16';
import {
  clearOneNoteAuth,
  completeOneNoteAuthRedirectIfPresent,
  createNotebook,
  createSection,
  ensureValidAccessToken,
  getOneNoteRedirectUri,
  isOneNoteConnected,
  listNotebooks,
  listSections,
  pushSingleNoteToOneNote,
  startOneNotePkceLogin,
  syncNotesBidirectional,
  verifyDirectToken,
} from './services/onenote.js?v=20261115-16';
import {
  connectGcal,
  disconnectGcal,
  fetchGcalMonth,
  isGcalConnected,
} from './services/gcal.js?v=20261115-16';
import {
  renderAll,
  renderBookModal,
  renderBooksView,
  renderCalDayModal,
  renderHome,
  renderSettings,
  renderToday,
  renderWeek,
} from './views/schedule.js?v=20261115-16';
import { detectBookmarkKind, renderHub } from './views/hub.js?v=20261115-16';
import { renderMatrix } from './views/matrix.js?v=20261115-16';
import { NOTE_TEMPLATES, renderNotesView } from './views/notes.js?v=20261115-16';

const $ = (s) => document.querySelector(s);

const SECTION_ORDER = ['home', 'study', 'schedule', 'settings'];
const NAV_SECTIONS = {
  home: {
    label: '🏠 홈',
    title: '홈 대시보드',
    desc: '오늘의 학습 진도, 긴급 할 일, 주요 일정을 한눈에 확인하세요.',
    items: [
      ['home', '🏠 종합 대시보드'],
      ['today', '📅 오늘 할 일'],
      ['matrix', '🧭 긴급 매트릭스'],
      ['notes', '📓 OneNote 메모'],
    ],
  },
  study: {
    label: '📚 학습',
    title: '학습 관리',
    desc: '과목별 일일 공부 계획과 주간 부하율, 교재별 진도를 관리합니다.',
    items: [
      ['today', '📅 오늘 학습'],
      ['week', '📊 주간 현황'],
      ['books', '📖 교재·기록 분석'],
      ['notes', '📓 OneNote 메모'],
    ],
  },
  schedule: {
    label: '🗓️ 일정',
    title: '일정 · 매트릭스 · 허브',
    desc: '월간 계획표와 아이젠하워 우선순위, 구글 캘린더·문서를 연결합니다.',
    items: [
      ['all', '🗓️ 월간 캘린더'],
      ['matrix', '🧭 아이젠하워 매트릭스'],
      ['hub', '🔗 캘린더·문서 허브'],
      ['notes', '📓 OneNote 메모'],
    ],
  },
  settings: {
    label: '⚙️ 설정',
    title: '환경설정 · 데이터',
    desc: '교재별 부하 가중치, 이월·매트릭스 규칙, 클라우드 백업을 설정합니다.',
    items: [
      ['set', '⚖️ 학습·부하 규칙'],
      ['set-matrix', '🎯 D-day·매트릭스 규칙'],
      ['set-sync', '☁️ 연동·백업 관리'],
    ],
  },
};
const TAB_ORDER = [
  'home',
  'today',
  'week',
  'books',
  'notes',
  'all',
  'matrix',
  'hub',
  'set',
  'set-matrix',
  'set-sync',
];
const DEFAULT_VIEW_SECTION = {
  home: 'home',
  today: 'study',
  week: 'study',
  books: 'study',
  notes: 'study',
  all: 'schedule',
  matrix: 'schedule',
  hub: 'schedule',
  set: 'settings',
  'set-matrix': 'settings',
  'set-sync': 'settings',
};
const reduceMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(
    window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

let trackedPills = [];
function syncPill(box, activeBtn) {
  if (!box || !activeBtn) return;
  const apply = () => {
    const w = activeBtn.offsetWidth;
    const h = activeBtn.offsetHeight;
    if (!w || !h) return;
    box.style.setProperty('--pill-x', activeBtn.offsetLeft + 'px');
    box.style.setProperty('--pill-y', activeBtn.offsetTop + 'px');
    box.style.setProperty('--pill-w', w + 'px');
    box.style.setProperty('--pill-h', h + 'px');
    box.setAttribute('data-pill', 'ready');
  };
  apply();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply);
  }
}

function registerPill(box, getActive) {
  if (!box) return;
  trackedPills = trackedPills.filter((item) => item.box !== box);
  trackedPills.push({ box, getActive });
  const act = getActive();
  if (act) syncPill(box, act);
}

function refreshAllPills() {
  trackedPills = trackedPills.filter(
    (item) => typeof document !== 'undefined' && document.body.contains(item.box)
  );
  trackedPills.forEach((item) => {
    const act = item.getActive();
    if (act) syncPill(item.box, act);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'resize',
    () => requestAnimationFrame(refreshAllPills),
    { passive: true }
  );
}
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    requestAnimationFrame(refreshAllPills);
  });
}

function animateSwap(el, dir) {
  if (!el || reduceMotion() || typeof el.animate !== 'function') return;
  const dx = dir === 'left' ? -16 : dir === 'right' ? 16 : 0;
  const dy = dx === 0 ? 8 : 0;
  el.animate(
    [
      { opacity: 0, transform: `translate3d(${dx}px,${dy}px,0)` },
      { opacity: 1, transform: 'translate3d(0,0,0)' },
    ],
    { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );
}

function triggerViewTransition(appEl, dir) {
  if (!appEl || reduceMotion()) return;
  appEl.classList.remove('view-enter');
  if (dir && dir !== 'soft') appEl.setAttribute('data-dir', dir);
  else appEl.removeAttribute('data-dir');
  void appEl.offsetWidth;
  appEl.classList.add('view-enter');
}

function tabDirection(prevView, nextView) {
  const prevIdx = TAB_ORDER.indexOf(prevView);
  const nextIdx = TAB_ORDER.indexOf(nextView);
  if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
    return nextIdx > prevIdx ? 'right' : 'left';
  }
  return 'soft';
}

let hasEnteredOnce = false;
let lastSyncKey = '';

const state = {
  REAL: todayKst(),
  sec: 'home',
  view: 'home',
  lastSub: {
    home: 'home',
    study: 'today',
    schedule: 'all',
    settings: 'set',
  },
  cur: todayKst(),
  calM: todayKst().slice(0, 7),
  ready: false,
  authNeeded: false,
  authMsg: '',
  plans: {},
  cfg: defaultConfig(),
  logs: {},
  hub: defaultHubBookmarks(),
  matrix: { tasks: [], overrides: {} },
  notes: normalizeNotesState({}),

  // Schedule transient UI state
  adding: false,
  addKind: 'book',
  moving: null,
  asking: null,
  askMsg: '',
  closing: false,
  closeMode: 'next',
  closeKeep: new Set(),
  closeHours: null,
  closeFeel: null,
  closedMsg: '',
  openC: new Set(),
  rulesOpen: false,
  selB: new Set(),
  bookModalId: null,
  bookModalFilter: 'all',
  calModalDate: null,

  // Hub transient UI state
  hubAdding: false,
  hubEditId: null,
  hubGroupFilter: 'all',
  hubCalEdit: false,
  hubKindTouched: false,
  hubSearch: '',

  // Matrix transient UI state
  matrixAdding: false,
  matrixDoneOpen: false,
  matrixUndo: [],

  // OneNote / Notes transient UI state
  gcalByMonth: {},
  gcalTried: {},
  gcalLoading: false,
  gcalMsg: '',
  gcalSetupOpen: false,
  notesSelectedId: null,
  notesSearch: '',
  notesFilterSubj: 'all',
  notesConnectOpen: false,
  notesAuthTab: 'pkce',
  notesSyncing: false,
  notesSyncMsg: '',
  notesNotebooks: [],
  notesSections: [],

  // Sync status
  syncStatus: {
    offline: false,
    failedCount: 0,
    failedPaths: [],
    lastError: '',
    isError: false,
  },
};

const store = createStore({
  onStatusChange(status) {
    state.syncStatus = status;
    renderSyncBanner();
  },
});

function getTheme() {
  try {
    const t = localStorage.getItem('theme_v1');
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function setTheme(v) {
  try {
    if (v === 'auto') localStorage.removeItem('theme_v1');
    else localStorage.setItem('theme_v1', v);
  } catch {
    // ignore
  }
  if (v === 'light' || v === 'dark') {
    document.documentElement.setAttribute('data-theme', v);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function applyTheme(v) {
  const commit = () => {
    setTheme(v);
    render();
  };
  if (
    typeof document !== 'undefined' &&
    document.startViewTransition &&
    !reduceMotion()
  ) {
    document.startViewTransition(commit);
  } else {
    commit();
  }
}

function themeSwitchHtml() {
  const cur = getTheme();
  const idx = ['auto', 'light', 'dark'].indexOf(cur);
  const opt = (v, l) =>
    `<button type="button" data-theme-set="${v}" aria-pressed="${
      cur === v
    }">${l}</button>`;
  return `
    <div class="themesw" role="group" aria-label="화면 테마">
      <span class="thumb" aria-hidden="true" style="transform:translateX(${
        idx * 100
      }%)"></span>
      ${opt('auto', '자동')}${opt('light', '라이트')}${opt('dark', '다크')}
    </div>
  `;
}

function renderSyncBanner() {
  const el = $('#sync-banner');
  if (!el) return;
  const st = state.syncStatus;
  if (!st.offline && !st.isError) {
    if (lastSyncKey !== '') {
      lastSyncKey = '';
      el.innerHTML = '';
      el.className = 'sync-banner-slot';
    }
    return;
  }
  const title = st.offline ? '오프라인 상태' : '저장 실패';
  const detail = st.lastError
    ? st.lastError
    : st.offline
      ? '네트워크 연결이 끊겨 있어요. 변경 내용은 이 기기에 임시 보관됩니다.'
      : '서버 저장에 실패했어요.';
  const countTxt = st.failedCount ? ` (미저장 ${st.failedCount}건)` : '';
  const nextKey = `${title}|${countTxt}|${detail}`;
  if (lastSyncKey === nextKey) return;
  lastSyncKey = nextKey;
  el.className = 'sync-banner-slot active';
  el.innerHTML = `
    <div class="sync-banner" role="alert">
      <div class="sync-banner-msg">
        <b>⚠️ ${title}${countTxt}</b>
        <span>${esc(detail)}</span>
      </div>
      <div class="sync-banner-btns">
        <button type="button" class="btn sm pri" data-act="retry">다시 시도</button>
        <button type="button" class="btn sm" data-act="changetoken">토큰 설정</button>
      </div>
    </div>
  `;
}

function renderAuthCard() {
  return `
    <div class="card auth-card">
      <b class="card-title-md">🔐 접속 토큰 입력</b>
      <div class="note" style="margin:6px 0 12px">
        Cloudflare Worker 저장소 연결을 위해 웹앱 접속 토큰을 한 번 입력해 주세요. 토큰은 이 브라우저에만 저장됩니다.
      </div>
      <div class="row wrap-row">
        <input type="password" id="tok-in" autocomplete="off" placeholder="접속 토큰 입력" style="flex:1;min-width:200px">
        <button type="button" class="btn pri" data-act="toksave">저장하고 열기</button>
      </div>
      ${
        state.authMsg
          ? `<div class="err" style="margin-top:8px">${esc(state.authMsg)}</div>`
          : ''
      }
    </div>
  `;
}

function syncThemeSwitchInPlace(headEl) {
  const cur = getTheme();
  const idx = ['auto', 'light', 'dark'].indexOf(cur);
  const thumb = headEl.querySelector('.themesw .thumb');
  if (thumb) {
    thumb.style.transform = `translateX(${idx * 100}%)`;
  }
  headEl.querySelectorAll('[data-theme-set]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.dataset.themeSet === cur ? 'true' : 'false');
  });
}

function syncHead(ddays) {
  const headEl = $('#head');
  if (!headEl) return;
  const ddKey = JSON.stringify(ddays);
  if (
    headEl.dataset.built === '1' &&
    headEl.dataset.today === state.REAL &&
    headEl.dataset.ddkey === ddKey
  ) {
    syncThemeSwitchInPlace(headEl);
    return;
  }
  headEl.dataset.built = '1';
  headEl.dataset.today = state.REAL;
  headEl.dataset.ddkey = ddKey;
  const ddPills = (ddays || [])
    .slice(0, 2)
    .map(
      (x) =>
        `<span class="head-dd-chip"><b>${esc(x.n)}</b> <em>${ddayLabel(
          x.d,
          state.REAL
        )}</em></span>`
    )
    .join('');
  headEl.innerHTML = `
    <div class="head-top">
      <span class="today-pill">오늘 ${lab(state.REAL)}</span>
      ${ddPills}
      ${themeSwitchHtml()}
    </div>
  `;
}

function syncNav() {
  const secMeta = NAV_SECTIONS[state.sec] || NAV_SECTIONS.home;

  const topNavEl = $('#top-nav');
  if (topNavEl) {
    if (topNavEl.dataset.built !== '1') {
      topNavEl.dataset.built = '1';
      topNavEl.innerHTML = SECTION_ORDER.map(
        (secKey) =>
          `<button type="button" class="${
            state.sec === secKey ? 'on' : ''
          }" data-sec="${secKey}" aria-current="${
            state.sec === secKey ? 'page' : 'false'
          }">${NAV_SECTIONS[secKey].label}</button>`
      ).join('');
      registerPill(topNavEl, () => topNavEl.querySelector('button.on'));
    } else {
      let activeTop = null;
      topNavEl.querySelectorAll('button[data-sec]').forEach((btn) => {
        const on = btn.dataset.sec === state.sec;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-current', on ? 'page' : 'false');
        if (on) activeTop = btn;
      });
      if (activeTop) syncPill(topNavEl, activeTop);
    }
  }

  const metaEl = $('#subnav-meta');
  if (metaEl && metaEl.dataset.sec !== state.sec) {
    metaEl.dataset.sec = state.sec;
    metaEl.innerHTML = `<span class="sec-crumb">${esc(secMeta.label)}</span>`;
  }

  const navEl = $('#nav');
  if (navEl) {
    if (navEl.dataset.sec !== state.sec) {
      navEl.dataset.sec = state.sec;
      navEl.innerHTML = secMeta.items
        .map(
          ([k, t]) =>
            `<button type="button" class="${
              state.view === k ? 'on' : ''
            }" data-v="${k}" aria-selected="${
              state.view === k ? 'true' : 'false'
            }">${t}</button>`
        )
        .join('');
      registerPill(navEl, () => navEl.querySelector('button.on'));
    } else {
      let activeBtn = null;
      navEl.querySelectorAll('button[data-v]').forEach((btn) => {
        const on = btn.dataset.v === state.view;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) activeBtn = btn;
      });
      if (activeBtn) syncPill(navEl, activeBtn);
    }
  }
}

function syncBookModal() {
  const modalSlot = $('#modal-root');
  if (!modalSlot) return;
  if (!state.bookModalId && !state.calModalDate) {
    const existing = modalSlot.querySelector('.modal-backdrop');
    if (existing && existing.classList.contains('out')) return;
    modalSlot.innerHTML = '';
    delete modalSlot.dataset.bookId;
    delete modalSlot.dataset.calDate;
    return;
  }
  if (!state.bookModalId && state.calModalDate) {
    delete modalSlot.dataset.bookId;
    modalSlot.innerHTML = renderCalDayModal(state);
    modalSlot.dataset.calDate = String(state.calModalDate);
    return;
  }
  delete modalSlot.dataset.calDate;
  const html = renderBookModal(state);
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const curBackdrop = modalSlot.querySelector('.modal-backdrop');
  const curCard = curBackdrop && curBackdrop.querySelector('.modal-card');
  const nextCard = tpl.content.querySelector('.modal-card');
  if (
    curBackdrop &&
    !curBackdrop.classList.contains('out') &&
    curCard &&
    nextCard &&
    modalSlot.dataset.bookId === String(state.bookModalId)
  ) {
    const curChips = curCard.querySelector('.chips');
    const nextChips = nextCard.querySelector('.chips');
    if (curChips && nextChips) curChips.innerHTML = nextChips.innerHTML;
    const curList = curCard.querySelector('.modal-list');
    const nextList = nextCard.querySelector('.modal-list');
    if (curList && nextList) {
      curList.innerHTML = nextList.innerHTML;
      animateSwap(curList, '');
    }
  } else {
    modalSlot.innerHTML = html;
    modalSlot.dataset.bookId = String(state.bookModalId);
  }
}

function closeBookModal() {
  const modalSlot = $('#modal-root');
  const backdrop = modalSlot && modalSlot.querySelector('.modal-backdrop');
  state.bookModalId = null;
  if (!backdrop || reduceMotion()) {
    if (modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.bookId;
    }
    return;
  }
  if (backdrop.classList.contains('out')) return;
  backdrop.classList.add('out');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (!state.bookModalId && modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.bookId;
    }
  };
  backdrop.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 240);
}

function closeCalModal() {
  const modalSlot = $('#modal-root');
  const backdrop = modalSlot && modalSlot.querySelector('.modal-backdrop');
  state.calModalDate = null;
  if (!backdrop || reduceMotion()) {
    if (modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.calDate;
    }
    return;
  }
  if (backdrop.classList.contains('out')) return;
  backdrop.classList.add('out');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (!state.calModalDate && !state.bookModalId && modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.calDate;
    }
  };
  backdrop.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 240);
}

async function loadGcalMonth(ym, { force = false } = {}) {
  const g = (state.cfg && state.cfg.gcal) || {};
  if (!g.clientId || !isGcalConnected()) return;
  if (!force && (state.gcalByMonth[ym] || state.gcalTried[ym])) return;
  state.gcalTried = { ...state.gcalTried, [ym]: true };
  state.gcalLoading = true;
  if (force) render();
  try {
    const res = await fetchGcalMonth(ym, g.hiddenCalendarIds || []);
    state.gcalByMonth = { ...state.gcalByMonth, [ym]: res.items };
    state.gcalMsg = `${res.calendars.length}개 캘린더에서 일정 ${res.items.length}개를 불러왔어요.`;
  } catch (err) {
    state.gcalMsg = (err && err.message) || String(err);
  } finally {
    state.gcalLoading = false;
    render();
  }
}

function saveGcalClientId(clientId) {
  state.cfg = CL(state.cfg);
  state.cfg.gcal = { hiddenCalendarIds: [], ...(state.cfg.gcal || {}), clientId };
  store.saveCfg(state.cfg);
}

function render(opts = {}) {
  const realToday = todayKst();
  if (realToday !== state.REAL) {
    if (state.cur === state.REAL) state.cur = realToday;
    state.REAL = realToday;
  }

  const ddays = state.cfg.ddays || DEF_DD;
  syncHead(ddays);
  syncNav();
  renderSyncBanner();

  const appEl = $('#app');
  if (!appEl) return;

  if (state.authNeeded) {
    appEl.innerHTML = renderAuthCard();
    if (opts.motion) triggerViewTransition(appEl, opts.motion);
    setTimeout(() => {
      const inp = $('#tok-in');
      if (inp) inp.focus();
    }, 0);
    return;
  }

  if (!state.ready) {
    appEl.innerHTML = '<div class="card note">데이터를 불러오는 중…</div>';
    return;
  }

  if (state.view === 'home') appEl.innerHTML = renderHome(state);
  else if (state.view === 'today') appEl.innerHTML = renderToday(state);
  else if (state.view === 'week') appEl.innerHTML = renderWeek(state);
  else if (state.view === 'books') appEl.innerHTML = renderBooksView(state);
  else if (state.view === 'all') appEl.innerHTML = renderAll(state);
  else if (state.view === 'matrix') appEl.innerHTML = renderMatrix(state);
  else if (state.view === 'hub') appEl.innerHTML = renderHub(state);
  else if (state.view === 'notes') appEl.innerHTML = renderNotesView(state);
  else if (state.view === 'set')
    appEl.innerHTML = renderSettings({ ...state, settingsSection: 'study' });
  else if (state.view === 'set-matrix')
    appEl.innerHTML = renderSettings({ ...state, settingsSection: 'rules' });
  else if (state.view === 'set-sync')
    appEl.innerHTML = renderSettings({ ...state, settingsSection: 'sync' });
  else appEl.innerHTML = renderSettings(state);

  if (opts.motion) {
    triggerViewTransition(appEl, opts.motion);
  }

  syncBookModal();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(refreshAllPills);
  }

  if ((state.view === 'all' || state.view === 'today') && !state.gcalLoading) {
    const gym = state.view === 'all' ? state.calM : String(state.cur).slice(0, 7);
    setTimeout(() => loadGcalMonth(gym), 0);
  }

  if (state.asking) {
    setTimeout(() => {
      const e = $('#ak');
      if (e) e.focus();
    }, 0);
  }
}

function findItem(dateIso, id) {
  return (state.plans[dateIso] || []).find((i) => i.id === id);
}

function updatePlanDate(dateIso, updater) {
  const clonedList = CL(state.plans[dateIso] || []);
  const nextList = updater(clonedList);
  state.plans[dateIso] = CL(nextList);
  store.savePlan(dateIso, state.plans[dateIso]);
}

function doMove(from, id, to, quiet) {
  const res = movePlanItem(state.plans, from, id, to);
  if (!res.changed) return;
  state.plans = res.plans;
  store.savePlan(from, state.plans[from] || []);
  store.savePlan(to, state.plans[to] || []);
  state.moving = null;
  if (!quiet) render();
}

function runAutoCarryOnBoot() {
  const res = applyAutoCarry(state.plans, state.cfg, state.REAL);
  if (!res.changed) return;
  state.plans = res.plans;
  for (const d of res.touchedDates) {
    store.savePlan(d, state.plans[d] || []);
  }
}

function triggerInitialEnter() {
  if (hasEnteredOnce || reduceMotion() || typeof document === 'undefined') return;
  hasEnteredOnce = true;
  document.body.classList.add('enter');
  setTimeout(() => document.body.classList.remove('enter'), 950);
}

function captureActiveNoteDraft({ forceDirty = false } = {}) {
  if (state.view !== 'notes') return null;
  const subjEl = $('#note-subj');
  const saveBtn = document.querySelector('[data-act="note-save"]');
  const noteId =
    (subjEl && subjEl.dataset.id) ||
    (saveBtn && saveBtn.dataset.id) ||
    state.notesSelectedId;
  if (!noteId) return null;

  const titleEl = $('#note-title');
  const bodyEl = $('#note-body');
  const dateEl = $('#note-date');
  if (!titleEl && !bodyEl && !subjEl && !dateEl) return null;

  const curNotes = normalizeNotesState(state.notes);
  const idx = curNotes.items.findIndex((x) => x.id === noteId);
  if (idx === -1) return null;

  const curItem = curNotes.items[idx];
  const nextTitle = titleEl
    ? String(titleEl.value || '').trim() || '제목 없는 메모'
    : curItem.title;
  const nextContent = bodyEl ? String(bodyEl.value || '') : curItem.content;
  const nextSubject = subjEl ? String(subjEl.value || '일반') : curItem.subject;
  const nextDate = dateEl ? String(dateEl.value || '') : curItem.date;

  const changed =
    nextTitle !== curItem.title ||
    nextContent !== curItem.content ||
    nextSubject !== curItem.subject ||
    nextDate !== curItem.date;

  if (!changed && !forceDirty) return curItem;

  const nowIso = new Date().toISOString();
  curNotes.items[idx] = {
    ...curItem,
    title: nextTitle,
    content: nextContent,
    subject: nextSubject,
    date: nextDate,
    updatedAt: changed ? nowIso : curItem.updatedAt,
    dirty: changed || forceDirty ? true : curItem.dirty,
  };
  state.notes = curNotes;
  store.saveNotes(state.notes);
  return curNotes.items[idx];
}

async function loadOneNoteContainers({ silent = false } = {}) {
  if (!isOneNoteConnected()) return;
  try {
    const cfgOneNote = {
      ...defaultOneNoteConfig(),
      ...((state.cfg && state.cfg.onenote) || {}),
    };
    const token = await ensureValidAccessToken(cfgOneNote);
    let notebooks = await listNotebooks(token);
    if (!notebooks.length) {
      const nb = await createNotebook(token, '공부 계획표');
      notebooks = [nb];
    }
    state.notesNotebooks = notebooks;

    const nbId =
      (cfgOneNote.notebookId &&
        notebooks.some((n) => n.id === cfgOneNote.notebookId) &&
        cfgOneNote.notebookId) ||
      notebooks[0].id;
    const nbObj = notebooks.find((n) => n.id === nbId) || notebooks[0];

    const sections = nbId ? await listSections(token, nbId) : [];
    state.notesSections = sections;

    let nextCfgChanged = false;
    const nextOneNote = { ...cfgOneNote };
    if (nbObj && nextOneNote.notebookId !== nbObj.id) {
      nextOneNote.notebookId = nbObj.id;
      nextOneNote.notebookName = nbObj.displayName || '';
      nextCfgChanged = true;
    }
    if (
      sections.length &&
      (!nextOneNote.sectionId || !sections.some((s) => s.id === nextOneNote.sectionId))
    ) {
      const preferredSec =
        sections.find((s) => s.displayName === (nextOneNote.sectionName || '공부 계획표 메모')) ||
        sections[0];
      nextOneNote.sectionId = preferredSec.id;
      nextOneNote.sectionName = preferredSec.displayName || '공부 계획표 메모';
      nextCfgChanged = true;
    }
    if (nextCfgChanged) {
      state.cfg = { ...CL(state.cfg), onenote: nextOneNote };
      store.saveCfg(state.cfg);
    }
    if (!silent) {
      state.notesSyncMsg = `전자필기장 ${notebooks.length}개 · 섹션 ${sections.length}개를 불러왔어요.`;
    }
  } catch (err) {
    if (!silent) {
      state.notesSyncMsg = `OneNote 목록 불러오기 실패: ${(err && err.message) || err}`;
    }
  } finally {
    render();
  }
}

async function runOneNoteSync({ silent = false } = {}) {
  if (state.notesSyncing) return;
  if (!isOneNoteConnected()) {
    if (!silent) {
      state.notesConnectOpen = true;
      state.notesSyncMsg = '먼저 OneNote 계정을 연결해 주세요.';
      render();
    }
    return;
  }

  state.notesSyncing = true;
  if (!silent) {
    state.notesSyncMsg = 'Microsoft OneNote와 양방향 동기화 중...';
    render();
  }

  let notesChanged = false;
  try {
    const cfgOneNote = {
      ...defaultOneNoteConfig(),
      ...((state.cfg && state.cfg.onenote) || {}),
    };
    const res = await syncNotesBidirectional({
      notesState: state.notes,
      cfgOneNote,
    });
    state.notes = res.nextNotesState;
    state.cfg = { ...CL(state.cfg), onenote: res.nextCfgOneNote };
    store.saveNotes(state.notes);
    store.saveCfg(state.cfg);
    const { pushed, pulled, deleted } = res.stats;
    notesChanged = pushed + pulled + deleted > 0;
    state.notesSyncMsg = `양방향 동기화 완료 · 전송 ${pushed}건 · 가져오기 ${pulled}건${
      deleted ? ` · 삭제 ${deleted}건` : ''
    }`;
  } catch (err) {
    const msg = (err && err.message) || String(err);
    if (!silent || (err && err.code === 'onenote_auth')) {
      state.notesSyncMsg = `OneNote 동기화 실패: ${msg}`;
    }
  } finally {
    state.notesSyncing = false;
    if (!silent || notesChanged || state.view === 'notes' || state.view === 'hub') {
      render();
    }
  }
}

async function boot() {
  const oauthRes = await completeOneNoteAuthRedirectIfPresent().catch((err) => ({
    handled: true,
    ok: false,
    error: (err && err.message) || String(err),
  }));

  if (oauthRes && oauthRes.handled) {
    state.view = 'notes';
    state.sec = DEFAULT_VIEW_SECTION.notes;
    state.lastSub[state.sec] = 'notes';
    state.notesConnectOpen = true;
    state.notesSyncMsg = oauthRes.ok
      ? 'Microsoft 계정 연결 완료! 대상 섹션을 확인해 주세요.'
      : oauthRes.error || 'Microsoft 계정 연결에 실패했어요.';
  }

  const token = getToken();
  if (!token) {
    state.authNeeded = true;
    state.ready = false;
    render({ motion: 'soft' });
    triggerInitialEnter();
    return;
  }
  state.authNeeded = false;
  state.authMsg = '';
  const cached = store.loadOfflineSnapshot();
  const hasCachedPlans = Boolean(cached && cached.plans && Object.keys(cached.plans).length > 0);
  let prevSnap = '';
  if (hasCachedPlans) {
    state.plans = cached.plans;
    state.cfg = cached.cfg;
    state.logs = cached.logs;
    state.hub = cached.hub;
    state.matrix = cached.matrix;
    state.notes = cached.notes || normalizeNotesState({});
    state.ready = true;
    prevSnap = JSON.stringify({
      plans: state.plans,
      cfg: state.cfg,
      logs: state.logs,
      hub: state.hub,
      matrix: state.matrix,
      notes: state.notes,
    });
    render({ motion: 'soft' });
    triggerInitialEnter();
  } else {
    state.ready = false;
    render();
  }

  try {
    const data = await store.boot();
    state.plans = data.plans;
    state.cfg = data.cfg;
    state.logs = data.logs;
    state.hub = data.hub;
    state.matrix = data.matrix;
    state.notes = data.notes || normalizeNotesState({});
    state.ready = true;
    runAutoCarryOnBoot();

    if (!hasCachedPlans) {
      render({ motion: 'soft' });
      triggerInitialEnter();
    } else {
      const nextSnap = JSON.stringify({
        plans: state.plans,
        cfg: state.cfg,
        logs: state.logs,
        hub: state.hub,
        matrix: state.matrix,
        notes: state.notes,
      });
      if (nextSnap !== prevSnap) {
        render();
      }
    }

    if (oauthRes && oauthRes.handled && oauthRes.ok) {
      loadOneNoteContainers({ silent: true }).then(() => runOneNoteSync({ silent: false }));
    } else if (
      isOneNoteConnected() &&
      (!state.cfg.onenote || state.cfg.onenote.autoSync !== false)
    ) {
      runOneNoteSync({ silent: true });
    }
  } catch (err) {
    if (err && err.code === 'auth') {
      state.authNeeded = true;
      state.authMsg = err.message || '접속 토큰을 다시 확인해 주세요.';
      state.ready = false;
      render({ motion: 'soft' });
      return;
    }
    state.syncStatus = {
      ...store.getStatus(),
      isError: true,
      lastError: (err && err.message) || '서버 연결 실패 (임시 데이터 표시 중)',
    };
    if (hasCachedPlans) {
      renderSyncBanner();
    } else {
      // 오프라인 또는 일시 오류 시 로컬 캐시가 있으면 화면을 멈추지 않고 열기
      state.plans = cached.plans;
      state.cfg = cached.cfg;
      state.logs = cached.logs;
      state.hub = cached.hub;
      state.matrix = cached.matrix;
      state.notes = cached.notes || normalizeNotesState({});
      state.ready = true;
      render({ motion: 'soft' });
      triggerInitialEnter();
    }
  }
}

function pushMatrixUndo(undoEntry) {
  if (!undoEntry) return;
  state.matrixUndo = [...state.matrixUndo.slice(-29), undoEntry];
}

function handleClick(e) {
  const themeBtn = e.target.closest('[data-theme-set]');
  if (themeBtn) {
    applyTheme(themeBtn.dataset.themeSet);
    return;
  }

  const t = e.target.closest('[data-sec],[data-v],[data-act]');
  if (!t) return;

  if (t.dataset.sec) {
    captureActiveNoteDraft();
    const nextSec = t.dataset.sec;
    const secCfg = NAV_SECTIONS[nextSec];
    if (!secCfg) return;
    const prevView = state.view;
    let nextView;
    if (t.classList.contains('brand-btn') || state.sec === nextSec) {
      nextView = secCfg.items[0][0];
    } else {
      nextView = state.lastSub[nextSec] || secCfg.items[0][0];
    }
    state.sec = nextSec;
    state.view = nextView;
    state.lastSub[nextSec] = nextView;
    const motion =
      nextView !== prevView ? tabDirection(prevView, nextView) : 'soft';
    closeBookModal();
    closeCalModal();
    render({ motion });
    return;
  }

  if (t.dataset.v) {
    captureActiveNoteDraft();
    const nextView = t.dataset.v;
    const prevView = state.view;
    if (!t.closest('#nav')) {
      state.sec = DEFAULT_VIEW_SECTION[nextView] || state.sec;
    }
    state.view = nextView;
    state.lastSub[state.sec] = nextView;
    if (t.dataset.openOn === '1') {
      state.notesConnectOpen = true;
    }
    const motion =
      nextView !== prevView ? tabDirection(prevView, nextView) : '';
    closeBookModal();
    closeCalModal();
    render({ motion });
    return;
  }

  const a = t.dataset.act;
  const d = t.dataset.d;
  const id = t.dataset.id;

  if (a === 'toksave') {
    const val = ($('#tok-in') || {}).value || '';
    if (!val.trim()) {
      state.authMsg = '토큰을 입력해 주세요.';
      render();
      return;
    }
    setToken(val);
    boot();
    return;
  }

  if (a === 'changetoken') {
    const nextTok = window.prompt(
      '새 접속 토큰을 입력하세요 (비우고 확인하면 토큰 초기화):',
      getToken()
    );
    if (nextTok === null) return;
    setToken(nextTok);
    boot();
    return;
  }

  if (a === 'retry') {
    store.retryFailed().then((ok) => {
      if (ok && !state.ready) boot();
      else renderSyncBanner();
    });
    return;
  }

  if (!state.ready) return;

  if (a === 'bookpop') {
    const b = t.dataset.b;
    if (!b) return;
    state.bookModalId = b;
    state.bookModalFilter = 'all';
    render();
    return;
  }

  if (a === 'bookpopbg' && e.target !== t) return;
  if (a === 'bookpopbg' || a === 'bookpopclose') {
    closeBookModal();
    return;
  }

  if (a === 'bookpopfilter') {
    state.bookModalFilter = t.dataset.f || 'all';
    syncBookModal();
    return;
  }

  if (a === 'calpop') {
    if (!d) return;
    state.bookModalId = null;
    state.calModalDate = d;
    syncBookModal();
    return;
  }

  if (a === 'calpopbg' && e.target !== t) return;
  if (a === 'calpopbg' || a === 'calpopclose') {
    closeCalModal();
    return;
  }

  if (a === 'calpop-goto') {
    if (!d) return;
    const prevView = state.view;
    state.calModalDate = null;
    const modalSlot = $('#modal-root');
    if (modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.calDate;
    }
    state.cur = d;
    state.view = 'today';
    state.sec = DEFAULT_VIEW_SECTION.today;
    state.lastSub[state.sec] = 'today';
    state.moving = null;
    render({ motion: tabDirection(prevView, 'today') });
    return;
  }

  if (a === 'day') {
    const n = Number(t.dataset.n);
    state.cur = addDay(state.cur, n);
    state.moving = null;
    render({ motion: n > 0 ? 'right' : n < 0 ? 'left' : 'soft' });
  } else if (a === 'goto') {
    const prevView = state.view;
    const prevCur = state.cur;
    state.cur = d;
    if (t.dataset.v2) {
      state.view = t.dataset.v2;
      state.sec = DEFAULT_VIEW_SECTION[state.view] || state.sec;
      state.lastSub[state.sec] = state.view;
    }
    if (t.dataset.closepop) closeBookModal();
    state.moving = null;
    const motion =
      state.view !== prevView
        ? tabDirection(prevView, state.view)
        : d !== prevCur
          ? d > prevCur
            ? 'right'
            : 'left'
          : 'soft';
    render({ motion });
  } else if (a === 'askok') {
    const v = ($('#ak') || {}).value || '';
    const targetItem = findItem(state.asking.d, state.asking.id);
    const res = splitRangeUpTo(targetItem, v, state.REAL);
    if (!res.ok) {
      state.askMsg = res.error;
      render();
      return;
    }
    const dd = state.asking.d;
    const targetId = state.asking.id;
    updatePlanDate(dd, (list) => {
      const idx = list.findIndex((x) => x.id === targetId);
      if (idx < 0) return list;
      list.splice(idx, 1, ...res.items);
      return list;
    });
    state.asking = null;
    state.askMsg = '';
    render();
  } else if (a === 'askall') {
    const dd = state.asking.d;
    const targetId = state.asking.id;
    updatePlanDate(dd, (list) =>
      list.map((x) =>
        x.id === targetId
          ? { ...x, done: true, done_date: state.REAL, d: state.REAL }
          : x
      )
    );
    state.asking = null;
    state.askMsg = '';
    render();
  } else if (a === 'askno') {
    state.asking = null;
    state.askMsg = '';
    render();
  } else if (a === 'close') {
    const prevView = state.view;
    state.cur = state.REAL;
    state.view = 'today';
    state.sec = DEFAULT_VIEW_SECTION.today;
    state.lastSub[state.sec] = 'today';
    state.closing = true;
    state.closedMsg = '';
    render({
      motion: prevView !== 'today' ? tabDirection(prevView, 'today') : '',
    });
  } else if (a === 'cno') {
    state.closing = false;
    render();
  } else if (a === 'cmode') {
    state.closeMode = t.dataset.m;
    render();
  } else if (a === 'ckeep') {
    if (state.closeKeep.has(id)) state.closeKeep.delete(id);
    else state.closeKeep.add(id);
    render();
  } else if (a === 'cfeel') {
    state.closeFeel = t.dataset.f;
    render();
  } else if (a === 'cok') {
    const applied = applyClosePlan({
      plans: state.plans,
      cfg: state.cfg,
      todayIso: state.REAL,
      mode: state.closeMode,
      keepIds: state.closeKeep,
    });
    state.plans = applied.plans;
    for (const td of applied.touchedDates) {
      store.savePlan(td, state.plans[td] || []);
    }
    const g = CL(state.logs[state.REAL] || {});
    if (state.closeHours != null) g.hours = state.closeHours;
    if (state.closeFeel != null) g.feel = state.closeFeel;
    if (state.closeHours != null || state.closeFeel != null) {
      state.logs[state.REAL] = g;
      store.saveLog(state.REAL, g);
    }
    const sum = applied.summary;
    const to = sum.moves.length
      ? [...new Set(sum.moves.map((i) => sum.dest[i.id]))].map(lab).join(', ')
      : '';
    state.closedMsg = sum.moves.length
      ? `${sum.moves.length}줄(${sum.moveP}P)을 ${to}로 옮겼어요.${
          sum.keeps.length ? ` ${sum.keeps.length}줄은 그대로 뒀어요.` : ''
        }`
      : '오늘은 밀린 것 없이 마무리했어요.';
    state.closing = false;
    state.closeKeep = new Set();
    state.closeHours = null;
    state.closeFeel = null;
    render();
  } else if (a === 'cm') {
    const n = Number(t.dataset.n);
    state.calM = addMonth(state.calM, n);
    render({ motion: n > 0 ? 'right' : n < 0 ? 'left' : 'soft' });
  } else if (a === 'gcal-setup-tog') {
    state.gcalSetupOpen = !state.gcalSetupOpen;
    render();
  } else if (a === 'gcal-save-id') {
    const clientId = (($('#gcal-client-id') || {}).value || '').trim();
    if (!clientId) {
      state.gcalMsg = '클라이언트 ID를 입력해 주세요.';
      render();
      return;
    }
    saveGcalClientId(clientId);
    connectGcal(clientId)
      .then(() => {
        state.gcalSetupOpen = false;
        state.gcalByMonth = {};
        state.gcalTried = {};
        return loadGcalMonth(state.calM, { force: true });
      })
      .catch((err) => {
        state.gcalMsg = (err && err.message) || String(err);
        render();
      });
  } else if (a === 'gcal-connect') {
    const g = (state.cfg && state.cfg.gcal) || {};
    connectGcal(g.clientId)
      .then(() => {
        state.gcalByMonth = {};
        return loadGcalMonth(state.calM, { force: true });
      })
      .catch((err) => {
        state.gcalMsg = (err && err.message) || String(err);
        render();
      });
  } else if (a === 'gcal-refresh') {
    loadGcalMonth(state.calM, { force: true });
  } else if (a === 'gcal-disconnect') {
    disconnectGcal();
    state.cfg = CL(state.cfg);
    state.cfg.gcal = { hiddenCalendarIds: [], clientId: '' };
    store.saveCfg(state.cfg);
    state.gcalByMonth = {};
    state.gcalMsg = '구글 캘린더 연결을 해제했어요.';
    render();
  } else if (a === 'selb') {
    const b = t.dataset.b;
    if (state.selB.has(b)) state.selB.delete(b);
    else state.selB.add(b);
    render();
  } else if (a === 'selclr') {
    state.selB.clear();
    render();
  } else if (a === 'wk') {
    const n = Number(t.dataset.n);
    state.cur = addDay(state.cur, n);
    render({ motion: n > 0 ? 'right' : n < 0 ? 'left' : 'soft' });
  } else if (a === 'cx') {
    const k = t.dataset.k;
    if (state.openC.has(k)) state.openC.delete(k);
    else state.openC.add(k);
    render();
  } else if (a === 'rl') {
    state.rulesOpen = !state.rulesOpen;
    render();
  } else if (a === 'menu') {
    state.moving = state.moving === id ? null : id;
    render();
  } else if (a === 'del') {
    updatePlanDate(d, (list) => list.filter((i) => i.id !== id));
    state.moving = null;
    render();
  } else if (a === 'togimp') {
    updatePlanDate(d, (list) =>
      list.map((i) => (i.id === id ? { ...i, important: !i.important } : i))
    );
    render();
  } else if (a === 'mv') {
    doMove(d, id, t.dataset.to, false);
  } else if (a === 'pull') {
    doMove(d, id, state.cur, false);
  } else if (a === 'pullall') {
    const mv = [];
    for (const x of planDates(state.plans)) {
      if (x >= state.REAL) continue;
      for (const i of state.plans[x] || []) {
        if (!i.done && !i.x && (state.cfg.carry[i.b] || 'ask') !== 'drop') {
          mv.push([x, i.id]);
        }
      }
    }
    mv.forEach(([x, itemId]) => doMove(x, itemId, state.cur, true));
    render();
  } else if (a === 'addtoggle') {
    state.adding = !state.adding;
    render();
  } else if (a === 'addkind') {
    state.addKind = t.dataset.k || 'book';
    render();
  } else if (a === 'add') {
    const b = ($('#nb') || {}).value;
    const tx = (($('#nt') || {}).value || '').trim();
    const n = parseFloat(($('#nn') || {}).value) || 0;
    const due = ($('#ndue') || {}).value || '';
    const important = Boolean(($('#nimp') || {}).checked);
    if (!tx || !b) return;
    const newItem = {
      id: 'u' + Date.now().toString(36),
      s: BOOKS[b],
      b,
      t: tx,
      n,
      done: false,
      ...(due ? { due } : {}),
      ...(important ? { important: true } : {}),
    };
    updatePlanDate(state.cur, (list) => [...list, newItem]);
    state.adding = false;
    render();
  } else if (a === 'addtodo') {
    const cat = ($('#ncat') || {}).value || '일반';
    const tx = (($('#nt') || {}).value || '').trim();
    const pRaw = parseFloat(($('#np') || {}).value);
    const p = Number.isNaN(pRaw) ? 5 : Math.max(0, pRaw);
    const due = ($('#ndue') || {}).value || '';
    const important = Boolean(($('#nimp') || {}).checked);
    if (!tx) return;
    const newItem = {
      id: 't' + Date.now().toString(36),
      kind: 'todo',
      s: '학교·할일',
      b: GENERAL_BOOK,
      cat,
      t: tx,
      n: 1,
      p,
      done: false,
      ...(due ? { due } : {}),
      ...(important ? { important: true } : {}),
    };
    updatePlanDate(state.cur, (list) => [...list, newItem]);
    state.adding = false;
    render();
  } else if (a === 'feel') {
    const g = CL(state.logs[state.cur] || {});
    g.feel = g.feel === t.dataset.f ? null : t.dataset.f;
    state.logs[state.cur] = g;
    store.saveLog(state.cur, g);
    render();
  } else if (a === 'savelog') {
    const g = CL(state.logs[state.cur] || {});
    const h = parseFloat(($('#lh') || {}).value);
    g.hours = Number.isNaN(h) ? null : h;
    g.note = ($('#ln') || {}).value || '';
    state.logs[state.cur] = g;
    store.saveLog(state.cur, g);
    render();
  }

  // ===== Settings actions =====
  else if (a === 'ddadd') {
    state.cfg = CL(state.cfg);
    state.cfg.ddays = [...(state.cfg.ddays || DEF_DD), { n: '새 일정', d: state.REAL }];
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'dddel') {
    const idx = Number(t.dataset.i);
    state.cfg = CL(state.cfg);
    state.cfg.ddays = (state.cfg.ddays || DEF_DD).filter((_, i) => i !== idx);
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'mexambook') {
    const b = t.dataset.b;
    state.cfg = CL(state.cfg);
    const rules = resolveMatrixRules(state.cfg);
    const set = new Set(rules.examBooks);
    if (set.has(b)) set.delete(b);
    else set.add(b);
    rules.examBooks = [...set];
    state.cfg.matrixRules = rules;
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'savecal') {
    const srcId = t.dataset.src || 'hub-cal-url';
    const raw = (($('#' + srcId) || {}).value || '').trim();
    if (raw && !buildCalendarEmbedUrl(raw, state.cfg.calendarMode || 'WEEK')) {
      window.alert('올바른 구글 캘린더 임베드 URL, <iframe> 코드, 또는 Google 이메일 주소를 입력해 주세요.');
      return;
    }
    state.cfg = CL(state.cfg);
    state.cfg.calendarUrl = raw;
    state.hubCalEdit = false;
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'clearcal') {
    state.cfg = CL(state.cfg);
    state.cfg.calendarUrl = '';
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'calmode') {
    state.cfg = CL(state.cfg);
    state.cfg.calendarMode = t.dataset.m || 'WEEK';
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'caltoggle') {
    state.hubCalEdit = !state.hubCalEdit;
    render();
  } else if (a === 'exportjson') {
    const payload = {
      exportedAt: new Date().toISOString(),
      plan: Object.fromEntries(
        planDates(state.plans).map((dt) => [dt, { items: state.plans[dt] }])
      ),
      config: { main: state.cfg },
      log: state.logs,
      hub: { bookmarks: state.hub },
      matrix: { state: state.matrix },
      notes: { main: state.notes },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = `plan-backup-${state.REAL}.json`;
    aEl.click();
    URL.revokeObjectURL(aEl.href);
  } else if (a === 'reseed') {
    if (!window.confirm('초기 데이터(11/12~12/6)를 불러와 현재 계획과 병합·복원할까요?')) return;
    fetch('./data/plan-data-export.json')
      .then((r) => r.json())
      .then((json) => {
        const docs = exportJsonToDocs(json);
        return store.batchSetDocs(docs).then(() => boot());
      })
      .catch((err) => {
        window.alert('초기 데이터 불러오기 실패: ' + ((err && err.message) || err));
      });
  }

  // ===== Hub actions =====
  else if (a === 'go-hub') {
    const prevView = state.view;
    state.view = 'hub';
    state.sec = DEFAULT_VIEW_SECTION.hub;
    state.lastSub[state.sec] = 'hub';
    render({ motion: prevView !== 'hub' ? tabDirection(prevView, 'hub') : '' });
  } else if (a === 'hubstar') {
    state.hub = toggleHubStar(state.hub, id, state.notes);
    store.saveHub(state.hub);
    render();
  } else if (a === 'hub-search-clear') {
    state.hubSearch = '';
    render();
    const searchInp = $('#hub-search');
    if (searchInp) searchInp.focus();
  } else if (a === 'hubaddtog') {
    if (state.hubEditId) {
      state.hubEditId = null;
      state.hubAdding = false;
    } else {
      state.hubAdding = !state.hubAdding;
    }
    state.hubKindTouched = false;
    render();
  } else if (a === 'hubaddsave') {
    const name = (($('#hb-name') || {}).value || '').trim();
    const url = (($('#hb-url') || {}).value || '').trim();
    const kind = ($('#hb-kind') || {}).value || detectBookmarkKind(url, name);
    const group = (($('#hb-group') || {}).value || '').trim() || '학교·세특';
    const starOn = $('#hb-star') ? Boolean($('#hb-star').checked) : true;
    if (!name || !url) return;
    const curHub = normalizeHubState(state.hub);
    const newId = 'bm' + Date.now().toString(36);
    const newDoc = {
      id: newId,
      name,
      url,
      kind,
      group,
      modifiedAt: state.REAL,
    };
    const nextCustom = [...(curHub.customDocs || []), newDoc];
    const nextItems = CL(curHub.items || []);
    if (starOn) {
      const maxOrder = nextItems.reduce((m, x) => Math.max(m, x.order ?? 0), 0);
      nextItems.push({ ...newDoc, order: maxOrder + 1 });
    }
    state.hub = normalizeHubState({
      ...curHub,
      items: nextItems,
      customDocs: nextCustom,
      initialized: true,
    });
    state.hubAdding = false;
    state.hubKindTouched = false;
    store.saveHub(state.hub);
    render();
  } else if (a === 'hubedit') {
    state.hubEditId = id;
    state.hubAdding = false;
    state.hubKindTouched = true;
    render();
  } else if (a === 'hubeditcancel') {
    state.hubEditId = null;
    state.hubKindTouched = false;
    render();
  } else if (a === 'hubeditsave') {
    const name = (($('#hb-name') || {}).value || '').trim();
    const url = (($('#hb-url') || {}).value || '').trim();
    const kind = ($('#hb-kind') || {}).value || detectBookmarkKind(url, name);
    const group = (($('#hb-group') || {}).value || '').trim() || '학교·세특';
    if (!name || !url) return;
    const curHub = normalizeHubState(state.hub);
    const nextItems = (curHub.items || []).map((x) =>
      x.id === id ? { ...x, name, url, kind, group } : x
    );
    const nextCustom = (curHub.customDocs || []).map((x) =>
      x.id === id ? { ...x, name, url, kind, group } : x
    );
    state.hub = normalizeHubState({
      ...curHub,
      items: nextItems,
      customDocs: nextCustom,
      initialized: true,
    });
    state.hubEditId = null;
    state.hubKindTouched = false;
    store.saveHub(state.hub);
    render();
  } else if (a === 'hubdel') {
    const curHub = normalizeHubState(state.hub);
    state.hub = normalizeHubState({
      ...curHub,
      items: (curHub.items || []).filter((x) => x.id !== id),
      customDocs: (curHub.customDocs || []).filter((x) => x.id !== id),
      initialized: true,
    });
    store.saveHub(state.hub);
    render();
  } else if (a === 'hubmove') {
    const dir = Number(t.dataset.dir) || 0;
    const curHub = normalizeHubState(state.hub);
    const list = CL(curHub.items || []).sort(
      (a1, b1) => (a1.order ?? 9999) - (b1.order ?? 9999)
    );
    const idx = list.findIndex((x) => x.id === id);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = tmp;
    list.forEach((x, i) => {
      x.order = i + 1;
    });
    state.hub = normalizeHubState({
      ...curHub,
      items: list,
      initialized: true,
    });
    store.saveHub(state.hub);
    render();
  } else if (a === 'hubgrp') {
    state.hubGroupFilter = t.dataset.g || 'all';
    render();
  }

  // ===== Matrix actions =====
  else if (a === 'mxaddtog') {
    state.matrixAdding = !state.matrixAdding;
    render();
  } else if (a === 'mxaddsave') {
    const title = (($('#mx-title') || {}).value || '').trim();
    const cat = ($('#mx-cat') || {}).value || '일반';
    const due = ($('#mx-due') || {}).value || '';
    const important = Boolean(($('#mx-imp') || {}).checked);
    if (!title) return;
    const nextMx = CL(state.matrix);
    nextMx.tasks = [
      ...(nextMx.tasks || []),
      {
        id: 'mx' + Date.now().toString(36),
        title,
        cat,
        due,
        important,
        done: false,
        created_at: new Date().toISOString(),
      },
    ];
    state.matrix = nextMx;
    state.matrixAdding = false;
    store.saveMatrix(state.matrix);
    render();
  } else if (a === 'mxmv') {
    const key = t.dataset.key;
    const q = t.dataset.q;
    const res = moveMatrixItemManual(state.matrix, key, q);
    if (res.changed) {
      state.matrix = res.matrixState;
      pushMatrixUndo(res.undoEntry);
      store.saveMatrix(state.matrix);
      render();
    }
  } else if (a === 'mxauto') {
    const key = t.dataset.key;
    const res = resetMatrixItemToAuto(state.matrix, key);
    if (res.changed) {
      state.matrix = res.matrixState;
      pushMatrixUndo(res.undoEntry);
      store.saveMatrix(state.matrix);
      render();
    }
  } else if (a === 'mxundo') {
    const last = state.matrixUndo[state.matrixUndo.length - 1];
    if (!last) return;
    const res = applyMatrixUndo(state.matrix, last);
    if (res.changed) {
      state.matrixUndo = state.matrixUndo.slice(0, -1);
      state.matrix = res.matrixState;
      store.saveMatrix(state.matrix);
      render();
    }
  } else if (a === 'mximp') {
    const src = t.dataset.src;
    if (src === 'plan') {
      updatePlanDate(d, (list) =>
        list.map((i) => (i.id === id ? { ...i, important: !i.important } : i))
      );
    } else {
      const nextMx = CL(state.matrix);
      nextMx.tasks = (nextMx.tasks || []).map((x) =>
        x.id === id ? { ...x, important: !x.important } : x
      );
      state.matrix = nextMx;
      store.saveMatrix(state.matrix);
    }
    render();
  } else if (a === 'mxdel') {
    const nextMx = CL(state.matrix);
    nextMx.tasks = (nextMx.tasks || []).filter((x) => x.id !== id);
    if (nextMx.overrides) delete nextMx.overrides['todo:' + id];
    state.matrix = nextMx;
    store.saveMatrix(state.matrix);
    render();
  } else if (a === 'mxdonetog') {
    state.matrixDoneOpen = !state.matrixDoneOpen;
    render();
  }

  // ===== OneNote / Notes actions =====
  else if (a === 'note-open') {
    const prevView = state.view;
    state.notesSelectedId = id || null;
    state.view = 'notes';
    state.sec = DEFAULT_VIEW_SECTION.notes;
    state.lastSub[state.sec] = 'notes';
    render({ motion: prevView !== 'notes' ? tabDirection(prevView, 'notes') : '' });
  } else if (a === 'note-new') {
    captureActiveNoteDraft();
    const curNotes = normalizeNotesState(state.notes);
    const nowIso = new Date().toISOString();
    const defSubj =
      state.notesFilterSubj &&
      state.notesFilterSubj !== 'all' &&
      state.notesFilterSubj !== 'pinned' &&
      state.notesFilterSubj !== 'date'
        ? state.notesFilterSubj
        : '일반';
    const nextId = 'n_' + Date.now().toString(36);
    const nextNotes = normalizeNotesState({
      ...curNotes,
      items: [
        {
          id: nextId,
          title: '새 메모',
          content: '',
          subject: defSubj,
          date: state.notesFilterSubj === 'date' ? state.cur : state.REAL,
          pinned: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          dirty: true,
        },
        ...curNotes.items,
      ],
    });
    state.notes = nextNotes;
    state.notesSelectedId = nextId;
    store.saveNotes(state.notes);
    render();
    setTimeout(() => {
      const inp = $('#note-title');
      if (inp) {
        inp.focus();
        if (typeof inp.select === 'function') inp.select();
      }
    }, 0);
  } else if (a === 'note-sel') {
    captureActiveNoteDraft();
    state.notesSelectedId = id;
    render();
  } else if (a === 'note-filter') {
    captureActiveNoteDraft();
    state.notesFilterSubj = t.dataset.f || 'all';
    render();
  } else if (a === 'note-pin') {
    captureActiveNoteDraft();
    const curNotes = normalizeNotesState(state.notes);
    const nowIso = new Date().toISOString();
    curNotes.items = curNotes.items.map((x) =>
      x.id === id ? { ...x, pinned: !x.pinned, updatedAt: nowIso } : x
    );
    state.notes = curNotes;
    store.saveNotes(state.notes);
    render();
  } else if (a === 'note-del') {
    const curNotes = normalizeNotesState(state.notes);
    const target = curNotes.items.find((x) => x.id === id);
    if (!target) return;
    if (!window.confirm(`"${target.title}" 메모를 삭제할까요?`)) return;
    if (target.onenotePageId && !curNotes.deletedPageIds.includes(target.onenotePageId)) {
      curNotes.deletedPageIds.push(target.onenotePageId);
    }
    curNotes.items = curNotes.items.filter((x) => x.id !== id);
    state.notes = curNotes;
    if (state.notesSelectedId === id) state.notesSelectedId = null;
    store.saveNotes(state.notes);
    render();
    if (
      isOneNoteConnected() &&
      target.onenotePageId &&
      (!state.cfg.onenote || state.cfg.onenote.autoSync !== false)
    ) {
      runOneNoteSync({ silent: true });
    }
  } else if (a === 'note-date-today') {
    captureActiveNoteDraft();
    const curNotes = normalizeNotesState(state.notes);
    const saveBtn = document.querySelector('[data-act="note-save"]');
    const targetId = (saveBtn && saveBtn.dataset.id) || state.notesSelectedId;
    const nowIso = new Date().toISOString();
    curNotes.items = curNotes.items.map((x) =>
      x.id === targetId ? { ...x, date: state.cur, updatedAt: nowIso, dirty: true } : x
    );
    state.notes = curNotes;
    store.saveNotes(state.notes);
    render();
  } else if (a === 'note-tpl') {
    const tpl = NOTE_TEMPLATES[t.dataset.tpl];
    if (!tpl) return;
    captureActiveNoteDraft();
    const curNotes = normalizeNotesState(state.notes);
    const saveBtn = document.querySelector('[data-act="note-save"]');
    const targetId = (saveBtn && saveBtn.dataset.id) || state.notesSelectedId;
    const nowIso = new Date().toISOString();
    curNotes.items = curNotes.items.map((x) => {
      if (x.id !== targetId) return x;
      const base = String(x.content || '').trimEnd();
      return {
        ...x,
        content: base ? `${base}\n\n${tpl}` : tpl,
        updatedAt: nowIso,
        dirty: true,
      };
    });
    state.notes = curNotes;
    store.saveNotes(state.notes);
    render();
  } else if (a === 'note-chk-tog') {
    captureActiveNoteDraft();
    const lineIdx = Number(t.dataset.line);
    const curNotes = normalizeNotesState(state.notes);
    const nowIso = new Date().toISOString();
    curNotes.items = curNotes.items.map((x) => {
      if (x.id !== id) return x;
      const lines = String(x.content || '').split(/\r?\n/);
      if (lines[lineIdx] != null) {
        lines[lineIdx] = lines[lineIdx].replace(
          /^(\s*-\s*\[)([ xX])(\]\s*.*)$/,
          (_, p1, mark, p3) => `${p1}${mark.toLowerCase() === 'x' ? ' ' : 'x'}${p3}`
        );
      }
      return {
        ...x,
        content: lines.join('\n'),
        updatedAt: nowIso,
        dirty: true,
      };
    });
    state.notes = curNotes;
    store.saveNotes(state.notes);
    render();
  } else if (a === 'note-save') {
    const saved = captureActiveNoteDraft({ forceDirty: true });
    if (!saved) return;
    state.notesSyncMsg = '웹에 저장했어요.';
    render();
    if (
      isOneNoteConnected() &&
      (!state.cfg.onenote || state.cfg.onenote.autoSync !== false)
    ) {
      runOneNoteSync({ silent: false });
    }
  } else if (a === 'note-push-one') {
    const captured = captureActiveNoteDraft();
    const curNotes = normalizeNotesState(state.notes);
    const target = curNotes.items.find((x) => x.id === id) || captured;
    if (!target) return;
    if (!isOneNoteConnected()) {
      state.notesConnectOpen = true;
      state.notesSyncMsg = '먼저 OneNote 계정을 연결해 주세요.';
      render();
      return;
    }
    state.notesSyncing = true;
    state.notesSyncMsg = 'OneNote로 메모 전송 중...';
    render();
    pushSingleNoteToOneNote({
      note: target,
      cfgOneNote: (state.cfg && state.cfg.onenote) || defaultOneNoteConfig(),
    })
      .then(({ updatedNote, nextCfgOneNote }) => {
        const latest = normalizeNotesState(state.notes);
        latest.items = latest.items.map((x) => (x.id === updatedNote.id ? updatedNote : x));
        state.notes = latest;
        state.cfg = { ...CL(state.cfg), onenote: nextCfgOneNote };
        store.saveNotes(state.notes);
        store.saveCfg(state.cfg);
        state.notesSyncMsg = '이 메모를 Microsoft OneNote에 즉시 반영했어요.';
      })
      .catch((err) => {
        state.notesSyncMsg = `OneNote 전송 실패: ${(err && err.message) || err}`;
      })
      .finally(() => {
        state.notesSyncing = false;
        render();
      });
  } else if (a === 'note-today-add') {
    const inp = $('#today-quick-note');
    const rawTxt = ((inp && inp.value) || '').trim();
    if (!rawTxt) return;
    const curNotes = normalizeNotesState(state.notes);
    const nowIso = new Date().toISOString();
    const nextNotes = normalizeNotesState({
      ...curNotes,
      items: [
        {
          id: 'n_' + Date.now().toString(36),
          title: rawTxt.split('\n')[0].slice(0, 42) || '빠른 메모',
          content: rawTxt,
          subject: '일반',
          date: state.cur,
          pinned: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          dirty: true,
        },
        ...curNotes.items,
      ],
    });
    state.notes = nextNotes;
    state.notesSelectedId = nextNotes.items[0].id;
    store.saveNotes(state.notes);
    render();
    if (
      isOneNoteConnected() &&
      (!state.cfg.onenote || state.cfg.onenote.autoSync !== false)
    ) {
      runOneNoteSync({ silent: true });
    }
  } else if (a === 'on-sync') {
    captureActiveNoteDraft();
    runOneNoteSync({ silent: false });
  } else if (a === 'on-connect-tog') {
    captureActiveNoteDraft();
    state.notesConnectOpen = !state.notesConnectOpen;
    render();
    if (state.notesConnectOpen && isOneNoteConnected() && !state.notesNotebooks.length) {
      loadOneNoteContainers({ silent: true });
    }
  } else if (a === 'on-auth-tab') {
    captureActiveNoteDraft();
    state.notesAuthTab = t.dataset.tab || 'pkce';
    render();
  } else if (a === 'on-tenant-preset') {
    const nextTenant = String(t.dataset.tenant || 'consumers').trim() || 'consumers';
    const curClientId =
      (($('#on-client-id') || {}).value || '').trim() ||
      (state.cfg.onenote && state.cfg.onenote.clientId) ||
      DEFAULT_ONENOTE_CLIENT_ID;
    state.cfg = CL(state.cfg);
    state.cfg.onenote = {
      ...defaultOneNoteConfig(),
      ...(state.cfg.onenote || {}),
      clientId: curClientId,
      tenant: nextTenant,
    };
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'on-pkce-consumers') {
    const clientId =
      (($('#on-client-id') || {}).value || '').trim() ||
      (state.cfg.onenote && state.cfg.onenote.clientId) ||
      DEFAULT_ONENOTE_CLIENT_ID;
    const tenant = 'consumers';
    state.cfg = CL(state.cfg);
    state.cfg.onenote = {
      ...defaultOneNoteConfig(),
      ...(state.cfg.onenote || {}),
      clientId,
      tenant,
    };
    store.saveCfg(state.cfg);
    startOneNotePkceLogin({ clientId, tenant }).catch((err) => {
      state.notesSyncMsg = (err && err.message) || String(err);
      render();
    });
  } else if (a === 'on-copy-redirect') {
    const uri = getOneNoteRedirectUri();
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(uri)
        .then(() => {
          state.notesSyncMsg = `리디렉션 URI를 복사했어요: ${uri}`;
          render();
        })
        .catch(() => {
          window.prompt('아래 리디렉션 URI를 복사하세요:', uri);
        });
    } else {
      window.prompt('아래 리디렉션 URI를 복사하세요:', uri);
    }
  } else if (a === 'on-pkce-login') {
    const clientId =
      (($('#on-client-id') || {}).value || '').trim() ||
      (state.cfg.onenote && state.cfg.onenote.clientId) ||
      DEFAULT_ONENOTE_CLIENT_ID;
    const tenant = (($('#on-tenant') || {}).value || 'consumers').trim() || 'consumers';
    state.cfg = CL(state.cfg);
    state.cfg.onenote = {
      ...defaultOneNoteConfig(),
      ...(state.cfg.onenote || {}),
      clientId,
      tenant,
    };
    store.saveCfg(state.cfg);
    startOneNotePkceLogin({ clientId, tenant }).catch((err) => {
      state.notesSyncMsg = (err && err.message) || String(err);
      render();
    });
  } else if (a === 'on-token-save') {
    const rawTok = ($('#on-access-token') || {}).value || '';
    state.notesSyncing = true;
    state.notesSyncMsg = 'Microsoft Graph 토큰 확인 중...';
    render();
    verifyDirectToken(rawTok)
      .then((auth) => {
        state.notesSyncMsg = `${auth.userName || auth.userEmail || 'Microsoft'} 계정 연결 완료!`;
        return loadOneNoteContainers({ silent: true });
      })
      .catch((err) => {
        state.notesSyncMsg = `토큰 연결 실패: ${(err && err.message) || err}`;
      })
      .finally(() => {
        state.notesSyncing = false;
        render();
        if (isOneNoteConnected()) runOneNoteSync({ silent: false });
      });
  } else if (a === 'on-load-containers') {
    loadOneNoteContainers({ silent: false });
  } else if (a === 'on-create-sec') {
    const secName = window.prompt('새 OneNote 섹션 이름을 입력하세요:', '공부 계획표 메모');
    if (!secName || !secName.trim()) return;
    const cleanName = secName.trim();
    state.notesSyncing = true;
    state.notesSyncMsg = `"${cleanName}" 섹션 생성 중...`;
    render();
    (async () => {
      const cfgOneNote = {
        ...defaultOneNoteConfig(),
        ...((state.cfg && state.cfg.onenote) || {}),
      };
      const token = await ensureValidAccessToken(cfgOneNote);
      let nbId = cfgOneNote.notebookId;
      let nbName = cfgOneNote.notebookName;
      if (!nbId) {
        let nbs = await listNotebooks(token);
        if (!nbs.length) {
          const createdNb = await createNotebook(token, '공부 계획표');
          nbs = [createdNb];
        }
        nbId = nbs[0].id;
        nbName = nbs[0].displayName || '';
      }
      const createdSec = await createSection(token, nbId, cleanName);
      state.notesSections = await listSections(token, nbId);
      state.cfg = CL(state.cfg);
      state.cfg.onenote = {
        ...cfgOneNote,
        notebookId: nbId,
        notebookName: nbName,
        sectionId: createdSec.id,
        sectionName: createdSec.displayName || cleanName,
      };
      store.saveCfg(state.cfg);
      state.notesSyncMsg = `새 섹션 "${state.cfg.onenote.sectionName}" 생성 완료!`;
    })()
      .catch((err) => {
        state.notesSyncMsg = `섹션 생성 실패: ${(err && err.message) || err}`;
      })
      .finally(() => {
        state.notesSyncing = false;
        render();
      });
  } else if (a === 'on-disconnect') {
    clearOneNoteAuth();
    state.notesNotebooks = [];
    state.notesSections = [];
    state.notesSyncMsg = 'Microsoft OneNote 연결을 해제했어요.';
    render();
  }
}

function handleChange(e) {
  const t = e.target;
  if (!state.ready) return;
  if (t.id === 'note-subj' || t.id === 'note-date') {
    captureActiveNoteDraft();
    render();
    return;
  }
  const a = t.dataset.act;
  if (!a) return;

  if (a === 'tog') {
    const d = t.dataset.d;
    const id = t.dataset.id;
    const it = findItem(d, id);
    if (!it) return;
    if (t.checked && !it.done && PB.has(it.b) && it.n > 1 && parseUnits(it)) {
      state.asking = { d, id };
      state.askMsg = '';
      render();
      return;
    }
    updatePlanDate(d, (list) =>
      list.map((x) => {
        if (x.id !== id) return x;
        const copy = { ...x, done: t.checked };
        if (t.checked) {
          copy.done_date = state.REAL;
          copy.d = state.REAL;
        } else {
          delete copy.done_date;
          delete copy.d;
        }
        return copy;
      })
    );
    render();
  } else if (a === 'mxtog') {
    const src = t.dataset.src;
    const id = t.dataset.id;
    const d = t.dataset.d;
    if (src === 'plan') {
      updatePlanDate(d, (list) =>
        list.map((x) => {
          if (x.id !== id) return x;
          const copy = { ...x, done: t.checked };
          if (t.checked) {
            copy.done_date = state.REAL;
            copy.d = state.REAL;
          } else {
            delete copy.done_date;
            delete copy.d;
          }
          return copy;
        })
      );
    } else {
      const nextMx = CL(state.matrix);
      nextMx.tasks = (nextMx.tasks || []).map((x) => {
        if (x.id !== id) return x;
        const copy = { ...x, done: t.checked };
        if (t.checked) copy.done_date = state.REAL;
        else delete copy.done_date;
        return copy;
      });
      state.matrix = nextMx;
      store.saveMatrix(state.matrix);
    }
    render();
  } else if (a === 'chours') {
    const h = parseFloat(t.value);
    state.closeHours = Number.isNaN(h) ? null : h;
  } else if (a === 'mvd' && t.value) {
    doMove(t.dataset.d, t.dataset.id, t.value, false);
  } else if (a === 'setdue') {
    const d = t.dataset.d;
    const id = t.dataset.id;
    updatePlanDate(d, (list) =>
      list.map((x) => (x.id === id ? { ...x, due: t.value || '' } : x))
    );
    render();
  } else if (a === 'wt') {
    state.cfg = CL(state.cfg);
    state.cfg.weights = { ...state.cfg.weights, [t.dataset.b]: parseFloat(t.value) || 0 };
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'cr') {
    state.cfg = CL(state.cfg);
    state.cfg.carry = { ...state.cfg.carry, [t.dataset.b]: t.value };
    store.saveCfg(state.cfg);
  } else if (a === 'ddn' || a === 'ddd') {
    state.cfg = CL(state.cfg);
    state.cfg.ddays = CL(state.cfg.ddays || DEF_DD);
    const x = state.cfg.ddays[Number(t.dataset.i)];
    if (!x) return;
    if (a === 'ddn') x.n = t.value;
    else if (t.value) x.d = t.value;
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'cap') {
    state.cfg = CL(state.cfg);
    state.cfg.caps = { ...state.cfg.caps, [t.dataset.k]: parseFloat(t.value) || 0 };
    store.saveCfg(state.cfg);
  } else if (a === 'mrule') {
    state.cfg = CL(state.cfg);
    const rules = resolveMatrixRules(state.cfg);
    rules[t.dataset.k] = Math.max(0, parseInt(t.value, 10) || 0);
    state.cfg.matrixRules = rules;
    store.saveCfg(state.cfg);
  } else if (a === 'mrulekw') {
    state.cfg = CL(state.cfg);
    const rules = resolveMatrixRules(state.cfg);
    rules.importantKeywords = String(t.value || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    state.cfg.matrixRules = rules;
    store.saveCfg(state.cfg);
  } else if (a === 'importfile') {
    const file = t.files && t.files[0];
    if (!file) return;
    file
      .text()
      .then((txt) => {
        const parsed = JSON.parse(txt);
        const docs = exportJsonToDocs(parsed);
        if (!Object.keys(docs).length) {
          throw new Error('가져올 수 있는 계획 데이터가 없어요.');
        }
        return store.batchSetDocs(docs).then(() => boot());
      })
      .catch((err) => {
        window.alert('JSON 가져오기 실패: ' + ((err && err.message) || err));
      });
  } else if (a === 'on-nb-change') {
    const opt = t.options && t.selectedIndex >= 0 ? t.options[t.selectedIndex] : null;
    const nbId = t.value || '';
    const nbName = opt ? opt.textContent || '' : '';
    state.cfg = CL(state.cfg);
    state.cfg.onenote = {
      ...defaultOneNoteConfig(),
      ...(state.cfg.onenote || {}),
      notebookId: nbId,
      notebookName: nbName,
      sectionId: '',
      sectionName: '',
    };
    state.notesSections = [];
    store.saveCfg(state.cfg);
    render();
    if (nbId && isOneNoteConnected()) {
      ensureValidAccessToken(state.cfg.onenote)
        .then((tok) => listSections(tok, nbId))
        .then((secs) => {
          state.notesSections = secs;
          if (secs.length) {
            state.cfg = CL(state.cfg);
            state.cfg.onenote.sectionId = secs[0].id;
            state.cfg.onenote.sectionName = secs[0].displayName || '공부 계획표 메모';
            store.saveCfg(state.cfg);
          }
          render();
        })
        .catch((err) => {
          state.notesSyncMsg = `섹션 목록 불러오기 실패: ${(err && err.message) || err}`;
          render();
        });
    }
  } else if (a === 'on-sec-change') {
    const opt = t.options && t.selectedIndex >= 0 ? t.options[t.selectedIndex] : null;
    state.cfg = CL(state.cfg);
    state.cfg.onenote = {
      ...defaultOneNoteConfig(),
      ...(state.cfg.onenote || {}),
      sectionId: t.value || '',
      sectionName: opt ? opt.textContent || '' : '공부 계획표 메모',
    };
    store.saveCfg(state.cfg);
    render();
  } else if (a === 'on-autosync-tog') {
    state.cfg = CL(state.cfg);
    state.cfg.onenote = {
      ...defaultOneNoteConfig(),
      ...(state.cfg.onenote || {}),
      autoSync: Boolean(t.checked),
    };
    store.saveCfg(state.cfg);
  }
}

function handleInput(e) {
  const t = e.target;
  if ((t.id === 'hb-url' || t.id === 'hb-name') && !state.hubKindTouched) {
    const kindSel = $('#hb-kind');
    if (kindSel) {
      kindSel.value = detectBookmarkKind(
        ($('#hb-url') || {}).value || '',
        ($('#hb-name') || {}).value || ''
      );
    }
  } else if (t.id === 'hb-kind') {
    state.hubKindTouched = true;
  } else if (t.id === 'hub-search') {
    const pos = t.selectionStart ?? t.value.length;
    state.hubSearch = t.value;
    render();
    const nextInp = $('#hub-search');
    if (nextInp) {
      nextInp.focus();
      try {
        nextInp.setSelectionRange(pos, pos);
      } catch {
        // ignore selection errors
      }
    }
  } else if (t.id === 'note-search') {
    captureActiveNoteDraft();
    const pos = t.selectionStart ?? t.value.length;
    state.notesSearch = t.value;
    render();
    const nextInp = $('#note-search');
    if (nextInp) {
      nextInp.focus();
      try {
        nextInp.setSelectionRange(pos, pos);
      } catch {
        // ignore selection errors
      }
    }
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape' && state.bookModalId) {
    closeBookModal();
    return;
  }
  if (e.key === 'Escape' && state.calModalDate) {
    closeCalModal();
    return;
  }
  if (e.key === 'Enter') {
    if (e.target && e.target.id === 'ak') {
      e.preventDefault();
      const btn = document.querySelector('[data-act="askok"]');
      if (btn) btn.click();
    } else if (e.target && e.target.id === 'tok-in') {
      e.preventDefault();
      const btn = document.querySelector('[data-act="toksave"]');
      if (btn) btn.click();
    } else if (e.target && e.target.id === 'today-quick-note') {
      e.preventDefault();
      const btn = document.querySelector('[data-act="note-today-add"]');
      if (btn) btn.click();
    }
  }
}

// Drag & drop support for Eisenhower Matrix
let draggedMatrixKey = null;

document.addEventListener('dragstart', (e) => {
  const card = e.target.closest('[data-mxkey]');
  if (!card) return;
  draggedMatrixKey = card.dataset.mxkey;
  card.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedMatrixKey);
  }
});

document.addEventListener('dragend', (e) => {
  const card = e.target.closest('[data-mxkey]');
  if (card) card.classList.remove('dragging');
  document
    .querySelectorAll('.mx-quad.drag-over')
    .forEach((el) => el.classList.remove('drag-over'));
  draggedMatrixKey = null;
});

document.addEventListener('dragover', (e) => {
  const zone = e.target.closest('[data-qdrop]');
  if (!zone || !draggedMatrixKey) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  zone.classList.add('drag-over');
});

document.addEventListener('dragleave', (e) => {
  const zone = e.target.closest('[data-qdrop]');
  if (!zone) return;
  if (!zone.contains(e.relatedTarget)) {
    zone.classList.remove('drag-over');
  }
});

document.addEventListener('drop', (e) => {
  const zone = e.target.closest('[data-qdrop]');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('drag-over');
  const key =
    draggedMatrixKey ||
    (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
  const targetQuad = zone.dataset.qdrop;
  if (!key || !targetQuad) return;
  const res = moveMatrixItemManual(state.matrix, key, targetQuad);
  if (res.changed) {
    state.matrix = res.matrixState;
    pushMatrixUndo(res.undoEntry);
    store.saveMatrix(state.matrix);
    render();
  }
});

document.addEventListener('click', handleClick);
document.addEventListener('change', handleChange);
document.addEventListener('input', handleInput);
document.addEventListener('keydown', handleKeydown);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const nowToday = todayKst();
      if (nowToday !== state.REAL) {
        if (state.cur === state.REAL) state.cur = nowToday;
        state.REAL = nowToday;
        if (state.ready) runAutoCarryOnBoot();
        render();
      }
    }
  });
}

boot();
