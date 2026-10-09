// Optional native smoke test for an explicitly selected Android device/emulator.
// Start only with FirePresenter's debug APK installed and ADB authorized.
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';

const serial = process.env.FIREPRESENTER_ADB_SERIAL;
if (!serial) throw Error('Set FIREPRESENTER_ADB_SERIAL to the specific test device.');
const root = fileURLToPath(new URL('../', import.meta.url));
const cdpPort = Number(process.env.FIREPRESENTER_CDP_PORT || 9229);
const uploadPort = Number(process.env.FIREPRESENTER_UPLOAD_PORT || 18767);
const adb = (...args) => execFileSync('adb', ['-s', serial, ...args], { encoding: 'utf8' });
const key = code => adb('shell', 'input', 'keyevent', String(code));
adb('shell', 'am', 'start', '-W', '-n', 'org.firepresenter.app/.MainActivity');
const pid = adb('shell', 'pidof', 'org.firepresenter.app').trim();
if (!/^\d+$/.test(pid)) throw Error('FirePresenter is not running.');
adb('forward', `tcp:${cdpPort}`, `localabstract:webview_devtools_remote_${pid}`);
await new Promise(resolve => setTimeout(resolve, 500));
const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const target = pages.find(page => page.type === 'page' && page.url === 'https://deck.local/assets/index.html');
if (!target) throw Error('The FirePresenter WebView is unavailable; install the debug APK.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) {
    const entry = pending.get(message.id);
    clearTimeout(entry.timer);
    entry.resolve(message);
    pending.delete(message.id);
  }
};
socket.onclose = () => {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(Error('The debug WebView closed.'));
  }
  pending.clear();
};
const send = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const timer = setTimeout(() => { pending.delete(id); reject(Error('Debug protocol timed out: ' + method)); }, 12000);
  pending.set(id, { resolve, reject, timer });
  socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.error || response.result?.exceptionDetails) throw Error(JSON.stringify(response));
  return response.result.result.value;
}
async function until(expression) {
  const end = Date.now() + 12000;
  do {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < end);
  throw Error('Timed out: ' + expression);
}
const state = () => evaluate('window.presenter.getState()');
const at = (mode, index) => until(`window.presenter.getState().mode===${JSON.stringify(mode)} && window.presenter.getState().index===${index} && !window.presenter.getState().importing`);
let uploadForwarded = false;

try {
  await evaluate("if(window.presenter.getState().mode!=='home')window.presenter.command('back')");
  await evaluate("if(window.presenter.getState().mode!=='home')window.presenter.command('back')");
  key(23); await at('bundled', 0);
  key(22); await at('bundled', 1);
  console.log('Native demo opened; checking slide links…');
  key(20); key(23); await at('bundled', 2);
  key(20); key(23); await at('bundled', 1);
  key(20); key(20); key(23); await at('bundled', 3);
  console.log('Native links passed; checking embedded video…');
  await until("document.getElementById('film').readyState>=2");
  key(23); await until('window.presenter.getState().media?.time>0.2');
  key(85); await until('window.presenter.getState().media.paused');
  key(22); await at('bundled', 4);
  assert.equal(await evaluate("document.getElementById('film').getAttribute('src')"), null);
  key(82); await until("!document.getElementById('toolbar').hidden");
  key(4); await until("document.getElementById('toolbar').hidden");
  key(4); await until("window.presenter.getState().mode==='home'");
  console.log('PASS: native DPAD links, video play/pause, media cleanup, Menu and Back');
  await mkdir(path.join(root, 'test-results'), { recursive: true });
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path.join(root, 'test-results/android-home.png'), Buffer.from(screenshot.result.data, 'base64'));
  await evaluate("document.getElementById('send').click()");
  await until("document.getElementById('address').textContent.startsWith('http://')");
  const address = await evaluate("document.getElementById('address').textContent");
  adb('forward', `tcp:${uploadPort}`, 'tcp:8767');
  uploadForwarded = true;
  const receiver = `http://127.0.0.1:${uploadPort}` + new URL(address).pathname;
  assert.equal((await fetch(receiver)).status, 200);
  assert.equal((await fetch(receiver + 'upload', { method: 'POST', body: Buffer.from('invalid pptx') })).status, 400);
  const bytes = await readFile(path.join(root, 'examples/FirePresenter-Demo.pptx'));
  assert.equal((await fetch(receiver + 'upload', { method: 'POST', body: bytes })).status, 200);
  await until('!window.presenter.getState().importing');
  const imported = await state();
  console.log('PASS: native receiver page, invalid-file rejection, accepted and saved PPTX');
  if (imported.mode !== 'pptx' || imported.total !== 4) {
    throw Error('PPTX did not render on this WebView: ' + await evaluate("document.getElementById('status').textContent"));
  }
  console.log('PASS: imported PPTX rendered on the native WebView');
  key(22); await at('pptx', 1);
  await until("document.querySelector('#pptx video')!==null");
  key(23); await until('window.presenter.getState().media?.time>0.2');
  key(85); await until('window.presenter.getState().media.paused');
  key(22); await at('pptx', 2);
  assert.equal((await state()).media, null);
  console.log('PASS: imported embedded MP4 playback and cleanup');
  key(20); key(23); await at('pptx', 0);
  key(20); key(23); await at('pptx', 2);
  key(22); await at('pptx', 3);
  key(20); key(23); await at('pptx', 0);
  console.log('PASS: native picture, shape, and text slide links');
} finally {
  await evaluate("if(window.presenter.getState().mode!=='home')window.presenter.command('back')").catch(() => {});
  socket.close();
  adb('forward', '--remove', `tcp:${cdpPort}`);
  if (uploadForwarded) adb('forward', '--remove', `tcp:${uploadPort}`);
}
