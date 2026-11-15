import { esc, safeUrl } from '../core/html.js';
import { lab, shortDate } from '../core/date.js';
import {
  DEFAULT_ONENOTE_CLIENT_ID,
  STICKY_COLORS,
  defaultOneNoteConfig,
  normalizeNotesState,
  normalizeStickyColor,
  safeOneNoteClientUrl,
} from '../core/onenote.js';
import { getOneNoteAuth, getOneNoteRedirectUri } from '../services/onenote.js';

export const NOTE_SUBJECTS = ['일반', '수학', '물리', '화학', '영어', '학교·할일'];

export const NOTE_TEMPLATES = {
  wrong: '[문항 번호] \n[틀린 이유] \n[핵심 개념·풀이] \n- [ ] 다시 풀어보기',
  setuk: '[교과/단원] \n[탐구 주제] \n[배운 점·심화 내용] \n- [ ] 보고서 초안 정리',
  checklist: '- [ ] 핵심 개념 복습\n- [ ] 오답 문항 재풀이\n- [ ] 질문할 내용 정리',
};

const TENANT_PRESETS = [
  { id: 'consumers', label: '👤 개인 계정 전용 (consumers · 추천)' },
  { id: 'common', label: '🌐 개인+학교 공통 (common)' },
  { id: 'organizations', label: '🏫 학교·직장 전용 (organizations)' },
];

export function extractCheckLines(content) {
  return String(content || '')
    .split(/\r?\n/)
    .map((line, lineIdx) => {
      const m = /^\s*-\s*\[([ xX])\]\s*(.*)$/.exec(line);
      if (!m) return null;
      return {
        lineIdx,
        checked: m[1].toLowerCase() === 'x',
        text: m[2].trim(),
      };
    })
    .filter(Boolean);
}

function syncBadgeHtml(note, isConnected) {
  if (note.dirty && isConnected) {
    return '<span class="mini-pill due">✏️ 동기화 대기</span>';
  }
  if (note.outlookId && !note.onenotePageId) {
    return '<span class="mini-pill note-on-badge">📬 Outlook</span>';
  }
  if (note.onenotePageId) {
    return '<span class="mini-pill note-on-badge">🟣 OneNote</span>';
  }
  return '<span class="mini-pill">☁️ 자동저장</span>';
}

function noteStatusText(note) {
  if (note.dirty) return '웹에 자동 저장됨 · OneNote 반영 대기';
  if (note.lastSyncedAt) {
    return `마지막 동기화: ${String(note.lastSyncedAt).slice(0, 16).replace('T', ' ')}`;
  }
  return `수정: ${String(note.updatedAt || '').slice(0, 16).replace('T', ' ')}`;
}

function colorDotsHtml(noteId, activeColor, actName = 'sticky-color') {
  const cur = normalizeStickyColor(activeColor);
  return `
    <div class="sticky-color-dots" role="group" aria-label="스티커 메모 색상 선택">
      ${STICKY_COLORS.map(
        (c) => `
        <button
          type="button"
          class="sticky-color-dot ${cur === c.id ? 'on' : ''}"
          style="background:${c.hex}"
          data-act="${actName}"
          data-id="${esc(noteId)}"
          data-color="${c.id}"
          title="${esc(c.label)}"
          aria-label="${esc(c.label)} 색상"
          aria-pressed="${cur === c.id ? 'true' : 'false'}"
        ></button>
      `
      ).join('')}
    </div>
  `;
}

function subjectOptionsHtml(selectedSubj) {
  const list = [
    ...NOTE_SUBJECTS,
    ...(selectedSubj && !NOTE_SUBJECTS.includes(selectedSubj) ? [selectedSubj] : []),
  ];
  return list
    .map(
      (s) =>
        `<option value="${esc(s)}" ${selectedSubj === s ? 'selected' : ''}>${esc(s)}</option>`
    )
    .join('');
}

