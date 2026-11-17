import {
  addDay,
  addMonth,
  lab,
  todayKst,
} from './core/date.js?v=20261118-01';
import {
  BNAME,
  BOOKS,
  CL,
  DEF_DD,
  GENERAL_BOOK,
  PB,
  STUDY_BOOKS,
  auditBookRanges,
  parseUnits,
  planDates,
  splitRangeUpTo,
} from './core/units.js?v=20261118-01';
import {
  applyAutoCarry,
  applyClosePlan,
  movePlanItem,
  movePlanSlice,
} from './core/carry.js?v=20261118-01';
import {
  applyMatrixUndo,
  moveMatrixItemManual,
  resetMatrixItemToAuto,
  resolveMatrixRules,
} from './core/matrix.js?v=20261118-01';
import {
  normalizeHubState,
  toggleHubStar,
} from './core/hub.js?v=20261118-01';
import { esc } from './core/html.js?v=20261118-01';
import {
  buildCalendarEmbedUrl,
  createStore,
  defaultConfig,
  defaultHubBookmarks,
  exportJsonToDocs,
  getToken,
  mergeConfig,
  setToken,
} from './services/store.js?v=20261118-01';
import {
  connectGcal,
  disconnectGcal,
  fetchGcalMonth,
  isGcalConnected,
} from './services/gcal.js?v=20261118-01';
import {
  renderAll,
  renderBookModal,
  renderBooksView,
  renderCalDayModal,
  renderHome,
  renderMoveCalModal,
  renderSettings,
  renderToday,
  renderWeek,
} from './views/schedule.js?v=20261118-01';
import { detectBookmarkKind, renderHub } from './views/hub.js?v=20261118-01';
import { renderMatrix } from './views/matrix.js?v=20261118-01';

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
let lastAuditKey = '';
let dismissedAuditSig = '';
let latestAuditSig = '';

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
  notes: { items: [] },

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
  moveModal: null,

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

