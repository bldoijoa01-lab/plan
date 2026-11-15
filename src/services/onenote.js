import { CL } from '../core/units.js';
import {
  defaultOneNoteConfig,
  normalizeNotesState,
  noteToOneNoteHtml,
  noteToOneNotePatchPayload,
  parseOneNotePageHtml,
  planBidirectionalSync,
} from '../core/onenote.js';

export const ONENOTE_AUTH_KEY = 'onenote_auth_v1';
export const ONENOTE_PKCE_KEY = 'onenote_pkce_v1';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const OAUTH_SCOPES = 'openid profile offline_access User.Read Notes.ReadWrite';

function readStorageJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorageJson(key, val) {
  try {
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage quota errors
  }
}

function readPkceTemp() {
  try {
    const ss = sessionStorage.getItem(ONENOTE_PKCE_KEY);
    if (ss) return JSON.parse(ss);
  } catch {
    // ignore
  }
  return readStorageJson(ONENOTE_PKCE_KEY);
}

function writePkceTemp(val) {
  try {
    if (val == null) sessionStorage.removeItem(ONENOTE_PKCE_KEY);
    else sessionStorage.setItem(ONENOTE_PKCE_KEY, JSON.stringify(val));
  } catch {
    // ignore
  }
  writeStorageJson(ONENOTE_PKCE_KEY, val);
}

export function getOneNoteAuth() {
  return readStorageJson(ONENOTE_AUTH_KEY);
}

export function setOneNoteAuth(authObj) {
  writeStorageJson(ONENOTE_AUTH_KEY, authObj || null);
}

export function clearOneNoteAuth() {
  writeStorageJson(ONENOTE_AUTH_KEY, null);
}

export function isOneNoteConnected() {
  const auth = getOneNoteAuth();
  return Boolean(auth && (auth.accessToken || auth.refreshToken));
}

export function getOneNoteRedirectUri() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.origin + window.location.pathname;
}

function decodeJwtExpiryMs(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return 0;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    return payload && typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function randomBase64Url(bytesCount = 48) {
  const arr = new Uint8Array(bytesCount);
  crypto.getRandomValues(arr);
  return bytesToBase64Url(arr);
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(hash));
}

async function graphFetch(pathOrUrl, accessToken, options = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : GRAPH_BASE + pathOrUrl;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  const isTextOnly = options.expectText || !contentType.includes('application/json');
  const payload = isTextOnly
    ? await res.text()
    : await res.json().catch(() => null);

  if (!res.ok) {
    let msg = `Microsoft Graph 오류 (${res.status})`;
    if (payload && typeof payload === 'object' && payload.error && payload.error.message) {
      msg = payload.error.message;
    } else if (typeof payload === 'string' && payload.trim()) {
      try {
        const parsed = JSON.parse(payload);
        if (parsed && parsed.error && parsed.error.message) msg = parsed.error.message;
      } catch {
        // leave generic status message
      }
    }
    const err = new Error(msg);
    err.status = res.status;
    if (res.status === 401) err.code = 'onenote_auth';
    throw err;
  }

  return payload;
}

async function exchangeTokenEndpoint(tenant, paramsObj) {
  const cleanTenant = encodeURIComponent(String(tenant || 'common').trim() || 'common');
  const body = new URLSearchParams(paramsObj);
  const res = await fetch(`https://login.microsoftonline.com/${cleanTenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    const desc = json.error_description || json.error || `인증 토큰 발급 실패 (${res.status})`;
    throw new Error(desc);
  }
  return json;
}

/**
 * Azure SPA Client ID를 이용해 OAuth 2.0 PKCE 로그인 페이지로 이동합니다.
 */
export async function startOneNotePkceLogin({
  clientId,
  tenant = 'consumers',
  prompt = 'select_account',
}) {
  const cleanClientId = String(clientId || '').trim();
  const cleanTenant = String(tenant || 'consumers').trim() || 'consumers';
  if (!cleanClientId) {
    throw new Error('Azure 앱 등록 클라이언트 ID(Client ID)를 입력해 주세요.');
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('HTTPS 환경에서만 Microsoft PKCE 로그인을 사용할 수 있어요.');
  }

  const codeVerifier = randomBase64Url(48);
  const state = randomBase64Url(24);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const redirectUri = getOneNoteRedirectUri();

  writePkceTemp({
    codeVerifier,
    state,
    clientId: cleanClientId,
    tenant: cleanTenant,
    redirectUri,
  });

  const authParams = new URLSearchParams({
    client_id: cleanClientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: prompt || 'select_account',
  });

  window.location.assign(
    `https://login.microsoftonline.com/${encodeURIComponent(cleanTenant)}/oauth2/v2.0/authorize?${authParams.toString()}`
  );
}