function renderConnectPanel({
  cfgOneNote,
  auth,
  isConnected,
  authTab,
  notebooks,
  sections,
}) {
  const redirectUri = getOneNoteRedirectUri();
  const nbList = Array.isArray(notebooks) ? notebooks : [];
  const secList = Array.isArray(sections) ? sections : [];
  const clientIdVal = cfgOneNote.clientId || DEFAULT_ONENOTE_CLIENT_ID;
  const tenantVal = cfgOneNote.tenant || 'consumers';

  return `
    <div class="on-connect-panel">
      <div class="row wrap-row" style="margin-bottom:10px">
        <b class="card-title-sm">Microsoft OneNote 계정 연결 &amp; 대상 섹션</b>
        <span class="sp"></span>
        ${
          isConnected
            ? `<span class="mini-pill note-on-badge">연결됨: ${esc(
                (auth && (auth.userName || auth.userEmail)) || 'Microsoft 계정'
              )} (${auth && auth.mode === 'pkce' ? 'OAuth 자동갱신' : '토큰'})</span>`
            : '<span class="mini-pill">미연결</span>'
        }
      </div>

      <div class="on-trouble-box">
        <b>💡 Microsoft 로그인 오류 (<code>AADSTS700016</code>) 해결 안내</b>
        <div class="note" style="margin-top:4px;line-height:1.55">
          • <b>원인</b>: Azure 앱이 <b>개인 계정 전용</b>(또는 다른 디렉터리)으로 등록된 상태에서 브라우저에 로그인된 <b>학교·기관 Microsoft 계정</b>으로 접속하면 해당 학교 디렉터리(<code>821ada1a-...</code>)에서 앱을 찾지 못해 거부됩니다.<br>
          • <b>해결 1 (가장 빠름)</b>: 아래 <b>👤 개인 계정 전용 (consumers)</b> 버튼을 눌러 <code>@outlook.com</code> / <code>@naver.com</code> / <code>@gmail.com</code> 같은 <b>개인 Microsoft 계정</b>으로 로그인하세요.<br>
          • <b>해결 2 (학교 계정 사용)</b>: Entra 앱 등록 → <b>매니페스트(Manifest)</b>에서 <code>"signInAudience"</code>를 <code>"AzureADandPersonalMicrosoftAccount"</code>로 바꾸거나 학교 테넌트에 앱을 등록하세요.<br>
          • <b>참고</b>: 🗒️ <b>스티커 메모 보드</b>는 Microsoft 로그인 없이도 우리 웹앱 클라우드(Cloudflare)에 <b>즉시 자동 저장·기기 동기화</b>됩니다!
        </div>
      </div>

      <div class="seg" style="margin:10px 0">
        <button type="button" class="btn sm ${
          authTab === 'pkce' ? 'pri' : ''
        }" data-act="on-auth-tab" data-tab="pkce">🔐 Microsoft 계정 로그인 (PKCE)</button>
        <button type="button" class="btn sm ${
          authTab === 'token' ? 'pri' : ''
        }" data-act="on-auth-tab" data-tab="token">🔑 빠른 토큰 연결 (Graph Explorer)</button>
      </div>

      ${
        authTab === 'pkce'
          ? `
        <div class="on-auth-box">
          <div class="chips" style="margin-bottom:8px">
            <span class="note" style="align-self:center">계정 유형(테넌트):</span>
            ${TENANT_PRESETS.map(
              (p) => `
              <button
                type="button"
                class="chip ${tenantVal === p.id ? 'on' : ''}"
                data-act="on-tenant-preset"
                data-tenant="${esc(p.id)}"
              >${esc(p.label)}</button>
            `
            ).join('')}
          </div>
          <div class="menu">
            <input type="text" id="on-client-id" placeholder="Azure 앱 등록 Client ID" value="${esc(
              clientIdVal
            )}" style="flex:2;min-width:220px">
            <input type="text" id="on-tenant" placeholder="테넌트 (consumers / common)" value="${esc(
              tenantVal
            )}" style="width:150px" title="개인 계정 전용: consumers / 공통: common / 조직: organizations">
            <button type="button" class="btn sm pri" data-act="on-pkce-consumers">👤 개인 계정 전용(consumers)으로 바로 로그인</button>
            <button type="button" class="btn sm" data-act="on-pkce-login">입력값대로 로그인</button>
            <button type="button" class="btn sm pri" data-act="on-pkce-outlook" title="Outlook '메모' 폴더 동기화용 Mail.ReadWrite 권한 포함">📬 Outlook 메모 권한 포함 로그인</button>
          </div>
          <div class="note" style="margin-top:6px;line-height:1.55">
            📬 Outlook 메모(메일함 '메모' 폴더) 연동: Entra 앱 → API 권한 → Microsoft Graph → 위임된 권한 → <code>Mail.ReadWrite</code> 추가 후 위 버튼으로 다시 로그인하세요.
          </div>
          <div class="row wrap-row" style="margin-top:8px">
            <span class="note">리디렉션 URI (SPA):</span>
            <code class="mono on-uri-code">${esc(redirectUri || 'https://도메인/경로')}</code>
            <button type="button" class="btn sm" data-act="on-copy-redirect">URI 복사</button>
          </div>
          <div class="note" style="margin-top:6px;line-height:1.55">
            1) <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">Microsoft Entra 앱 등록</a> → 지원되는 계정 유형: <b>개인 Microsoft 계정</b> 포함 선택
            · 2) 인증(Authentication) → <b>단일 페이지 애플리케이션(SPA)</b>에 위 리디렉션 URI 등록
            · 3) API 사용 권한에서 <code>Notes.ReadWrite</code>, <code>User.Read</code> 추가
          </div>
        </div>
      `
          : `
        <div class="on-auth-box">
          <div class="menu">
            <input type="password" id="on-access-token" autocomplete="off" placeholder="Microsoft Graph Access Token 붙여넣기" style="flex:1;min-width:220px">
            <button type="button" class="btn sm pri" data-act="on-token-save">토큰으로 즉시 연결</button>
            <a class="btn sm" href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer">Graph Explorer ↗</a>
          </div>
          <div class="note" style="margin-top:6px;line-height:1.55">
            Azure 앱 설정이나 테넌트 제약 없이 바로 테스트하려면 <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer">Graph Explorer</a> 로그인 → Modify permissions에서 <code>Notes.ReadWrite</code> 동의 후 <b>Access token</b> 탭 값을 복사해 붙여넣으세요. (일회성 토큰은 약 1시간 후 만료됩니다.)
          </div>
        </div>
      `
      }

      ${
        isConnected
          ? `
        <div class="on-section-box">
          <div class="menu">
            <label class="note" for="on-notebook-sel">전자필기장</label>
            <select id="on-notebook-sel" data-act="on-nb-change" style="min-width:160px">
              ${
                nbList.length
                  ? nbList
                      .map(
                        (nb) =>
                          `<option value="${esc(nb.id)}" ${
                            nb.id === cfgOneNote.notebookId ? 'selected' : ''
                          }>${esc(nb.displayName || '제목 없음')}</option>`
                      )
                      .join('')
                  : `<option value="${esc(cfgOneNote.notebookId || '')}">${esc(
                      cfgOneNote.notebookName || '자동 선택 (목록 새로고침)'
                    )}</option>`
              }
            </select>
            <label class="note" for="on-section-sel">섹션</label>
            <select id="on-section-sel" data-act="on-sec-change" style="min-width:160px">
              ${
                secList.length
                  ? secList
                      .map(
                        (sec) =>
                          `<option value="${esc(sec.id)}" ${
                            sec.id === cfgOneNote.sectionId ? 'selected' : ''
                          }>${esc(sec.displayName || '제목 없음')}</option>`
                      )
                      .join('')
                  : `<option value="${esc(cfgOneNote.sectionId || '')}">${esc(
                      cfgOneNote.sectionName || '공부 계획표 메모'
                    )}</option>`
              }
            </select>
            <button type="button" class="btn sm" data-act="on-load-containers">🔄 목록 새로고침</button>
            <button type="button" class="btn sm" data-act="on-create-sec">+ 새 섹션 만들기</button>
          </div>
          <div class="row wrap-row" style="margin-top:8px">
            <label class="chk-pill">
              <input type="checkbox" data-act="on-autosync-tog" ${
                cfgOneNote.autoSync !== false ? 'checked' : ''
              }>
              앱 열 때·저장 시 OneNote 자동 양방향 동기화
            </label>
            <span class="sp"></span>
            <button type="button" class="btn sm danger" data-act="on-disconnect">연결 해제</button>
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;
}

