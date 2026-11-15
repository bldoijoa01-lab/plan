import { esc, safeUrl } from '../core/html.js';
import { buildCalendarEmbedUrl } from '../services/store.js';

export const BOOKMARK_KINDS = [
  { id: 'docs', icon: '📝', label: '독스', cls: 'bk-docs' },
  { id: 'sheet', icon: '📊', label: '스프레드시트', cls: 'bk-sheet' },
  { id: 'drive', icon: '📁', label: '드라이브', cls: 'bk-drive' },
  { id: 'keep', icon: '💡', label: '구글 킵', cls: 'bk-keep' },
  { id: 'onenote', icon: '📓', label: '원노트', cls: 'bk-onenote' },
  { id: 'cal', icon: '📅', label: '캘린더', cls: 'bk-cal' },
  { id: 'link', icon: '🔗', label: '링크', cls: 'bk-link' },
];

const KIND_MAP = Object.fromEntries(BOOKMARK_KINDS.map((k) => [k.id, k]));

export function detectBookmarkKind(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('/spreadsheets') || u.includes('sheets.google')) return 'sheet';
  if (u.includes('/document') || u.includes('docs.google.com/document')) return 'docs';
  if (u.includes('drive.google')) return 'drive';
  if (u.includes('keep.google')) return 'keep';
  if (u.includes('onenote.com') || u.includes('onedrive.live') || u.includes('1drv.ms')) {
    return 'onenote';
  }
  if (u.includes('calendar.google')) return 'cal';
  return 'link';
}

const CORE_APPS = [
  {
    name: '구글 캘린더',
    sub: '일정·시간표',
    icon: '📅',
    url: 'https://calendar.google.com',
    cls: 'bk-cal',
  },
  {
    name: 'Microsoft OneNote',
    sub: '양방향 메모·필기',
    icon: '📓',
    url: 'https://www.onenote.com/notebooks',
    cls: 'bk-onenote',
  },
  {
    name: '구글 킵',
    sub: '빠른 메모 · 새 창 전용',
    icon: '💡',
    url: 'https://keep.google.com',
    cls: 'bk-keep',
  },
  {
    name: '구글 독스',
    sub: '문서·세특 정리',
    icon: '📝',
    url: 'https://docs.google.com/document/',
    cls: 'bk-docs',
  },
  {
    name: '스프레드시트',
    sub: '성적·데이터 표',
    icon: '📊',
    url: 'https://docs.google.com/spreadsheets/',
    cls: 'bk-sheet',
  },
  {
    name: '구글 드라이브',
    sub: '파일·자료 보관함',
    icon: '📁',
    url: 'https://drive.google.com',
    cls: 'bk-drive',
  },
];

