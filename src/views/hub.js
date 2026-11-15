import { esc, safeUrl } from '../core/html.js';
import { buildCalendarEmbedUrl } from '../services/store.js';
import {
  BOOKMARK_KINDS,
  DEFAULT_HUB_DOCS,
  HUB_CATEGORY_META,
  KIND_MAP,
  buildHubDocumentCatalog,
  detectBookmarkKind,
  normalizeHubState,
  toggleHubStar,
} from '../core/hub.js';

export {
  BOOKMARK_KINDS,
  DEFAULT_HUB_DOCS,
  HUB_CATEGORY_META,
  detectBookmarkKind,
  normalizeHubState,
  buildHubDocumentCatalog,
  toggleHubStar,
};

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

function kindInfoOf(doc) {
  return (
    KIND_MAP[doc.kind] ||
    KIND_MAP[detectBookmarkKind(doc.url, doc.name)] ||
    KIND_MAP.link
  );
}

function renderDocLinkStart(doc, kInfo, metaText) {
  const inner = `
    <span class="hub-bm-ico ${kInfo.cls}">${kInfo.icon}</span>
    <span class="hub-bm-meta">
      <b>${esc(doc.name)}</b>
      <span class="note">${metaText}</span>
    </span>
  `;
  if (doc.noteId) {
    return `
      <button type="button" class="hub-bm-link hub-bm-note-btn" data-act="note-open" data-id="${esc(
        doc.noteId
      )}" title="웹 메모장에서 열기">
        ${inner}
      </button>
    `;
  }
  const url = safeUrl(doc.url);
  return `
    <a class="hub-bm-link" href="${esc(
      url
    )}" target="_blank" rel="noopener noreferrer">
      ${inner}
    </a>
  `;
}