function renderStickyCard(note, isConnected) {
  const color = normalizeStickyColor(note.color);
  const chkLines = extractCheckLines(note.content);
  const clientHref = safeOneNoteClientUrl(note.onenoteClientUrl);
  const webHref = note.onenoteWebUrl ? safeUrl(note.onenoteWebUrl) : '';

  return `
    <article class="sticky-card sticky-${color}" data-note-id="${esc(note.id)}">
      <div class="sticky-card-head">
        ${colorDotsHtml(note.id, color, 'sticky-color')}
        <span class="sp"></span>
        <button
          type="button"
          class="sticky-icon-btn ${note.pinned ? 'on' : ''}"
          data-act="note-pin"
          data-id="${esc(note.id)}"
          title="${note.pinned ? '상단 고정 해제' : '상단 고정'}"
          aria-label="고정"
        >📌</button>
        <button
          type="button"
          class="sticky-icon-btn"
          data-act="sticky-add-chk"
          data-id="${esc(note.id)}"
          title="체크리스트 줄 추가"
          aria-label="체크리스트 줄 추가"
        >☑</button>
        <button
          type="button"
          class="sticky-icon-btn"
          data-act="note-expand"
          data-id="${esc(note.id)}"
          title="상세 편집기에서 크게 보기"
          aria-label="상세 편집기 열기"
        >⤢</button>
        ${
          isConnected
            ? `<button
                type="button"
                class="sticky-icon-btn"
                data-act="note-push-one"
                data-id="${esc(note.id)}"
                title="이 메모만 OneNote로 즉시 전송"
                aria-label="OneNote 전송"
              >📤</button>`
            : ''
        }
        <button
          type="button"
          class="sticky-icon-btn danger"
          data-act="note-del"
          data-id="${esc(note.id)}"
          title="스티커 메모 삭제"
          aria-label="삭제"
        >✕</button>
      </div>

      <input
        type="text"
        class="sticky-title-in"
        data-act="sticky-title"
        data-id="${esc(note.id)}"
        value="${esc(note.title)}"
        placeholder="스티커 메모 제목..."
        aria-label="스티커 메모 제목"
      >

      <textarea
        class="sticky-body-in"
        data-act="sticky-body"
        data-id="${esc(note.id)}"
        rows="5"
        placeholder="포스트잇처럼 바로 입력하세요... ('- [ ] 항목' 입력 시 체크박스 생성)"
        aria-label="스티커 메모 본문"
      >${esc(note.content)}</textarea>

      ${
        chkLines.length
          ? `
        <div class="sticky-chk-list">
          ${chkLines
            .map(
              (c) => `
            <button
              type="button"
              class="sticky-chk-btn ${c.checked ? 'done' : ''}"
              data-act="note-chk-tog"
              data-id="${esc(note.id)}"
              data-line="${c.lineIdx}"
            >${c.checked ? '☑' : '☐'} ${esc(c.text || '(빈 항목)')}</button>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      <div class="sticky-card-foot">
        <select
          class="sticky-subj-sel"
          data-act="sticky-subj"
          data-id="${esc(note.id)}"
          aria-label="과목 태그"
        >${subjectOptionsHtml(note.subject)}</select>
        ${note.date ? `<span class="mini-pill">📅 ${esc(shortDate(note.date))}</span>` : ''}
        <span class="sp"></span>
        ${syncBadgeHtml(note, isConnected)}
      </div>

      ${
        (webHref && webHref !== '#') || clientHref
          ? `
        <div class="sticky-on-links">
          ${
            webHref && webHref !== '#'
              ? `<a class="btn sm" href="${esc(webHref)}" target="_blank" rel="noopener noreferrer">🌐 OneNote 웹에서 열기 ↗</a>`
              : ''
          }
          ${
            clientHref
              ? `<a class="btn sm" href="${esc(clientHref)}">🟣 OneNote 앱에서 열기</a>`
              : ''
          }
        </div>
      `
          : ''
      }
    </article>
  `;
}

function renderStickyBoardView({
  state,
  filteredItems,
  notesState,
  isConnected,
  filterSubj,
}) {
  const newColor = normalizeStickyColor(state.stickyNewColor || 'yellow');
  const defSubj =
    filterSubj && !['all', 'pinned', 'date'].includes(filterSubj) ? filterSubj : '일반';

  return `
    <div class="card sticky-toolbar-card">
      <div class="row wrap-row">
        <input
          type="text"
          id="note-search"
          data-act="note-search"
          placeholder="스티커 메모 제목·내용 검색..."
          value="${esc(state.notesSearch || '')}"
          style="flex:1;min-width:180px"
        >
        <div class="chips">
          <button type="button" class="chip ${filterSubj === 'all' ? 'on' : ''}" data-act="note-filter" data-f="all">전체 (${notesState.items.length})</button>
          <button type="button" class="chip ${filterSubj === 'pinned' ? 'on' : ''}" data-act="note-filter" data-f="pinned">📌 고정</button>
          <button type="button" class="chip ${filterSubj === 'date' ? 'on' : ''}" data-act="note-filter" data-f="date">📅 ${esc(shortDate(state.cur))}</button>
          ${NOTE_SUBJECTS.map(
            (s) =>
              `<button type="button" class="chip ${filterSubj === s ? 'on' : ''}" data-act="note-filter" data-f="${esc(s)}">${esc(s)}</button>`
          ).join('')}
        </div>
      </div>
    </div>

    <div class="sticky-board-grid">
      <div class="sticky-card sticky-creator-card sticky-${newColor}">
        <div class="sticky-card-head">
          <b class="card-title-sm">+ 새 스티커 메모 붙이기</b>
          <span class="sp"></span>
          ${colorDotsHtml('new', newColor, 'sticky-pick-color')}
        </div>
        <input
          type="text"
          id="sticky-quick-title"
          class="sticky-title-in"
          placeholder="제목 (비워두면 첫 줄이 제목이 됩니다)"
          aria-label="새 스티커 메모 제목"
        >
        <textarea
          id="sticky-quick-body"
          class="sticky-body-in"
          rows="4"
          placeholder="여기에 포스트잇처럼 메모를 적어 바로 보드에 붙이세요...
- [ ] 체크리스트 항목도 추가할 수 있어요"
          aria-label="새 스티커 메모 내용"
        ></textarea>
        <div class="sticky-card-foot">
          <select id="sticky-quick-subj" class="sticky-subj-sel" aria-label="새 메모 과목">
            ${subjectOptionsHtml(defSubj)}
          </select>
          <span class="sp"></span>
          <button type="button" class="btn sm pri" data-act="sticky-quick-add">📌 보드에 붙이기</button>
        </div>
      </div>

      ${
        filteredItems.length
          ? filteredItems.map((it) => renderStickyCard(it, isConnected)).join('')
          : `
        <div class="card sticky-empty-card">
          <div class="notes-empty">
            <div style="font-size:30px">🗒️</div>
            <b>검색/필터에 맞는 스티커 메모가 없어요</b>
            <div class="note">왼쪽 새 스티커 카드에 바로 메모를 적거나 필터를 '전체'로 바꿔 보세요.</div>
            ${
              filterSubj !== 'all' || state.notesSearch
                ? '<button type="button" class="btn sm" data-act="note-filter" data-f="all">전체 메모 보기</button>'
                : ''
            }
          </div>
        </div>
      `
      }
    </div>
  `;
}

function renderSplitEditorView({
  state,
  filteredItems,
  activeNote,
  notesState,
  isConnected,
  filterSubj,
}) {
  const chkLines = activeNote ? extractCheckLines(activeNote.content) : [];
  const clientHref = activeNote ? safeOneNoteClientUrl(activeNote.onenoteClientUrl) : '';
  const webHref = activeNote && activeNote.onenoteWebUrl ? safeUrl(activeNote.onenoteWebUrl) : '';
  const activeColor = activeNote ? normalizeStickyColor(activeNote.color) : 'yellow';

  return `
    <div class="notes-layout">
      <div class="card notes-list-card">
        <div class="row wrap-row">
          <input type="text" id="note-search" data-act="note-search" placeholder="메모 제목·내용 검색..." value="${esc(
            state.notesSearch || ''
          )}" style="flex:1;min-width:150px">
          <span class="note mono">${filteredItems.length}/${notesState.items.length}</span>
        </div>

        <div class="chips" style="margin:10px 0 8px">
          <button type="button" class="chip ${filterSubj === 'all' ? 'on' : ''}" data-act="note-filter" data-f="all">전체</button>
          <button type="button" class="chip ${filterSubj === 'pinned' ? 'on' : ''}" data-act="note-filter" data-f="pinned">📌 고정</button>
          <button type="button" class="chip ${filterSubj === 'date' ? 'on' : ''}" data-act="note-filter" data-f="date">📅 ${esc(shortDate(state.cur))}</button>
          ${NOTE_SUBJECTS.map(
            (s) =>
              `<button type="button" class="chip ${filterSubj === s ? 'on' : ''}" data-act="note-filter" data-f="${esc(s)}">${esc(s)}</button>`
          ).join('')}
        </div>

        <div class="notes-list-items">
          ${
            filteredItems.length
              ? filteredItems
                  .map((it) => {
                    const isActive = activeNote && activeNote.id === it.id;
                    const itColor = normalizeStickyColor(it.color);
                    const colorObj = STICKY_COLORS.find((c) => c.id === itColor) || STICKY_COLORS[0];
                    const preview =
                      String(it.content || '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 72) || '(내용 없음)';
                    return `
                      <button type="button" class="note-list-item ${
                        isActive ? 'active' : ''
                      }" data-act="note-sel" data-id="${esc(it.id)}">
                        <div class="row wrap-row">
                          <span class="sticky-mini-swatch" style="background:${colorObj.hex}" title="${esc(colorObj.label)}"></span>
                          ${it.pinned ? '<span class="mini-pill">📌</span>' : ''}
                          <span class="cat-badge">${esc(it.subject)}</span>
                          ${it.date ? `<span class="mini-pill">${esc(shortDate(it.date))}</span>` : ''}
                          <span class="sp"></span>
                          ${syncBadgeHtml(it, isConnected)}
                        </div>
                        <div class="note-list-title">${esc(it.title)}</div>
                        <div class="note-list-preview">${esc(preview)}</div>
                      </button>
                    `;
                  })
                  .join('')
              : `<div class="note" style="padding:18px 4px">표시할 메모가 없어요. <b>+ 새 메모</b>를 눌러 작성하거나 OneNote에서 가져와 보세요.</div>`
          }
        </div>
      </div>

      <div class="card notes-editor-card sticky-editor-tint-${activeColor}">
        ${
          activeNote
            ? `
          <div class="row wrap-row">
            <input type="text" id="note-title" placeholder="메모 제목" value="${esc(
              activeNote.title
            )}" style="flex:1;min-width:180px;font-weight:700">
            ${colorDotsHtml(activeNote.id, activeColor, 'sticky-color')}
            <button type="button" class="btn sm ${
              activeNote.pinned ? 'pri' : ''
            }" data-act="note-pin" data-id="${esc(activeNote.id)}">${
                activeNote.pinned ? '📌 고정됨' : '📌 고정'
              }</button>
            <button type="button" class="btn sm danger" data-act="note-del" data-id="${esc(
              activeNote.id
            )}">삭제</button>
          </div>

          <div class="menu" style="margin-top:10px">
            <select id="note-subj" data-id="${esc(activeNote.id)}">
              ${subjectOptionsHtml(activeNote.subject)}
            </select>
            <input type="date" id="note-date" value="${esc(activeNote.date || '')}" title="연결할 학습 날짜(선택)">
            <button type="button" class="btn sm" data-act="note-date-today">오늘 날짜</button>
            <span class="sp"></span>
            <span class="note">${esc(noteStatusText(activeNote))}</span>
          </div>

          <div class="chips" style="margin-top:10px">
            <button type="button" class="chip" data-act="note-tpl" data-tpl="wrong">+ 오답노트 양식</button>
            <button type="button" class="chip" data-act="note-tpl" data-tpl="setuk">+ 세특·탐구 양식</button>
            <button type="button" class="chip" data-act="note-tpl" data-tpl="checklist">+ 체크리스트</button>
          </div>

          <textarea id="note-body" class="note-textarea" rows="12" placeholder="여기에 메모를 작성하세요. '- [ ] 할 일' 형식으로 적으면 OneNote 체크박스와 양방향으로 호환됩니다.">${esc(
            activeNote.content
          )}</textarea>

          ${
            chkLines.length
              ? `
            <div class="note-chk-box">
              <div class="note" style="margin-bottom:6px">빠른 체크리스트 (클릭해서 완료 체크):</div>
              <div class="chips">
                ${chkLines
                  .map(
                    (c) => `
                  <button type="button" class="chip ${
                    c.checked ? 'on' : ''
                  }" data-act="note-chk-tog" data-id="${esc(activeNote.id)}" data-line="${
                      c.lineIdx
                    }">${c.checked ? '☑' : '☐'} ${esc(c.text || '(빈 항목)')}</button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <div class="row wrap-row" style="margin-top:14px">
            <button type="button" class="btn pri" data-act="note-save" data-id="${esc(
              activeNote.id
            )}">💾 저장${isConnected ? ' & OneNote 동기화' : ''}</button>
            ${
              isConnected
                ? `<button type="button" class="btn" data-act="note-push-one" data-id="${esc(
                    activeNote.id
                  )}">📤 이 메모만 즉시 OneNote로 전송</button>`
                : ''
            }
            <span class="sp"></span>
            ${
              webHref && webHref !== '#'
                ? `<a class="btn sm" href="${esc(
                    webHref
                  )}" target="_blank" rel="noopener noreferrer">🌐 OneNote 웹에서 열기 ↗</a>`
                : ''
            }
            ${
              clientHref
                ? `<a class="btn sm" href="${esc(clientHref)}">🟣 OneNote 앱에서 열기</a>`
                : ''
            }
          </div>
        `
            : `
          <div class="notes-empty">
            <div style="font-size:28px">🗒️</div>
            <b>작성된 메모가 없어요</b>
            <div class="note">스티커 메모와 학습 오답을 남기고 Microsoft OneNote와 양방향으로 동기화해 보세요.</div>
            <button type="button" class="btn pri" data-act="note-new">+ 첫 메모 작성하기</button>
          </div>
        `
        }
      </div>
    </div>
  `;
}

