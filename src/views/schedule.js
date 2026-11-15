import {
  WD_EN,
  WD_KO,
  addDay,
  addMonth,
  diffDays,
  lab,
  monthInfo,
  shortDate,
  weekDatesOf,
} from '../core/date.js';
import {
  ALL_SUBJ,
  BNAME,
  CL,
  DEF_DD,
  GENERAL_BOOK,
  GENERAL_CATS,
  PB,
  SC,
  SH,
  STUDY_BOOKS,
  STUDY_SUBJ,
  UNIT,
  capOf,
  doneDateOf,
  fmt,
  getBookProgress,
  isGeneralItem,
  itemLabelPrefix,
  itemP,
  liveItems,
  parseUnits,
  planDates,
  remainByBook,
  sumP,
  weightOf,
} from '../core/units.js';
import { carryRuleOf, getOverdueItems, planClose } from '../core/carry.js';
import { esc } from '../core/html.js';
import { resolveMatrixRules } from '../core/matrix.js';

const WARN_P = 80;
const HIGH_P = 100;
const BAR_PX = 84;
const MODE_LABEL = {
  ask: '물어보기',
  auto: '자동으로 밀기',
  drop: '이월 안 함',
};

function gaugeHtml(dateIso, plans, cfg) {
  const items = plans[dateIso] || [];
  const tot = sumP(items, cfg);
  const cap = capOf(dateIso, plans, cfg);
  const pct = Math.min(100, (tot / Math.max(cap, 1)) * 100);
  const cls = tot > 100 ? 'bad' : tot > cap ? 'warn' : '';
  const doneP = sumP(items, cfg, (i) => i.done);
  const tag =
    tot > 100
      ? '<span class="tag b">과부하</span>'
      : tot > cap
        ? '<span class="tag w">기준 초과</span>'
        : '<span class="tag">여유</span>';

  return `
    <div class="gauge ${cls}"><i style="width:${pct}%"></i></div>
    <div class="row note">
      <span class="mono">부하 ${tot} / 기준 ${cap}P · 완료 ${doneP}P</span>
      <span class="sp"></span>
      ${tag}
    </div>
  `;
}

function askFormHtml(dateIso, it, state) {
  const { asking, askMsg } = state;
  if (!asking || asking.d !== dateIso || asking.id !== it.id) return '';
  const u = parseUnits(it);
  const ex = u ? u[Math.min(1, u.length - 1)].p + u[Math.min(1, u.length - 1)].n : '443';
  return `
    <div class="ask-box">
      <div class="menu">
        <input type="text" id="ak" value="" placeholder="마지막으로 푼 번호 (예: ${esc(ex)})" inputmode="text" autocomplete="off">
        <button type="button" class="btn sm pri" data-act="askok">여기까지</button>
        <button type="button" class="btn sm" data-act="askall">전부 완료</button>
        <button type="button" class="btn sm" data-act="askno">취소</button>
      </div>
      <div class="note ${askMsg ? 'err' : ''}" style="margin-top:4px">${esc(
        askMsg || '어디까지 했는지 적으면 나머지는 그대로 남아요.'
      )}</div>
    </div>
  `;
}

function itemTitleHtml(it) {
  if (isGeneralItem(it)) {
    return `<span class="cat-badge">${esc(it.cat || '일반')}</span> <span class="it-title-text">${esc(it.t)}</span>`;
  }
  return `<button type="button" class="book-link" data-act="bookpop" data-b="${esc(
    it.b
  )}">${esc(BNAME[it.b] || it.b)}</button> <span class="it-title-text">${esc(it.t)}</span>`;
}

function itemRowHtml(dateIso, it, state) {
  const { cfg, moving, REAL } = state;
  const open = moving === it.id;
  const dd = doneDateOf(it);
  const p = itemP(it, cfg);
  const badges = [];
  if (it.important) badges.push('<span class="mini-pill star">★ 중요</span>');
  if (it.due) badges.push(`<span class="mini-pill due">마감 ${shortDate(it.due)}</span>`);

  return `
    <div class="it ${it.done ? 'done' : ''}">
      <input type="checkbox" data-act="tog" data-d="${esc(dateIso)}" data-id="${esc(
        it.id
      )}" ${it.done ? 'checked' : ''} aria-label="완료 체크">
      <div class="tx">
        <div class="it-main">${itemTitleHtml(it)} ${badges.join(' ')}</div>
        ${
          it.done && dd && dd !== dateIso
            ? `<div class="note">실제 완료 ${lab(dd)}</div>`
            : ''
        }
        ${askFormHtml(dateIso, it, state)}
        ${
          open
            ? `<div class="menu item-menu">
                <button type="button" class="btn sm" data-act="mv" data-d="${esc(
                  dateIso
                )}" data-id="${esc(it.id)}" data-to="${addDay(dateIso, 1)}">내일로</button>
                <button type="button" class="btn sm" data-act="mv" data-d="${esc(
                  dateIso
                )}" data-id="${esc(it.id)}" data-to="${REAL}">오늘로</button>
                <input type="date" data-act="mvd" data-d="${esc(dateIso)}" data-id="${esc(
                  it.id
                )}" title="날짜 이동">
                <button type="button" class="btn sm ${
                  it.important ? 'pri' : ''
                }" data-act="togimp" data-d="${esc(dateIso)}" data-id="${esc(it.id)}">${
                  it.important ? '★ 중요 해제' : '☆ 중요'
                }</button>
                <label class="inline-date-pick">
                  <span class="note">마감</span>
                  <input type="date" data-act="setdue" data-d="${esc(
                    dateIso
                  )}" data-id="${esc(it.id)}" value="${esc(it.due || '')}">
                </label>
                <button type="button" class="btn sm danger" data-act="del" data-d="${esc(
                  dateIso
                )}" data-id="${esc(it.id)}">삭제</button>
              </div>`
            : ''
        }
      </div>
      <span class="p mono">${it.x ? '기록' : fmt(p) + 'P'}</span>
      <button type="button" class="btn sm icon-btn" data-act="menu" data-id="${esc(
        it.id
      )}" aria-label="항목 메뉴">⋯</button>
    </div>
  `;
}

