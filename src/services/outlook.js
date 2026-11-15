import { CL } from '../core/units.js';
import { normalizeNotesState, planOutlookSync } from '../core/onenote.js';
import {
  ensureValidAccessToken,
  graphFetch,
  hasOutlookScope,
} from './onenote.js';

const PREFER_TEXT = { Prefer: 'outlook.body-content-type="text"' };
const STICKY_CLASS_PROP = [{ id: 'String 0x001A', value: 'IPM.StickyNote' }];

function friendlyError(err) {
  const msg = (err && err.message) || String(err);
  if (err && (err.status === 403 || /access is denied|ErrorAccessDenied/i.test(msg))) {
    return new Error(
      'Outlook 메일함 접근이 거부됐어요. Entra 앱의 API 권한에 Mail.ReadWrite(위임됨)를 추가하고, 설정 패널의 [📬 Outlook 메모 권한 포함 로그인]으로 다시 로그인해 주세요. 학교에서 동의를 막았다면 관리자 승인이 필요해요.'
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

/**
 * Outlook '메모' 폴더 ID를 찾습니다 (well-known 'notes' → 폴더명 '메모'/'Notes' 검색).
 */
export async function findNotesFolder(token, cachedId = '') {
  if (cachedId) {
    try {
      const f = await graphFetch(`/me/mailFolders/${encodeURIComponent(cachedId)}?$select=id,displayName`, token);
      if (f && f.id) return { id: f.id, name: f.displayName || '' };
    } catch {
      // fall through to rediscovery
    }
  }
  try {
    const f = await graphFetch('/me/mailFolders/notes?$select=id,displayName', token);
    if (f && f.id) return { id: f.id, name: f.displayName || '' };
  } catch {
    // well-known alias may be unsupported; search by name
  }
  const res = await graphFetch('/me/mailFolders?$top=100&$select=id,displayName', token);
  const list = res && Array.isArray(res.value) ? res.value : [];
  const hit = list.find((x) => /^(메모|notes)$/i.test(String(x.displayName || '').trim()));
  if (hit) return { id: hit.id, name: hit.displayName };
  const err = new Error(
    `Outlook '메모' 폴더를 찾지 못했어요. (확인된 폴더: ${list
      .map((x) => x.displayName)
      .slice(0, 12)
      .join(', ')})`
  );
  err.code = 'no_notes_folder';
  throw err;
}

async function listFolderNotes(token, folderId) {
  const out = [];
  let url = `/me/mailFolders/${encodeURIComponent(
    folderId
  )}/messages?$top=50&$select=id,subject,body,createdDateTime,lastModifiedDateTime&$orderby=lastModifiedDateTime desc`;
  let pages = 0;
  while (url && pages < 10) {
    const res = await graphFetch(url, token, { headers: PREFER_TEXT });
    if (res && Array.isArray(res.value)) out.push(...res.value);
    url = res && res['@odata.nextLink'] ? res['@odata.nextLink'] : '';
    pages += 1;
  }
  return { items: out, complete: !url };
}

async function createOutlookNote(token, folderId, note) {
  const payload = {
    subject: note.title,
    body: { contentType: 'text', content: note.content || note.title },
  };
  const path = `/me/mailFolders/${encodeURIComponent(folderId)}/messages`;
  const post = (extra) =>
    graphFetch(path, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, ...extra }),
    });
  try {
    return await post({ singleValueExtendedProperties: STICKY_CLASS_PROP });
  } catch (err) {
    if (err && err.status === 400) return await post({});
    throw err;
  }
}

