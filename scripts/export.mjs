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
const OUTPUT_DIR = path.join(ROOT, 'export');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
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

function normalizeOrgCardId(value) {
  const normalized = normalizeId(value);
  return normalized === 'curators' ? 'curator' : normalized;
}

function normalizeMode(value) {
  const mode = String(value ?? '').trim().toLowerCase();

  if (mode === 'profile') {
    return 'creator';
  }

  if (mode === 'session') {
    return 'speaker';
  }

  if (mode === 'participants') {
    return 'participant';
  }

  if (['generic', 'speaker', 'creator', 'participant', 'org', 'all', 'single'].includes(mode)) {
    return mode;
  }

  return 'all';
}

function normalizeFormat(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseArgs(argv) {
  const options = {
    mode: 'all',
    id: null,
    lab: null,
    style: null,
    format: null,
    types: [],
  };

  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--mode' && argv[index + 1]) {
      options.mode = normalizeMode(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      options.mode = normalizeMode(arg.slice('--mode='.length));
      continue;
    }

    if (arg === '--id' && argv[index + 1]) {
      options.id = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--id=')) {
      options.id = arg.slice('--id='.length);
      continue;
    }

    if (arg === '--lab' && argv[index + 1]) {
      options.lab = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--lab=')) {
      options.lab = arg.slice('--lab='.length);
      continue;
    }

    if (arg === '--style' && argv[index + 1]) {
      options.style = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--style=')) {
      options.style = arg.slice('--style='.length);
      continue;
    }

    if (arg === '--format' && argv[index + 1]) {
      options.format = normalizeFormat(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith('--format=')) {
      options.format = normalizeFormat(arg.slice('--format='.length));
      continue;
    }

    if (arg === '--type' && argv[index + 1]) {
      options.types.push(...argv[index + 1].split(',').map((item) => item.trim()).filter(Boolean));
      index += 1;
      continue;
    }

    if (arg.startsWith('--type=')) {
      options.types.push(...arg.slice('--type='.length).split(',').map((item) => item.trim()).filter(Boolean));
      continue;
    }

    if (arg === '--generic-only') {
      options.mode = 'generic';
      continue;
    }

    if (arg.startsWith('--')) {
      continue;
    }

    positional.push(arg);
  }

  if (!positional.length) {
    return options;
  }

  const first = normalizeMode(positional[0]);

  if (['generic', 'speaker', 'creator', 'participant', 'org', 'all'].includes(first)) {
    options.mode = first;

    if (positional[1]) {
      options.id = positional[1];
    }

    return options;
  }

  options.mode = 'single';
  options.id = positional[0];
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

function resolveLabId(data, lab) {
  const requested = normalizeId(lab || data.defaultLab || 'x26');
  return data.labAliases?.[requested] || (data.labs?.[requested] ? requested : data.defaultLab || 'x26');
}

function labIds(data, requestedLab) {
  if (requestedLab && normalizeId(requestedLab) !== 'all') {
    return [resolveLabId(data, requestedLab)];
  }

  return Object.keys(data.labs || {});
}

function pickLab(data, labId) {
  return data.labs?.[labId] || data.labs?.[data.defaultLab] || {};
}

function pickSpeakers(data, labId) {
  return Array.isArray(pickLab(data, labId).speakers) ? pickLab(data, labId).speakers : [];
}

function pickCreators(data, labId) {
  const lab = pickLab(data, labId);

  if (Array.isArray(lab.creatorPages) && lab.creatorPages.length) {
    return lab.creatorPages
      .map((record) => ({
        ...record,
        speaker: pickSpeakers(data, labId).find((speaker) => speaker.id === record.personId) || null,
      }))
      .filter((record) => record.speaker);
  }

  return pickSpeakers(data, labId).map((speaker) => ({
    id: speaker.id,
    speaker,
  }));
}

function pickParticipants(data, labId) {
  return Array.isArray(pickLab(data, labId).participantTests) ? pickLab(data, labId).participantTests : [];
}

function pickOrgCards(data, labId) {
  return Array.isArray(pickLab(data, labId).orgCards) ? pickLab(data, labId).orgCards : [];
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

  const fallbackStyles = pickModeStyles(lab, mode);
  return [{
    format: lab.defaultFormats?.[mode] || 'wide',
    styles: fallbackStyles,
  }];
}

function resolveFormatStyles(lab, mode, requestedFormat, requestedStyle) {
  const formatTargets = pickModeFormats(lab, mode);
  let matches = formatTargets;

  if (requestedFormat) {
    matches = matches.filter((entry) => normalizeFormat(entry.format) === normalizeFormat(requestedFormat));
    if (!matches.length) {
      throw new Error(`Format not found for lab ${lab.id}: ${mode}:${requestedFormat}`);
    }
  }

  if (requestedStyle) {
    matches = matches
      .map((entry) => ({
        format: entry.format,
        styles: entry.styles.filter((style) => normalizeId(style) === normalizeId(requestedStyle)),
      }))
      .filter((entry) => entry.styles.length);

    if (!matches.length) {
      throw new Error(`Style not found for lab ${lab.id}: ${mode}:${requestedStyle}`);
    }
  }

  return matches;
}

function styleTargets(data, labId, requestedStyle, requestedFormat) {
  const lab = pickLab(data, labId);
  return resolveFormatStyles(lab, 'generic', requestedFormat, requestedStyle);
}

function matchesTypeFilter(target, filters) {
  if (!filters.length) {
    return true;
  }

  const normalized = filters.map((item) => item.toLowerCase());
  const speaker = target.speaker || null;
  const participant = target.participant || null;
  const haystack = [
    target.mode,
    target.kind,
    target.labId,
    target.format,
    target.style,
    speaker?.type,
    speaker?.modality,
    speaker?.modalityLabel,
    participant?.modality,
    participant?.modalityLabel,
    participant?.status,
  ]
    .filter(Boolean)
    .map((item) => String(item).toLowerCase());

  return normalized.some((filter) => haystack.some((item) => item.includes(filter)));
}

function genericTargets(data, labId, options) {
  return styleTargets(data, labId, options.style, options.format).flatMap(({ format, styles }) =>
    styles.map((style) => ({
      labId,
      mode: 'generic',
      kind: 'generic',
      id: 'generic-cover',
      format,
      style,
      file: `${labId}/generic/${labId}-generic-${normalizeId(format)}-${normalizeId(style)}.png`,
      title: `${pickLab(data, labId).name || labId} generic ${format} ${style}`,
    }))
  );
}

function speakerTarget(labId, speaker, format, style) {
  return {
    labId,
    mode: 'speaker',
    kind: 'speaker',
    id: speaker.id,
    speaker,
    format,
    style,
    file: `${labId}/${normalizeId(speaker.id)}-${normalizeId(format || 'wide')}-${normalizeId(style || 'default')}.png`,
    title: `${speaker.name} ${format || 'wide'} ${style || 'default'}`.trim(),
  };
}

function creatorTarget(labId, record) {
  return {
    labId,
    mode: 'creator',
    kind: 'creator',
    id: record.id,
    speaker: record.speaker,
    file: `${labId}/${normalizeId(record.speaker.id)}-creator.png`,
    title: `${record.speaker.name} creator page`,
  };
}

function participantTarget(labId, record) {
  return {
    labId,
    mode: 'participant',
    kind: 'participant',
    id: record.id,
    participant: record,
    file: `${labId}/participants/${normalizeId(record.id)}-participant-test.png`,
    title: `${record.name} participant test`,
  };
}

function orgTarget(data, labId, record, format, style) {
  return {
    labId,
    mode: 'org',
    kind: record.kind || 'org',
    id: record.id,
    orgCard: record,
    format,
    style,
    file: `${labId}/org/${normalizeId(record.id)}-${normalizeId(format || 'wide')}-${normalizeId(style || 'default')}.png`,
    title: `${pickLab(data, labId).name || labId} ${record.title || record.id} ${format || 'wide'} ${style || ''}`.trim(),
  };
}

function buildTargetsForLab(data, labId, options) {
  const lab = pickLab(data, labId);
  const speakers = pickSpeakers(data, labId);
  const creators = pickCreators(data, labId);
  const participants = pickParticipants(data, labId);
  const orgCards = pickOrgCards(data, labId);
  const normalizedId = options.id ? normalizeId(options.id) : null;
  const list = [];

  if (options.mode === 'generic') {
    list.push(...genericTargets(data, labId, options));
  } else if (options.mode === 'speaker') {
    const speakerFormats = resolveFormatStyles(lab, 'speaker', options.format, options.style);
    const speaker = normalizedId
      ? speakers.find((item) => normalizeId(item.id) === normalizedId || normalizeId(item.aimLmsId) === normalizedId)
      : null;

    if (normalizedId && !speaker) {
      throw new Error(`Speaker not found for lab ${labId}: ${options.id}`);
    }

    list.push(...speakerFormats.flatMap(({ format, styles }) =>
      (speaker ? [speaker] : speakers).flatMap((item) => styles.map((style) => speakerTarget(labId, item, format, style)))
    ));
  } else if (options.mode === 'creator') {
    const creator = normalizedId
      ? creators.find((item) => normalizeId(item.id) === normalizedId || normalizeId(item.speaker.id) === normalizedId)
      : null;

    if (normalizedId && !creator) {
      throw new Error(`Creator not found for lab ${labId}: ${options.id}`);
    }

    list.push(...(creator ? [creatorTarget(labId, creator)] : creators.map((item) => creatorTarget(labId, item))));
  } else if (options.mode === 'participant') {
    const participant = normalizedId
      ? participants.find((item) => normalizeId(item.id) === normalizedId)
      : null;

    if (normalizedId && !participant) {
      throw new Error(`Participant not found for lab ${labId}: ${options.id}`);
    }

    list.push(...(participant ? [participantTarget(labId, participant)] : participants.map((item) => participantTarget(labId, item))));
  } else if (options.mode === 'org') {
    const orgFormats = resolveFormatStyles(lab, 'org', options.format, options.style);
    const normalizedOrgId = normalizedId ? normalizeOrgCardId(options.id) : null;
    const orgCard = normalizedOrgId
      ? orgCards.find((item) => normalizeOrgCardId(item.id) === normalizedOrgId)
      : null;

    if (normalizedOrgId && !orgCard) {
      throw new Error(`Org card not found for lab ${labId}: ${options.id}`);
    }

    list.push(...orgFormats.flatMap(({ format, styles }) =>
      (orgCard ? [orgCard] : orgCards).flatMap((item) => styles.map((style) => orgTarget(data, labId, item, format, style)))
    ));
  } else if (options.mode === 'single') {
    const speaker = speakers.find((item) => normalizeId(item.id) === normalizedId || normalizeId(item.aimLmsId) === normalizedId);

    if (!speaker) {
      throw new Error(`Speaker not found for lab ${labId}: ${options.id}`);
    }

    const defaultSpeakerStyle = lab.defaultSpeakerStyle || (Array.isArray(lab.speakerStyles) && lab.speakerStyles.includes('surname') ? 'surname' : lab.speakerStyles?.[0]) || 'speaker';
    const defaultSpeakerFormat = lab.defaultFormats?.speaker || 'wide';
    list.push(speakerTarget(labId, speaker, defaultSpeakerFormat, defaultSpeakerStyle));
  } else {
    list.push(...genericTargets(data, labId, options));
    list.push(...resolveFormatStyles(lab, 'speaker', options.format, options.style).flatMap(({ format, styles }) =>
      speakers.flatMap((item) => styles.map((style) => speakerTarget(labId, item, format, style)))
    ));
    list.push(...creators.map((item) => creatorTarget(labId, item)));
    list.push(...participants.map((item) => participantTarget(labId, item)));
    list.push(...resolveFormatStyles(lab, 'org', options.format, options.style).flatMap(({ format, styles }) =>
      orgCards.flatMap((item) => styles.map((style) => orgTarget(data, labId, item, format, style)))
    ));
  }

  return list.filter((target) => matchesTypeFilter(target, options.types));
}

function buildTargets(data, options) {
  return labIds(data, options.lab).flatMap((labId) => buildTargetsForLab(data, labId, options));
}

function canvasSizeForTarget(target, data) {
  const base = data.design?.size || { width: 1800, height: 600, deviceScaleFactor: 2 };
  if (target.format === 'story') {
    return { width: 1080, height: 1920, deviceScaleFactor: base.deviceScaleFactor || 2 };
  }
  if (target.format === 'square') {
    return { width: 1080, height: 1080, deviceScaleFactor: base.deviceScaleFactor || 2 };
  }
  return base;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

async function cleanupExportTargets(targets) {
  const labs = [...new Set(targets.map((target) => target.labId))];
  const expectedFiles = new Set(targets.map((target) => path.join(OUTPUT_DIR, target.file)));

  for (const labId of labs) {
    const labDir = path.join(OUTPUT_DIR, labId);
    let existingFiles = [];
    try {
      existingFiles = await walkFiles(labDir);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }

    for (const filePath of existingFiles) {
      if (!expectedFiles.has(filePath)) {
        await fs.unlink(filePath);
      }
    }
  }
}

async function renderTarget(page, target, data) {
  const targetSize = canvasSizeForTarget(target, data);
  await page.setViewport({
    width: Math.max(1200, targetSize.width),
    height: Math.max(900, Math.min(2200, targetSize.height)),
    deviceScaleFactor: targetSize.deviceScaleFactor || 2,
  });

  const params = new URLSearchParams();
  params.set('lab', target.labId);
  params.set('mode', target.mode);
  if (target.format) {
    params.set('format', target.format);
  }

  if (target.mode === 'generic') {
    params.set('style', target.style);
  } else {
    params.set('id', target.id);
    if (target.mode === 'speaker' && target.style) {
      params.set('speakerStyle', target.style);
    }
    if (target.mode === 'org' && target.style) {
      params.set('orgStyle', target.style);
    }
  }

  const url = `${pathToFileURL(INDEX_PATH).toString()}?${params.toString()}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(
    () => window.__X26_BANNER_READY__ === true && !!document.querySelector('#currentBanner[data-banner-root="true"]'),
    { timeout: 90000 }
  );
  await page.evaluate(() => {
    const scaler = document.getElementById('scaler');
    if (scaler) {
      scaler.style.transform = 'none';
    }
    const previewWrap = document.querySelector('.preview-wrap');
    if (previewWrap) {
      previewWrap.style.overflow = 'visible';
      previewWrap.style.height = 'auto';
    }
  });
  await page.evaluate(() => {
    const banner = document.querySelector('#currentBanner[data-banner-root="true"]');
    if (!banner) return;
    const clone = banner.cloneNode(true);
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = 'transparent';
    document.body.appendChild(clone);
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const element = await page.$('#currentBanner[data-banner-root="true"]');

  if (!element) {
    throw new Error(`Banner root not found for ${target.labId}:${target.mode}:${target.id}`);
  }

  const filePath = path.join(OUTPUT_DIR, target.file);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await element.screenshot({ path: filePath, type: 'png' });
  return filePath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = await loadData();
  const size = data.design?.size || { width: 1800, height: 600, deviceScaleFactor: 2 };
  const targets = buildTargets(data, options);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  if (options.mode === 'all') {
    await cleanupExportTargets(targets);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: {
      width: size.width,
      height: size.height,
      deviceScaleFactor: size.deviceScaleFactor || 2,
    },
    args: [
      '--allow-file-access-from-files',
      '--font-render-hinting=medium',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  const records = [];

  try {
    for (const target of targets) {
      const filePath = await renderTarget(page, target, data);
      records.push({
        lab: target.labId,
        mode: target.mode,
      kind: target.kind,
      id: target.id,
      format: target.format || null,
      style: target.style || null,
      title: target.title,
      file: path.relative(OUTPUT_DIR, filePath),
      });
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    projectName: data.projectName || 'x26-banner-generator',
    outputDir: OUTPUT_DIR,
    totals: {
      files: records.length,
      generic: records.filter((item) => item.mode === 'generic').length,
      speaker: records.filter((item) => item.mode === 'speaker').length,
      creator: records.filter((item) => item.mode === 'creator').length,
      participant: records.filter((item) => item.mode === 'participant').length,
      org: records.filter((item) => item.mode === 'org').length,
    },
    filters: {
      mode: options.mode,
      id: options.id,
      lab: options.lab,
      style: options.style,
      format: options.format,
      types: options.types,
    },
    files: records,
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`exported ${records.length} PNG file(s) to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
