import { esc, safeUrl } from '../core/html.js';
import { lab, shortDate } from '../core/date.js';
import {
  defaultOneNoteConfig,
  normalizeNotesState,
  safeOneNoteClientUrl,
} from '../core/onenote.js';
import { getOneNoteAuth, getOneNoteRedirectUri } from '../services/onenote.js';

export const NOTE_SUBJECTS = ['일반', '수학', '물리', '화학', '영어', '학교·할일'];

export const NOTE_TEMPLATES = {
  wrong: '[문항 번호] \n[틀린 이유] \n[핵심 개념·풀이] \n- [ ] 다시 풀어보기',
  setuk: '[교과/단원] \n[탐구 주제] \n[배운 점·심화 내용] \n- [ ] 보고서 초안 정리',
  checklist: '- [ ] 핵심 개념 복습\n- [ ] 오답 문항 재풀이\n- [ ] 질문할 내용 정리',
};

function syncBadgeHtml(note, isConnected) {
  if (note.dirty && isConnected) {
    return '<span class="mini-pill due">✏️ 동기화 대기</span>';
  }
  if (note.onenotePageId) {
    return '<span class="mini-pill note-on-badge">🟣 OneNote 동기화됨</span>';
  }
  return '<span class="mini-pill">☁️ 웹 저장됨</span>';
}

function noteStatusText(note) {
  if (note.dirty) return '웹에 임시/저장됨 · OneNote 반영 대기';
  if (note.lastSyncedAt) {
    return `마지막 동기화: ${String(note.lastSyncedAt).slice(0, 16).replace('T', ' ')}`;
  }
  return `수정: ${String(note.updatedAt || '').slice(0, 16).replace('T', ' ')}`;
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

      <div class="seg" style="margin-bottom:10px">
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
          <div class="menu">
            <input type="text" id="on-client-id" placeholder="Azure 앱 등록 Client ID (예: xxxxxxxx-xxxx-...)" value="${esc(
              cfgOneNote.clientId || ''
            )}" style="flex:2;min-width:220px">
            <input type="text" id="on-tenant" placeholder="테넌트 (기본: common)" value="${esc(
              cfgOneNote.tenant || 'common'
            )}" style="width:130px" title="개인/학교 계정 모두 허용 시 common">
            <button type="button" class="btn sm pri" data-act="on-pkce-login">🟣 Microsoft 계정으로 로그인</button>
          </div>
          <div class="row wrap-row" style="margin-top:8px">
            <span class="note">리디렉션 URI (SPA):</span>
            <code class="mono on-uri-code">${esc(redirectUri || 'https://도메인/경로')}</code>
            <button type="button" class="btn sm" data-act="on-copy-redirect">URI 복사</button>
          </div>
          <div class="note" style="margin-top:6px;line-height:1.55">
            1) <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">Microsoft Entra 앱 등록</a> → 새 등록 (지원되는 계정 유형: 개인 Microsoft 계정 포함)
            · 2) 인증(Authentication) → 플랫폼 추가 → <b>단일 페이지 애플리케이션(SPA)</b>에 위 리디렉션 URI 등록
            · 3) API 사용 권한에서 Microsoft Graph <code>Notes.ReadWrite</code>, <code>User.Read</code> 추가 후 Client ID 입력
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
            Azure 앱 설정 없이 테스트하려면 <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer">Graph Explorer</a> 로그인 → Modify permissions에서 <code>Notes.ReadWrite</code> 동의 후 <b>Access token</b> 탭 값을 복사해 붙여넣으세요. (일회성 토큰은 약 1시간 후 만료됩니다.)
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