/**
 * Microsoft 로그인 리디렉션 복귀 시 URL의 ?code=...를 토큰으로 교환합니다.
 */
export async function completeOneNoteAuthRedirectIfPresent() {
  if (typeof window === 'undefined' || !window.location || !window.location.search) {
    return { handled: false };
  }
  const params = new URLSearchParams(window.location.search);
  const oauthErr = params.get('error');
  const code = params.get('code');
  const state = params.get('state');
  const pkce = readPkceTemp();

  if (!oauthErr && (!code || !pkce)) {
    return { handled: false };
  }

  // URL에서 OAuth 파라미터 정리
  if (window.history && typeof window.history.replaceState === 'function') {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  }
  writePkceTemp(null);

  if (oauthErr) {
    const desc = params.get('error_description') || oauthErr;
    if (/AADSTS700016|not found in the directory/i.test(desc)) {
      return {
        handled: true,
        ok: false,
        error:
          'Microsoft 로그인 오류 (AADSTS700016): 현재 선택한 테넌트(학교·조직 디렉터리)에 이 Azure 앱이 등록되어 있지 않아요. 개인 Microsoft 계정용 앱이라면 아래 [👤 개인 계정 전용(consumers)으로 바로 로그인]을 눌러 주세요. (자세한 해결법은 아래 안내 참고)',
      };
    }
    return { handled: true, ok: false, error: `Microsoft 로그인 실패: ${desc}` };
  }

  if (!pkce || pkce.state !== state) {
    return { handled: true, ok: false, error: 'OAuth 보안 state 검증에 실패했어요. 다시 로그인해 주세요.' };
  }

  try {
    const tok = await exchangeTokenEndpoint(pkce.tenant || 'common', {
      client_id: pkce.clientId,
      scope: OAUTH_SCOPES,
      code,
      redirect_uri: pkce.redirectUri || getOneNoteRedirectUri(),
      grant_type: 'authorization_code',
      code_verifier: pkce.codeVerifier,
    });

    const me = await graphFetch('/me?$select=displayName,mail,userPrincipalName', tok.access_token);
    const expiresInSec = Number(tok.expires_in) || 3600;
    const authObj = {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token || '',
      expiresAt: Date.now() + expiresInSec * 1000,
      mode: 'pkce',
      userName: (me && me.displayName) || '',
      userEmail: (me && (me.mail || me.userPrincipalName)) || '',
      clientId: pkce.clientId,
      tenant: pkce.tenant || 'common',
    };
    setOneNoteAuth(authObj);
    return { handled: true, ok: true, auth: authObj };
  } catch (err) {
    return {
      handled: true,
      ok: false,
      error: `Microsoft 로그인 완료 실패: ${(err && err.message) || err}`,
    };
  }
}

/**
 * Graph Explorer 등에서 복사한 Access Token을 검증하고 저장합니다.
 */
export async function verifyDirectToken(rawToken) {
  const token = String(rawToken || '').trim().replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('Microsoft Graph 액세스 토큰을 입력해 주세요.');
  }
  const me = await graphFetch('/me?$select=displayName,mail,userPrincipalName', token);
  const expMs = decodeJwtExpiryMs(token);
  const authObj = {
    accessToken: token,
    refreshToken: '',
    expiresAt: expMs,
    mode: 'token',
    userName: (me && me.displayName) || '',
    userEmail: (me && (me.mail || me.userPrincipalName)) || '',
    clientId: '',
    tenant: 'common',
  };
  setOneNoteAuth(authObj);
  return authObj;
}

/**
 * 유효한 Microsoft Graph Access Token을 반환하며, PKCE 리프레시 토큰이 있으면 자동 갱신합니다.
 */
