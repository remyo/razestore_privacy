// Local-only website regression checks. Run: node scripts/check.mjs
// Optional: RAZESTORE_NODE_MODULES=/path/to/node_modules
//           RAZESTORE_QA_CHROME=/path/to/chrome
//           RAZESTORE_POLICY_BASELINE_REF=<original-policy-git-ref>
// Uses existing Playwright/Chrome; installs nothing and never visits the live site.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.preview/website-check');
const modules = process.env.RAZESTORE_NODE_MODULES || resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const require = createRequire(import.meta.url);
const {chromium} = require(resolve(modules, 'playwright'));
const chrome = process.env.RAZESTORE_QA_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// This was HEAD before the privacy-only page became the website.
const baselineRef = process.env.RAZESTORE_POLICY_BASELINE_REF || '64e28a1564e1a1935d5c01bff37e6ac314f78224';
const profiles = [
  {name: 'desktop', width: 1440, height: 1000},
  {name: 'tablet', width: 768, height: 1024},
  {name: 'mobile', width: 390, height: 844},
  {name: 'small-mobile', width: 320, height: 740},
  {name: 'text-200', width: 390, height: 844, textScale: 2},
];
const screens = [
  {key: 'products', image: 'home.png'},
  {key: 'checkout', image: 'checkout.png'},
  {key: 'gcash', image: 'gcash.png'},
  {key: 'sales', image: 'sales.png'},
  {key: 'receipts', image: 'receipt.png'},
];
const report = {
  passed: false, startedAt: new Date().toISOString(),
  scope: 'Local static public website only; no application data or external websites.',
  policyBaselineRef: baselineRef, checks: [], artifacts: [],
  notes: [
    'Screenshots still need visual review. These checks do not OCR images or verify legal claims.',
    'The 200% text profile doubles the root font size; this is not browser page zoom.',
  ],
};
await mkdir(output, {recursive: true});

async function check(name, work) {
  const start = Date.now();
  try {
    const details = await work();
    report.checks.push({name, passed: true, durationMs: Date.now() - start, ...(details === undefined ? {} : {details})});
    console.log(`PASS ${name}`);
  } catch (error) {
    report.checks.push({name, passed: false, durationMs: Date.now() - start, error: error.message});
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const publicPath = /^\/(?:index\.html|privacy\.html|assets\/[A-Za-z0-9_./-]+\.(?:css|js|png|jpe?g|webp|svg|ico))$/i;
async function publicFile(pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  assert(publicPath.test(normalized), 'Not an allowed public file');
  const file = await realpath(resolve(root, `.${normalized}`));
  assert(file.startsWith(`${root}${sep}`), 'Outside public root');
  return file;
}

// Bind loopback and expose only the two pages and their public assets.
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (path.startsWith('/renamed-website/')) path = path.slice('/renamed-website'.length);
    const file = await publicFile(path);
    response.setHeader('Content-Type', mimeTypes[extname(file).toLowerCase()]);
    response.setHeader('Cache-Control', 'no-store');
    response.end(await readFile(file));
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
});

await check('privacy-policy-approved-contact-update', async () => {
  const original = execFileSync('git', ['show', `${baselineRef}:index.html`], {cwd: root, encoding: 'utf8'});
  const current = await readFile(resolve(root, 'privacy.html'), 'utf8');
  const oldBody = original.match(/<main>([\s\S]*?)<\/main>/)?.[1];
  const newBody = current.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1];
  assert(oldBody && newBody, 'Cannot locate original policy or current policy article');
  const blocks = html => [...html.matchAll(/<(h1|h2|p|li)\b([^>]*)>([\s\S]*?)<\/\1>/g)]
    .filter(match => !match[2].includes('eyebrow')).map(match => [match[1], match[3]]);
  // The contact address is the only approved policy-content change.
  const expected = blocks(oldBody.replaceAll('razedevworkspace@gmail.com', 'razeappdev@gmail.com'));
  assert.equal(expected.length, 33, 'Unexpected policy baseline');
  assert.deepEqual(blocks(newBody), expected, 'Policy changed beyond the approved contact email update');
  return {comparedBlocks: expected.length, approvedContactEmail: 'razeappdev@gmail.com'};
});