function renderAuditBanner() {
  const el = $('#audit-banner');
  if (!el) return;
  if (!state.ready || state.authNeeded) {
    if (lastAuditKey !== '') {
      lastAuditKey = '';
      el.innerHTML = '';
      el.className = 'sync-banner-slot';
    }
    return;
  }
  const audit = auditBookRanges(state.plans);
  if (!audit.hasIssues) {
    latestAuditSig = '';
    if (lastAuditKey !== '') {
      lastAuditKey = '';
      el.innerHTML = '';
      el.className = 'sync-banner-slot';
    }
    return;
  }
  const sig = audit.books
    .map((b) => `${b.bookId}:${b.duplicateText}:${b.gapText}`)
    .join('|');
  latestAuditSig = sig;
  if (dismissedAuditSig === sig) {
    if (lastAuditKey !== '') {
      lastAuditKey = '';
      el.innerHTML = '';
      el.className = 'sync-banner-slot';
    }
    return;
  }
  if (lastAuditKey === sig) return;
  lastAuditKey = sig;

  const lines = audit.books
    .map((b) => {
      const parts = [];
      if (b.duplicateText) {
        const dTxt = b.duplicateDates.map((d) => d.slice(5).replace('-', '/')).join(', ');
        parts.push(`중복 ${esc(b.duplicateText)} (${esc(dTxt)})`);
      }
      if (b.gapText) {
        parts.push(`누락 ${esc(b.gapText)}`);
      }
      return `<button type="button" class="btn sm" style="margin:2px 4px 2px 0" data-act="bpop" data-b="${esc(
        b.bookId
      )}">${esc(b.name)}: ${parts.join(' · ')}</button>`;
    })
    .join('');

  el.className = 'sync-banner-slot active';
  el.innerHTML = `
    <div class="sync-banner" role="alert">
      <div class="sync-banner-msg">
        <b>⚠️ 교재 범위 중복·누락 감지</b>
        <span style="display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-top:4px">${lines}</span>
      </div>
      <div class="sync-banner-btns">
        <button type="button" class="btn sm" data-act="audit-dismiss">닫기</button>
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

function syncHead() {
  const headEl = $('#head');
  if (!headEl) return;
  if (
    headEl.dataset.built === '1' &&
    headEl.dataset.today === state.REAL
  ) {
    syncThemeSwitchInPlace(headEl);
    return;
  }
  headEl.dataset.built = '1';
  headEl.dataset.today = state.REAL;
  headEl.innerHTML = `
    <div class="head-top">
      <span class="today-pill">오늘 ${lab(state.REAL)}</span>
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
  if (!state.bookModalId && !state.calModalDate && !state.moveModal) {
    const existing = modalSlot.querySelector('.modal-backdrop');
    if (existing && existing.classList.contains('out')) return;
    modalSlot.innerHTML = '';
    delete modalSlot.dataset.bookId;
    delete modalSlot.dataset.calDate;
    delete modalSlot.dataset.movePop;
    return;
  }
  if (!state.bookModalId && state.moveModal) {
    delete modalSlot.dataset.bookId;
    delete modalSlot.dataset.calDate;
    modalSlot.innerHTML = renderMoveCalModal(state);
    modalSlot.dataset.movePop = '1';
    return;
  }
  if (!state.bookModalId && state.calModalDate) {
    delete modalSlot.dataset.bookId;
    delete modalSlot.dataset.movePop;
    modalSlot.innerHTML = renderCalDayModal(state);
    modalSlot.dataset.calDate = String(state.calModalDate);
    return;
  }
  delete modalSlot.dataset.calDate;
  delete modalSlot.dataset.movePop;
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

function closeMoveModal() {
  const modalSlot = $('#modal-root');
  const backdrop = modalSlot && modalSlot.querySelector('.modal-backdrop');
  state.moveModal = null;
  if (!backdrop || reduceMotion()) {
    if (modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.movePop;
    }
    return;
  }
  if (backdrop.classList.contains('out')) return;
  backdrop.classList.add('out');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (!state.moveModal && !state.calModalDate && !state.bookModalId && modalSlot) {
      modalSlot.innerHTML = '';
      delete modalSlot.dataset.movePop;
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
  renderAuditBanner();

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

function effectiveDoneDate(planDate) {
  return planDate && planDate < state.REAL ? planDate : state.REAL;
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

function doMoveSlice(from, id, to, startIdx = 0, endIdx = null) {
  const res = movePlanSlice(state.plans, from, id, to, startIdx, endIdx);
  if (!res.changed) return;
  state.plans = res.plans;
  store.savePlan(from, state.plans[from] || []);
  store.savePlan(to, state.plans[to] || []);
  state.moving = null;
  state.moveModal = null;
  const modalSlot = $('#modal-root');
  if (modalSlot) {
    modalSlot.innerHTML = '';
    delete modalSlot.dataset.movePop;
  }
  render();
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

async function boot() {
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
    state.notes = { items: [] };
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
    state.notes = { items: [] };
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
      state.notes = { items: [] };
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
    closeMoveModal();
    render({ motion });
    return;
  }

  if (t.dataset.v) {
    const nextView = t.dataset.v;
    const prevView = state.view;
    if (!t.closest('#nav')) {
      state.sec = DEFAULT_VIEW_SECTION[nextView] || state.sec;
    }
    state.view = nextView;
    state.lastSub[state.sec] = nextView;
    const motion =
      nextView !== prevView ? tabDirection(prevView, nextView) : '';
    closeBookModal();
    closeCalModal();
    closeMoveModal();
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

  if (a === 'ctx-move') {
    closePlanContextMenu();
    if (!d || !id) return;
    state.bookModalId = null;
    state.calModalDate = null;
    state.moveModal = {
      fromDate: d,
      id,
      ym: d.slice(0, 7),
      startIdx: 0,
      endIdx: null,
    };
    syncBookModal();
    return;
  }

  if (a === 'ctx-tog') {
    closePlanContextMenu();
    if (!d || !id) return;
    updatePlanDate(d, (list) =>
      list.map((x) => {
        if (x.id !== id) return x;
        const nextDone = !x.done;
        const copy = { ...x, done: nextDone };
        if (nextDone) {
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
    return;
  }

  if (a === 'movepopbg' && e.target !== t) return;
  if (a === 'movepopbg' || a === 'movepopclose') {
    closeMoveModal();
    return;
  }

  if (a === 'movepop-m') {
    if (!state.moveModal) return;
    const curYm = state.moveModal.ym || state.moveModal.fromDate.slice(0, 7);
    state.moveModal = {
      ...state.moveModal,
      ym: addMonth(curYm, Number(t.dataset.n)),
    };
    syncBookModal();
    return;
  }

  if (a === 'movepop-full') {
    if (!state.moveModal) return;
    state.moveModal = { ...state.moveModal, startIdx: 0, endIdx: null };
    syncBookModal();
    return;
  }

  if (a === 'movepop-pick') {
    if (!d || !state.moveModal || d === state.moveModal.fromDate) return;
    doMoveSlice(
      state.moveModal.fromDate,
      state.moveModal.id,
      d,
      state.moveModal.startIdx,
      state.moveModal.endIdx
    );
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
    const dd = state.asking.d;
    const targetItem = findItem(dd, state.asking.id);
    const res = splitRangeUpTo(targetItem, v, effectiveDoneDate(dd));
    if (!res.ok) {
      state.askMsg = res.error;
      render();
      return;
    }
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
    const doneAt = effectiveDoneDate(dd);
    updatePlanDate(dd, (list) =>
      list.map((x) =>
        x.id === targetId
          ? { ...x, done: true, done_date: doneAt, d: doneAt }
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
  } else if (a === 'audit-dismiss') {
    dismissedAuditSig = latestAuditSig;
    renderAuditBanner();
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

}

function handleChange(e) {
  const t = e.target;
  if (!state.ready) return;
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
          const doneAt = effectiveDoneDate(d);
          copy.done_date = doneAt;
          copy.d = doneAt;
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
            const doneAt = effectiveDoneDate(d);
            copy.done_date = doneAt;
            copy.d = doneAt;
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
  } else if (a === 'movepop-start') {
    if (!state.moveModal) return;
    const nextStart = Math.max(0, Number(t.value) || 0);
    const curEnd = state.moveModal.endIdx;
    state.moveModal = {
      ...state.moveModal,
      startIdx: nextStart,
      endIdx: curEnd != null && curEnd < nextStart ? nextStart : curEnd,
    };
    syncBookModal();
  } else if (a === 'movepop-end') {
    if (!state.moveModal) return;
    const nextEnd = Math.max(state.moveModal.startIdx || 0, Number(t.value) || 0);
    state.moveModal = {
      ...state.moveModal,
      endIdx: nextEnd,
    };
    syncBookModal();
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
  }
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    closePlanContextMenu();
  }
  if (e.key === 'Escape' && state.moveModal) {
    closeMoveModal();
    return;
  }
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

// Context menu & drag-and-drop support (Eisenhower Matrix, Weekly Plan, Move Modal)
let draggedMatrixKey = null;
let draggedWeekItem = null;
let draggedMoveModal = false;

function closePlanContextMenu() {
  const existing = $('#plan-ctx-menu');
  if (existing) existing.remove();
}

function openPlanContextMenu(fromDate, id, clientX, clientY, { showFull = false } = {}) {
  closePlanContextMenu();
  const item = findItem(fromDate, id);
  if (!item) return;
  const menu = document.createElement('div');
  menu.id = 'plan-ctx-menu';
  menu.className = 'plan-ctx-menu';
  menu.innerHTML = `
    <div class="plan-ctx-head">${esc(item.t || '')}</div>
    <button type="button" data-act="ctx-move" data-d="${esc(fromDate)}" data-id="${esc(id)}">📅 계획 이동 (월간 달력)</button>
    ${
      showFull
        ? `
          <button type="button" data-act="mv" data-d="${esc(fromDate)}" data-id="${esc(id)}" data-to="${addDay(fromDate, 1)}">⏭ 내일로 이동</button>
          ${
            fromDate !== state.REAL
              ? `<button type="button" data-act="mv" data-d="${esc(fromDate)}" data-id="${esc(id)}" data-to="${state.REAL}">📌 오늘로 이동</button>`
              : ''
          }
          <button type="button" data-act="togimp" data-d="${esc(fromDate)}" data-id="${esc(id)}">${
            item.important ? '★ 중요 해제' : '☆ 중요 표시'
          }</button>
          <button type="button" data-act="menu" data-id="${esc(id)}">📆 마감·날짜 옵션</button>
        `
        : ''
    }
    <button type="button" data-act="ctx-tog" data-d="${esc(fromDate)}" data-id="${esc(id)}">${
      item.done ? '↩ 미완료로 되돌리기' : '✓ 완료 처리'
    }</button>
    <button type="button" class="danger" data-act="del" data-d="${esc(fromDate)}" data-id="${esc(id)}">🗑 삭제</button>
  `;
  document.body.appendChild(menu);
  const vw = window.innerWidth || 360;
  const vh = window.innerHeight || 640;
  const rect = menu.getBoundingClientRect();
  const left = Math.max(8, Math.min(clientX, vw - rect.width - 8));
  const top = Math.max(8, Math.min(clientY, vh - rect.height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

document.addEventListener('contextmenu', (e) => {
  const wrow = e.target.closest('[data-wdrag-id]');
  if (wrow) {
    e.preventDefault();
    openPlanContextMenu(wrow.dataset.wdragD, wrow.dataset.wdragId, e.clientX, e.clientY, {
      showFull: false,
    });
    return;
  }
  const itRow = e.target.closest('[data-it-id]');
  if (itRow) {
    e.preventDefault();
    openPlanContextMenu(itRow.dataset.itD, itRow.dataset.itId, e.clientX, e.clientY, {
      showFull: true,
    });
  }
});

document.addEventListener('dragstart', (e) => {
  const mpopChip = e.target.closest('[data-mpop-drag]');
  if (mpopChip && state.moveModal) {
    draggedMoveModal = true;
    mpopChip.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'movepop');
    }
    return;
  }
  const wrow = e.target.closest('[data-wdrag-id]');
  if (wrow) {
    closePlanContextMenu();
    draggedWeekItem = { fromDate: wrow.dataset.wdragD, id: wrow.dataset.wdragId };
    wrow.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', wrow.dataset.wdragId);
    }
    return;
  }
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
  const card = e.target.closest('[data-mxkey], [data-wdrag-id], [data-mpop-drag]');
  if (card) card.classList.remove('dragging');
  document
    .querySelectorAll('.mx-quad.drag-over, [data-wdrop-d].drag-over, [data-mpop-drop].drag-over')
    .forEach((el) => el.classList.remove('drag-over'));
  draggedMatrixKey = null;
  draggedWeekItem = null;
  draggedMoveModal = false;
});

document.addEventListener('dragover', (e) => {
  if (draggedMoveModal) {
    const mzone = e.target.closest('[data-mpop-drop]');
    if (!mzone || (state.moveModal && mzone.dataset.mpopDrop === state.moveModal.fromDate)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    mzone.classList.add('drag-over');
    return;
  }
  if (draggedWeekItem) {
    const wzone = e.target.closest('[data-wdrop-d]');
    if (!wzone || wzone.dataset.wdropD === draggedWeekItem.fromDate) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    wzone.classList.add('drag-over');
    return;
  }
  const zone = e.target.closest('[data-qdrop]');
  if (!zone || !draggedMatrixKey) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  zone.classList.add('drag-over');
});

document.addEventListener('dragleave', (e) => {
  const zone = e.target.closest('[data-qdrop], [data-wdrop-d], [data-mpop-drop]');
  if (!zone) return;
  if (!zone.contains(e.relatedTarget)) {
    zone.classList.remove('drag-over');
  }
});

document.addEventListener('drop', (e) => {
  if (draggedMoveModal && state.moveModal) {
    const mzone = e.target.closest('[data-mpop-drop]');
    if (!mzone) return;
    e.preventDefault();
    mzone.classList.remove('drag-over');
    const toDate = mzone.dataset.mpopDrop;
    draggedMoveModal = false;
    if (toDate && toDate !== state.moveModal.fromDate) {
      doMoveSlice(
        state.moveModal.fromDate,
        state.moveModal.id,
        toDate,
        state.moveModal.startIdx,
        state.moveModal.endIdx
      );
    }
    return;
  }
  if (draggedWeekItem) {
    const wzone = e.target.closest('[data-wdrop-d]');
    if (!wzone) return;
    e.preventDefault();
    wzone.classList.remove('drag-over');
    const { fromDate, id } = draggedWeekItem;
    const toDate = wzone.dataset.wdropD;
    draggedWeekItem = null;
    if (fromDate && id && toDate && fromDate !== toDate) {
      doMove(fromDate, id, toDate);
    }
    return;
  }
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

document.addEventListener('click', (e) => {
  const clickedMenuBtn = e.target.closest('#plan-ctx-menu button');
  if (!e.target.closest('#plan-ctx-menu')) {
    closePlanContextMenu();
  }
  handleClick(e);
  if (clickedMenuBtn) {
    closePlanContextMenu();
  }
});
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