async function updateOutlookNote(token, outlookId, note) {
  return await graphFetch(`/me/messages/${encodeURIComponent(outlookId)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: note.title,
      body: { contentType: 'text', content: note.content || note.title },
    }),
  });
}

/**
 * 웹앱 스티커 메모 ↔ Outlook '메모' 폴더 양방향 동기화 (삭제는 동기화하지 않음).
 */
export async function syncOutlookNotes({ notesState, cfgOneNote = {} }) {
  if (!hasOutlookScope()) {
    const e = new Error(
      'Outlook 메모 권한(Mail.ReadWrite)이 없어요. [📬 Outlook 메모 권한 포함 로그인]으로 다시 로그인해 주세요.'
    );
    e.code = 'no_mail_scope';
    throw e;
  }
  try {
    const token = await ensureValidAccessToken(cfgOneNote);
    const folder = await findNotesFolder(token, cfgOneNote.outlookFolderId || '');
    const { items: remote, complete } = await listFolderNotes(token, folder.id);

    const working = normalizeNotesState(CL(notesState));
    const plan = planOutlookSync({ localState: working, remoteNotes: remote, complete });
    const nowIso = new Date().toISOString();
    const stats = { pushed: 0, pulled: 0, failed: 0, remoteTotal: remote.length, firstError: '' };
    const fail = (err) => {
      stats.failed += 1;
      if (!stats.firstError) stats.firstError = (err && err.message) || String(err);
    };

    for (const item of plan.toCreateRemote) {
      try {
        const created = await createOutlookNote(token, folder.id, item);
        const idx = working.items.findIndex((x) => x.id === item.id);
        if (idx !== -1 && created && created.id) {
          working.items[idx] = {
            ...working.items[idx],
            outlookId: created.id,
            outlookModifiedAt: created.lastModifiedDateTime || nowIso,
            outlookSyncedAt: nowIso,
          };
        }
        stats.pushed += 1;
      } catch (err) {
        fail(err);
      }
    }

    for (const item of plan.toUpdateRemote) {
      try {
        const upd = await updateOutlookNote(token, item.outlookId, item);
        const idx = working.items.findIndex((x) => x.id === item.id);
        if (idx !== -1) {
          working.items[idx] = {
            ...working.items[idx],
            outlookModifiedAt: (upd && upd.lastModifiedDateTime) || nowIso,
            outlookSyncedAt: nowIso,
          };
        }
        stats.pushed += 1;
      } catch (err) {
        fail(err);
      }
    }

    for (const { remote: r, localItem } of plan.toPull) {
      const body = String((r.body && r.body.content) || '').replace(/\r\n/g, '\n').trim();
      const subject = String(r.subject || '').trim();
      const title = subject || body.split('\n')[0].slice(0, 42) || '제목 없는 메모';
      const remoteMod = r.lastModifiedDateTime || nowIso;
      if (localItem) {
        const idx = working.items.findIndex((x) => x.id === localItem.id);
        if (idx !== -1) {
          working.items[idx] = {
            ...working.items[idx],
            title,
            content: body,
            updatedAt: remoteMod,
            outlookModifiedAt: remoteMod,
            outlookSyncedAt: nowIso,
            dirty: true,
          };
        }
      } else {
        working.items.push({
          id: `ol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          content: body,
          subject: '일반',
          date: '',
          color: 'purple',
          pinned: false,
          createdAt: r.createdDateTime || remoteMod,
          updatedAt: remoteMod,
          outlookId: r.id,
          outlookModifiedAt: remoteMod,
          outlookSyncedAt: nowIso,
          dirty: true,
        });
      }
      stats.pulled += 1;
    }

    if (plan.unlinkLocalIds.length) {
      const un = new Set(plan.unlinkLocalIds);
      working.items = working.items.map((x) =>
        un.has(x.id) ? { ...x, outlookId: '', outlookModifiedAt: '', outlookSyncedAt: '' } : x
      );
    }

    working.lastOutlookSyncAt = nowIso;
    return {
      nextNotesState: normalizeNotesState(working),
      nextCfgOneNote: { ...cfgOneNote, outlookFolderId: folder.id },
      stats: { ...stats, unlinked: plan.unlinkLocalIds.length, folderName: folder.name },
    };
  } catch (err) {
    throw friendlyError(err);
  }
}
