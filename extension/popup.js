const startButton = document.getElementById('start');
const cancelButton = document.getElementById('cancel');
const messageElement = document.getElementById('message');
const chatElement = document.getElementById('chat');
const progressElement = document.getElementById('progress');
const counterElement = document.getElementById('counter');
const countElement = document.getElementById('count');
const errorElement = document.getElementById('errors');
const hintElement = document.getElementById('hint');
let tabId = null;
let refreshing = false;

function render(state) {
  const phase = state?.phase || 'connecting';
  const isBusy = ['starting', 'running', 'packaging'].includes(phase);
  startButton.disabled = !['ready', 'done', 'error', 'cancelled'].includes(phase);
  startButton.hidden = isBusy;
  cancelButton.hidden = !isBusy;
  messageElement.textContent = state?.message || 'Attendo WhatsApp Web...';
  chatElement.textContent = phase === 'running' ? (state?.chat || '') : '';
  const current = Number(state?.current) || 0;
  const total = Number(state?.total) || 0;
  progressElement.style.width = total ? Math.min(100, Math.round(100 * current / total)) + '%' : '0%';
  counterElement.textContent = current + ' / ' + total + ' chat';
  countElement.textContent = (Number(state?.messages) || 0).toLocaleString('it-IT') + ' messaggi';
  const failed = Number(state?.failed) || 0;
  errorElement.hidden = failed === 0;
  errorElement.textContent = failed + ' chat non esportate: consulta manifest.json nello ZIP.';
}

async function send(type) {
  if (tabId === null) return;
  return browser.tabs.sendMessage(tabId, { type });
}

async function refresh() {
  if (refreshing || tabId === null) return;
  refreshing = true;
  try {
    const state = await send('STATE');
    render(state);
    hintElement.textContent = '';
  } catch {
    startButton.disabled = true;
    cancelButton.hidden = true;
    hintElement.textContent = 'Ricarica la scheda di WhatsApp Web dopo aver installato l’estensione.';
  } finally {
    refreshing = false;
  }
}

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url?.startsWith('https://web.whatsapp.com/')) {
    startButton.disabled = true;
    messageElement.textContent = 'Apri WhatsApp Web per iniziare.';
    hintElement.textContent = 'L’estensione opera esclusivamente su https://web.whatsapp.com/';
    return;
  }
  tabId = tab.id;
  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    try { await send('START'); } catch (error) { hintElement.textContent = String(error); }
    await refresh();
  });
  cancelButton.addEventListener('click', async () => {
    cancelButton.disabled = true;
    try { await send('CANCEL'); } catch (error) { hintElement.textContent = String(error); }
    setTimeout(() => { cancelButton.disabled = false; }, 1000);
  });
  await refresh();
  setInterval(refresh, 1000);
}
init().catch(error => {
  messageElement.textContent = 'Errore di inizializzazione.';
  hintElement.textContent = String(error);
});
