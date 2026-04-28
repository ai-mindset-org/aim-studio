// Netlify Function: Banner-as-API v1 (CHUNK 1)
// POST /api/v1/render-banner
// Body: { lab, mode, type, format, style, color, filter, customText, photoUrl }
// Returns: PNG binary with Content-Type: image/png
//
// Auth: X-API-Key header against env BANNER_API_KEYS (comma-separated allowed keys).
// Errors: 4xx with { error, request_id } JSON; 5xx logs to Sentry (SENTRY_DSN env).
//
// Renders by loading the public banner generator URL in headless chromium and
// screenshotting the #currentBanner element. customText / photoUrl are v2 features
// and are ignored in v1 (documented but not implemented).
//
// See: scripts/export.mjs (local-server CLI variant using full puppeteer).

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import * as Sentry from '@sentry/serverless';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Sentry (inline, optional — only inits if DSN provided)
// ---------------------------------------------------------------------------
const SENTRY_DSN = process.env.SENTRY_DSN || '';
if (SENTRY_DSN) {
  Sentry.AWSLambda.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0,
    environment: process.env.CONTEXT || 'production',
  });
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PUBLIC_GENERATOR_URL = process.env.BANNER_GENERATOR_URL || 'https://x26-banners.netlify.app/';

const ALLOWED_LABS = ['x26', 's3', 'core'];
const ALLOWED_MODES = ['generic', 'speaker', 'org'];
const ALLOWED_FORMATS = ['3:1', 'square', 'story'];

// Viewport sizing — mirrors scripts/export.mjs canvasSizeForTarget.
// Format aliases: '3:1' is what the API accepts; UI uses 'wide' internally.
function viewportForFormat(format) {
  if (format === 'story') {
    return { width: 1080, height: 1920, deviceScaleFactor: 2 };
  }
  if (format === 'square') {
    return { width: 1080, height: 1080, deviceScaleFactor: 2 };
  }
  // '3:1' default — matches design.size in data/labs.bundle.js (1800x600 @ 2x)
  return { width: 1800, height: 600, deviceScaleFactor: 2 };
}

// API format → UI format param. UI uses 'wide' for 3:1 banners.
function uiFormatFor(format) {
  if (format === '3:1') return 'wide';
  return format;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------
function jsonError(status, requestId, error) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ error, request_id: requestId }),
  };
}

function pngOk(buffer, requestId, renderMs) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'X-Request-Id': requestId,
      'X-Banner-Cache': 'MISS',
      'X-Banner-Render-Ms': String(renderMs),
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validate(payload) {
  const errors = [];
  const lab = payload.lab;
  const mode = payload.mode;
  const format = payload.format || '3:1';

  if (!lab || !ALLOWED_LABS.includes(lab)) {
    errors.push(`lab must be one of ${ALLOWED_LABS.join(', ')}`);
  }
  if (!mode || !ALLOWED_MODES.includes(mode)) {
    errors.push(`mode must be one of ${ALLOWED_MODES.join(', ')}`);
  }
  if (!ALLOWED_FORMATS.includes(format)) {
    errors.push(`format must be one of ${ALLOWED_FORMATS.join(', ')}`);
  }
  // type, style: soft — accepted as-is (UI defaults gracefully on unknown).
  // customText, photoUrl: v2 features — silently ignored in v1.

  return { errors, normalized: { lab, mode, format, type: payload.type, style: payload.style } };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
async function renderBanner({ lab, mode, format, type, style }) {
  const viewport = viewportForFormat(format);
  const url = new URL(PUBLIC_GENERATOR_URL);
  url.searchParams.set('lab', lab);
  url.searchParams.set('mode', mode);
  url.searchParams.set('format', uiFormatFor(format));
  if (type) url.searchParams.set('type', type);
  if (style) {
    if (mode === 'speaker') {
      url.searchParams.set('speakerStyle', style);
    } else if (mode === 'org') {
      url.searchParams.set('orgStyle', style);
    } else {
      url.searchParams.set('style', style);
    }
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: viewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Wait for the app to signal banner is ready (app.js sets this flag).
    await page.waitForFunction(
      () => window.__X26_BANNER_READY__ === true && !!document.querySelector('#currentBanner[data-banner-root="true"]'),
      { timeout: 60_000 }
    );

    // Strip the scaler/preview wrap so the banner renders at native size — same
    // trick scripts/export.mjs uses to get crisp screenshots.
    await page.evaluate(() => {
      const scaler = document.getElementById('scaler');
      if (scaler) scaler.style.transform = 'none';
      const previewWrap = document.querySelector('.preview-wrap');
      if (previewWrap) {
        previewWrap.style.overflow = 'visible';
        previewWrap.style.height = 'auto';
      }
      const banner = document.querySelector('#currentBanner[data-banner-root="true"]');
      if (banner) {
        const clone = banner.cloneNode(true);
        document.body.innerHTML = '';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.background = 'transparent';
        document.body.appendChild(clone);
      }
    });

    // Two RAFs for layout settle.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const element = await page.$('#currentBanner[data-banner-root="true"]');
    if (!element) {
      throw new Error('Banner root not found after render');
    }

    const buffer = await element.screenshot({ type: 'png', omitBackground: false });
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
async function rawHandler(event) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  if (event.httpMethod !== 'POST') {
    return jsonError(405, requestId, 'Method not allowed; use POST');
  }

  // Auth
  const allowedKeys = (process.env.BANNER_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (!allowedKeys.length) {
    return jsonError(503, requestId, 'API not configured (BANNER_API_KEYS env var is empty)');
  }
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'] || headers['X-Api-Key'];
  if (!apiKey || !allowedKeys.includes(apiKey)) {
    return jsonError(401, requestId, 'Invalid or missing X-API-Key');
  }

  // Body
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonError(400, requestId, 'Invalid JSON body');
  }

  // Validate
  const { errors, normalized } = validate(payload);
  if (errors.length) {
    return jsonError(400, requestId, errors.join('; '));
  }

  // Render
  try {
    const buffer = await renderBanner(normalized);
    const renderMs = Date.now() - startedAt;
    return pngOk(buffer, requestId, renderMs);
  } catch (e) {
    console.error(`[render-banner ${requestId}] render failed:`, e && e.stack ? e.stack : e);
    if (SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag('request_id', requestId);
        scope.setContext('render_params', normalized);
        Sentry.captureException(e);
      });
      await Sentry.flush(2000).catch(() => {});
    }
    return jsonError(500, requestId, 'Render failed');
  }
}

export const handler = SENTRY_DSN
  ? Sentry.AWSLambda.wrapHandler(rawHandler)
  : rawHandler;
