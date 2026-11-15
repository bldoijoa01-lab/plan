import { esc } from './html.js';
import { isValidIso } from './date.js';

export const DEFAULT_ONENOTE_CLIENT_ID = '328438b7-4c01-4c07-a840-e625a749bb89';

export const STICKY_COLORS = [
  { id: 'yellow', label: '노랑', hex: '#fff7b1', accent: '#eab308' },
  { id: 'green', label: '초록', hex: '#d7f9d3', accent: '#22c55e' },
  { id: 'pink', label: '분홍', hex: '#ffd6e7', accent: '#ec4899' },
  { id: 'purple', label: '보라', hex: '#e9d8fd', accent: '#9333ea' },
  { id: 'blue', label: '파랑', hex: '#d0ebff', accent: '#3b82f6' },
  { id: 'gray', label: '회색', hex: '#e5e7eb', accent: '#6b7280' },
  { id: 'charcoal', label: '차콜', hex: '#374151', accent: '#1f2937' },
];

const STICKY_COLOR_SET = new Set(STICKY_COLORS.map((c) => c.id));

/**
 * 스티커 메모 색상 ID를 정규화합니다.
 */
export function normalizeStickyColor(color) {
  const c = String(color || '').trim().toLowerCase();
  return STICKY_COLOR_SET.has(c) ? c : 'yellow';
}

/**
 * Microsoft OneNote 기본 설정을 반환합니다.
 */
export function defaultOneNoteConfig() {
  return {
    clientId: DEFAULT_ONENOTE_CLIENT_ID,
    tenant: 'consumers',
    notebookId: '',
    notebookName: '',
    sectionId: '',
    sectionName: '공부 계획표 메모',
    autoSync: true,
  };
}

/**
 * OneNote 데스크톱/모바일 앱 딥링크(onenote:...)만 허용합니다.
 * @param {string} u
 * @returns {string}
 */
export function safeOneNoteClientUrl(u) {
  const raw = String(u || '').trim();
  if (!raw) return '';
  if (/^onenote:(https:\/\/)?[^\s<>"']+$/i.test(raw)) return raw;
  return '';
}

function normalizeNoteItem(raw, idx = 0) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const nowIso = new Date().toISOString();
  const createdAt = typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : nowIso;
  const updatedAt = typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : createdAt;
  const title = String(item.title ?? '').trim() || '제목 없는 메모';
  return {
    id: String(item.id || `n_${Date.now().toString(36)}_${idx}`),
    title,
    content: String(item.content ?? ''),
    subject: String(item.subject || '').trim() || '일반',
    date: isValidIso(item.date) ? item.date : '',
    color: normalizeStickyColor(item.color),
    pinned: Boolean(item.pinned),
    createdAt,
    updatedAt,
    onenotePageId: String(item.onenotePageId || ''),
    onenoteSectionId: String(item.onenoteSectionId || ''),
    onenoteSectionName: String(item.onenoteSectionName || ''),
    onenoteWebUrl: String(item.onenoteWebUrl || ''),
    onenoteClientUrl: String(item.onenoteClientUrl || ''),
    lastSyncedAt: String(item.lastSyncedAt || ''),
    remoteModifiedAt: String(item.remoteModifiedAt || ''),
    outlookId: String(item.outlookId || ''),
    outlookModifiedAt: String(item.outlookModifiedAt || ''),
    outlookSyncedAt: String(item.outlookSyncedAt || ''),
    dirty: Boolean(item.dirty),
  };
}

/**
 * notes/main 문서 상태를 표준 구조로 정규화합니다.
 */
export function normalizeNotesState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawItems = Array.isArray(src.items) ? src.items : [];
  const items = rawItems.map((it, idx) => normalizeNoteItem(it, idx));
  const rawDeleted = Array.isArray(src.deletedPageIds) ? src.deletedPageIds : [];
  const deletedPageIds = [...new Set(rawDeleted.map((x) => String(x || '').trim()).filter(Boolean))];
  const rawOl = Array.isArray(src.deletedOutlookIds) ? src.deletedOutlookIds : [];
  const deletedOutlookIds = [...new Set(rawOl.map((x) => String(x || '').trim()).filter(Boolean))];
  return {
    items,
    deletedPageIds,
    deletedOutlookIds,
    lastFullSyncAt: String(src.lastFullSyncAt || ''),
    lastOutlookSyncAt: String(src.lastOutlookSyncAt || ''),
  };
}