let browser;
try {
  await new Promise(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const projectBase = `${origin}/renamed-website/`;
  browser = await chromium.launch({headless: true, executablePath: chrome, args: ['--disable-background-networking']});

  async function newPage(profile, javaScriptEnabled = true) {
    const context = await browser.newContext({
      viewport: {width: profile.width, height: profile.height},
      reducedMotion: 'reduce', javaScriptEnabled, serviceWorkers: 'block',
    });
    const errors = [];
    const externalRequests = [];
    await context.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin === origin) return route.continue();
      externalRequests.push(url);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) errors.push(`console ${message.type()}: ${message.text()}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    page.on('requestfailed', request => errors.push(`request failed: ${new URL(request.url()).pathname}`));
    return {page, context, errors, externalRequests};
  }

  async function load(page, url, profile = null) {
    await page.goto(url, {waitUntil: 'load'});
    if (profile?.textScale) await page.evaluate(scale => {
      document.documentElement.style.fontSize = `${16 * scale}px`;
    }, profile.textScale);
    await page.evaluate(() => document.fonts.ready);
    await loadImages(page);
  }

  async function loadImages(page) {
    const failures = await page.locator('img[src]').evaluateAll(async images => {
      return (await Promise.all(images.map(async image => {
        image.loading = 'eager';
        try {
          await image.decode();
          return image.naturalWidth > 0 ? null : image.getAttribute('src');
        } catch { return image.getAttribute('src'); }
      }))).filter(Boolean);
    });
    assert.deepEqual(failures, [], 'Missing or undecodable image assets');
  }

  async function fit(page) {
    const size = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      return {
        viewport,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        candidates: [...document.querySelectorAll('header *, main *, footer *')].filter(element => {
          if (!element.getClientRects().length || element.closest('dialog:not([open])')) return false;
          const rect = element.getBoundingClientRect();
          return rect.right > viewport + 1 || rect.left < -1;
        }).slice(0, 12).map(element => ({tag: element.tagName, id: element.id, class: element.className})),
      };
    });
    assert(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
    return size;
  }

  async function anchorsAndLocalLinks(page) {
    const issues = await page.evaluate(async () => {
      const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      const missing = [];
      const failures = [];
      const checked = new Map();
      for (const link of document.querySelectorAll('a[href]')) {
        const target = new URL(link.href, location.href);
        if (target.origin !== location.origin) continue;
        if (target.pathname === location.pathname && target.hash) {
          if (!document.getElementById(decodeURIComponent(target.hash.slice(1)))) missing.push(link.getAttribute('href'));
          continue;
        }
        const path = target.pathname;
        if (!checked.has(path)) {
          const response = await fetch(path);
          checked.set(path, {ok: response.ok, html: response.headers.get('content-type')?.includes('text/html') ? await response.text() : null});
        }
        const result = checked.get(path);
        if (!result.ok) failures.push(link.getAttribute('href'));
        if (target.hash && result.html) {
          const documentAtTarget = new DOMParser().parseFromString(result.html, 'text/html');
          if (!documentAtTarget.getElementById(decodeURIComponent(target.hash.slice(1)))) missing.push(link.getAttribute('href'));
        }
      }
      return {duplicates, missing, failures, destinations: checked.size};
    });
    assert.deepEqual(issues.duplicates, [], 'Duplicate page IDs');
    assert.deepEqual(issues.missing, [], 'Missing same-page or linked-page anchors');
    assert.deepEqual(issues.failures, [], 'Broken local navigation links');
    return issues;
  }

  function clean(record) {
    assert.deepEqual(record.externalRequests, [], 'Unexpected third-party request');
    assert.deepEqual(record.errors, [], 'Unexpected browser, console, or asset error');
  }

  async function screenshot(page, name, selector = null) {
    const file = `${name}.png`;
    if (selector) await page.locator(selector).screenshot({path: resolve(output, file)});
    else await page.screenshot({path: resolve(output, file), fullPage: true});
    report.artifacts.push(file);
  }

  for (const profile of profiles) {
    for (const filename of ['index.html', 'privacy.html']) {
      await check(`${filename}-${profile.name}`, async () => {
        const record = await newPage(profile);
        try {
          await load(record.page, `${origin}/${filename}`, profile);
          await screenshot(record.page, `${filename.replace('.html', '')}-${profile.name}`);
          const dimensions = await fit(record.page);
          const links = await anchorsAndLocalLinks(record.page);
          clean(record);
          return {dimensions, links, images: await record.page.locator('img[src]').count()};
        } finally { await record.context.close(); }
      });
    }
  }

  async function selected(page, expected) {
    const tab = page.locator(`#tab-${expected.key}`);
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
    assert.equal(await tab.getAttribute('tabindex'), '0');
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').count(), 1);
    assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
    assert.equal(await page.locator('#screen-panel').getAttribute('aria-labelledby'), `tab-${expected.key}`);
    assert((await page.locator('#app-screen').getAttribute('src')).endsWith(`/${expected.image}`));
    assert((await page.locator('#app-screen').getAttribute('alt')).length > 10);
    assert((await page.locator('#screen-title').innerText()).trim().length > 5);
    await loadImages(page);
  }

  await check('five-screen-tabs-click-and-keyboard', async () => {
    const record = await newPage(profiles[0]);
    const {page} = record;
    try {
      await load(page, `${origin}/index.html`);
      assert.equal(await page.locator('[role="tab"]').count(), 5);
      const titles = new Set();
      for (const screen of screens) {
        await page.locator(`#tab-${screen.key}`).click();
        await selected(page, screen);
        titles.add(await page.locator('#screen-title').innerText());
        await screenshot(page, `screen-${screen.key}`, '#app');
      }
      assert.equal(titles.size, 5, 'Each screen should have its own explanatory caption');
      await page.locator('#tab-products').focus();
      await page.keyboard.press('Home');
      for (let index = 0; index < screens.length; index += 1) {
        await selected(page, screens[index]);
        assert.equal(await page.evaluate(() => document.activeElement.id), `tab-${screens[index].key}`);
        await page.keyboard.press('ArrowRight');
      }
      await selected(page, screens[0]);
      await page.keyboard.press('ArrowLeft');
      await selected(page, screens[4]);
      await page.keyboard.press('Home');
      await selected(page, screens[0]);
      await page.keyboard.press('End');
      await selected(page, screens[4]);
      await page.keyboard.press('ArrowDown');
      await selected(page, screens[0]);
      await page.keyboard.press('ArrowUp');
      await selected(page, screens[4]);
      clean(record);
      return {clickScreens: 5, keyboardScreens: 5, wrapping: true, homeEnd: true};
    } finally { await record.context.close(); }
  });

  await check('screenshot-dialog-close-escape-and-focus', async () => {
    const record = await newPage(profiles[2]);
    const {page} = record;
    try {
      await load(page, `${origin}/index.html`);
      const zoom = page.locator('[data-open-screen]');
      const dialog = page.locator('#screen-dialog');
      for (const screen of screens) {
        await page.locator(`#tab-${screen.key}`).click();
        await zoom.click();
        await page.waitForFunction(() => document.querySelector('#screen-dialog').open);
        assert(await dialog.isVisible());
        assert((await page.locator('#dialog-image').getAttribute('src')).endsWith(`/${screen.image}`));
        assert.equal(await page.locator('#dialog-title').innerText(), await page.locator('#screen-title').innerText());
        assert(await page.evaluate(() => document.querySelector('#screen-dialog').contains(document.activeElement)));
        await loadImages(page);
        await fit(page);
        if (screen.key === 'products') await screenshot(page, 'screenshot-dialog-mobile');
        await page.locator('[data-close-screen]').click();
        // The native close event is queued after dialog.open changes. Wait for
        // the app's close handler before checking scroll lock and focus.
        await page.waitForFunction(() => !document.querySelector('#screen-dialog').open && !document.body.classList.contains('dialog-open'));
        assert(await zoom.evaluate(element => element === document.activeElement));
        assert.equal(await page.locator('body').evaluate(body => body.classList.contains('dialog-open')), false);
      }
      await zoom.click();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#screen-dialog').open && !document.body.classList.contains('dialog-open'));
      assert(await zoom.evaluate(element => element === document.activeElement));
      assert.equal(await page.locator('body').evaluate(body => body.classList.contains('dialog-open')), false);
      clean(record);
      return {screens: 5, closeButton: true, escape: true, focusRestored: true};
    } finally { await record.context.close(); }
  });

  await check('renamed-github-pages-project-path', async () => {
    const record = await newPage(profiles[2]);
    const {page} = record;
    try {
      await load(page, projectBase);
      await fit(page);
      await anchorsAndLocalLinks(page);
      for (const screen of screens) {
        await page.locator(`#tab-${screen.key}`).click();
        await selected(page, screen);
        assert((await page.locator('#app-screen').evaluate(image => image.currentSrc)).startsWith(projectBase));
      }
      await page.locator('.nav-links a[href="./privacy.html"]').click();
      await page.waitForURL(`${projectBase}privacy.html`);
      await loadImages(page);
      await fit(page);
      await anchorsAndLocalLinks(page);
      await page.locator('.site-header .brand').click();
      await page.waitForURL(`${projectBase}index.html`);
      assert(await page.locator('#hero-title').isVisible());
      clean(record);
      return {basePath: '/renamed-website/', workingRelativeAssetsAndLinks: true};
    } finally { await record.context.close(); }
  });

  await check('no-javascript-home-and-privacy-navigation', async () => {
    const record = await newPage(profiles[2], false);
    const {page} = record;
    try {
      await page.goto(projectBase, {waitUntil: 'load'});
      assert(await page.locator('#hero-title').isVisible());
      assert(await page.locator('noscript').isVisible());
      assert.equal(await page.locator('noscript a').count(), 4);
      await page.locator('.hero-actions a[href="#app"]').click();
      assert.equal(new URL(page.url()).hash, '#app');
      for (const link of await page.locator('noscript a').all()) {
        const href = await link.getAttribute('href');
        const response = await page.request.get(new URL(href, page.url()).href);
        assert(response.ok(), `Broken no-JS screenshot link: ${href}`);
        assert(response.headers()['content-type'].startsWith('image/'));
      }
      await page.locator('.nav-links a[href="./privacy.html"]').click();
      await page.waitForURL(`${projectBase}privacy.html`);
      assert(await page.locator('#policy-title').isVisible());
      await page.locator('.policy-sidebar a[href="#changes-contact"]').click();
      assert.equal(new URL(page.url()).hash, '#changes-contact');
      await page.locator('.site-header .brand').click();
      await page.waitForURL(`${projectBase}index.html`);
      clean(record);
      return {nativeAnchors: true, screenshotFallbackLinks: 4, privacyNavigation: true};
    } finally { await record.context.close(); }
  });
} catch (error) {
  report.checks.push({name: 'runner', passed: false, error: error.message});
  console.error(error);
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise(resolveClosed => server.close(resolveClosed));
  report.passed = report.checks.length > 0 && report.checks.every(item => item.passed);
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.passed ? 'PASS' : 'FAIL'}: ${report.checks.filter(item => item.passed).length}/${report.checks.length} checks. Artifacts: .preview/website-check/`);
  process.exitCode = report.passed ? 0 : 1;
}
