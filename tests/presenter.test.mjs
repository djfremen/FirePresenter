import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = path.join(root, 'app/src/main/assets');
let browser, server, origin;
let fixture = 'FirePresenter-Demo.pptx';
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4' };

before(async () => {
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = pathname === '/import/current.pptx' ? path.join(root, 'examples', fixture) :
        path.join(assets, pathname.replace(/^\/assets\//, ''));
      if (!file.startsWith(assets + path.sep) && !file.startsWith(path.join(root, 'examples') + path.sep)) throw Error('Invalid path');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.FIREPRESENTER_BROWSER_PATH ? { executablePath: process.env.FIREPRESENTER_BROWSER_PATH } : {}) });
  await mkdir(path.join(root, 'test-results'), { recursive: true });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function session() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const external = [], errors = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/') || url.startsWith('blob:') || url.startsWith('data:')) route.continue();
    else { external.push(url); route.abort(); }
  });
  await context.addInitScript(() => {
    window.AndroidDeck = { hasImport: () => true, stopUpload: () => {}, startUpload: () => {}, pickPptx: () => {}, exit: () => {} };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  if (process.env.FIREPRESENTER_DEBUG) page.on('console', message => console.log(message.text()));
  await page.goto(origin + '/assets/index.html');
  return { context, page, external, errors };
}

async function slide(page, mode, index) {
  await page.waitForFunction(([m, i]) => {
    const state = window.presenter.getState();
    return state.mode === m && state.index === i && !state.importing;
  }, [mode, index]);
  assert.equal(await page.locator('#count').textContent(), `${index + 1} / ${mode === 'bundled' ? 6 : 4}`);
}

test('offline demo: remote links, pointer links, video pause, holding card, boundaries, and toolbar', async () => {
  const { context, page, external, errors } = await session();
  try {
    assert.match(await page.locator('.offline').textContent(), /Manage Installed Applications → FirePresenter → Launch application/);
    await page.screenshot({ path: path.join(root, 'test-results', 'home.png') });
    await page.keyboard.press('Enter');
    await slide(page, 'bundled', 0);
    await page.keyboard.press('ArrowLeft');
    await slide(page, 'bundled', 0);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'bundled', 1);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Graphics');
    await page.screenshot({ path: path.join(root, 'test-results', 'menu.png') });
    await page.keyboard.press('Enter');
    await slide(page, 'bundled', 2);
    await page.getByRole('button', { name: 'Return to menu', exact: true }).click();
    await slide(page, 'bundled', 1);
    await page.getByRole('button', { name: 'Embedded video', exact: true }).click();
    await slide(page, 'bundled', 3);
    await page.waitForFunction(() => document.getElementById('film').readyState >= 2);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.presenter.getState().media?.time > 0.2);
    await page.keyboard.press('Space');
    assert.equal((await page.evaluate(() => window.presenter.getState())).media.paused, true);
    await page.keyboard.press('m');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'next');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'prev');
    await page.keyboard.press('Enter');
    await slide(page, 'bundled', 2);
    assert.equal(await page.locator('#film').getAttribute('src'), null);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'bundled', 3);
    await page.waitForFunction(() => document.getElementById('film').readyState >= 2);
    await page.keyboard.press('Enter');
    await slide(page, 'bundled', 4);
    await page.waitForTimeout(300);
    await slide(page, 'bundled', 4);
    await page.screenshot({ path: path.join(root, 'test-results', 'hold.png') });
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await slide(page, 'bundled', 5);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'bundled', 5);
    await page.keyboard.press('Home');
    await slide(page, 'bundled', 0);
    await page.locator('#poster').click();
    await slide(page, 'bundled', 1);
    await page.keyboard.press('Escape');
    assert.equal((await page.evaluate(() => window.presenter.getState())).mode, 'home');
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('offline PPTX: shape, picture, and text hyperlinks; embedded MP4; external links blocked', async () => {
  fixture = 'FirePresenter-Demo.pptx';
  const { context, page, external, errors } = await session();
  try {
    await page.getByRole('button', { name: 'Last imported deck' }).click();
    await slide(page, 'pptx', 0);
    if (process.env.FIREPRESENTER_DEBUG) console.log(await page.locator('#pptx').innerHTML());
    await page.waitForSelector('[aria-label="Jump to graphics"]');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Jump to graphics');
    await page.keyboard.press('Enter');
    await slide(page, 'pptx', 2);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#pptx img')).some(image => image.complete && image.naturalWidth > 0));
    await page.getByRole('link', { name: 'Return to start', exact: true }).click();
    await slide(page, 'pptx', 0);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'pptx', 1);
    await page.waitForSelector('#pptx video');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.presenter.getState().media?.time > 0.2);
    await page.screenshot({ path: path.join(root, 'test-results', 'pptx-video.png') });
    await page.keyboard.press('Space');
    assert.equal((await page.evaluate(() => window.presenter.getState())).media.paused, true);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'pptx', 2);
    assert.equal((await page.evaluate(() => window.presenter.getState())).media, null);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'pptx', 3);
    await page.getByRole('link', { name: /^External/ }).click();
    assert.match(await page.locator('#status').textContent(), /External web links are unavailable/);
    await slide(page, 'pptx', 3);
    await page.getByRole('link', { name: 'Return to start', exact: true }).click();
    await slide(page, 'pptx', 0);
    await page.getByRole('link', { name: 'Jump to finish', exact: true }).click();
    await slide(page, 'pptx', 3);
    await page.keyboard.press('ArrowLeft');
    await slide(page, 'pptx', 2);
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(300);
    await slide(page, 'pptx', 2);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('4:3 PPTX fits the viewport and slide links preserve remote navigation', async () => {
  fixture = 'FirePresenter-4x3.pptx';
  const { context, page, external, errors } = await session();
  try {
    await page.getByRole('button', { name: 'Last imported deck' }).click();
    await slide(page, 'pptx', 0);
    await page.getByRole('link', { name: 'Jump to graphics', exact: true }).click();
    await slide(page, 'pptx', 2);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#pptx img')).some(image => image.complete && image.naturalWidth > 0));
    await page.screenshot({ path: path.join(root, 'test-results', 'pptx-4x3.png') });
    const rectangle = await page.locator('#pptx > div').first().boundingBox();
    assert.ok(rectangle && rectangle.x >= -1 && rectangle.y >= -1 && rectangle.x + rectangle.width <= 1281 && rectangle.y + rectangle.height <= 721);
    assert.ok(Math.abs(rectangle.width / rectangle.height - 4 / 3) < 0.01);
    await page.keyboard.press('ArrowRight');
    await slide(page, 'pptx', 3);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