/**
 * 로컬 스티커 메모와 Outlook '메모' 폴더 항목을 비교해 동기화 계획을 산출합니다.
 * remoteNotes: [{ id, subject, body, lastModifiedDateTime }]
 * complete=false(목록이 잘린 경우)면 원격 삭제 판단(연결 해제)을 하지 않습니다.
 * 원격에서 사라진 메모는 로컬에서 삭제하지 않고 연결만 해제합니다(데이터 보호).
 */
export function planOutlookSync({ localState, remoteNotes = [], complete = true }) {
  const local = normalizeNotesState(localState);
  const ignored = new Set(local.deletedOutlookIds);
  const remoteMap = new Map();
  for (const r of Array.isArray(remoteNotes) ? remoteNotes : []) {
    if (r && r.id) remoteMap.set(r.id, r);
  }
  const matched = new Set();
  const toCreateRemote = [];
  const toUpdateRemote = [];
  const toPull = [];
  const unlinkLocalIds = [];

  for (const item of local.items) {
    const localMs = Date.parse(item.updatedAt || '') || 0;
    const syncedMs = Date.parse(item.outlookSyncedAt || '') || 0;
    const localChanged = localMs > syncedMs;
    if (!item.outlookId) {
      toCreateRemote.push(item);
      continue;
    }
    const remote = remoteMap.get(item.outlookId);
    if (remote) {
      matched.add(remote.id);
      const remoteMs = Date.parse(remote.lastModifiedDateTime || '') || 0;
      const knownMs = Date.parse(item.outlookModifiedAt || '') || 0;
      const remoteChanged = !item.outlookModifiedAt || remoteMs > knownMs + 1000;
      if (localChanged && (!remoteChanged || localMs >= remoteMs)) {
        toUpdateRemote.push(item);
      } else if (remoteChanged) {
        toPull.push({ remote, localItem: item });
      }
      continue;
    }
    if (complete) {
      if (localChanged) toCreateRemote.push({ ...item, outlookId: '' });
      else unlinkLocalIds.push(item.id);
    }
  }

  for (const r of remoteMap.values()) {
    if (!matched.has(r.id) && !ignored.has(r.id)) {
      toPull.push({ remote: r, localItem: null });
    }
  }
  return { toCreateRemote, toUpdateRemote, toPull, unlinkLocalIds };
}

/**
 * 메모 본문을 OneNote 호환 XHTML div 블록으로 직렬화합니다.
 */
export function renderNoteBodyInnerHtml(note) {
  const n = normalizeNoteItem(note);
  const metaText = `[과목: ${n.subject}]${n.date ? ` [날짜: ${n.date}]` : ''}${
    n.color ? ` [색상: ${n.color}]` : ''
  }`;
  const metaHtml = `<p data-plan-meta="1" style="color:#6b7280;font-size:10.5pt">${esc(metaText)}</p>`;

  const lines = n.content.split(/\r?\n/);
  const bodyLinesHtml = lines
    .map((line) => {
      const todoMatch = /^\s*-\s*\[([ xX])\]\s*(.*)$/.exec(line);
      if (todoMatch) {
        const checked = todoMatch[1].toLowerCase() === 'x';
        const text = todoMatch[2];
        const tag = checked ? 'to-do:completed' : 'to-do';
        return `<p data-tag="${tag}">${text ? esc(text) : '&nbsp;'}</p>`;
      }
      if (!line.trim() && line === '') {
        return '<p>&nbsp;</p>';
      }
      return `<p>${line ? esc(line) : '&nbsp;'}</p>`;
    })
    .join('');

  return `<div data-plan-body="1" data-plan-note-id="${esc(n.id)}" data-plan-subject="${esc(
    n.subject
  )}" data-plan-date="${esc(n.date)}" data-plan-color="${esc(n.color)}">${metaHtml}${bodyLinesHtml}</div>`;
}

/**
 * POST /me/onenote/sections/{id}/pages 용 전체 HTML 문서를 생성합니다.
 */
