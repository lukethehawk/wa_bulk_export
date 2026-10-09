import { Zip, ZipDeflate, strToU8 } from 'fflate';
import { ExportCancelledError, normalizeChat, normalizeMessage, readHistory, renderText, safeFilename, PAGE_SIZE } from './core.js';

(() => {
  const CHANNEL = 'wa-bulk-export-v1';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let running = false;
  let cancelled = false;
  let status = {
    phase: 'connecting',
    message: 'Connessione a WhatsApp Web...',
    total: 0,
    current: 0,
    messages: 0,
    failed: 0
  };

  const emit = update => {
    status = { ...status, ...update };
    window.postMessage({ channel: CHANNEL, type: 'STATUS', state: status }, location.origin);
  };

  async function waitForWpp() {
    for (let attempt = 0; attempt < 150; attempt++) {
      const wpp = window.WPP;
      if (wpp?.isReady && typeof wpp.chat?.list === 'function' &&
          typeof wpp.chat?.getMessages === 'function') return wpp;
      await sleep(400);
    }
    throw new Error('WA-JS non si è inizializzato. Ricarica WhatsApp Web e verifica di essere connesso.');
  }

  const ready = waitForWpp();
  ready.then(() => {
    if (!running) emit({ phase: 'ready', message: 'Pronto per esportare tutte le chat.' });
  }).catch(error => {
    if (!running) emit({ phase: 'error', message: error.message });
  });

  function makeZip() {
    const parts = [];
    let rejectDone;
    let resolveDone;
    const completed = new Promise((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    const zip = new Zip((error, data, final) => {
      if (error) {
        rejectDone(error);
        return;
      }
      if (data?.length) parts.push(data);
      if (final) resolveDone(new Blob(parts, { type: 'application/zip' }));
    });
    return {
      add(path, content) {
        const entry = new ZipDeflate(path, { level: 5 });
        zip.add(entry);
        entry.push(strToU8(content), true);
      },
      async finish() {
        zip.end();
        return completed;
      }
    };
  }

  function download(blob) {
    const now = new Date();
    const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
    const filename = 'WA_Bulk_Export_' + date + '.zip';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return filename;
  }

  async function exportAll() {
    if (running) return;
    running = true;
    cancelled = false;
    let doneMessages = 0;
    let errors = 0;
    emit({ phase: 'starting', message: 'Lettura delle conversazioni...', total: 0, current: 0, messages: 0, failed: 0 });

    try {
      const wpp = await ready;
      if (cancelled) throw new ExportCancelledError();
      if (typeof wpp.conn?.isAuthenticated === 'function' && !await wpp.conn.isAuthenticated()) {
        throw new Error('Accedi a WhatsApp Web prima di avviare il backup.');
      }
      // WPP.chat.list() includes ordinary and archived chats.
      const rawChats = await wpp.chat.list({ ignoreGroupMetadata: true });
      const chats = rawChats.map(normalizeChat).filter(chat => chat.id);
      if (!chats.length) throw new Error('Nessuna conversazione disponibile in WhatsApp Web.');

      const archive = makeZip();
      const manifest = {
        application: 'WA Bulk Export',
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        scope: 'Messaggi disponibili tramite WhatsApp Web: non è garantita la cronologia completa sul telefono.',
        mediaFilesIncluded: false,
        totalChats: chats.length,
        chats: []
      };
      emit({ phase: 'running', total: chats.length, message: 'Esportazione in corso...' });

      for (let index = 0; index < chats.length; index++) {
        if (cancelled) throw new ExportCancelledError();
        const chat = chats[index];
        const prefix = String(index + 1).padStart(4, '0') + '_' + safeFilename(chat.name);
        emit({ phase: 'running', current: index + 1, chat: chat.name, messages: doneMessages,
          message: 'Recupero della conversazione ' + (index + 1) + ' di ' + chats.length });
        try {
          const result = await readHistory(
            async (cursor, count) => wpp.chat.getMessages(chat.id, cursor
              ? { count, direction: 'before', id: cursor }
              : { count, direction: 'before' }),
            count => emit({ messages: doneMessages + count }),
            () => cancelled
          );

          if (cancelled) throw new ExportCancelledError();

          // The default backwards anchor may be the last received (not sent)
          // message. Query messages after that anchor to also include outgoing
          // messages newer than the last incoming one.
          try {
            const recent = await wpp.chat.getMessages(chat.id, { count: PAGE_SIZE, direction: 'after' });
            const known = new Set(result.messages.map(message => message.id));
            for (const message of recent) {
              const item = normalizeMessage(message);
              if (item.id && !known.has(item.id)) {
                result.messages.push(item);
                known.add(item.id);
              }
            }
            result.messages.sort((a, b) => a.timestamp - b.timestamp);
          } catch (error) {
            console.warn('[WA Bulk Export] Impossibile recuperare i messaggi recenti:', error);
          }
          if (cancelled) throw new ExportCancelledError();

          const payload = { chat, exportedAt: new Date().toISOString(), pagination: result.status,
            messages: result.messages };
          archive.add(prefix + '.json', JSON.stringify(payload, null, 2));
          archive.add(prefix + '.txt', renderText(chat, result.messages));
          doneMessages += result.messages.length;
          manifest.chats.push({ ...chat, messages: result.messages.length, pages: result.pages,
            status: result.status, files: [prefix + '.json', prefix + '.txt'] });
          emit({ messages: doneMessages });
        } catch (error) {
          if (error instanceof ExportCancelledError) throw error;
          errors++;
          manifest.chats.push({ ...chat, messages: 0, status: 'error',
            error: String(error?.message || error) });
          emit({ failed: errors, message: 'Errore su ' + chat.name + ': passo alla chat successiva.' });
        }
        // Yield between chats so Firefox can redraw the interface.
        await sleep(25);
      }

      if (cancelled) throw new ExportCancelledError();
      manifest.completedAt = new Date().toISOString();
      manifest.successfulChats = manifest.chats.filter(c => c.status !== 'error').length;
      manifest.failedChats = errors;
      archive.add('manifest.json', JSON.stringify(manifest, null, 2));
      emit({ phase: 'packaging', message: 'Preparazione dello ZIP...' });
      const blob = await archive.finish();
      if (cancelled) throw new ExportCancelledError();
      const filename = download(blob);
      emit({ phase: 'done', current: chats.length, messages: doneMessages, failed: errors,
        message: 'Download avviato: ' + filename });
    } catch (error) {
      if (error instanceof ExportCancelledError) {
        emit({ phase: 'cancelled', message: 'Esportazione annullata. Nessun ZIP generato.' });
      } else {
        console.error('[WA Bulk Export]', error);
        emit({ phase: 'error', message: String(error?.message || error) });
      }
    } finally {
      running = false;
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.channel !== CHANNEL || event.data?.type !== 'COMMAND') return;
    if (event.data.command === 'START') void exportAll();
    if (event.data.command === 'CANCEL') cancelled = true;
    if (event.data.command === 'STATE') emit({});
  });
})();