export async function ensureValidAccessToken(cfgOneNote = {}) {
  const auth = getOneNoteAuth();
  if (!auth || (!auth.accessToken && !auth.refreshToken)) {
    throw new Error('Microsoft OneNote 계정이 연결되지 않았어요.');
  }

  const expiringSoon = Boolean(auth.expiresAt && auth.expiresAt - 60000 <= Date.now());
  if (!expiringSoon && auth.accessToken) {
    return auth.accessToken;
  }

  const clientId = auth.clientId || (cfgOneNote && cfgOneNote.clientId) || '';
  const tenant = auth.tenant || (cfgOneNote && cfgOneNote.tenant) || 'common';
  if (auth.refreshToken && clientId) {
    const tok = await exchangeTokenEndpoint(tenant, {
      client_id: clientId,
      scope: OAUTH_SCOPES,
      refresh_token: auth.refreshToken,
      grant_type: 'refresh_token',
    });
    const expiresInSec = Number(tok.expires_in) || 3600;
    const nextAuth = {
      ...auth,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token || auth.refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    setOneNoteAuth(nextAuth);
    return nextAuth.accessToken;
  }

  if (expiringSoon) {
    const err = new Error('연결된 OneNote 액세스 토큰이 만료되었어요. 다시 연결해 주세요.');
    err.code = 'onenote_auth';
    throw err;
  }

  return auth.accessToken;
}

export async function listNotebooks(accessToken) {
  const res = await graphFetch(
    '/me/onenote/notebooks?$select=id,displayName,lastModifiedDateTime&$orderby=lastModifiedDateTime desc',
    accessToken
  );
  return (res && Array.isArray(res.value) ? res.value : []);
}

export async function createNotebook(accessToken, displayName) {
  return await graphFetch('/me/onenote/notebooks', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: String(displayName || '공부 계획표') }),
  });
}

export async function listSections(accessToken, notebookId = '') {
  const path = notebookId
    ? `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`
    : '/me/onenote/sections?$select=id,displayName&$top=50';
  const res = await graphFetch(path, accessToken);
  return (res && Array.isArray(res.value) ? res.value : []);
}

export async function createSection(accessToken, notebookId, displayName) {
  return await graphFetch(
    `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: String(displayName || '공부 계획표 메모') }),
    }
  );
}

/**
 * 대상 OneNote 섹션을 확보합니다 (설정된 섹션이 없으면 기본 노트북/섹션 생성·선택).
 */
export async function ensureTargetSection(accessToken, cfgOneNote = {}) {
  if (cfgOneNote && cfgOneNote.sectionId) {
    return {
      notebookId: cfgOneNote.notebookId || '',
      notebookName: cfgOneNote.notebookName || '',
      sectionId: cfgOneNote.sectionId,
      sectionName: cfgOneNote.sectionName || '공부 계획표 메모',
    };
  }

  const desiredSection = (cfgOneNote && cfgOneNote.sectionName) || '공부 계획표 메모';
  let notebookId = (cfgOneNote && cfgOneNote.notebookId) || '';
  let notebookName = (cfgOneNote && cfgOneNote.notebookName) || '';

  if (!notebookId) {
    let notebooks = await listNotebooks(accessToken);
    if (!notebooks.length) {
      const createdNb = await createNotebook(accessToken, '공부 계획표');
      notebooks = [createdNb];
    }
    const preferred =
      notebooks.find((n) => n.displayName === '공부 계획표') || notebooks[0];
    notebookId = preferred.id;
    notebookName = preferred.displayName || '공부 계획표';
  }

  const sections = await listSections(accessToken, notebookId);
  let targetSec = sections.find((s) => s.displayName === desiredSection);
  if (!targetSec) {
    targetSec = await createSection(accessToken, notebookId, desiredSection);
  }

  return {
    notebookId,
    notebookName,
    sectionId: targetSec.id,
    sectionName: targetSec.displayName || desiredSection,
  };
}

export async function listSectionPages(accessToken, sectionId) {
  const res = await graphFetch(
    `/me/onenote/sections/${encodeURIComponent(
      sectionId
    )}/pages?$select=id,title,createdDateTime,lastModifiedDateTime,links&$top=50&$orderby=lastModifiedDateTime desc`,
    accessToken
  );
  return (res && Array.isArray(res.value) ? res.value : []);
}

export async function getPageHtmlContent(accessToken, pageId) {
  return await graphFetch(
    `/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    accessToken,
    { expectText: true }
  );
}

export async function createOneNotePage(accessToken, sectionId, note) {
  return await graphFetch(
    `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: noteToOneNoteHtml(note),
    }
  );
}

export async function updateOneNotePage(accessToken, pageId, note) {
  await graphFetch(
    `/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteToOneNotePatchPayload(note)),
      expectText: true,
    }
  );
  return await graphFetch(
    `/me/onenote/pages/${encodeURIComponent(pageId)}?$select=id,title,lastModifiedDateTime,links`,
    accessToken
  );
}

