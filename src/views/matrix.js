import { lab, shortDate } from '../core/date.js';
import { esc } from '../core/html.js';
import { QUAD_ORDER, QUADRANTS, buildMatrixBoard } from '../core/matrix.js';
import { GENERAL_CATS, SC, fmt } from '../core/units.js';

export function renderMatrix(state) {
  const { plans, cfg, matrix, REAL, matrixUndo, matrixAdding, matrixDoneOpen } =
    state;
  const { quads, doneTodos, rules } = buildMatrixBoard({
    plans,
    cfg,
    matrixState: matrix,
    todayIso: REAL,
  });

  const totalActive =
    quads.q1.length + quads.q2.length + quads.q3.length + quads.q4.length;

  let h = `
    <div class="card">
      <div class="row wrap-row">
        <div>
          <b class="card-title-md">🧭 아이젠하워 매트릭스</b>
          <div class="note">
            공부 계획(오늘·내일·밀림) + 할 일 총 <b>${totalActive}개</b> ·
            긴급 기준: 마감 ${rules.urgentDays}일 이내 / 시험 ${rules.examUrgentDays}일 이내
          </div>
        </div>
        <span class="sp"></span>
        <div class="menu" style="margin:0">
          <button type="button" class="btn sm" data-act="mxundo" ${
            matrixUndo && matrixUndo.length ? '' : 'disabled'
          }>↶ 되돌리기${
            matrixUndo && matrixUndo.length ? ` (${matrixUndo.length})` : ''
          }</button>
          <button type="button" class="btn sm" data-v="set">규칙 설정 ⚙</button>
          <button type="button" class="btn sm pri" data-act="mxaddtog">${
            matrixAdding ? '닫기' : '+ 할 일 추가'
          }</button>
        </div>
      </div>

      ${
        matrixAdding
          ? `<div class="hub-form" style="margin-top:10px">
              <div class="menu">
                <select id="mx-cat">
                  ${GENERAL_CATS.map((c) => `<option value="${c}">${c}</option>`).join(
                    ''
                  )}
                </select>
                <input type="text" id="mx-title" placeholder="할 일 (예: 수학 세특 보고서 초안)" style="flex:1;min-width:170px">
                <input type="date" id="mx-due" title="마감일(선택)">
                <label class="chk-pill"><input type="checkbox" id="mx-imp"> ★ 중요</label>
                <button type="button" class="btn sm pri" data-act="mxaddsave">추가</button>
              </div>
              <div class="note" style="margin-top:4px">
                마감일, 세특·수행평가 키워드, 중요(★)에 따라 자동으로 4분면에 배치돼요.
              </div>
            </div>`
          : ''
      }
    </div>

    <div class="mx-grid">
      ${QUAD_ORDER.map((qid) => {
        const q = QUADRANTS[qid];
        const list = quads[qid];
        return `
          <div class="card mx-quad mx-${q.tone}" data-qdrop="${qid}">
            <div class="mx-qhead">
              <div>
                <b>${q.title}</b>
                <span class="note">${q.sub}</span>
              </div>
              <span class="bdg">${list.length}</span>
            </div>
            <div class="mx-list">
              ${
                list.length
                  ? list
                      .map((item) => {
                        const cVar = SC[item.subject]
                          ? SC[item.subject][0]
                          : '--mute';
                        return `
                          <div class="mx-item ${
                            item.manual ? 'is-manual' : ''
                          }" draggable="true" data-mxkey="${esc(item.key)}">
                            <div class="mx-item-top">
                              <input type="checkbox" data-act="mxtog" data-src="${
                                item.source
                              }" data-id="${esc(item.id)}" data-d="${esc(
                                item.planDate || ''
                              )}" aria-label="완료">
                              <span class="subj-dot" style="background:var(${cVar})"></span>
                              <div class="mx-item-title">
                                ${
                                  item.source === 'plan' && item.bookId !== '일반할일'
                                    ? `<button type="button" class="book-link" data-act="bookpop" data-b="${esc(
                                        item.bookId
                                      )}">${esc(item.title)}</button>`
                                    : `<span>${esc(item.title)}</span>`
                                }
                              </div>
                              <button type="button" class="star-btn ${
                                item.important ? 'on' : ''
                              }" data-act="mximp" data-src="${
                                item.source
                              }" data-id="${esc(item.id)}" data-d="${esc(
                                item.planDate || ''
                              )}" title="중요 표시">★</button>
                            </div>

                            <div class="mx-tags">
                              ${
                                item.manual
                                  ? '<span class="mini-pill manual">수동</span>'
                                  : '<span class="mini-pill auto">자동</span>'
                              }
                              ${
                                item.source === 'plan'
                                  ? `<span class="mini-pill">${shortDate(
                                      item.planDate
                                    )} 계획${
                                      item.p ? ` · ${fmt(item.p)}P` : ''
                                    }</span>`
                                  : `<span class="mini-pill">${esc(
                                      item.cat || '할일'
                                    )}</span>`
                              }
                              ${
                                item.due
                                  ? `<span class="mini-pill due">마감 ${shortDate(
                                      item.due
                                    )}</span>`
                                  : ''
                              }
                              ${item.reasons
                                .slice(0, 3)
                                .map(
                                  (r) => `<span class="mini-pill reason">${esc(r)}</span>`
                                )
                                .join('')}
                            </div>

                            <div class="mx-actions">
                              <div class="mx-move-btns" role="group" aria-label="사분면 이동">
                                ${QUAD_ORDER.map(
                                  (targetQ, idx) => `
                                  <button type="button" class="btn sm ${
                                    item.quad === targetQ ? 'pri' : ''
                                  }" data-act="mxmv" data-key="${esc(
                                    item.key
                                  )}" data-q="${targetQ}" title="${
                                    QUADRANTS[targetQ].title
                                  }로 이동">${idx + 1}</button>
                                `
                                ).join('')}
                              </div>
                              <span class="sp"></span>
                              ${
                                item.manual
                                  ? `<button type="button" class="btn sm" data-act="mxauto" data-key="${esc(
                                      item.key
                                    )}">↺ 자동</button>`
                                  : ''
                              }
                              ${
                                item.source === 'plan'
                                  ? `<button type="button" class="btn sm" data-act="goto" data-d="${esc(
                                      item.planDate
                                    )}" data-v2="today">열기</button>`
                                  : `<button type="button" class="btn sm danger" data-act="mxdel" data-id="${esc(
                                      item.id
                                    )}">삭제</button>`
                              }
                            </div>
                          </div>
                        `;
                      })
                      .join('')
                  : '<div class="mx-empty note">여기로 카드를 끌어다 놓거나 1~4 버튼으로 옮길 수 있어요.</div>'
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (doneTodos.length) {
    h += `
      <div class="card">
        <div class="row">
          <b class="card-title-sm">완료한 할 일 (${doneTodos.length}개)</b>
          <span class="sp"></span>
          <button type="button" class="btn sm" data-act="mxdonetog">${
            matrixDoneOpen ? '접기' : '보기'
          }</button>
        </div>
        ${
          matrixDoneOpen
            ? `<div style="margin-top:8px">
                ${doneTodos
                  .map(
                    (t) => `
                  <div class="it done">
                    <input type="checkbox" checked data-act="mxtog" data-src="todo" data-id="${esc(
                      t.id
                    )}">
                    <div class="tx">
                      <div><span class="cat-badge">${esc(
                        t.cat || '일반'
                      )}</span> <span class="it-title-text">${esc(
                        t.title
                      )}</span></div>
                      ${
                        t.done_date
                          ? `<div class="note">완료 ${lab(t.done_date)}</div>`
                          : ''
                      }
                    </div>
                    <button type="button" class="btn sm danger" data-act="mxdel" data-id="${esc(
                      t.id
                    )}">삭제</button>
                  </div>
                `
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>
    `;
  }

  return h;
}