export function renderNotesView(state) {
  const cfgOneNote = {
    ...defaultOneNoteConfig(),
    ...((state.cfg && state.cfg.onenote) || {}),
  };
  const auth = state.oneNoteAuth !== undefined ? state.oneNoteAuth : getOneNoteAuth();
  const isConnected = Boolean(auth && (auth.accessToken || auth.refreshToken));
  const notesState = normalizeNotesState(state.notes);

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

  const chkLines = activeNote
    ? activeNote.content
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
        .filter(Boolean)
    : [];

  const targetSectionLabel =
    cfgOneNote.notebookName || cfgOneNote.sectionName
      ? `${cfgOneNote.notebookName ? cfgOneNote.notebookName + ' / ' : ''}${
          cfgOneNote.sectionName || '공부 계획표 메모'
        }`
      : '공부 계획표 메모';

  const lastSyncStr = notesState.lastFullSyncAt
    ? String(notesState.lastFullSyncAt).slice(0, 16).replace('T', ' ')
    : '';

  const clientHref = activeNote ? safeOneNoteClientUrl(activeNote.onenoteClientUrl) : '';
  const webHref = activeNote && activeNote.onenoteWebUrl ? safeUrl(activeNote.onenoteWebUrl) : '';

  return `
    <div class="card onenote-hero">
      <div class="row wrap-row">
        <div class="on-hero-title">
          <div class="row wrap-row">
            <b class="card-title-md">📓 Microsoft OneNote 양방향 메모장</b>
            ${
              isConnected
                ? `<span class="tag note-on-tag">🟣 OneNote 양방향 연결됨 · ${esc(
                    targetSectionLabel
                  )}</span>`
                : '<span class="bdg">⚪ 클라우드 단독 모드 (OneNote 연결 전)</span>'
            }
          </div>
          <div class="note" style="margin-top:4px">
            ${
              state.notesSyncMsg
                ? esc(state.notesSyncMsg)
                : lastSyncStr
                  ? `마지막 양방향 동기화: ${esc(lastSyncStr)} · 총 메모 ${notesState.items.length}개`
                  : `웹에서 작성한 메모는 Cloudflare에 자동 저장되며, OneNote 연결 시 PC/태블릿 OneNote와 양방향 동기화됩니다.`
            }
          </div>
        </div>
        <div class="menu">
          <button type="button" class="btn pri" data-act="on-sync" ${
            state.notesSyncing ? 'disabled' : ''
          }>${state.notesSyncing ? '⏳ 동기화 중...' : '🔄 지금 양방향 동기화'}</button>
          <button type="button" class="btn" data-act="on-connect-tog">${
            state.notesConnectOpen ? '설정 닫기' : '⚙️ OneNote 연결·섹션 설정'
          }</button>
          <button type="button" class="btn" data-act="note-new">+ 새 메모</button>
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

    <div class="notes-layout">
      <div class="card notes-list-card">
        <div class="row wrap-row">
          <input type="text" id="note-search" data-act="note-search" placeholder="메모 제목·내용 검색..." value="${esc(
            state.notesSearch || ''
          )}" style="flex:1;min-width:150px">
          <span class="note mono">${filteredItems.length}/${notesState.items.length}</span>
        </div>

        <div class="chips" style="margin:10px 0 8px">
          <button type="button" class="chip ${
            filterSubj === 'all' ? 'on' : ''
          }" data-act="note-filter" data-f="all">전체</button>
          <button type="button" class="chip ${
            filterSubj === 'pinned' ? 'on' : ''
          }" data-act="note-filter" data-f="pinned">📌 고정</button>
          <button type="button" class="chip ${
            filterSubj === 'date' ? 'on' : ''
          }" data-act="note-filter" data-f="date">📅 ${esc(shortDate(state.cur))}</button>
          ${NOTE_SUBJECTS.map(
            (s) =>
              `<button type="button" class="chip ${
                filterSubj === s ? 'on' : ''
              }" data-act="note-filter" data-f="${esc(s)}">${esc(s)}</button>`
          ).join('')}
        </div>

        <div class="notes-list-items">
          ${
            filteredItems.length
              ? filteredItems
                  .map((it) => {
                    const isActive = activeNote && activeNote.id === it.id;
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
                          ${it.pinned ? '<span class="mini-pill">📌</span>' : ''}
                          <span class="cat-badge">${esc(it.subject)}</span>
                          ${
                            it.date
                              ? `<span class="mini-pill">${esc(shortDate(it.date))}</span>`
                              : ''
                          }
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

      <div class="card notes-editor-card">
        ${
          activeNote
            ? `
          <div class="row wrap-row">
            <input type="text" id="note-title" placeholder="메모 제목" value="${esc(
              activeNote.title
            )}" style="flex:1;min-width:180px;font-weight:700">
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
              ${[
                ...NOTE_SUBJECTS,
                ...(NOTE_SUBJECTS.includes(activeNote.subject) ? [] : [activeNote.subject]),
              ]
                .map(
                  (s) =>
                    `<option value="${esc(s)}" ${
                      activeNote.subject === s ? 'selected' : ''
                    }>${esc(s)}</option>`
                )
                .join('')}
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
            <div style="font-size:28px">📓</div>
            <b>작성된 메모가 없어요</b>
            <div class="note">학습 오답, 세특 아이디어, 체크리스트를 웹에서 남기고 OneNote와 양방향으로 동기화해 보세요.</div>
            <button type="button" class="btn pri" data-act="note-new">+ 첫 메모 작성하기</button>
          </div>
        `
        }
      </div>
    </div>
  `;
}

export function renderTodayNoteWidget(state) {
  const notesState = normalizeNotesState(state.notes);
  const auth = state.oneNoteAuth !== undefined ? state.oneNoteAuth : getOneNoteAuth();
  const isConnected = Boolean(auth && (auth.accessToken || auth.refreshToken));
  const targetDate = state.cur;

  const dateNotes = notesState.items.filter((x) => x.date === targetDate);
  const displayNotes = (
    dateNotes.length
      ? dateNotes
      : notesState.items
          .slice()
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  ).slice(0, 3);

  return `
    <div class="card glass-tint-purple">
      <div class="row wrap-row">
        <b class="card-title-sm">📓 ${esc(lab(targetDate))} 원노트 빠른 메모</b>
        <span class="sp"></span>
        ${
          isConnected
            ? '<span class="mini-pill note-on-badge">🟣 연동됨</span>'
            : '<span class="mini-pill">클라우드 저장</span>'
        }
      </div>
      <div class="row" style="margin-top:8px">
        <input type="text" id="today-quick-note" placeholder="한 줄 메모 남기기..." style="flex:1;min-width:120px">
        <button type="button" class="btn sm pri" data-act="note-today-add">메모 추가</button>
      </div>
      ${
        displayNotes.length
          ? `<div class="today-note-list">
              ${displayNotes
                .map(
                  (n) => `
                <button type="button" class="today-note-row" data-act="note-open" data-id="${esc(
                    n.id
                  )}">
                  <span class="cat-badge">${esc(n.subject)}</span>
                  <span class="today-note-title">${esc(n.title)}</span>
                  ${n.onenotePageId ? '<span class="note">🟣</span>' : ''}
                </button>
              `
                )
                .join('')}
            </div>`
          : '<div class="note" style="margin-top:8px">이 날 연결된 메모가 아직 없어요.</div>'
      }
      <div class="row" style="margin-top:10px">
        <span class="note mono">전체 메모 ${notesState.items.length}개</span>
        <span class="sp"></span>
        <button type="button" class="btn sm" data-v="notes">📓 원노트 메모장 열기</button>
      </div>
    </div>
  `;
}
