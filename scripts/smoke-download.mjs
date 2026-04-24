import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const DATA_PATH = path.join(ROOT, 'data', 'speakers.js');
const require = createRequire(import.meta.url);

function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch {
    const fallbackRequire = createRequire('/Users/alex/Documents/_code/_generators/aim-ig-carousels/package.json');
    return fallbackRequire('puppeteer');
  }
}

const puppeteer = loadPuppeteer();

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function pickModeStyles(lab, mode) {
  if (mode === 'generic') {
    return Array.isArray(lab.genericStyles) && lab.genericStyles.length ? lab.genericStyles : [lab.defaultStyle || 'field'];
  }
  if (mode === 'speaker') {
    return Array.isArray(lab.speakerStyles) && lab.speakerStyles.length ? lab.speakerStyles : ['surname'];
  }
  if (mode === 'org') {
    return Array.isArray(lab.orgStyles) && lab.orgStyles.length ? lab.orgStyles : ['plaque'];
  }
  return [];
}

function pickModeFormats(lab, mode) {
  const groups = lab.formatStyles?.[mode];
  if (groups) {
    return Object.entries(groups)
      .filter(([, styles]) => Array.isArray(styles) && styles.length)
      .map(([format, styles]) => ({ format, styles: [...styles] }));
  }

  return [{
    format: lab.defaultFormats?.[mode] || 'wide',
    styles: pickModeStyles(lab, mode),
  }];
}

function parseArgs(argv) {
  const options = { labs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--lab' && argv[index + 1]) {
      options.labs.push(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--lab=')) {
      options.labs.push(arg.slice('--lab='.length));
      continue;
    }
    if (arg === '--all') {
      options.all = true;
    }
  }
  return options;
}

async function loadData() {
  const source = await fs.readFile(DATA_PATH, 'utf8');
  const sandbox = {
    console,
    module: { exports: {} },
    exports: {},
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  vm.runInNewContext(source, sandbox, { filename: DATA_PATH });

  return (
    sandbox.X26BannerData ??
    sandbox.X26BannerGeneratorData ??
    sandbox.window?.X26BannerData ??
    sandbox.window?.X26BannerGeneratorData ??
    sandbox.module.exports ??
    sandbox.exports
  );
}

function targetList(data, labId) {
  const lab = data.labs?.[labId];
  if (!lab) {
    throw new Error(`Lab not found: ${labId}`);
  }

  const generic = pickModeFormats(lab, 'generic').flatMap(({ format, styles }) =>
    styles.map((style) => ({
      label: `${labId}:generic:${format}:${style}`,
      url: `${pathToFileURL(INDEX_PATH)}?lab=${encodeURIComponent(labId)}&mode=generic&format=${encodeURIComponent(format)}&style=${encodeURIComponent(style)}`,
    }))
  );

  const orgStyled = (lab.orgCards || []).flatMap((card) =>
    pickModeFormats(lab, 'org').flatMap(({ format, styles }) =>
      styles.map((style) => ({
        label: `${labId}:org:${card.id}:${format}:${style}`,
        url: `${pathToFileURL(INDEX_PATH)}?lab=${encodeURIComponent(labId)}&mode=org&id=${encodeURIComponent(card.id)}&format=${encodeURIComponent(format)}&orgStyle=${encodeURIComponent(style)}`,
      }))
    )
  );
  const orgWeekVariants = (lab.orgCards || [])
    .filter((card) => card.kind === 'week')
    .flatMap((card) => ([
      {
        label: `${labId}:org:${card.id}:wide:plaque:xl-clean`,
        url: `${pathToFileURL(INDEX_PATH)}?lab=${encodeURIComponent(labId)}&mode=org&id=${encodeURIComponent(card.id)}&format=wide&orgStyle=plaque&weekText=xl&tags=0`,
      },
      {
        label: `${labId}:org:${card.id}:wide:digest:xl-f6-clean`,
        url: `${pathToFileURL(INDEX_PATH)}?lab=${encodeURIComponent(labId)}&mode=org&id=${encodeURIComponent(card.id)}&format=wide&orgStyle=digest&weekText=xl&faces=6&tags=0`,
      },
    ]));

  const speaker = (lab.speakers || []).flatMap((record) =>
    pickModeFormats(lab, 'speaker').flatMap(({ format, styles }) =>
      styles.map((style) => ({
        label: `${labId}:speaker:${record.id}:${format}:${style}`,
        url: `${pathToFileURL(INDEX_PATH)}?lab=${encodeURIComponent(labId)}&mode=speaker&id=${encodeURIComponent(record.id)}&format=${encodeURIComponent(format)}&speakerStyle=${encodeURIComponent(style)}`,
      }))
    )
  );

  return [...generic, ...orgStyled, ...orgWeekVariants, ...speaker];
}

async function smokeRender(page, target) {
  await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(
    () => window.__X26_BANNER_READY__ === true && !!document.querySelector('#currentBanner[data-banner-root="true"]'),
    { timeout: 90000 }
  );

  return page.evaluate(async () => {
    const previousAlert = window.alert;
    let lastAlert = null;
    window.alert = (message) => {
      lastAlert = String(message);
    };

    try {
      await document.fonts.ready;
      const el = document.querySelector('#currentBanner[data-banner-root="true"]') || document.getElementById('bc');
      if (!el) {
        throw new Error('banner root not found');
      }

      el.querySelectorAll('[contenteditable]').forEach((node) => node.blur());
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const size = { width: el.offsetWidth, height: el.offsetHeight };
      const dataUrl = await window.domtoimage.toPng(el, {
        width: size.width,
        height: size.height,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          width: `${size.width}px`,
          height: `${size.height}px`,
        },
      });

      return {
        ok: true,
        len: dataUrl.length,
        width: size.width,
        height: size.height,
        alert: lastAlert,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        alert: lastAlert,
      };
    } finally {
      window.alert = previousAlert;
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = await loadData();
  const labs = options.all || options.labs.length === 0
    ? Object.keys(data.labs || {})
    : options.labs.map((labId) => normalizeId(labId));
  const targets = labs.flatMap((labId) => targetList(data, labId));
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1600, height: 2200, deviceScaleFactor: 1 },
    args: [
      '--allow-file-access-from-files',
      '--font-render-hinting=medium',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);

  const failures = [];

  try {
    for (const target of targets) {
      const result = await smokeRender(page, target);
      if (!result.ok || result.alert || !result.len) {
        failures.push({ target: target.label, result });
        console.log(`FAIL ${target.label} ${result.error || result.alert || 'empty render'}`);
      } else {
        console.log(`OK   ${target.label} ${result.width}x${result.height} len=${result.len}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`\nSmoke test failed: ${failures.length} target(s)`);
    process.exit(1);
  }

  console.log(`\nSmoke test passed: ${targets.length} target(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