export function renderHub(state) {
  const { cfg, hub, hubAdding, hubEditId, hubGroupFilter, hubCalEdit } = state;
  const items = (hub && Array.isArray(hub.items) ? hub.items : [])
    .slice()
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const groups = [...new Set(items.map((x) => x.group || '기본'))];
  const activeGroup = hubGroupFilter || 'all';
  const visibleItems =
    activeGroup === 'all'
      ? items
      : items.filter((x) => (x.group || '기본') === activeGroup);

  const calMode = cfg.calendarMode || 'WEEK';
  const embedUrl = buildCalendarEmbedUrl(cfg.calendarUrl, calMode);
  const editingItem = hubEditId ? items.find((x) => x.id === hubEditId) : null;

  let h = `
    <div class="card">
      <div class="row">
        <b class="card-title-md">구글 워크스페이스 바로가기</b>
        <span class="sp"></span>
        <span class="note">새 탭으로 열림</span>
      </div>
      <div class="hub-apps">
        ${CORE_APPS.map(
          (app) => `
          <a class="hub-app-tile ${app.cls}" href="${app.url}" target="_blank" rel="noopener noreferrer">
            <span class="hub-app-ico">${app.icon}</span>
            <span class="hub-app-name">${app.name}</span>
            <span class="hub-app-sub">${app.sub}</span>
          </a>
        `
        ).join('')}
      </div>
    </div>

    <div class="hub-main-grid">
    <div class="card">
      <div class="row wrap-row">
        <b class="card-title-md">📅 내 구글 캘린더</b>
        <span class="sp"></span>
        <div class="chips" style="margin:0">
          ${[
            ['WEEK', '주간'],
            ['MONTH', '월간'],
            ['AGENDA', '일정'],
          ]
            .map(
              ([m, l]) =>
                `<button type="button" class="chip ${
                  calMode === m ? 'on' : ''
                }" data-act="calmode" data-m="${m}">${l}</button>`
            )
            .join('')}
          <button type="button" class="chip" data-act="caltoggle">${
            hubCalEdit ? '닫기' : '주소 설정'
          }</button>
          <a class="chip" href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style="text-decoration:none">새 창 ↗</a>
        </div>
      </div>

      ${
        hubCalEdit || !embedUrl
          ? `<div class="cal-setup">
              <div class="note" style="margin-bottom:6px">
                구글 캘린더 설정 → '캘린더 통합'의 임베드 URL, &lt;iframe&gt; 코드 전체, 또는 Google 이메일 주소를 붙여넣으면 앱 안에 바로 떠요.
              </div>
              <div class="row wrap-row">
                <input type="text" id="hub-cal-url" placeholder="https://calendar.google.com/calendar/embed?src=... 또는 Gmail 주소" value="${esc(
                  cfg.calendarUrl || ''
                )}" style="flex:1;min-width:200px">
                <button type="button" class="btn sm pri" data-act="savecal" data-src="hub-cal-url">연결</button>
                ${
                  cfg.calendarUrl
                    ? '<button type="button" class="btn sm" data-act="clearcal">해제</button>'
                    : ''
                }
              </div>
            </div>`
          : ''
      }

      ${
        embedUrl
          ? `<div class="cal-frame-wrap">
              <iframe class="cal-embed" src="${esc(
                embedUrl
              )}" title="구글 캘린더" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
            <div class="note" style="margin-top:6px">
              ※ 비공개 캘린더가 안 보이면 같은 브라우저에서 Google 계정에 로그인되어 있는지 확인하거나, 캘린더 공유 설정을 확인해 주세요.
            </div>`
          : `<div class="note" style="margin-top:10px">
              아직 캘린더 주소가 연결되지 않았어요. 위에 구글 캘린더 주소(또는 이메일)를 한 번만 저장해 주세요.
            </div>`
      }
    </div>

    <div class="card">
      <div class="row wrap-row">
        <b class="card-title-md">⭐ 자주 쓰는 문서 즐겨찾기</b>
        <span class="sp"></span>
        <button type="button" class="btn sm pri" data-act="hubaddtog">${
          hubAdding || editingItem ? '닫기' : '+ 즐겨찾기 추가'
        }</button>
      </div>

      ${
        hubAdding || editingItem
          ? `<div class="hub-form">
              <div class="menu">
                <input type="text" id="hb-name" placeholder="문서 이름 (예: 세특 초안)" value="${esc(
                  editingItem ? editingItem.name : ''
                )}" style="flex:1;min-width:140px">
                <input type="text" id="hb-url" placeholder="https://docs.google.com/..." value="${esc(
                  editingItem ? editingItem.url : ''
                )}" style="flex:2;min-width:200px">
              </div>
              <div class="menu" style="margin-top:8px">
                <select id="hb-kind">
                  ${BOOKMARK_KINDS.map(
                    (k) =>
                      `<option value="${k.id}" ${
                        editingItem && editingItem.kind === k.id ? 'selected' : ''
                      }>${k.icon} ${k.label}</option>`
                  ).join('')}
                </select>
                <input type="text" id="hb-group" list="hb-groups" placeholder="그룹 (예: 학교·세특)" value="${esc(
                  editingItem ? editingItem.group || '기본' : '기본'
                )}" style="width:130px">
                <datalist id="hb-groups">
                  ${['기본', '학교·세특', '공부·오답', ...groups]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((g) => `<option value="${esc(g)}">`)
                    .join('')}
                </datalist>
                <button type="button" class="btn sm pri" data-act="${
                  editingItem ? 'hubeditsave' : 'hubaddsave'
                }" data-id="${esc(editingItem ? editingItem.id : '')}">${
                  editingItem ? '수정 저장' : '등록'
                }</button>
                ${
                  editingItem
                    ? '<button type="button" class="btn sm" data-act="hubeditcancel">취소</button>'
                    : ''
                }
              </div>
            </div>`
          : ''
      }

      ${
        groups.length > 1
          ? `<div class="chips" style="margin-top:10px">
              <button type="button" class="chip ${
                activeGroup === 'all' ? 'on' : ''
              }" data-act="hubgrp" data-g="all">전체 (${items.length})</button>
              ${groups
                .map(
                  (g) =>
                    `<button type="button" class="chip ${
                      activeGroup === g ? 'on' : ''
                    }" data-act="hubgrp" data-g="${esc(g)}">${esc(g)}</button>`
                )
                .join('')}
            </div>`
          : ''
      }

      <div class="hub-bm-list">
        ${
          visibleItems.length
            ? (() => {
                const byGroup = {};
                for (const bm of visibleItems) {
                  const g = bm.group || '기본';
                  (byGroup[g] = byGroup[g] || []).push(bm);
                }
                return Object.entries(byGroup)
                  .map(
                    ([grp, list]) => `
                    <div class="hub-group-sec">
                      <div class="hub-group-title">${esc(grp)}</div>
                      <div class="hub-bm-grid">
                      ${list
                        .map((bm) => {
                          const kInfo =
                            KIND_MAP[bm.kind] ||
                            KIND_MAP[detectBookmarkKind(bm.url)] ||
                            KIND_MAP.link;
                          const url = safeUrl(bm.url);
                          return `
                            <div class="hub-bm-row">
                              <a class="hub-bm-link" href="${esc(
                                url
                              )}" target="_blank" rel="noopener noreferrer">
                                <span class="hub-bm-ico ${kInfo.cls}">${
                                  kInfo.icon
                                }</span>
                                <span class="hub-bm-meta">
                                  <b>${esc(bm.name)}</b>
                                  <span class="note">${esc(kInfo.label)} · ${esc(
                                    bm.url.replace(/^https?:\/\//, '').slice(0, 42)
                                  )}</span>
                                </span>
                              </a>
                              <div class="hub-bm-actions">
                                <button type="button" class="btn sm" data-act="hubmove" data-id="${esc(
                                  bm.id
                                )}" data-dir="-1" title="위로">▲</button>
                                <button type="button" class="btn sm" data-act="hubmove" data-id="${esc(
                                  bm.id
                                )}" data-dir="1" title="아래로">▼</button>
                                <button type="button" class="btn sm" data-act="hubedit" data-id="${esc(
                                  bm.id
                                )}" title="수정">✎</button>
                                <button type="button" class="btn sm danger" data-act="hubdel" data-id="${esc(
                                  bm.id
                                )}" title="삭제">✕</button>
                              </div>
                            </div>
                          `;
                        })
                        .join('')}
                      </div>
                    </div>
                  `
                  )
                  .join('');
              })()
            : '<div class="note" style="padding:14px 0">등록된 문서 즐겨찾기가 없어요. 자주 쓰는 독스나 스프레드시트 링크를 추가해 보세요!</div>'
        }
      </div>
    </div>
    </div>
  `;

  return h;
}
