import { gcalEventToItem } from '../core/gcal.js';
import { addDay, monthInfo } from '../core/date.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'gcal_token_v1';
const API = 'https://www.googleapis.com/calendar/v3';

function readToken() {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (t && t.accessToken && t.expiresAt - 60000 > Date.now()) return t;
  } catch {
    // ignore
  }
  return null;
}

function writeToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function isGcalConnected() {
  return Boolean(readToken());
}

export function disconnectGcal() {
  const t = readToken();
  writeToken(null);
  try {
    if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(t.accessToken, () => {});
    }
  } catch {
    // ignore
  }
}

function loadGis() {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저에서만 사용할 수 있어요.'));
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했어요. (광고차단/네트워크 확인)'));
    document.head.appendChild(s);
  });
}

/**
 * Google 로그인 팝업으로 읽기 전용 캘린더 액세스 토큰을 받습니다. 반드시 클릭 이벤트에서 호출하세요.
 */
export async function connectGcal(clientId) {
  const id = String(clientId || '').trim();
  if (!id) throw new Error('Google OAuth 클라이언트 ID를 입력해 주세요.');
  await loadGis();
  return await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (resp) => {
        if (!resp || resp.error || !resp.access_token) {
          reject(new Error(`Google 로그인 실패: ${(resp && (resp.error_description || resp.error)) || '알 수 없는 오류'}`));
          return;
        }
        const t = {
          accessToken: resp.access_token,
          expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
        };
        writeToken(t);
        resolve(t);
      },
      error_callback: (err) => {
        reject(new Error(`Google 로그인 창 오류: ${(err && (err.message || err.type)) || '취소됨'}`));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function gfetch(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (json && json.error && json.error.message) || `Google Calendar 오류 (${res.status})`
    );
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * 해당 월(KST)의 모든 선택된 캘린더 일정을 불러옵니다.
 */
export async function fetchGcalMonth(ym, hiddenIds = []) {
  const tok = readToken();
  if (!tok) {
    const e = new Error('Google 캘린더 연결이 만료됐어요. 다시 연결해 주세요.');
    e.code = 'gcal_auth';
    throw e;
  }
  const { dates } = monthInfo(ym);
  const first = dates[0];
  const lastExclusive = addDay(dates[dates.length - 1], 1);
  const timeMin = encodeURIComponent(`${first}T00:00:00+09:00`);
  const timeMax = encodeURIComponent(`${lastExclusive}T00:00:00+09:00`);
  try {
    const cl = await gfetch('/users/me/calendarList?minAccessRole=reader&maxResults=100', tok.accessToken);
    const cals = (cl.items || []).filter(
      (c) => c.selected !== false && !hiddenIds.includes(c.id)
    );
    const items = [];
    for (const cal of cals) {
      const r = await gfetch(
        `/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=${timeMin}&timeMax=${timeMax}`,
        tok.accessToken
      );
      for (const ev of r.items || []) {
        const it = gcalEventToItem(ev, {
          id: cal.id,
          summary: cal.summaryOverride || cal.summary,
          backgroundColor: cal.backgroundColor,
        });
        if (it) items.push(it);
      }
    }
    return { items, calendars: cals.map((c) => ({ id: c.id, name: c.summaryOverride || c.summary })) };
  } catch (err) {
    if (err && err.status === 401) {
      writeToken(null);
      err.code = 'gcal_auth';
      err.message = 'Google 캘린더 연결이 만료됐어요. 다시 연결해 주세요.';
    }
    throw err;
  }
}
