export const PAGE_SIZE = 250;

export function serializedId(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value._serialized === 'string') return value._serialized;
  if (typeof value.id === 'string') return value.id;
  if (typeof value.toString === 'function') {
    const result = value.toString();
    if (result && result !== '[object Object]') return result;
  }
  return '';
}

export function normalizeChat(chat) {
  const id = serializedId(chat?.id);
  return {
    id,
    name: String(chat?.formattedTitle || chat?.name || chat?.contact?.name || id || 'Chat senza nome'),
    archived: Boolean(chat?.archive),
    isGroup: Boolean(id.endsWith('@g.us'))
  };
}

export function normalizeMessage(message) {
  const id = serializedId(message?.id);
  const rawTime = Number(message?.t ?? message?.timestamp ?? 0);
  const timestamp = Number.isFinite(rawTime) && rawTime > 0
    ? (rawTime > 1e12 ? rawTime : rawTime * 1000)
    : 0;
  const body = message?.body ?? message?.caption ?? '';
  return {
    id,
    timestamp,
    datetime: timestamp ? new Date(timestamp).toISOString() : null,
    fromMe: Boolean(message?.id?.fromMe ?? message?.fromMe),
    sender: serializedId(message?.author) || serializedId(message?.from) || '',
    type: String(message?.type || 'unknown'),
    text: typeof body === 'string' ? body : String(body),
    hasMedia: Boolean(message?.hasMedia || message?.mediaData)
  };
}

export function safeFilename(input, maxLength = 76) {
  return String(input || 'chat')
    .replace(/[\\/<>:"|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, maxLength) || 'chat';
}

export function renderText(chat, messages) {
  const lines = ['Conversazione: ' + chat.name, 'ID: ' + chat.id, 'Messaggi: ' + messages.length, ''];
  for (const item of messages) {
    const sender = item.fromMe ? 'Io' : (item.sender || chat.name);
    const body = item.text || '[' + item.type + (item.hasMedia ? ': allegato non incluso' : '') + ']';
    lines.push('[' + (item.datetime || 'data sconosciuta') + '] ' + sender + ': ' + body);
  }
  return lines.join('\n');
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Esportazione interrotta');
    this.name = 'ExportCancelledError';
  }
}

/**
 * Reads available history in anchored pages. A zero-length page indicates
 * only that WhatsApp Web has no more messages to provide, not that the
 * phone's entire history was recovered.
 */
export async function readHistory(fetchPage, onProgress = () => {}, isCancelled = () => false) {
  const items = new Map();
  let cursor = null;
  let pages = 0;
  let stalled = false;
  while (pages < 50000) {
    if (isCancelled()) throw new ExportCancelledError();
    const batch = await fetchPage(cursor, PAGE_SIZE);
    if (!Array.isArray(batch)) throw new Error('WhatsApp non ha restituito una lista di messaggi.');
    if (batch.length === 0) break;
    pages++;

    const normalized = batch.map(normalizeMessage);
    let fresh = 0;
    for (const item of normalized) {
      const key = item.id || [item.timestamp, item.sender, item.type, item.text].join(':');
      if (!items.has(key)) {
        items.set(key, item);
        fresh++;
      }
    }
    onProgress(items.size);

    const withIds = normalized.filter(item => item.id);
    if (!withIds.length || fresh === 0) {
      stalled = batch.length >= PAGE_SIZE || !withIds.length;
      break;
    }
    const oldest = withIds.reduce((a, b) =>
      (a.timestamp || Infinity) <= (b.timestamp || Infinity) ? a : b
    );
    if (oldest.id === cursor) {
      stalled = true;
      break;
    }
    cursor = oldest.id;
  }
  if (pages >= 50000) stalled = true;
  return {
    messages: [...items.values()].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id)),
    pages,
    status: stalled ? 'pagination_stalled' : 'available_history_exhausted'
  };
}
