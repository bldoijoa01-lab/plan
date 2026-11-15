const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

let schemaInitialized = false;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  });
}

async function ensureSchema(db) {
  if (schemaInitialized) return;
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)'
    )
    .run();
  schemaInitialized = true;
}

function extractToken(request, body) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const xTok = request.headers.get('X-Auth-Token');
  if (xTok) return xTok.trim();
  if (body && typeof body.token === 'string') return body.token.trim();
  return '';
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyToken(db, env, token) {
  if (!token) return false;
  if (env && typeof env.UI_TOKEN === 'string' && timingSafeEqual(token, env.UI_TOKEN)) {
    return true;
  }
  if (env && typeof env.API_TOKEN === 'string' && timingSafeEqual(token, env.API_TOKEN)) {
    return true;
  }
  try {
    const res = await db
      .prepare("SELECT k, v FROM props WHERE k IN ('UI_TOKEN', 'AI_WRITE_TOKEN')")
      .all();
    const rows = res && res.results ? res.results : [];
    return rows.some((r) => typeof r.v === 'string' && timingSafeEqual(token, r.v));
  } catch {
    return false;
  }
}

function isValidPath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 200 && !path.startsWith('/') && !path.includes('..');
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function handleAction(db, payload) {
  const action = payload.action;
  const now = new Date().toISOString();

  if (action === 'boot') {
    const res = await db.prepare('SELECT path, data, updated_at FROM docs ORDER BY path ASC').all();
    const docs = {};
    for (const row of res.results || []) {
      const parsed = parseJsonSafe(row.data);
      if (parsed !== null) docs[row.path] = parsed;
    }
    return json({ ok: true, docs, serverTime: now });
  }

  if (action === 'collection') {
    const prefix = typeof payload.prefix === 'string' ? payload.prefix : '';
    const res = prefix
      ? await db.prepare('SELECT path, data, updated_at FROM docs WHERE path LIKE ?1 ORDER BY path ASC').bind(prefix + '%').all()
      : await db.prepare('SELECT path, data, updated_at FROM docs ORDER BY path ASC').all();
    const docs = {};
    for (const row of res.results || []) {
      const parsed = parseJsonSafe(row.data);
      if (parsed !== null) docs[row.path] = parsed;
    }
    return json({ ok: true, docs });
  }

  if (action === 'get') {
    const path = payload.path;
    if (!isValidPath(path)) return json({ ok: false, code: 'bad_request', error: '올바른 문서 경로가 아니에요.' }, 400);
    const row = await db.prepare('SELECT data, updated_at FROM docs WHERE path = ?1').bind(path).first();
    if (!row) return json({ ok: true, path, exists: false, data: null });
    return json({ ok: true, path, exists: true, data: parseJsonSafe(row.data), updated_at: row.updated_at });
  }

  if (action === 'set') {
    const path = payload.path;
    if (!isValidPath(path) || payload.data === undefined) {
      return json({ ok: false, code: 'bad_request', error: 'path와 data가 필요해요.' }, 400);
    }
    const serialized = JSON.stringify(payload.data);
    await db
      .prepare(
        'INSERT INTO docs (path, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
      )
      .bind(path, serialized, now)
      .run();
    return json({ ok: true, path, updated_at: now });
  }

  if (action === 'batch_set') {
    const entries = payload.docs && typeof payload.docs === 'object' ? Object.entries(payload.docs) : [];
    if (!entries.length) return json({ ok: false, code: 'bad_request', error: '저장할 문서가 없어요.' }, 400);
    const stmts = [];
    for (const [path, data] of entries) {
      if (!isValidPath(path)) {
        return json({ ok: false, code: 'bad_request', error: `잘못된 경로: ${path}` }, 400);
      }
      stmts.push(
        db
          .prepare(
            'INSERT INTO docs (path, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
          )
          .bind(path, JSON.stringify(data), now)
      );
    }
    // Chunk D1 batch in groups of 50 statements
    for (let i = 0; i < stmts.length; i += 50) {
      await db.batch(stmts.slice(i, i + 50));
    }
    return json({ ok: true, count: entries.length, updated_at: now });
  }

  if (action === 'delete') {
    const path = payload.path;
    if (!isValidPath(path)) return json({ ok: false, code: 'bad_request', error: '올바른 문서 경로가 아니에요.' }, 400);
    await db.prepare('DELETE FROM docs WHERE path = ?1').bind(path).run();
    return json({ ok: true, path });
  }

  return json({ ok: false, code: 'bad_request', error: '지원하지 않는 action이에요.' }, 400);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/+/, '');

    if (request.method === 'GET' && !pathname && !url.searchParams.has('path') && !url.searchParams.has('prefix')) {
      return json({ ok: true, service: 'study-plan', version: 2 });
    }

    try {
      await ensureSchema(env.DB);

      let body = null;
      if (request.method === 'POST' || request.method === 'PUT') {
        const text = await request.text();
        if (text.trim()) {
          try {
            body = JSON.parse(text);
          } catch {
            return json({ ok: false, code: 'bad_request', error: '요청 본문이 올바른 JSON이 아니에요.' }, 400);
          }
        }
      }

      const token = extractToken(request, body);
      const authed = await verifyToken(env.DB, env, token);
      if (!authed) {
        return json({ ok: false, code: 'auth', error: '접속 토큰이 올바르지 않아요.' }, 401);
      }

      // REST-style routes: /docs/<path> or /?path=...
      if (request.method === 'GET') {
        if (pathname.startsWith('docs/')) {
          return await handleAction(env.DB, { action: 'get', path: decodeURIComponent(pathname.slice(5)) });
        }
        if (pathname === 'docs') {
          return await handleAction(env.DB, { action: 'collection', prefix: url.searchParams.get('prefix') || '' });
        }
        if (url.searchParams.has('path')) {
          return await handleAction(env.DB, { action: 'get', path: url.searchParams.get('path') });
        }
        if (url.searchParams.has('prefix')) {
          return await handleAction(env.DB, { action: 'collection', prefix: url.searchParams.get('prefix') });
        }
        return await handleAction(env.DB, { action: 'boot' });
      }

      if (request.method === 'PUT' && pathname.startsWith('docs/')) {
        return await handleAction(env.DB, {
          action: 'set',
          path: decodeURIComponent(pathname.slice(5)),
          data: body && body.data !== undefined ? body.data : body,
        });
      }

      if (request.method === 'DELETE' && pathname.startsWith('docs/')) {
        return await handleAction(env.DB, { action: 'delete', path: decodeURIComponent(pathname.slice(5)) });
      }

      if (request.method === 'POST') {
        if (pathname.startsWith('docs/')) {
          return await handleAction(env.DB, {
            action: 'set',
            path: decodeURIComponent(pathname.slice(5)),
            data: body && body.data !== undefined ? body.data : body,
          });
        }
        if (!body || typeof body !== 'object') {
          return json({ ok: false, code: 'bad_request', error: '요청 본문이 필요해요.' }, 400);
        }
        return await handleAction(env.DB, body);
      }

      return json({ ok: false, code: 'method_not_allowed', error: '허용되지 않은 메서드예요.' }, 405);
    } catch (e) {
      return json({ ok: false, code: 'server_error', error: '서버 오류: ' + String((e && e.message) || e) }, 500);
    }
  },

  async scheduled() {
    // Keep cron handler registered without mutating documents unexpectedly.
  },
};
