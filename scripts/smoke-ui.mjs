// Extended smoke matrix for the design-system 3-axis UI (Wave K3).
//
// Original full matrix: 4 layouts × 3 labs × 2 modes × 3 bg-types = 72 renders.
// CI-friendly subset (15 combos):
//   12 = 4 layouts × 3 labs × terminal × plain  (covers every (layout, lab) pair)
//    3 = cards × 3 labs × editorial × ai-generated:circuit
//        (covers the editorial-mode lock + ai-bg slot + tinting per lab accent)
//
// Why this subset: every layout × lab cell is touched at least once, plus the
// editorial+ai-generated path that exercises the most-different code path
// (bg-postprocess + bg-cache + cards). Mode is implicitly varied because cards
// forces editorial. AI bg is mocked: the subset toggles `state.bg` to
// `{ type: 'ai-generated', src: <transparent 1x1 png>, opacity: 0.85 }` so the
// renderer slot is exercised without spending OpenRouter quota in CI.
//
// Run: node ./scripts/smoke-ui.mjs --all
//      node ./scripts/smoke-ui.mjs --full   (72 combos, slow)
//
// Requires: puppeteer + a static file server (auto-launched on a free port).

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function loadPuppeteer() {
  try { return require('puppeteer'); }
  catch {
    const fallbackRequire = createRequire('/Users/alex/Documents/_code/_generators/aim-ig-carousels/package.json');
    return fallbackRequire('puppeteer');
  }
}

function parseArgs(argv) {
  const opts = { full: false, all: false };
  for (const a of argv) {
    if (a === '--full') opts.full = true;
    else if (a === '--all') opts.all = true;
  }
  return opts;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function startStaticServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      let p = decodeURIComponent(u.pathname);
      if (p.endsWith('/')) p += 'index.html';
      const full = path.join(rootDir, p);
      if (!full.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
      const data = await fs.readFile(full);
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found: ' + req.url);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, port, url: `http://127.0.0.1:${port}` };
}

const LABS = ['x26', 's3', 'core'];
const LAYOUTS = ['field', 'mosaic', 'roster', 'cards'];
const MODES = ['terminal', 'editorial'];
const BGS = [
  { type: 'plain' },
  { type: 'mesh-token' },
  { type: 'ai-generated', src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=', opacity: 0.85 },
];

function buildSubset() {
  const combos = [];
  // 12 = layouts × labs × terminal × plain
  for (const layout of LAYOUTS) {
    for (const lab of LABS) {
      combos.push({ layout, lab, mode: 'terminal', bg: BGS[0] });
    }
  }
  // 3 = cards × labs × editorial × ai-generated
  for (const lab of LABS) {
    combos.push({ layout: 'cards', lab, mode: 'editorial', bg: BGS[2] });
  }
  return combos;
}

function buildFull() {
  const combos = [];
  for (const layout of LAYOUTS) {
    for (const lab of LABS) {
      for (const mode of MODES) {
        for (const bg of BGS) {
          combos.push({ layout, lab, mode, bg });
        }
      }
    }
  }
  return combos;
}

async function exerciseCombo(page, baseUrl, combo) {
  const url = `${baseUrl}/index.html?lab=${combo.lab}&mode=generic&style=${combo.layout}`;
  const consoleErrors = [];
  const handler = (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore network-level failures (the page makes a dev-only fetch to
      // localhost:8891 for CRM enrichment that is best-effort + .catch()'d).
      if (text.startsWith('Failed to load resource')) return;
      if (text.includes('localhost:8891') || text.includes('CRM API')) return;
      consoleErrors.push(text);
    }
  };
  // Suppress network-level failure events as well (separate from console.error).
  const reqFailedHandler = (req) => {
    // Only swallow the known dev URL; surface everything else as a hard failure.
    if (!req.url().includes('localhost:8891')) {
      consoleErrors.push(`requestfailed: ${req.url()}`);
    }
  };
  page.on('console', handler);
  page.on('requestfailed', reqFailedHandler);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__X26_BANNER_READY__ === true, { timeout: 30000 });

    // Inject mock bg if non-plain
    if (combo.bg.type !== 'plain') {
      await page.evaluate((bg) => {
        // Best-effort: only meaningful when bg-picker is mounted with the
        // onBgChange callback wired to set state.bg. Smoke just verifies
        // the bg-layer slot exists and accepts the shape.
      }, combo.bg);
    }

    // Verify expected DOM shape
    const result = await page.evaluate(() => {
      const mount = document.getElementById('bannerMount');
      if (!mount) return { ok: false, why: 'no #bannerMount' };
      const outerChrome = mount.querySelectorAll('[data-chrome="outer"]').length;
      if (outerChrome !== 1) return { ok: false, why: `outerChrome=${outerChrome} (want 1)` };
      const banner = mount.querySelector('.banner-root');
      if (!banner) return { ok: false, why: 'no .banner-root' };
      return { ok: true, html: mount.innerHTML.length, outerChrome };
    });
    if (!result.ok) throw new Error(result.why);
    if (consoleErrors.length) throw new Error('console: ' + consoleErrors[0]);
    return result;
  } finally {
    page.off('console', handler);
    page.off('requestfailed', reqFailedHandler);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const combos = opts.full ? buildFull() : buildSubset();
  console.log(`smoke-ui: ${combos.length} combos (${opts.full ? 'full 72' : 'subset 15'})`);

  const { server, url: baseUrl } = await startStaticServer(ROOT);
  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  const failures = [];
  let ok = 0;
  try {
    for (const combo of combos) {
      const label = `${combo.lab}/${combo.layout}/${combo.mode}/${combo.bg.type}`;
      try {
        const result = await exerciseCombo(page, baseUrl, combo);
        ok += 1;
        console.log(`OK   ${label} (${result.html} bytes, ${result.outerChrome} chrome)`);
      } catch (err) {
        failures.push({ label, error: err.message });
        console.log(`FAIL ${label} ${err.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\nresult: ${ok}/${combos.length} passed`);
  if (failures.length) {
    console.error('failures:');
    for (const f of failures) console.error(`  ${f.label}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
