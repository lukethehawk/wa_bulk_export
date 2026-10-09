import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChat, normalizeMessage, readHistory, renderText, safeFilename } from '../src/core.js';

const msg = (id, t, body = '') => ({ id: { _serialized: id, fromMe: false }, t, body, type: 'chat', from: { _serialized: 'sender@c.us' } });

test('normalizes chat identifiers, text, sender and timestamps', () => {
  assert.deepEqual(normalizeChat({id: {_serialized: '123@g.us'}, name:'Amici', archive:true}), {
    id: '123@g.us', name: 'Amici', archived: true, isGroup: true
  });
  assert.equal(normalizeMessage(msg('1', 1700000000, 'Ciao')).datetime, '2023-11-14T22:13:20.000Z');
  assert.equal(normalizeMessage(msg('1', 1700000000, 'Ciao')).sender, 'sender@c.us');
});

test('reads overlapping history pages, deduplicates and sorts ascending', async () => {
  const cursors = [];
  const pages = [
    [msg('3', 300), msg('2', 200)],
    [msg('2', 200), msg('1', 100)],
    [msg('1', 100)],
    []
  ];
  const result = await readHistory(async cursor => { cursors.push(cursor); return pages.shift(); });
  assert.deepEqual(cursors, [null, '2', '1']);
  assert.deepEqual(result.messages.map(x => x.id), ['1', '2', '3']);
  assert.equal(result.status, 'available_history_exhausted');
});

test('halts on repeated full page and avoids infinite loops', async () => {
  let calls = 0;
  const page = Array.from({ length: 250 }, (_, index) => msg(String(index), index + 1));
  const result = await readHistory(async () => { calls++; return page; });
  assert.equal(calls, 2);
  assert.equal(result.status, 'pagination_stalled');
});

test('preserves text and rejects unsafe ZIP filename characters', () => {
  assert.equal(safeFilename('A/B:*?"<>|'), 'A_B______');
  const text = renderText({name:'Mario', id:'123'}, [normalizeMessage(msg('1', 1700000000, 'Ciao\ncome va?'))]);
  assert.match(text, /Ciao\ncome va\?/);
});

test('can cancel before requesting the next page', async () => {
  await assert.rejects(
    readHistory(async () => [msg('1', 100)], () => {}, () => true),
    { name: 'ExportCancelledError' }
  );
});
