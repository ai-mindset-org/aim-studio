import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const STORY_PATH = path.join(ROOT, 'story-nomusicians.html');
const EXPORT_DIR = path.join(ROOT, 'export');
const DOWNLOADS_DIR = '/Users/alex/Downloads';
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

const variants = [
  { id: '01-elegant-stack', file: 'nomusicians-story-01-elegant-stack.png', download: 'Nomusicians Story 1 - Elegant Stack.png' },
  { id: '02-human-layer', file: 'nomusicians-story-02-human-layer.png', download: 'Nomusicians Story 2 - Human Layer.png' },
  { id: '03-blueprint-question', file: 'nomusicians-story-03-blueprint-question.png', download: 'Nomusicians Story 3 - Blueprint Question.png' },
  { id: '04-signal-format', file: 'nomusicians-story-04-signal-format.png', download: 'Nomusicians Story 4 - Signal Format.png' },
  { id: '05-poster-language', file: 'nomusicians-story-05-poster-language.png', download: 'Nomusicians Story 5 - Poster Language.png' },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exportVariant(page, variant) {
  const url = new URL(pathToFileURL(STORY_PATH).href);
  url.searchParams.set('variant', variant.id);

  await page.goto(url.href, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.storyRenderReady === true, { timeout: 20000 });

  const root = await page.$('#storyRoot');
  if (!root) {
    throw new Error(`Story root not found for ${variant.id}`);
  }

  const outputPath = path.join(EXPORT_DIR, variant.file);
  const downloadsPath = path.join(DOWNLOADS_DIR, variant.download);

  await root.screenshot({ path: outputPath });
  await fs.copyFile(outputPath, downloadsPath);

  return {
    id: variant.id,
    outputPath,
    downloadsPath,
  };
}

async function main() {
  await ensureDir(EXPORT_DIR);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: 1200,
      height: 2100,
      deviceScaleFactor: 1,
    },
    args: [
      '--allow-file-access-from-files',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  const results = [];

  try {
    for (const variant of variants) {
      const result = await exportVariant(page, variant);
      results.push(result);
      console.log(`exported ${variant.id} -> ${result.outputPath}`);
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(
    path.join(EXPORT_DIR, 'nomusicians-stories-manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n',
    'utf8',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