export async function deleteOneNotePage(accessToken, pageId) {
  try {
    await graphFetch(`/me/onenote/pages/${encodeURIComponent(pageId)}`, accessToken, {
      method: 'DELETE',
      expectText: true,
    });
  } catch (err) {
    if (err && err.status === 404) return;
    throw err;
  }
}

function extractPageLinks(pageObj) {
  const links = pageObj && pageObj.links ? pageObj.links : {};
  return {
    webUrl: (links.oneNoteWebUrl && links.oneNoteWebUrl.href) || '',
    clientUrl: (links.oneNoteClientUrl && links.oneNoteClientUrl.href) || '',
  };
}

/**
 * 단일 메모만 즉시 Microsoft OneNote로 생성 또는 업데이트합니다.
 */
export async function pushSingleNoteToOneNote({ note, cfgOneNote = {} }) {
  const accessToken = await ensureValidAccessToken(cfgOneNote);
  const target = await ensureTargetSection(accessToken, cfgOneNote);
  const nextCfgOneNote = {
    ...defaultOneNoteConfig(),
    ...(cfgOneNote || {}),
    ...target,
  };

  let remotePage = null;
  if (note.onenotePageId) {
    try {
      remotePage = await updateOneNotePage(accessToken, note.onenotePageId, note);
    } catch (err) {
      if (err && err.status === 404) {
        remotePage = await createOneNotePage(accessToken, target.sectionId, note);
      } else {
        throw err;
      }
    }
  } else {
    remotePage = await createOneNotePage(accessToken, target.sectionId, note);
  }

  const nowIso = new Date().toISOString();
  const links = extractPageLinks(remotePage);
  const updatedNote = {
    ...note,
    onenotePageId: remotePage.id || note.onenotePageId,
    onenoteSectionId: target.sectionId,
    onenoteSectionName: target.sectionName,
    onenoteWebUrl: links.webUrl || note.onenoteWebUrl || '',
    onenoteClientUrl: links.clientUrl || note.onenoteClientUrl || '',
    remoteModifiedAt: remotePage.lastModifiedDateTime || nowIso,
    lastSyncedAt: nowIso,
    dirty: false,
  };

  return { updatedNote, nextCfgOneNote };
}

/**
 * 웹앱과 Microsoft OneNote 섹션 간 전체 양방향 동기화를 실행합니다.
 */