function closeCardHtml(state) {
  const { plans, cfg, logs, REAL, closeMode, closeKeep, closeHours, closeFeel } =
    state;
  const c = planClose({ plans, cfg, todayIso: REAL, mode: closeMode, keepIds: closeKeep });
  const its = plans[REAL] || [];
  const dn = sumP(its, cfg, (i) => i.done);
  const tt = sumP(its, cfg);
  const mp = c.moveP;
  const kp = c.keepP;
  const curHours = closeHours ?? (logs[REAL] || {}).hours ?? '';
  const curFeel = closeFeel ?? (logs[REAL] || {}).feel ?? null;

  let h = `
    <div class="card glass-accent">
      <div class="row">
        <b class="card-title">🌙 오늘 마무리</b>
        <span class="sp"></span>
        <button type="button" class="btn sm" data-act="cno">닫기</button>
      </div>
      <div class="note" style="margin:6px 0">오늘 <b>${fmt(dn)}P</b> / 계획 <b>${fmt(
        tt
      )}P</b> 했어요.</div>
  `;

  if (!c.un.length) {
    h += '<div style="margin:8px 0">오늘 계획은 전부 끝났어요! 🎉</div>';
  } else {
    const unTotP = fmt(c.un.reduce((a, i) => a + itemP(i, cfg), 0));
    h += `
      <div style="margin:8px 0"><b>못 한 것 ${c.un.length}줄 · ${unTotP}P</b></div>
      <div class="seg" style="margin-bottom:8px">
        <button type="button" class="btn ${closeMode === 'next' ? 'pri' : ''}" data-act="cmode" data-m="next">전부 내일로</button>
        <button type="button" class="btn ${closeMode === 'spread' ? 'pri' : ''}" data-act="cmode" data-m="spread">이번주 안에서 나눠서</button>
      </div>
    `;
    h += c.un
      .map((i) => {
        const drop = carryRuleOf(i, cfg) === 'drop';
        const kp2 = drop || closeKeep.has(i.id);
        const t = c.dest[i.id];
        return `
          <div class="it">
            <div class="tx">
              <div>${itemTitleHtml(i)}</div>
              <div class="note">${
                kp2
                  ? drop
                    ? '규칙: 안 밀기 → 보관'
                    : '오늘 자리에 남겨 둠'
                  : '→ ' + lab(t)
              }</div>
            </div>
            <span class="p mono">${fmt(itemP(i, cfg))}P</span>
            ${
              drop
                ? ''
                : `<button type="button" class="btn sm" data-act="ckeep" data-id="${esc(
                    i.id
                  )}">${kp2 ? '밀기' : '안 밀기'}</button>`
            }
          </div>
        `;
      })
      .join('');

    h += `<div style="margin:12px 0 4px"><b>이후 부하 변화</b></div>
      <table class="tbl"><tr><th>날짜</th><th></th><th class="r">전 → 후</th></tr>`;
    c.days
      .filter((d, k) => k < 4 || c.after[d] !== c.before[d])
      .slice(0, 10)
      .forEach((d) => {
        const b = c.before[d];
        const a = c.after[d];
        const cap = capOf(d, plans, cfg);
        const cls = a > 100 ? 'bad' : a > cap ? 'warn' : '';
        h += `
          <tr>
            <td>${lab(d)}</td>
            <td style="width:38%">
              <div class="bar ${cls}"><i style="width:${Math.min(
                100,
                (a / Math.max(cap, 1)) * 100
              )}%"></i></div>
            </td>
            <td class="r mono">${fmt(b)} → <b>${fmt(a)}</b>${
              a > 100 ? ' ⚠' : a > cap ? ' ·' : ''
            }</td>
          </tr>
        `;
      });
    h += `</table>
      <div class="note" style="margin-top:8px">
        밀리는 양 <b>${mp}P</b>${kp ? ` · 보관 ${kp}P` : ''}.
        시험 전까지 남은 여유 ${c.freeBefore}P → <b>${c.freeAfter}P</b>
        ${
          mp > c.freeBefore
            ? ' <span class="err">— 여유보다 많이 밀려서 뭘 줄일지 정해야 해요</span>'
            : ''
        }
      </div>
    `;
  }

  h += `
    <div class="row" style="margin-top:12px">
      <label class="note">오늘 공부시간(h)</label>
      <input type="number" step="0.5" min="0" data-act="chours" value="${esc(curHours)}">
    </div>
    <div class="seg" style="margin-top:8px">
      ${['가벼움', '보통', '빡셈']
        .map(
          (f) =>
            `<button type="button" class="btn ${
              curFeel === f ? 'pri' : ''
            }" data-act="cfeel" data-f="${f}">${f}</button>`
        )
        .join('')}
    </div>
    <div style="margin-top:12px">
      <button type="button" class="btn pri" style="width:100%" data-act="cok">${
        c.moves.length ? '이대로 확정하고 자러 가기' : '기록하고 자러 가기'
      }</button>
    </div>
  </div>`;
  return h;
}

export function renderToday(state) {
  const { plans, cfg, logs, cur, REAL, closing, closedMsg, adding, addKind } = state;
  const items = plans[cur] || [];

  let h = `
    <div class="card">
      <div class="datebar">
        <button type="button" class="btn sm" data-act="day" data-n="-1" aria-label="어제">◀</button>
        <b>${lab(cur)}${cur === REAL ? ' · 오늘' : ''}</b>
        <button type="button" class="btn sm" data-act="day" data-n="1" aria-label="내일">▶</button>
      </div>
      ${
        cur !== REAL
          ? `<div class="center-mt"><button type="button" class="btn sm" data-act="goto" data-d="${REAL}">오늘로 돌아가기</button></div>`
          : ''
      }
      ${gaugeHtml(cur, plans, cfg)}
      ${
        cur === REAL && !closing
          ? `<div class="center-mt" style="margin-top:10px"><button type="button" class="btn pri" data-act="close">🌙 오늘은 여기까지</button></div>`
          : ''
      }
    </div>
  `;

  if (cur === REAL && closedMsg) {
    h += `<div class="card glass-ok"><b>마무리 완료</b><div class="note">${esc(
      closedMsg
    )} 푹 쉬어요!</div></div>`;
  }
  if (cur === REAL && closing) {
    h += closeCardHtml(state);
  }

  // Overdue items (d < REAL)
  const od = getOverdueItems(plans, REAL);
  if (od.length && cur >= REAL) {
    const tp = fmt(od.reduce((a, { item }) => a + itemP(item, cfg), 0));
    h += `
      <div class="card glass-warn">
        <div class="row wrap-row">
          <b>밀린 것 ${od.length}개 · ${tp}P</b>
          <span class="sp"></span>
          <button type="button" class="btn sm pri" data-act="pullall">전부 ${lab(
            cur
          )}로</button>
        </div>
    `;
    for (const { date: odDate, item: i } of od) {
      const rule = carryRuleOf(i, cfg);
      const ruleText =
        rule === 'drop'
          ? '규칙: 안 밀기'
          : rule === 'auto'
            ? '규칙: 자동'
            : '규칙: 물어보기';
      h += `
        <div class="it">
          <div class="tx">
            <div>${itemTitleHtml(i)}</div>
            <div class="note">원래 ${lab(odDate)} · ${ruleText}</div>
          </div>
          <span class="p mono">${fmt(itemP(i, cfg))}P</span>
          <button type="button" class="btn sm" data-act="pull" data-d="${esc(
            odDate
          )}" data-id="${esc(i.id)}">여기로</button>
        </div>
      `;
    }
    h += '</div>';
  }

  if (!items.length) {
    h += '<div class="card note">이 날은 계획이 없어요.</div>';
  }

  for (const s of ALL_SUBJ) {
    const L = items.filter((i) => i.s === s);
    if (!L.length) continue;
    const cVar = SC[s] ? SC[s][0] : '--acc';
    h += `
      <div class="card">
        <div class="subj-head">
          <span class="subj-dot" style="background:var(${cVar})"></span>
          <span class="subj" style="margin:0">${s} · ${sumP(L, cfg)}P</span>
        </div>
        ${L.map((i) => itemRowHtml(cur, i, state)).join('')}
      </div>
    `;
  }

  // Add task card (교재 진도 + 일반 할 일)
  h += `
    <div class="card">
      <div class="row">
        <b class="card-title-sm">할 일 추가</b>
        <span class="sp"></span>
        <button type="button" class="btn sm" data-act="addtoggle">${
          adding ? '닫기' : '열기'
        }</button>
      </div>
      ${
        adding
          ? `<div class="add-panel">
              <div class="seg" style="margin:10px 0 8px">
                <button type="button" class="btn sm ${
                  addKind === 'book' ? 'pri' : ''
                }" data-act="addkind" data-k="book">📚 교재 진도</button>
                <button type="button" class="btn sm ${
                  addKind === 'todo' ? 'pri' : ''
                }" data-act="addkind" data-k="todo">📌 일반 할 일 (세특·수행)</button>
              </div>
              ${
                addKind === 'book'
                  ? `<div class="menu">
                      <select id="nb">
                        ${Object.keys(STUDY_BOOKS)
                          .map((b) => `<option value="${b}">${BNAME[b]}</option>`)
                          .join('')}
                      </select>
                      <input type="text" id="nt" placeholder="범위 (예: #100~120)" size="14">
                      <input type="number" id="nn" placeholder="개수" value="1" min="0" step="any">
                      <input type="date" id="ndue" title="마감일(선택)">
                      <label class="chk-pill"><input type="checkbox" id="nimp"> ★ 중요</label>
                      <button type="button" class="btn sm pri" data-act="add">추가</button>
                    </div>`
                  : `<div class="menu">
                      <select id="ncat">
                        ${GENERAL_CATS.map((c) => `<option value="${c}">${c}</option>`).join(
                          ''
                        )}
                      </select>
                      <input type="text" id="nt" placeholder="할 일 (예: 생기부 세특 확인)" style="flex:1;min-width:150px">
                      <input type="number" id="np" placeholder="부하P" value="5" min="0" step="1" title="부하 점수(P)">
                      <input type="date" id="ndue" title="마감일(선택)">
                      <label class="chk-pill"><input type="checkbox" id="nimp"> ★ 중요</label>
                      <button type="button" class="btn sm pri" data-act="addtodo">추가</button>
                    </div>`
              }
            </div>`
          : ''
      }
    </div>
  `;

  // Daily study log card
  const lg = logs[cur] || {};
  const donePToday = sumP(items, cfg, (i) => i.done);
  h += `
    <div class="card">
      <b class="card-title-sm">${lab(cur)} 기록</b>
      <div class="row" style="margin-top:8px">
        <label class="note" for="lh">공부시간(h)</label>
        <input type="number" id="lh" step="0.5" min="0" value="${esc(lg.hours ?? '')}">
      </div>
      <div class="seg" style="margin-top:8px">
        ${['가벼움', '보통', '빡셈']
          .map(
            (f) =>
              `<button type="button" class="btn ${
                lg.feel === f ? 'pri' : ''
              }" data-act="feel" data-f="${f}">${f}</button>`
          )
          .join('')}
      </div>
      <div class="row" style="margin-top:8px">
        <input type="text" id="ln" placeholder="예외·메모 (선택)" value="${esc(
          lg.note || ''
        )}" style="flex:1">
        <button type="button" class="btn sm pri" data-act="savelog">저장</button>
      </div>
      <div class="note" style="margin-top:6px">
        완료한 부하 ${donePToday}P${
          lg.hours ? ` · 시간당 ${fmt(donePToday / lg.hours)}P` : ''
        }
      </div>
    </div>
  `;

  return h;
}

export function renderWeek(state) {
  const { plans, cfg, cur, REAL, openC, rulesOpen } = state;
  const days = weekDatesOf(cur);
  const tot = days.map((d) => sumP(liveItems(plans[d]), cfg));
  const mx = Math.max(1, ...tot);
  const all = days.flatMap((d) => liveItems(plans[d]));
  const T = sumP(all, cfg);
  const D = sumP(all, cfg, (i) => i.done);

  let h = `
    <div class="card">
      <div class="datebar">
        <button type="button" class="btn sm" data-act="wk" data-n="-7">◀</button>
        <b>${lab(days[0])} ~ ${lab(days[6])}</b>
        <button type="button" class="btn sm" data-act="wk" data-n="7">▶</button>
      </div>
    </div>
  `;

  h += `
    <div class="card">
      <b class="card-title-md">하루 분량 (부하 점수 P)</b>
      <div class="bars">
        ${days
          .map((d, i) => {
            const it = liveItems(plans[d]);
            const p = tot[i];
            const past = d < REAL;
            const ad = it.length && it.every((x) => x.done);
            let num, bar;
            if (!it.length) {
              num = '<div class="num sm">–</div>';
              bar = '<div class="wbar" style="height:0"></div>';
            } else if (past && ad) {
              num = '<div class="num sm">완료</div>';
              bar = '<div class="wbar donebar"></div>';
            } else {
              const segs = Object.keys(SC)
                .map((k) => ({ k, p: sumP(it, cfg, (x) => x.s === k) }))
                .filter((x) => x.p > 0)
                .map(
                  (x) =>
                    `<span style="background:var(${SC[x.k][0]});height:${
                      (x.p / Math.max(p, 0.1)) * 100
                    }%"></span>`
                )
                .join('');
              num = `<div class="num">${Math.round(p)}</div>`;
              bar = `<div class="wbar" style="height:${Math.max(
                6,
                (p / mx) * BAR_PX
              )}px">${segs}</div>`;
            }
            return `<div class="bcol">${num}${bar}<div class="dl ${
              d === REAL ? 'now' : ''
            }">${WD_KO[i]}</div></div>`;
          })
          .join('')}
      </div>
    </div>
  `;

  // Progress card
  const left = days.filter((d) => d >= REAL).length || 0;
  const rem = fmt(T - D);
  const per = left ? Math.round(rem / left) : 0;
  const warn = days
    .map((d, i) => [d, i, tot[i]])
    .filter((x) => x[0] >= REAL && x[2] > WARN_P)
    .map(
      (x) =>
        `${WD_KO[x[1]]} ${Math.round(x[2])}P(${
          x[2] > HIGH_P ? HIGH_P : WARN_P
        }P 초과)`
    );

  const prog = `
    <div class="card">
      <b class="card-title-md">이번주 계획 현황</b>
      <div class="big3">
        <div><b>${T ? Math.round((D / T) * 100) : 0}%</b><span>진행률</span></div>
        <div><b>${Math.round(D)}P / ${Math.round(
          T
        ).toLocaleString()}P</b><span>완료 / 전체</span></div>
        <div><b>약 ${per}P</b><span>${
          left ? `하루 약 ${per}P 해야 해요 (${left}일)` : '남은 날 없음'
        }</span></div>
      </div>
      ${Object.keys(SC)
        .map((k) => {
          const L = all.filter((x) => x.s === k);
          if (!L.length && k === '학교·할일') return '';
          const t = sumP(L, cfg);
          const dn = sumP(L, cfg, (x) => x.done);
          const p = t ? Math.round((dn / t) * 100) : 0;
          return `
            <div class="pg">
              <span style="color:var(${SC[k][0]})">${k}</span>
              <div class="t"><i style="width:${p}%;background:var(${SC[k][0]})"></i></div>
              <em>${dn}P/${t}P · ${p}%</em>
            </div>
          `;
        })
        .join('')}
      <div class="warnline">${warn.length ? esc(warn.join(', ')) : '무리한 날 없음'}</div>
    </div>
  `;

  // Carry card
  const od = getOverdueItems(plans, REAL);
  const keep = od.filter(({ item }) => carryRuleOf(item, cfg) !== 'drop');
  const bk = od.filter(({ item }) => carryRuleOf(item, cfg) === 'drop');
  const rows =
    keep
      .map(({ date: d, item: i }) => {
        const k = i.id;
        const o = openC.has(k);
        const n = diffDays(d, REAL);
        const c = SC[i.s] || ['--mute', '--div'];
        const rule = carryRuleOf(i, cfg);
        return `
          <div class="crow" data-act="cx" data-k="${esc(k)}">
            <div class="chead">
              <i class="dot" style="background:var(${c[0]})"></i>
              <span class="grow">${itemTitleHtml(i)}</span>
              <span class="bdg">${MODE_LABEL[rule]}</span>
              <span class="bdg ${n >= 3 ? 'o' : ''}">${n}일째</span>
              <span class="p mono">${fmt(itemP(i, cfg))}P</span>
            </div>
            ${
              o
                ? `<div class="cdet">원래 배정일 ${lab(d)} → 지금 위치 ${lab(
                    REAL
                  )}<br>적용 규칙: ${MODE_LABEL[rule]} (${rule})</div>`
                : ''
            }
          </div>
        `;
      })
      .join('') || '<div class="note">이월 중인 항목 없음</div>';

  const ex = Object.keys(STUDY_BOOKS).filter(
    (b) => (cfg.carry[b] || 'ask') !== 'ask'
  );
  const carryCard = `
    <div class="card">
      <b class="card-title-md">이월 현황</b>
      <div style="font-size:14px;margin:6px 0">
        이월 중 <b>${keep.length}</b>줄 · 총 <b>${fmt(
          keep.reduce((a, { item }) => a + itemP(item, cfg), 0)
        )}P</b>
      </div>
      ${rows}
      <div class="bk ${bk.length ? '' : 'none'}">
        <div class="note" style="margin-bottom:4px">밀린 목록(backlog)</div>
        ${
          bk.length
            ? bk
                .map(
                  ({ date: d, item: i }) =>
                    `<span class="chip p">${esc(itemLabelPrefix(i))} ${esc(
                      i.t
                    )} · ${lab(d)}부터</span>`
                )
                .join(' ')
            : '보관 중인 항목 없음'
        }
      </div>
      <div class="chips">
        <span class="chip">기본 규칙 물어보기</span>
        <button type="button" class="chip" data-act="rl">예외 규칙 ${ex.length}개 ${
          rulesOpen ? '▴' : '▾'
        }</button>
      </div>
      ${
        rulesOpen
          ? `<table class="tbl" style="margin-top:8px">
              <tr><th>교재</th><th>방식</th></tr>
              ${
                ex
                  .map(
                    (b) =>
                      `<tr><td>${esc(BNAME[b])}</td><td>${
                        MODE_LABEL[cfg.carry[b]]
                      }</td></tr>`
                  )
                  .join('') ||
                '<tr><td colspan="2" class="note">예외 없음 (설정 탭에서 바꿔요)</td></tr>'
              }
            </table>`
          : ''
      }
    </div>
  `;

  h += `<div class="two">${prog}${carryCard}</div><div class="wgrid">`;

  h += days
    .map((d, i) => {
      const it = liveItems(plans[d]);
      const p = tot[i];
      const past = d < REAL;
      const td = d === REAL;
      const ad = it.length && it.every((x) => x.done);
      const c = p > HIGH_P ? 'high' : p > WARN_P ? 'warn' : '';
      const cntTotal = it.reduce((s, x) => s + (Number(x.n) || 0), 0);
      const secs =
        Object.keys(SC)
          .map((k) => {
            const L = it.filter((x) => x.s === k);
            if (!L.length) return '';
            const cN = L.reduce((s, x) => s + (Number(x.n) || 0), 0);
            return `
              <div class="sec" style="--c:var(${SC[k][0]});--b:var(${SC[k][1]})">
                <div class="sech"><b>${k}</b><span>${cN}개 · ${sumP(
                  L,
                  cfg
                )}P</span></div>
                ${L.map(
                  (x) => `
                  <div class="wrow ${x.done ? 'done' : ''}">
                    <input type="checkbox" data-act="tog" data-d="${esc(
                      d
                    )}" data-id="${esc(x.id)}" ${x.done ? 'checked' : ''}>
                    <span class="l">${itemTitleHtml(x)}</span>
                    <span class="n mono">${x.n}</span>
                  </div>
                  ${askFormHtml(d, x, state)}
                `
                ).join('')}
              </div>
            `;
          })
          .join('') || '<div class="note">계획 없음</div>';

      return `
        <div class="card day ${td ? 'today' : ''} ${past ? 'past' : ''}">
          <div class="dh">
            <span class="dw">${WD_EN[i]}</span>
            <span class="dd">${d.slice(5).replace('-', '/')}</span>
            <span class="tags">
              ${td ? '<span class="tg t">오늘</span>' : ''}
              ${ad ? '<span class="tg">완료</span>' : ''}
              <button type="button" class="tg" data-act="goto" data-d="${esc(
                d
              )}" data-v2="today">열기</button>
            </span>
          </div>
          <div class="sum ${c}">하루 총 <b>${Math.round(p)}</b>P · <b>${cntTotal}</b>단위</div>
          ${secs}
        </div>
      `;
    })
    .join('');

  h += '</div>';
  return h;
}

export function renderAll(state) {
  const { plans, cfg, logs, calM, selB, REAL } = state;
  const { year: Y, month: M, pad, dates: monthDates } = monthInfo(calM);
  const allBooks = Object.keys(STUDY_BOOKS);
  const hasGeneral = planDates(plans).some((d) =>
    (plans[d] || []).some((it) => !it.x && isGeneralItem(it))
  );
  const chipBooks = hasGeneral ? [...allBooks, GENERAL_BOOK] : allBooks;

  let h = `
    <div class="card">
      <div class="datebar">
        <button type="button" class="btn sm" data-act="cm" data-n="-1">◀</button>
        <b>${Y}년 ${M}월</b>
        <button type="button" class="btn sm" data-act="cm" data-n="1">▶</button>
      </div>
      <div class="chips" style="margin:10px 0">
        ${chipBooks
          .map(
            (b) =>
              `<button type="button" class="chip ${
                selB.has(b) ? 'on' : ''
              }" data-act="selb" data-b="${esc(b)}">${esc(BNAME[b])}</button>`
          )
          .join('')}
        ${
          selB.size
            ? '<button type="button" class="chip" data-act="selclr">전체 해제</button>'
            : ''
        }
      </div>
      <div class="cal">
        ${WD_KO.map((x) => `<div class="h">${x}</div>`).join('')}
        ${'<div></div>'.repeat(pad)}
        ${monthDates
          .map((ds, idx) => {
            const day = idx + 1;
            const all = liveItems(plans[ds]);
            const it = selB.size ? all.filter((x) => selB.has(x.b)) : all;
            const p = sumP(all, cfg);
            const cap = capOf(ds, plans, cfg);
            const cls =
              p > 100 ? 'var(--bad)' : p > cap ? 'var(--warn)' : 'var(--ok)';
            const g = {};
            it.forEach((x) => {
              const o = (g[x.b] = g[x.b] || { n: 0, dn: 0, s: x.s });
              o.n += Number(x.n) || 0;
              if (x.done) o.dn += Number(x.n) || 0;
            });
            return `
              <div class="cc ${ds === REAL ? 'td' : ''} ${
                selB.size && !it.length ? 'dim' : ''
              }" data-act="goto" data-d="${ds}" data-v2="today">
                <div class="dn">
                  <span>${day}</span>
                  <span style="color:var(--mute);font-weight:400">${
                    p ? Math.round(p) : ''
                  }</span>
                </div>
                ${
                  all.length
                    ? `<div class="ld"><i style="width:${Math.min(
                        100,
                        (p / Math.max(cap, 1)) * 100
                      )}%;background:${cls}"></i></div>`
                    : ''
                }
                ${Object.keys(g)
                  .map((b) => {
                    const o = g[b];
                    const c = SC[o.s] ? SC[o.s][0] : '--mute';
                    return `<span class="ch ${
                      o.dn === o.n ? 'dn2' : ''
                    }" style="--c:var(${c})">${esc(SH[b] || b)} ${
                      o.dn && o.dn < o.n ? `${o.dn}/` : ''
                    }${o.n}</span>`;
                  })
                  .join('')}
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="note" style="margin-top:8px">
        칸을 누르면 그날 목록으로 가요. 위 막대는 부하(P), 숫자는 하루 총 P예요. 교재를 고르면 그 교재만 보여요.
      </div>
    </div>
  `;

  // Book summary / detail
  const r = remainByBook(plans, cfg);
  if (selB.size) {
    for (const b of selB) {
      const prog = getBookProgress(plans, b, cfg);
      h += `
        <div class="card">
          <div class="row wrap-row">
            <button type="button" class="book-link" style="font:400 16px Jua" data-act="bookpop" data-b="${esc(
              b
            )}">${esc(prog.name)}</button>
            <span class="sp"></span>
            <span class="note">${
              prog.rows.length
                ? `${lab(prog.rows[0].planDate)} ~ ${lab(
                    prog.rows[prog.rows.length - 1].planDate
                  )}`
                : '계획 없음'
            }</span>
          </div>
          <div class="pg" style="grid-template-columns:1fr auto;margin:8px 0">
            <div class="t"><i style="width:${prog.pct}%;background:var(--ok)"></i></div>
            <em>${prog.doneN}/${prog.totalN}${esc(prog.unit)} · ${
              prog.pct
            }% · 남은 ${prog.remainP}P</em>
          </div>
          ${prog.rows
            .map(
              ({ planDate, item: x, p, doneDate }) => `
              <div class="row" style="padding:4px 0;cursor:pointer;border-top:1px solid var(--div)" data-act="goto" data-d="${planDate}" data-v2="today">
                <span style="width:86px;font-size:13px;color:var(--mute)">${lab(
                  planDate
                )}</span>
                <span style="flex:1;${
                  x.done ? 'text-decoration:line-through;color:var(--done)' : ''
                }">${esc(x.t)}</span>
                <span class="p mono">${x.n}${esc(prog.unit)} · ${fmt(p)}P ${
                  x.done
                    ? doneDate && doneDate !== planDate
                      ? `✓ (${shortDate(doneDate)})`
                      : '✓'
                    : ''
                }</span>
              </div>
            `
            )
            .join('')}
        </div>
      `;
    }
  } else {
    const subjOrder = (b) => {
      const s = STUDY_BOOKS[b] || '학교·할일';
      const idx = ALL_SUBJ.indexOf(s);
      return idx >= 0 ? idx : 99;
    };
    h += `
      <div class="card">
        <div class="row">
          <b class="card-title-sm">교재별 (이름을 누르면 진도 팝업, 필터 버튼으로 달력 보기)</b>
        </div>
        <table class="tbl">
          <tr><th>교재</th><th class="r">완료/계획</th><th class="r">남은 P</th><th class="r">달력</th></tr>
          ${Object.keys(r)
            .sort((a, b) => subjOrder(a) - subjOrder(b))
            .map((b) => {
              const o = r[b];
              return `
                <tr>
                  <td>
                    <button type="button" class="book-link" data-act="bookpop" data-b="${esc(
                      b
                    )}">${esc(BNAME[b] || b)}</button>
                  </td>
                  <td class="r mono">${fmt(o.dn)}/${fmt(o.n)}${esc(
                    UNIT[b] || '개'
                  )}</td>
                  <td class="r mono">${fmt(o.p)}</td>
                  <td class="r">
                    <button type="button" class="btn sm" data-act="selb" data-b="${esc(
                      b
                    )}">필터</button>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </table>
      </div>
    `;
  }

  const L = Object.keys(logs || {}).sort();
  if (L.length) {
    h += `
      <div class="card">
        <b class="card-title-sm">기록 (보정용)</b>
        <table class="tbl">
          <tr><th>날짜</th><th class="r">시간</th><th class="r">완료P</th><th class="r">체감</th></tr>
          ${L.slice(-10)
            .reverse()
            .map((d) => {
              const g = logs[d] || {};
              return `<tr><td>${lab(d)}</td><td class="r mono">${
                g.hours ?? '-'
              }</td><td class="r mono">${sumP(
                plans[d],
                cfg,
                (i) => i.done
              )}</td><td class="r">${esc(g.feel || '-')}</td></tr>`;
            })
            .join('')}
        </table>
      </div>
    `;
  }

  return h;
}

export function renderSettings(state) {
  const { cfg } = state;
  const rules = resolveMatrixRules(cfg);
  const examSet = new Set(rules.examBooks);

  let h = `
    <div class="card">
      <b class="card-title-sm">부하 점수 (단위당 P) 및 밀림 규칙</b>
      <div class="note">체감과 시간 기록을 보면서 고치면 전체 계획 부하가 같이 바뀌어요.</div>
      <table class="tbl">
        <tr><th>교재</th><th class="r">P/단위</th><th>밀림</th></tr>
        ${Object.keys(STUDY_BOOKS)
          .map(
            (b) => `
          <tr>
            <td>
              <button type="button" class="book-link" data-act="bookpop" data-b="${esc(
                b
              )}">${esc(BNAME[b])}</button>
              <span class="note"> /${esc(UNIT[b])}</span>
            </td>
            <td class="r">
              <input type="number" step="0.1" min="0" data-act="wt" data-b="${esc(
                b
              )}" value="${weightOf(b, cfg)}">
            </td>
            <td>
              <select data-act="cr" data-b="${esc(b)}">
                ${[
                  ['ask', '물어보기'],
                  ['auto', '자동으로 밀기'],
                  ['drop', '안 밀기'],
                ]
                  .map(
                    ([v, t]) =>
                      `<option value="${v}" ${
                        (cfg.carry[b] || 'ask') === v ? 'selected' : ''
                      }>${t}</option>`
                  )
                  .join('')}
              </select>
            </td>
          </tr>
        `
          )
          .join('')}
        <tr>
          <td>일반 할 일 <span class="note">(세특·수행)</span></td>
          <td class="r note">항목별 지정</td>
          <td>
            <select data-act="cr" data-b="${GENERAL_BOOK}">
              ${[
                ['ask', '물어보기'],
                ['auto', '자동으로 밀기'],
                ['drop', '안 밀기'],
              ]
                .map(
                  ([v, t]) =>
                    `<option value="${v}" ${
                      (cfg.carry[GENERAL_BOOK] || 'ask') === v ? 'selected' : ''
                    }>${t}</option>`
                )
                .join('')}
            </select>
          </td>
        </tr>
      </table>
    </div>

    <div class="card">
      <div class="row">
        <b class="card-title-sm">D-day</b>
        <span class="sp"></span>
        <button type="button" class="btn sm" data-act="ddadd">+ 추가</button>
      </div>
      ${(cfg.ddays || DEF_DD)
        .map(
          (x, i) => `
        <div class="row wrap-row" style="margin-top:8px">
          <input type="text" data-act="ddn" data-i="${i}" value="${esc(x.n)}" size="10">
          <input type="date" data-act="ddd" data-i="${i}" value="${esc(x.d)}">
          ${
            (cfg.ddays || DEF_DD).length > 1
              ? `<button type="button" class="btn sm danger" data-act="dddel" data-i="${i}">삭제</button>`
              : ''
          }
        </div>
      `
        )
        .join('')}
    </div>

    <div class="card">
      <b class="card-title-sm">하루 기준 부하</b>
      <div class="row" style="margin-top:8px">
        <label>공부일(월·수·목·금)</label>
        <input type="number" data-act="cap" data-k="study" value="${
          cfg.caps.study
        }">
      </div>
      <div class="row" style="margin-top:8px">
        <label>쉬는 날(화·토·일)</label>
        <input type="number" data-act="cap" data-k="off" value="${cfg.caps.off}">
      </div>
      <div class="note" style="margin-top:6px">100P 초과는 과부하로 표시돼요.</div>
    </div>

    <div class="card">
      <b class="card-title-sm">아이젠하워 매트릭스 자동 분류 규칙</b>
      <div class="note" style="margin-bottom:8px">오늘 할 일(오늘 배정·이월된 계획 및 할 일)에 한해서만 4분면으로 분류해요. 수동으로 옮긴 항목은 자동 규칙이 덮어쓰지 않아요.</div>
      <div class="row wrap-row" style="margin-top:8px">
        <label>긴급 마감 기준 (일 이내)</label>
        <input type="number" min="0" max="30" data-act="mrule" data-k="urgentDays" value="${
          rules.urgentDays
        }">
      </div>
      <div class="row wrap-row" style="margin-top:8px">
        <label>D-day 시험 긴급 기준 (일 이내)</label>
        <input type="number" min="0" max="60" data-act="mrule" data-k="examUrgentDays" value="${
          rules.examUrgentDays
        }">
      </div>
      <div style="margin-top:10px">
        <label class="note">중요 자동 감지 키워드 (쉼표 구분)</label>
        <input type="text" data-act="mrulekw" style="width:100%;margin-top:4px" value="${esc(
          rules.importantKeywords.join(', ')
        )}">
      </div>
      <div style="margin-top:10px">
        <div class="note" style="margin-bottom:6px">시험범위 교재 (자동으로 '중요' 분류)</div>
        <div class="chips">
          ${Object.keys(STUDY_BOOKS)
            .map(
              (b) => `
            <button type="button" class="chip ${
              examSet.has(b) ? 'on' : ''
            }" data-act="mexambook" data-b="${esc(b)}">${esc(BNAME[b])}</button>
          `
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <b class="card-title-sm">구글 캘린더 임베드 설정</b>
      <div class="note" style="margin:6px 0">
        구글 캘린더 설정 → '캘린더 통합'의 공개/임베드 URL, &lt;iframe&gt; 태그, 또는 본인 Google 이메일을 붙여넣으면 허브 탭에 실제 캘린더가 열려요.
      </div>
      <div class="row wrap-row" style="margin-top:8px">
        <input type="text" id="set-cal-url" placeholder="https://calendar.google.com/calendar/embed?src=... 또는 Gmail 주소" value="${esc(
          cfg.calendarUrl || ''
        )}" style="flex:1;min-width:200px">
        <button type="button" class="btn sm pri" data-act="savecal" data-src="set-cal-url">저장</button>
      </div>
    </div>

    <div class="card">
      <b class="card-title-sm">밀림 규칙 안내</b>
      <div class="note">
        '자동으로 밀기'인 교재의 안 한 것은 열 때 지난 날짜에서 오늘로 옮겨져요.
        '안 밀기'는 '전부 오늘로' 버튼에서 빠져요(하나씩은 옮길 수 있어요).
        '물어보기'는 밀린 목록에 떠요.
      </div>
    </div>

    <div class="card">
      <b class="card-title-sm">접속 토큰 및 데이터 백업</b>
      <div class="menu" style="margin-top:10px">
        <button type="button" class="btn sm" data-act="changetoken">접속 토큰 변경</button>
        <button type="button" class="btn sm" data-act="exportjson">JSON 백업 다운로드</button>
        <label class="btn sm" style="cursor:pointer">
          JSON 파일 가져오기
          <input type="file" accept=".json,application/json" data-act="importfile" hidden>
        </label>
        <button type="button" class="btn sm" data-act="reseed">초기 데이터(11/12~12/6) 다시 불러오기</button>
      </div>
      <div class="note" style="margin-top:6px">토큰은 이 브라우저의 localStorage에만 저장되며 코드에 포함되지 않아요.</div>
    </div>
  `;

  return h;
}