export function renderNotesView(state) {
  const cfgOneNote = {
    ...defaultOneNoteConfig(),
    ...((state.cfg && state.cfg.onenote) || {}),
  };
  const auth = state.oneNoteAuth !== undefined ? state.oneNoteAuth : getOneNoteAuth();
  const isConnected = Boolean(auth && (auth.accessToken || auth.refreshToken));
  const notesState = normalizeNotesState(state.notes);
  const viewMode = state.notesViewMode === 'split' ? 'split' : 'sticky';

  const sortedItems = notesState.items
    .slice()
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    );

  const searchQ = String(state.notesSearch || '').trim().toLowerCase();
  const filterSubj = state.notesFilterSubj || 'all';

  const filteredItems = sortedItems.filter((it) => {
    if (filterSubj === 'pinned' && !it.pinned) return false;
    if (filterSubj === 'date' && it.date !== state.cur) return false;
    if (
      filterSubj !== 'all' &&
      filterSubj !== 'pinned' &&
      filterSubj !== 'date' &&
      it.subject !== filterSubj
    ) {
      return false;
    }
    if (!searchQ) return true;
    const hay = `${it.title}\n${it.content}\n${it.subject}`.toLowerCase();
    return hay.includes(searchQ);
  });

  const activeNote =
    sortedItems.find((x) => x.id === state.notesSelectedId) ||
    filteredItems[0] ||
    sortedItems[0] ||
    null;

  const targetSectionLabel =
    cfgOneNote.notebookName || cfgOneNote.sectionName
      ? `${cfgOneNote.notebookName ? cfgOneNote.notebookName + ' / ' : ''}${
          cfgOneNote.sectionName || '공부 계획표 메모'
        }`
      : '공부 계획표 메모';

  const lastSyncStr = notesState.lastFullSyncAt
    ? String(notesState.lastFullSyncAt).slice(0, 16).replace('T', ' ')
    : '';

  return `
    <div class="card onenote-hero">
      <div class="row wrap-row">
        <div class="on-hero-title">
          <div class="row wrap-row">
            <b class="card-title-md">🗒️ 스티커 메모 &amp; Microsoft OneNote 양방향 메모장</b>
            ${
              isConnected
                ? `<span class="tag note-on-tag">🟣 OneNote 양방향 연결됨 · ${esc(
                    targetSectionLabel
                  )}</span>`
                : '<span class="bdg">🟡 클라우드 스티커 메모 모드 (로그인 없이도 즉시 저장)</span>'
            }
          </div>
          <div class="note" style="margin-top:4px">
            ${
              state.notesSyncMsg
                ? esc(state.notesSyncMsg)
                : lastSyncStr
                  ? `마지막 양방향 동기화: ${esc(lastSyncStr)} · 총 스티커 메모 ${notesState.items.length}개`
                  : `포스트잇처럼 색상을 골라 바로 메모하면 웹·모바일에 즉시 자동 저장되며, OneNote 연결 시 양방향 동기화됩니다.`
            }
          </div>
        </div>
        <div class="menu">
          <div class="seg">
            <button type="button" class="btn sm ${
              viewMode === 'sticky' ? 'pri' : ''
            }" data-act="note-view-mode" data-mode="sticky">🗒️ 스티커 보드</button>
            <button type="button" class="btn sm ${
              viewMode === 'split' ? 'pri' : ''
            }" data-act="note-view-mode" data-mode="split">📑 상세 편집</button>
          </div>
          <button type="button" class="btn sm pri" data-act="on-sync" ${
            state.notesSyncing ? 'disabled' : ''
          }>${state.notesSyncing ? '⏳ 동기화 중...' : '🔄 OneNote 동기화'}</button>
          <button type="button" class="btn sm" data-act="ol-sync" ${
            state.notesSyncing ? 'disabled' : ''
          }>📬 Outlook 메모 동기화</button>
          <button type="button" class="btn sm" data-act="on-connect-tog">${
            state.notesConnectOpen ? '설정 닫기' : '⚙️ Microsoft 연결 설정'
          }</button>
          <a class="btn sm" href="https://www.onenote.com/stickynotes" target="_blank" rel="noopener noreferrer" title="Microsoft 웹 스티커 메모 열기">MS 스티커 웹 ↗</a>
          <button type="button" class="btn sm" data-act="note-new">+ 새 메모</button>
        </div>
      </div>

      ${
        state.notesConnectOpen
          ? renderConnectPanel({
              cfgOneNote,
              auth,
              isConnected,
              authTab: state.notesAuthTab || 'pkce',
              notebooks: state.notesNotebooks,
              sections: state.notesSections,
            })
          : ''
      }
    </div>

    ${
      viewMode === 'sticky'
        ? renderStickyBoardView({
            state,
            filteredItems,
            notesState,
            isConnected,
            filterSubj,
          })
        : renderSplitEditorView({
            state,
            filteredItems,
            activeNote,
            notesState,
            isConnected,
            filterSubj,
          })
    }
  `;
}

