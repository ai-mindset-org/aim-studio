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

async function waitReady(page) {
  await page.waitForFunction(
    () => window.__X26_BANNER_READY__ === true && !!document.querySelector('#currentBanner[data-banner-root="true"]'),
    { timeout: 90000 }
  );
}

async function visibleDatasetValues(page, rootSelector, datasetKey) {
  return page.$eval(
    rootSelector,
    (root, key) => [...root.querySelectorAll('button')]
      .filter((button) => getComputedStyle(button).display !== 'none')
      .map((button) => button.dataset[key])
      .filter(Boolean),
    datasetKey
  );
}

async function clickVisibleButton(page, rootSelector, datasetKey, value) {
  await page.$eval(
    rootSelector,
    (root, key, expected) => {
      const button = [...root.querySelectorAll('button')].find((candidate) =>
        candidate.dataset[key] === expected && getComputedStyle(candidate).display !== 'none'
      );
      if (!button) throw new Error(`button not found: ${key}=${expected}`);
      button.click();
    },
    datasetKey,
    value
  );
  await waitReady(page);
}

async function queryState(page) {
  return page.evaluate(() => {
    const params = new URLSearchParams(location.search);
    return {
      lab: params.get('lab'),
      mode: params.get('mode'),
      format: params.get('format'),
      style: params.get('style'),
      speakerStyle: params.get('speakerStyle'),
      orgStyle: params.get('orgStyle'),
      alerts: Array.isArray(window.__x26Alerts) ? [...window.__x26Alerts] : [],
      preview: document.getElementById('previewLabel')?.textContent || '',
    };
  });
}

async function assertNoAlerts(page, label) {
  const state = await queryState(page);
  if (state.alerts.length) {
    throw new Error(`${label} alert: ${state.alerts.join(' | ')}`);
  }
}

async function exerciseGeneric(page, labId) {
  await clickVisibleButton(page, '.controls', 'mode', 'generic');
  const formats = await visibleDatasetValues(page, '#formatSel', 'format');
  for (const format of formats) {
    await clickVisibleButton(page, '#formatSel', 'format', format);
    const variants = await visibleDatasetValues(page, '#variantSel', 'v');
    for (const variant of variants) {
      await clickVisibleButton(page, '#variantSel', 'v', variant);
      const state = await queryState(page);
      if (state.mode !== 'generic' || state.lab !== labId || state.format !== format || state.style !== variant) {
        throw new Error(`generic state mismatch for ${labId}:${format}:${variant}`);
      }
    }
  }
  await assertNoAlerts(page, `${labId}:generic`);
}

async function exerciseSpeaker(page, labId) {
  await clickVisibleButton(page, '.controls', 'mode', 'speaker');
  const formats = await visibleDatasetValues(page, '#formatSel', 'format');
  for (const format of formats) {
    await clickVisibleButton(page, '#formatSel', 'format', format);
    const state = await queryState(page);
    if (state.mode !== 'speaker' || state.lab !== labId || state.format !== format) {
      throw new Error(`speaker format mismatch for ${labId}:${format}`);
    }
  }

  const styles = await visibleDatasetValues(page, '#speakerStyleSel', 'style');
  for (const style of styles) {
    await clickVisibleButton(page, '#speakerStyleSel', 'style', style);
    const state = await queryState(page);
    if (state.mode !== 'speaker' || state.lab !== labId || state.speakerStyle !== style) {
      throw new Error(`speaker style mismatch for ${labId}:${style}`);
    }
  }
  await assertNoAlerts(page, `${labId}:speaker`);
}

async function exerciseOrg(page, lab) {
  if (!Array.isArray(lab.orgCards) || !lab.orgCards.length) return;

  await clickVisibleButton(page, '.controls', 'mode', 'org');
  const styles = await visibleDatasetValues(page, '#orgStyleSel', 'style');
  for (const style of styles) {
    await clickVisibleButton(page, '#orgStyleSel', 'style', style);
    const state = await queryState(page);
    if (state.mode !== 'org' || state.lab !== lab.id || state.orgStyle !== style) {
      throw new Error(`org style mismatch for ${lab.id}:${style}`);
    }
  }

  const weekCard = lab.orgCards.find((card) => card.kind === 'week');
  if (weekCard) {
    await page.evaluate((id) => { window.pickOrg(id); }, weekCard.id);
    await waitReady(page);

    const textScales = await visibleDatasetValues(page, '#weekCardSel', 'weekText');
    for (const scale of textScales) {
      await clickVisibleButton(page, '#weekCardSel', 'weekText', scale);
      const state = await queryState(page);
      if (state.mode !== 'org' || state.lab !== lab.id) {
        throw new Error(`week text mismatch for ${lab.id}:${scale}`);
      }
    }
  }
  await assertNoAlerts(page, `${lab.id}:org`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = await loadData();
  const labs = options.all || options.labs.length === 0
    ? Object.keys(data.labs || {})
    : options.labs.map((labId) => normalizeId(labId));
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1680, height: 1600, deviceScaleFactor: 1 },
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
  await page.evaluateOnNewDocument(() => {
    window.__x26Alerts = [];
    window.alert = function(message) {
      window.__x26Alerts.push(String(message));
      return undefined;
    };
  });

  const failures = [];

  try {
    for (const labId of labs) {
      const lab = data.labs?.[labId];
      if (!lab) {
        failures.push({ label: `${labId}:missing`, error: 'lab not found' });
        continue;
      }

      const url = `${pathToFileURL(INDEX_PATH)}?lab=${encodeURIComponent(labId)}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await waitReady(page);
        await exerciseGeneric(page, labId);
        await exerciseSpeaker(page, labId);
        await exerciseOrg(page, lab);
        console.log(`OK   ${labId}:ui interactions`);
      } catch (error) {
        failures.push({ label: `${labId}:ui`, error: error.message });
        console.log(`FAIL ${labId}:ui ${error.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`\nUI smoke failed: ${failures.length} target(s)`);
    process.exit(1);
  }

  console.log(`\nUI smoke passed: ${labs.length} lab(s)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