export function renderBookModal(state) {
  const { bookModalId, bookModalFilter, plans, cfg, REAL } = state;
  if (!bookModalId) return '';

  const prog = getBookProgress(plans, bookModalId, cfg);
  const cVar = SC[prog.subject] ? SC[prog.subject][0] : '--acc';
  const rule = cfg.carry?.[bookModalId] || 'ask';
  const filter = bookModalFilter || 'all';
  const doneCnt = prog.rows.filter((r) => r.item.done).length;
  const todoCnt = prog.rows.length - doneCnt;

  const filtered = prog.rows.filter((r) => {
    if (filter === 'done') return r.item.done;
    if (filter === 'todo') return !r.item.done;
    return true;
  });

  return `
    <div class="modal-backdrop" data-act="bookpopbg">
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(
        prog.name
      )} 진도 상세">
        <div class="row">
          <span class="subj-dot" style="background:var(${cVar})"></span>
          <b class="modal-title">${esc(prog.name)}</b>
          <span class="bdg">${esc(prog.subject)}</span>
          <span class="sp"></span>
          <button type="button" class="btn sm" data-act="bookpopclose">닫기</button>
        </div>

        <div class="modal-stats">
          <div class="stat-pill">
            <span>완료 / 전체</span>
            <b>${prog.doneN} / ${prog.totalN}${esc(prog.unit)}</b>
          </div>
          <div class="stat-pill">
            <span>진도율</span>
            <b>${prog.pct}%</b>
          </div>
          <div class="stat-pill">
            <span>남은 부하</span>
            <b>${prog.remainP}P</b>
          </div>
        </div>

        <div class="pg" style="grid-template-columns:1fr auto;margin:8px 0">
          <div class="t"><i style="width:${prog.pct}%;background:var(${cVar})"></i></div>
          <em>완료 ${prog.doneP}P / 전체 ${prog.totalP}P</em>
        </div>

        <div class="note" style="margin-bottom:10px">
          단위당 ${prog.weight}P · 밀림 규칙: ${MODE_LABEL[rule]}
        </div>

        <div class="chips" style="margin-bottom:8px">
          <button type="button" class="chip ${
            filter === 'all' ? 'on' : ''
          }" data-act="bookpopfilter" data-f="all">전체 (${prog.rows.length})</button>
          <button type="button" class="chip ${
            filter === 'done' ? 'on' : ''
          }" data-act="bookpopfilter" data-f="done">완료 (${doneCnt})</button>
          <button type="button" class="chip ${
            filter === 'todo' ? 'on' : ''
          }" data-act="bookpopfilter" data-f="todo">미완료 (${todoCnt})</button>
        </div>

        <div class="modal-list">
          ${
            filtered.length
              ? filtered
                  .map(({ planDate, item, p, doneDate }) => {
                    const overdue = !item.done && planDate < REAL;
                    const diffDone = item.done && doneDate && doneDate !== planDate;
                    return `
                      <div class="modal-row" data-act="goto" data-d="${esc(
                        planDate
                      )}" data-v2="today" data-closepop="1">
                        <div class="row wrap-row">
                          <span class="mono date-col">${lab(planDate)}</span>
                          <span class="range-col ${item.done ? 'done-tx' : ''}">${esc(
                            item.t
                          )}</span>
                          <span class="p mono">${item.n}${esc(prog.unit)} · ${fmt(
                            p
                          )}P</span>
                          ${
                            item.done
                              ? `<span class="tag">${
                                  diffDone
                                    ? `완료 (${shortDate(doneDate)})`
                                    : doneDate
                                      ? `완료 (${shortDate(doneDate)})`
                                      : '✓ 완료'
                                }</span>`
                              : overdue
                                ? '<span class="tag b">밀림</span>'
                                : '<span class="bdg">예정</span>'
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join('')
              : '<div class="note" style="padding:12px 0">해당하는 항목이 없어요.</div>'
          }
          ${
            prog.extraRows.length
              ? `<div class="note" style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--line)">
                  <b>사전기록 (0P)</b>: ${prog.extraRows
                    .map((r) => `${lab(r.planDate)} ${esc(r.item.t)} (${r.item.n}${esc(prog.unit)})`)
                    .join(' · ')}
                </div>`
              : ''
          }
        </div>
      </div>
    </div>
  `;
}