export function renderHub(state) {
  const {
    cfg,
    hub,
    notes,
    hubAdding,
    hubEditId,
    hubGroupFilter,
    hubCalEdit,
    hubSearch,
  } = state;

  const hubState = normalizeHubState(hub);
  const catalog = buildHubDocumentCatalog(hubState, notes);
  const starredItems = hubState.items
    .slice()
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const calMode = cfg.calendarMode || 'WEEK';
  const embedUrl = buildCalendarEmbedUrl(cfg.calendarUrl, calMode);
  const editingItem = hubEditId
    ? starredItems.find((x) => x.id === hubEditId) ||
      hubState.customDocs.find((x) => x.id === hubEditId) ||
      null
    : null;

  const query = String(hubSearch || '').trim().toLowerCase();
  const activeGroup = hubGroupFilter || 'all';

  const groupCounts = {};
  for (const doc of catalog) {
    const g = doc.group || '기본';
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  }
  const baseCategoryIds = new Set(HUB_CATEGORY_META.map((c) => c.id));
  const extraCategories = Object.keys(groupCounts)
    .filter((g) => !baseCategoryIds.has(g))
    .map((g) => ({ id: g, icon: '📁', label: g }));
  const filterCategories = [...HUB_CATEGORY_META, ...extraCategories];

  const starredCount = catalog.filter((d) => d.starred).length;
  const filteredDocs = catalog.filter((doc) => {
    if (activeGroup === 'starred' && !doc.starred) return false;
    if (
      activeGroup !== 'all' &&
      activeGroup !== 'starred' &&
      (doc.group || '기본') !== activeGroup
    ) {
      return false;
    }
    if (!query) return true;
    const kInfo = kindInfoOf(doc);
    const hay = [
      doc.name,
      doc.group,
      kInfo.label,
      doc.sub || '',
      doc.modifiedAt || '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(query);
  });

  const existingGroups = [...new Set(catalog.map((x) => x.group || '기본'))];

  let h = `
    <div class="card">
      <div class="row">
        <b class="card-title-md">워크스페이스 바로가기</b>
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
          <b class="card-title-md">📚 문서 허브 &amp; 즐겨찾기 설정</b>
          <span class="sp"></span>
          <button type="button" class="btn sm pri" data-act="hubaddtog">${
            hubAdding || editingItem ? '닫기' : '+ 새 문서 등록'
          }</button>
        </div>

        ${
          hubAdding || editingItem
            ? `<div class="hub-form">
                <div class="menu">
                  <input type="text" id="hb-name" placeholder="문서 이름 (예: 생명과학 세특 초안)" value="${esc(
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
                  <input type="text" id="hb-group" list="hb-groups" placeholder="카테고리 (예: 학교·세특)" value="${esc(
                    editingItem ? editingItem.group || '학교·세특' : '학교·세특'
                  )}" style="width:140px">
                  <datalist id="hb-groups">
                    ${['학교·세특', '수행·활동지', '교재·시험지', '입시·진학', ...existingGroups]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map((g) => `<option value="${esc(g)}">`)
                      .join('')}
                  </datalist>
                  ${
                    editingItem
                      ? ''
                      : `<label class="chk-pill"><input type="checkbox" id="hb-star" checked> ⭐ 즐겨찾기 바로 등록</label>`
                  }
                  <button type="button" class="btn sm pri" data-act="${
                    editingItem ? 'hubeditsave' : 'hubaddsave'
                  }" data-id="${esc(editingItem ? editingItem.id : '')}">${
                    editingItem ? '수정 저장' : '문서 등록'
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

        <div class="hub-sec-head" style="margin-top:14px">
          <b>⭐ 즐겨찾기 설정된 문서 (${starredItems.length})</b>
          <span class="note">홈 대시보드에도 연동</span>
        </div>

        <div class="hub-bm-list">
          ${
            starredItems.length
              ? `<div class="hub-bm-grid">
                  ${starredItems
                    .map((bm) => {
                      const kInfo = kindInfoOf(bm);
                      const metaText = `${esc(bm.group || '기본')} · ${esc(
                        kInfo.label
                      )}${bm.modifiedAt ? ' · ' + esc(bm.modifiedAt) : ''}`;
                      return `
                        <div class="hub-bm-row is-starred">
                          ${renderDocLinkStart(bm, kInfo, metaText)}
                          <div class="hub-bm-actions">
                            <button type="button" class="hub-star-btn on sm" data-act="hubstar" data-id="${esc(
                              bm.id
                            )}" title="즐겨찾기 해제">★</button>
                            <button type="button" class="btn sm" data-act="hubmove" data-id="${esc(
                              bm.id
                            )}" data-dir="-1" title="위로">▲</button>
                            <button type="button" class="btn sm" data-act="hubmove" data-id="${esc(
                              bm.id
                            )}" data-dir="1" title="아래로">▼</button>
                            <button type="button" class="btn sm" data-act="hubedit" data-id="${esc(
                              bm.id
                            )}" title="수정">✎</button>
                          </div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>`
              : '<div class="note" style="padding:10px 0">즐겨찾기한 문서가 없어요. 아래 문서 목록에서 ☆ 버튼을 눌러 자주 쓰는 문서를 고정해 보세요!</div>'
          }
        </div>

        <div class="hub-sec-head" style="margin-top:20px">
          <b>📂 전체 문서 목록 (${filteredDocs.length} / ${catalog.length})</b>
          <span class="note">☆ 클릭해 즐겨찾기 설정 · 제목 클릭해 열기</span>
        </div>

        <div class="hub-search-bar">
          <input type="text" id="hub-search" placeholder="문서 제목, 과목, 카테고리 검색 (예: 생기부, 기하, 물리, 서울대)..." value="${esc(
            hubSearch || ''
          )}">
          ${
            hubSearch
              ? '<button type="button" class="btn sm" data-act="hub-search-clear">지우기</button>'
              : ''
          }
        </div>

        <div class="chips" style="margin-top:10px">
          ${filterCategories
            .map((cat) => {
              const count =
                cat.id === 'all'
                  ? catalog.length
                  : cat.id === 'starred'
                    ? starredCount
                    : groupCounts[cat.id] || 0;
              if (cat.id !== 'all' && cat.id !== 'starred' && count === 0) {
                return '';
              }
              return `<button type="button" class="chip ${
                activeGroup === cat.id ? 'on' : ''
              }" data-act="hubgrp" data-g="${esc(cat.id)}">${cat.icon} ${esc(
                cat.label
              )} (${count})</button>`;
            })
            .join('')}
        </div>

        <div class="hub-doc-catalog">
          ${
            filteredDocs.length
              ? (() => {
                  const byGroup = {};
                  for (const doc of filteredDocs) {
                    const g = doc.group || '기본';
                    (byGroup[g] = byGroup[g] || []).push(doc);
                  }
                  const entries = Object.entries(byGroup);
                  const showGroupHeaders =
                    activeGroup === 'all' || entries.length > 1;
                  return entries
                    .map(
                      ([grp, list]) => `
                      <div class="hub-group-sec">
                        ${
                          showGroupHeaders
                            ? `<div class="hub-group-title">${esc(grp)} (${list.length})</div>`
                            : ''
                        }
                        <div class="hub-doc-list-rows">
                          ${list
                            .map((doc) => {
                              const kInfo = kindInfoOf(doc);
                              const metaText = `${esc(kInfo.label)}${
                                doc.sub ? ' · ' + esc(doc.sub) : ''
                              }${doc.modifiedAt ? ' · ' + esc(doc.modifiedAt) : ''}`;
                              return `
                                <div class="hub-doc-row ${
                                  doc.starred ? 'is-starred' : ''
                                }">
                                  <button type="button" class="hub-star-btn ${
                                    doc.starred ? 'on' : ''
                                  }" data-act="hubstar" data-id="${esc(
                                doc.id
                              )}" title="${
                                doc.starred ? '즐겨찾기 해제' : '즐겨찾기 설정'
                              }">
                                    <span class="hub-star-ico">${
                                      doc.starred ? '★' : '☆'
                                    }</span>
                                    <span class="hub-star-lbl">${
                                      doc.starred ? '즐겨찾기됨' : '즐겨찾기'
                                    }</span>
                                  </button>
                                  ${renderDocLinkStart(doc, kInfo, metaText)}
                                  <div class="hub-doc-trailing">
                                    ${
                                      doc.noteId &&
                                      doc.url &&
                                      doc.url.startsWith('http')
                                        ? `<a class="btn sm" href="${esc(
                                            safeUrl(doc.url)
                                          )}" target="_blank" rel="noopener noreferrer" title="OneNote 웹에서 열기">웹 ↗</a>`
                                        : ''
                                    }
                                    ${
                                      doc.isCustom
                                        ? `<button type="button" class="btn sm" data-act="hubedit" data-id="${esc(
                                            doc.id
                                          )}" title="수정">✎</button>
                                           <button type="button" class="btn sm danger" data-act="hubdel" data-id="${esc(
                                             doc.id
                                           )}" title="삭제">✕</button>`
                                        : ''
                                    }
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
              : '<div class="note" style="padding:14px 0">조건에 맞는 문서가 없어요. 검색어를 지우거나 다른 카테고리를 선택해 보세요.</div>'
          }
        </div>
      </div>
    </div>
  `;

  return h;
}