export function renderTodayNoteWidget(state) {
  const notesState = normalizeNotesState(state.notes);
  const auth = state.oneNoteAuth !== undefined ? state.oneNoteAuth : getOneNoteAuth();
  const isConnected = Boolean(auth && (auth.accessToken || auth.refreshToken));
  const targetDate = state.cur;
  const pickColor = normalizeStickyColor(state.stickyNewColor || 'yellow');

  const dateNotes = notesState.items.filter((x) => x.date === targetDate);
  const displayNotes = (
    dateNotes.length
      ? dateNotes
      : notesState.items
          .slice()
          .sort(
            (a, b) =>
              (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
              String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
          )
  ).slice(0, 4);

  return `
    <div class="card sticky-widget-card">
      <div class="row wrap-row">
        <b class="card-title-sm">🗒️ ${esc(lab(targetDate))} 스티커 메모</b>
        <span class="sp"></span>
        ${colorDotsHtml('widget', pickColor, 'sticky-pick-color')}
        ${
          isConnected
            ? '<span class="mini-pill note-on-badge">🟣 연동됨</span>'
            : '<span class="mini-pill">클라우드 저장</span>'
        }
      </div>
      <div class="row" style="margin-top:8px">
        <input type="text" id="today-quick-note" placeholder="포스트잇 한 줄 메모..." style="flex:1;min-width:120px">
        <button type="button" class="btn sm pri" data-act="note-today-add">+ 붙이기</button>
      </div>
      ${
        displayNotes.length
          ? `<div class="today-sticky-grid">
              ${displayNotes
                .map((n) => {
                  const nColor = normalizeStickyColor(n.color);
                  const preview = String(n.content || '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 56);
                  return `
                <button type="button" class="mini-sticky-card sticky-${nColor}" data-act="note-open" data-id="${esc(
                    n.id
                  )}">
                  <div class="row wrap-row">
                    ${n.pinned ? '<span>📌</span>' : ''}
                    <span class="cat-badge">${esc(n.subject)}</span>
                    <span class="sp"></span>
                    ${n.onenotePageId ? '<span class="note">🟣</span>' : ''}
                  </div>
                  <div class="mini-sticky-title">${esc(n.title)}</div>
                  ${preview ? `<div class="mini-sticky-preview">${esc(preview)}</div>` : ''}
                </button>
              `;
                })
                .join('')}
            </div>`
          : '<div class="note" style="margin-top:8px">아직 붙인 스티커 메모가 없어요. 위 칸에 적어 붙여 보세요!</div>'
      }
      <div class="row" style="margin-top:10px">
        <span class="note mono">전체 스티커 ${notesState.items.length}장</span>
        <span class="sp"></span>
        <button type="button" class="btn sm" data-v="notes">🗒️ 스티커 보드 전체 열기</button>
      </div>
    </div>
  `;
}

export function renderHomeStickyWidget(state) {
  const notesState = normalizeNotesState(state.notes);
  const pickColor = normalizeStickyColor(state.stickyNewColor || 'yellow');
  const displayNotes = notesState.items
    .slice()
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )
    .slice(0, 6);

  return `
    <div class="card home-sticky-strip">
      <div class="row wrap-row">
        <b class="card-title-md">🗒️ 빠른 스티커 메모 보드</b>
        ${colorDotsHtml('home', pickColor, 'sticky-pick-color')}
        <span class="sp"></span>
        <span class="note mono">${notesState.items.length}장 저장됨</span>
        <button type="button" class="btn sm pri" data-v="notes">스티커 보드 열기 →</button>
      </div>
      <div class="row wrap-row" style="margin-top:10px">
        <input type="text" id="today-quick-note" placeholder="떠오른 생각·할 일·오답 포인트를 바로 포스트잇으로 붙이세요..." style="flex:1;min-width:200px">
        <button type="button" class="btn sm pri" data-act="note-today-add">+ 스티커 붙이기</button>
      </div>
      ${
        displayNotes.length
          ? `<div class="home-sticky-grid">
              ${displayNotes
                .map((n) => {
                  const nColor = normalizeStickyColor(n.color);
                  const preview = String(n.content || '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 70);
                  return `
                <button type="button" class="mini-sticky-card sticky-${nColor}" data-act="note-open" data-id="${esc(
                    n.id
                  )}">
                  <div class="row wrap-row">
                    ${n.pinned ? '<span>📌</span>' : ''}
                    <span class="cat-badge">${esc(n.subject)}</span>
                    ${n.date ? `<span class="mini-pill">${esc(shortDate(n.date))}</span>` : ''}
                  </div>
                  <div class="mini-sticky-title">${esc(n.title)}</div>
                  ${preview ? `<div class="mini-sticky-preview">${esc(preview)}</div>` : ''}
                </button>
              `;
                })
                .join('')}
            </div>`
          : '<div class="note" style="margin-top:10px">아직 붙인 스티커 메모가 없어요. 위 입력란에 적고 엔터를 눌러 첫 포스트잇을 붙여 보세요!</div>'
      }
    </div>
  `;
}