export async function syncNotesBidirectional({ notesState, cfgOneNote = {} }) {
  const accessToken = await ensureValidAccessToken(cfgOneNote);
  const target = await ensureTargetSection(accessToken, cfgOneNote);
  const nextCfgOneNote = {
    ...defaultOneNoteConfig(),
    ...(cfgOneNote || {}),
    ...target,
  };

  const working = normalizeNotesState(CL(notesState));
  const remotePages = await listSectionPages(accessToken, target.sectionId);
  const plan = planBidirectionalSync({
    localState: working,
    remotePages,
    sectionId: target.sectionId,
  });

  const nowIso = new Date().toISOString();
  let pushed = 0;
  let pulled = 0;
  let deleted = 0;

  // 1. 로컬에서 삭제된 페이지 원노트에서도 삭제
  for (const pageId of plan.toDeleteRemote) {
    await deleteOneNotePage(accessToken, pageId);
    working.deletedPageIds = working.deletedPageIds.filter((id) => id !== pageId);
    deleted += 1;
  }

  // 2. 새 로컬 메모 -> OneNote 페이지 생성
  for (const item of plan.toCreateRemote) {
    const created = await createOneNotePage(accessToken, target.sectionId, item);
    const links = extractPageLinks(created);
    const localIdx = working.items.findIndex((x) => x.id === item.id);
    if (localIdx !== -1) {
      working.items[localIdx] = {
        ...working.items[localIdx],
        onenotePageId: created.id,
        onenoteSectionId: target.sectionId,
        onenoteSectionName: target.sectionName,
        onenoteWebUrl: links.webUrl,
        onenoteClientUrl: links.clientUrl,
        remoteModifiedAt: created.lastModifiedDateTime || nowIso,
        lastSyncedAt: nowIso,
        dirty: false,
      };
    }
    pushed += 1;
  }

  // 3. 수정된 로컬 메모 -> OneNote 페이지 PATCH 업데이트
  for (const item of plan.toUpdateRemote) {
    let updatedPage;
    try {
      updatedPage = await updateOneNotePage(accessToken, item.onenotePageId, item);
    } catch (err) {
      if (err && err.status === 404) {
        updatedPage = await createOneNotePage(accessToken, target.sectionId, item);
      } else {
        throw err;
      }
    }
    const links = extractPageLinks(updatedPage);
    const localIdx = working.items.findIndex((x) => x.id === item.id);
    if (localIdx !== -1) {
      working.items[localIdx] = {
        ...working.items[localIdx],
        onenotePageId: (updatedPage && updatedPage.id) || item.onenotePageId,
        onenoteSectionId: target.sectionId,
        onenoteSectionName: target.sectionName,
        onenoteWebUrl: links.webUrl || working.items[localIdx].onenoteWebUrl,
        onenoteClientUrl: links.clientUrl || working.items[localIdx].onenoteClientUrl,
        remoteModifiedAt: (updatedPage && updatedPage.lastModifiedDateTime) || nowIso,
        lastSyncedAt: nowIso,
        dirty: false,
      };
    }
    pushed += 1;
  }

  // 4. OneNote에서 새로 추가되었거나 더 최신으로 수정된 페이지 -> 로컬로 가져오기
  for (const { remote, localItem } of plan.toPullRemote) {
    const html = await getPageHtmlContent(accessToken, remote.id);
    const parsed = parseOneNotePageHtml(html, remote);
    const links = extractPageLinks(remote);
    const remoteMod = remote.lastModifiedDateTime || nowIso;

    if (localItem) {
      const idx = working.items.findIndex((x) => x.id === localItem.id);
      if (idx !== -1) {
        working.items[idx] = {
          ...working.items[idx],
          title: parsed.title,
          content: parsed.content,
          subject: parsed.subject || working.items[idx].subject || '일반',
          date: parsed.date || working.items[idx].date || '',
          color: parsed.color || working.items[idx].color || 'yellow',
          onenotePageId: remote.id,
          onenoteSectionId: target.sectionId,
          onenoteSectionName: target.sectionName,
          onenoteWebUrl: links.webUrl || working.items[idx].onenoteWebUrl,
          onenoteClientUrl: links.clientUrl || working.items[idx].onenoteClientUrl,
          updatedAt: remoteMod,
          remoteModifiedAt: remoteMod,
          lastSyncedAt: nowIso,
          dirty: false,
        };
      }
    } else {
      const embeddedIdx = parsed.embeddedNoteId
        ? working.items.findIndex((x) => x.id === parsed.embeddedNoteId)
        : -1;
      if (embeddedIdx !== -1) {
        working.items[embeddedIdx] = {
          ...working.items[embeddedIdx],
          title: parsed.title,
          content: parsed.content,
          subject: parsed.subject || working.items[embeddedIdx].subject || '일반',
          date: parsed.date || working.items[embeddedIdx].date || '',
          color: parsed.color || working.items[embeddedIdx].color || 'yellow',
          onenotePageId: remote.id,
          onenoteSectionId: target.sectionId,
          onenoteSectionName: target.sectionName,
          onenoteWebUrl: links.webUrl,
          onenoteClientUrl: links.clientUrl,
          updatedAt: remoteMod,
          remoteModifiedAt: remoteMod,
          lastSyncedAt: nowIso,
          dirty: false,
        };
      } else {
        working.items.push({
          id:
            parsed.embeddedNoteId ||
            `on_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          title: parsed.title,
          content: parsed.content,
          subject: parsed.subject || '일반',
          date: parsed.date || '',
          color: parsed.color || 'yellow',
          pinned: false,
          createdAt: remote.createdDateTime || remoteMod,
          updatedAt: remoteMod,
          onenotePageId: remote.id,
          onenoteSectionId: target.sectionId,
          onenoteSectionName: target.sectionName,
          onenoteWebUrl: links.webUrl,
          onenoteClientUrl: links.clientUrl,
          lastSyncedAt: nowIso,
          remoteModifiedAt: remoteMod,
          dirty: false,
        });
      }
    }
    pulled += 1;
  }

  // 5. OneNote 쪽에서 삭제된 페이지 로컬에서도 제거
  if (plan.deletedRemotelyLocalIds.length) {
    const rmSet = new Set(plan.deletedRemotelyLocalIds);
    working.items = working.items.filter((x) => !rmSet.has(x.id));
    deleted += plan.deletedRemotelyLocalIds.length;
  }

  working.lastFullSyncAt = nowIso;
  return {
    nextNotesState: normalizeNotesState(working),
    nextCfgOneNote,
    stats: { pushed, pulled, deleted },
  };
}
