// Isolated-world bridge. No chat payload is forwarded to extension APIs.
(() => {
  const CHANNEL = 'wa-bulk-export-v1';
  let state = {
    phase: 'connecting',
    message: 'Connessione a WhatsApp Web...',
    total: 0, current: 0, messages: 0, failed: 0
  };

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.channel !== CHANNEL || event.data?.type !== 'STATUS') return;
    const update = event.data.state;
    if (!update || typeof update !== 'object' || typeof update.phase !== 'string') return;
    // Whitelist primitive status values. Never pass arbitrary page data on to extension privileges.
    state = {
      phase: String(update.phase),
      message: String(update.message || ''),
      chat: String(update.chat || ''),
      current: Number(update.current) || 0,
      total: Number(update.total) || 0,
      messages: Number(update.messages) || 0,
      failed: Number(update.failed) || 0
    };
  });

  browser.runtime.onMessage.addListener(message => {
    if (message?.type === 'STATE') {
      window.postMessage({ channel: CHANNEL, type: 'COMMAND', command: 'STATE' }, location.origin);
      return Promise.resolve(state);
    }
    if (message?.type === 'START' || message?.type === 'CANCEL') {
      window.postMessage({ channel: CHANNEL, type: 'COMMAND', command: message.type }, location.origin);
      return Promise.resolve({ ok: true });
    }
    return undefined;
  });

  window.postMessage({ channel: CHANNEL, type: 'COMMAND', command: 'STATE' }, location.origin);
})();