export function noteToOneNoteHtml(note) {
  const n = normalizeNoteItem(note);
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${esc(n.title)}</title>
    <meta name="created" content="${esc(n.createdAt)}" />
  </head>
  <body>
    ${renderNoteBodyInnerHtml(n)}
  </body>
</html>`;
}

/**
 * PATCH /me/onenote/pages/{id}/content 용 JSON Patch 배열을 생성합니다.
 */
export function noteToOneNotePatchPayload(note) {
  const n = normalizeNoteItem(note);
  return [
    { target: 'title', action: 'replace', content: n.title },
    { target: 'body', action: 'replace', content: renderNoteBodyInnerHtml(n) },
  ];
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const cp = Number(code);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    });
}

function stripInlineTags(htmlFragment) {
  return decodeHtmlEntities(String(htmlFragment || '').replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .trim();
}

/**
 * OneNote Graph API에서 내려받은 페이지 HTML을 앱 메모 구조로 파싱합니다.
 */
export function parseOneNotePageHtml(html, pageMeta = {}) {
  const rawHtml = String(html || '');

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(rawHtml);
  const title =
    (titleMatch ? stripInlineTags(titleMatch[1]) : '') ||
    String(pageMeta.title || '').trim() ||
    '제목 없는 메모';

  const noteIdMatch = /data-plan-note-id=["']([^"']*)["']/i.exec(rawHtml);
  const subjAttrMatch = /data-plan-subject=["']([^"']*)["']/i.exec(rawHtml);
  const dateAttrMatch = /data-plan-date=["']([^"']*)["']/i.exec(rawHtml);
  const colorAttrMatch = /data-plan-color=["']([^"']*)["']/i.exec(rawHtml);

  const embeddedNoteId = noteIdMatch ? decodeHtmlEntities(noteIdMatch[1]).trim() : '';
  let subject = subjAttrMatch ? decodeHtmlEntities(subjAttrMatch[1]).trim() : '';
  let date = dateAttrMatch ? decodeHtmlEntities(dateAttrMatch[1]).trim() : '';
  let color = colorAttrMatch ? decodeHtmlEntities(colorAttrMatch[1]).trim() : '';

  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(rawHtml);
  let bodyHtml = bodyMatch ? bodyMatch[1] : rawHtml;

  // 스크립트·스타일 제거
  bodyHtml = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // 메타데이터 문단 추출 및 본문 중복 방지 제거
  const metaParaMatch = /<p\b[^>]*data-plan-meta=["']1["'][^>]*>([\s\S]*?)<\/p>/i.exec(
    bodyHtml
  );
  if (metaParaMatch) {
    const metaPlain = stripInlineTags(metaParaMatch[1]);
    if (!subject) {
      const sm = /\[과목:\s*([^\]]+)\]/i.exec(metaPlain);
      if (sm) subject = sm[1].trim();
    }
    if (!date) {
      const dm = /\[날짜:\s*(\d{4}-\d{2}-\d{2})\]/i.exec(metaPlain);
      if (dm) date = dm[1];
    }
    if (!color) {
      const cm = /\[색상:\s*([^\]]+)\]/i.exec(metaPlain);
      if (cm) color = cm[1].trim();
    }
    bodyHtml = bodyHtml.replace(metaParaMatch[0], '');
  } else {
    // OneNote 클라이언트가 data-plan-meta 속성을 제거한 경우 첫 문단에서 메타 추출
    const firstParaMatch = /^\s*(?:<div\b[^>]*>\s*)*(<p\b[^>]*>([\s\S]*?)<\/p>)/i.exec(
      bodyHtml
    );
    if (firstParaMatch) {
      const plain = stripInlineTags(firstParaMatch[2]);
      const fullMetaRx =
        /^\[과목:\s*([^\]]+)\](?:\s*\[날짜:\s*(\d{4}-\d{2}-\d{2})\])?(?:\s*\[색상:\s*([^\]]+)\])?$/i;
      const m = fullMetaRx.exec(plain);
      if (m) {
        if (!subject) subject = m[1].trim();
        if (!date && m[2]) date = m[2];
        if (!color && m[3]) color = m[3].trim();
        bodyHtml = bodyHtml.replace(firstParaMatch[1], '');
      }
    }
  }

  // data-tag="to-do" / "to-do:completed" 문단을 Markdown 체크박스 표기로 변환
  bodyHtml = bodyHtml.replace(
    /<p\b([^>]*)data-tag=["']([^"']*)["']([^>]*)>([\s\S]*?)<\/p>/gi,
    (_, _a, tagStr, _b, inner) => {
      const tags = tagStr
        .toLowerCase()
        .split(/[,\s]+/)
        .filter(Boolean);
      const text = stripInlineTags(inner);
      if (tags.includes('to-do:completed')) {
        return `<p>- [x] ${text}</p>`;
      }
      if (tags.includes('to-do')) {
        return `<p>- [ ] ${text}</p>`;
      }
      return `<p>${inner}</p>`;
    }
  );

  // HTML 소스 들여쓰기 줄바꿈 및 블록 경계 공백 정리
  bodyHtml = bodyHtml
    .replace(/\r?\n/g, ' ')
    .replace(/(<\/?(?:div|p|body|ul|ol|li|table|tr|h[1-6]|blockquote)\b[^>]*>)[ \t]+/gi, '$1')
    .replace(/[ \t]+(<\/?(?:div|p|body|ul|ol|li|table|tr|h[1-6]|blockquote)\b)/gi, '$1');

  // 줄바꿈·목록 태그를 개행으로 변환 (중첩 p+div 닫힘 중복 개행 방지)
  bodyHtml = bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/(?:p|h[1-6]|li|tr|blockquote)>\s*(?:<\/div>\s*)*/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  const plainRaw = decodeHtmlEntities(bodyHtml.replace(/<[^>]+>/g, ''));
  const content = plainRaw
    .split('\n')
    .map((line) => (line === '\u00a0' ? '' : line.replace(/\u00a0/g, ' ').replace(/[ \t]+$/, '')))
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');

  return {
    title,
    content,
    subject: subject || '일반',
    date: isValidIso(date) ? date : '',
    color: normalizeStickyColor(color),
    embeddedNoteId,
  };
}

/**
 * 로컬 메모 목록과 원노트 섹션 페이지 목록을 비교해 양방향 동기화 계획을 산출합니다.
 */
export function planBidirectionalSync({ localState, remotePages = [], sectionId = '' }) {
  const local = normalizeNotesState(localState);
  const deletedSet = new Set(local.deletedPageIds);
  const toDeleteRemote = [...deletedSet];

  const remoteMap = new Map();
  for (const rp of Array.isArray(remotePages) ? remotePages : []) {
    if (rp && rp.id) remoteMap.set(rp.id, rp);
  }

  const matchedRemoteIds = new Set();
  const toCreateRemote = [];
  const toUpdateRemote = [];
  const toPullRemote = [];
  const deletedRemotelyLocalIds = [];

  for (const item of local.items) {
    if (!item.onenotePageId) {
      toCreateRemote.push(item);
      continue;
    }

    const remote = remoteMap.get(item.onenotePageId);
    if (remote) {
      matchedRemoteIds.add(remote.id);
      const remoteMs = Date.parse(remote.lastModifiedDateTime || '') || 0;
      const knownRemoteMs = Date.parse(item.remoteModifiedAt || '') || 0;
      const localUpdatedMs = Date.parse(item.updatedAt || '') || 0;
      const remoteChanged = !item.remoteModifiedAt || remoteMs > knownRemoteMs + 1000;

      if (item.dirty && (!remoteChanged || localUpdatedMs >= remoteMs)) {
        toUpdateRemote.push(item);
      } else if (remoteChanged) {
        toPullRemote.push({ remote, localItem: item });
      }
      continue;
    }

    // OneNote 페이지 ID가 있지만 현재 원격 페이지 목록에 없는 경우
    if (item.dirty) {
      toCreateRemote.push({ ...item, onenotePageId: '' });
    } else if (!sectionId || !item.onenoteSectionId || item.onenoteSectionId === sectionId) {
      deletedRemotelyLocalIds.push(item.id);
    }
  }

  for (const remote of Array.isArray(remotePages) ? remotePages : []) {
    if (!remote || !remote.id) continue;
    if (!matchedRemoteIds.has(remote.id) && !deletedSet.has(remote.id)) {
      toPullRemote.push({ remote, localItem: null });
    }
  }

  return {
    toDeleteRemote,
    toCreateRemote,
    toUpdateRemote,
    toPullRemote,
    deletedRemotelyLocalIds,
  };
}
