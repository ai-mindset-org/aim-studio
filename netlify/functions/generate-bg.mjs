// Netlify Function: AI background generation via OpenRouter
// POST { prompt, style, lab, model?, seed? } → { dataUrl, prompt, model, costUsd, cacheKey }
//
// Style presets prepend a visual prefix; lab adds an accent hint.
// Supported models (priority order):
//   gemini-3-pro  → google/gemini-3-pro-image-preview  (~$0.04)
//   gpt-5-image   → openai/gpt-5-image                 (~$0.04)
//   gemini-flash  → google/gemini-2.5-flash-image      (~$0.003)
// On 5xx / provider error → falls back through MODEL_FALLBACK_ORDER.

import { createHash } from 'node:crypto';

const STYLE_PREFIXES = {
  biological: 'Abstract biological cellular pattern, microscope plate aesthetic, dark background with glowing cell structures, dense organic texture, ',
  terminal:   'Dark CRT terminal aesthetic, ASCII art, glowing phosphor traces, oscilloscope grid, scientific instrument display, ',
  glitch:     'Glitchy data corruption aesthetic, scan lines, RGB shift, digital decay, pixel sorting, ',
  botanical:  'Victorian botanical engraving meets circuit diagram, fern leaves intertwined with PCB traces, scientific plate, ',
  blueprint:  'Technical blueprint, hand-drawn architectural diagram, schematic lines, annotated technical drawing, ',
  evergreen:  'Soft mauve abstract gradient, mesh noise pattern, ambient depth, ethereal evergreen aesthetic, ',
  plain:      '',
};

const LAB_ACCENTS = {
  x26:  ', accent color #16a34a green',
  s3:   ', accent color #8ddff2 cyan-blue',
  core: ', accent color #a78bfa mauve',
};

const MODEL_MAP = {
  'gemini-3-pro': 'google/gemini-3-pro-image-preview',
  'gpt-5-image':  'openai/gpt-5-image',
  'gemini-flash': 'google/gemini-2.5-flash-image',
};

const COST_USD = {
  'gemini-3-pro': 0.04,
  'gpt-5-image':  0.04,
  'gemini-flash': 0.003,
};

const MODEL_FALLBACK_ORDER = ['gemini-3-pro', 'gpt-5-image', 'gemini-flash'];

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const jsonResponse = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Extract data URL from a chat-completion response.
// Handles three known envelopes:
//   1. message.images[0] = string (raw or data:)
//   2. message.images[0] = { image_url: { url }, url }
//   3. message.content[] = array with { type: 'image_url', image_url: { url } }
//      or { type: 'output_image', image_url: ... } (GPT-5 image variant)
// Falls back to scanning concatenated text for embedded data URL.
function extractDataUrl(data) {
  try {
    const choice  = (data.choices && data.choices[0]) || {};
    const message = choice.message || {};

    // Envelope A: message.images[]
    const images = Array.isArray(message.images) ? message.images : [];
    if (images.length > 0) {
      const first = images[0];
      if (typeof first === 'string') {
        return first.startsWith('data:') ? first : `data:image/png;base64,${first}`;
      }
      if (first && typeof first === 'object') {
        const url = (first.image_url && first.image_url.url) || first.url || first.b64_json || '';
        if (url) {
          return url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
        }
      }
    }

    // Envelope B: message.content[] array of typed parts
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (!part || typeof part !== 'object') continue;
        const url = (part.image_url && part.image_url.url) || part.url || part.b64_json || '';
        if (url) {
          return url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
        }
      }
    }

    // Envelope C: scan stringified content for embedded data URL
    const content = message.content;
    const asString = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((c) => (typeof c === 'string' ? c : (c && c.text) || '')).join('')
        : '';
    const m = asString.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
    if (m) return m[0];
  } catch (e) {
    console.error('extractDataUrl parse error:', e);
  }
  return null;
}

// Single attempt against one model. Returns { ok, status, dataUrl?, errorMessage? }.
async function callModel({ apiKey, modelKey, finalPrompt, seed }) {
  const modelId = MODEL_MAP[modelKey];
  const body = {
    model: modelId,
    messages: [
      { role: 'user', content: [{ type: 'text', text: finalPrompt }] },
    ],
    modalities: ['image', 'text'],
  };
  // Pass-through seed where the provider supports it (most don't, OpenRouter ignores unknown fields).
  if (seed !== undefined && seed !== null && seed !== '') {
    body.seed = Number.isFinite(Number(seed)) ? Number(seed) : seed;
  }

  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(`[${modelKey}] fetch failed:`, e);
    return { ok: false, status: 0, errorMessage: 'fetch failed' };
  }

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error(`[${modelKey}] non-JSON response:`, resp.status, text.slice(0, 300));
    return { ok: false, status: resp.status || 502, errorMessage: 'non-JSON upstream' };
  }

  if (!resp.ok) {
    const msg = (data && data.error && (data.error.message || data.error)) || `Upstream ${resp.status}`;
    console.error(`[${modelKey}] error:`, resp.status, typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 300));
    return { ok: false, status: resp.status, errorMessage: typeof msg === 'string' ? msg : 'upstream error' };
  }

  // Some providers return 200 with an embedded error envelope (provider-level failure).
  if (data && data.error) {
    const msg = (data.error && (data.error.message || data.error)) || 'provider error';
    console.error(`[${modelKey}] provider error in 200:`, typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 300));
    return { ok: false, status: 502, errorMessage: typeof msg === 'string' ? msg : 'provider error' };
  }

  const dataUrl = extractDataUrl(data);
  if (!dataUrl) {
    console.error(`[${modelKey}] no image in response. Keys:`, Object.keys(data || {}));
    return { ok: false, status: 502, errorMessage: 'no image in response' };
  }

  return { ok: true, status: 200, dataUrl };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: 'OPENROUTER_API_KEY not configured' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const {
    prompt = '',
    style  = 'plain',
    lab    = 'x26',
    model  = 'gemini-3-pro',
    seed,
  } = payload;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return jsonResponse(400, { error: 'prompt is required' });
  }

  if (!Object.prototype.hasOwnProperty.call(MODEL_MAP, model)) {
    return jsonResponse(400, {
      error: `unknown model: ${model}`,
      validModels: Object.keys(MODEL_MAP),
    });
  }

  const stylePrefix = STYLE_PREFIXES[style] != null ? STYLE_PREFIXES[style] : '';
  const accentHint  = LAB_ACCENTS[lab] || '';
  const finalPrompt = stylePrefix + prompt.trim() + accentHint;

  // Cache key — incorporates final prompt, requested model, and seed for explicit re-rolls.
  const cacheKey = createHash('sha256')
    .update(`${finalPrompt}|${model}|${seed || ''}`)
    .digest('hex')
    .slice(0, 16);

  // Build fallback chain starting from the requested model.
  const requestedIdx = MODEL_FALLBACK_ORDER.indexOf(model);
  const chain = requestedIdx >= 0
    ? [model, ...MODEL_FALLBACK_ORDER.filter((m) => m !== model)]
    : [model, ...MODEL_FALLBACK_ORDER];

  const attempts = [];
  for (const modelKey of chain) {
    const result = await callModel({ apiKey, modelKey, finalPrompt, seed });
    attempts.push({ modelKey, status: result.status, error: result.errorMessage || null });

    if (result.ok) {
      return jsonResponse(200, {
        dataUrl:  result.dataUrl,
        prompt:   finalPrompt,
        model:    modelKey,
        modelId:  MODEL_MAP[modelKey],
        costUsd:  COST_USD[modelKey] ?? null,
        cacheKey,
        attempts: attempts.length > 1 ? attempts : undefined,
      });
    }

    // Only fall back on 5xx / network / provider errors. 4xx (auth, bad request) — stop.
    const isRetryable = result.status === 0 || result.status === 429 || result.status >= 500;
    if (!isRetryable) {
      return jsonResponse(result.status, {
        error:    result.errorMessage || 'upstream error',
        model:    modelKey,
        attempts,
      });
    }
  }

  // Exhausted chain.
  return jsonResponse(502, {
    error: 'all models failed',
    attempts,
  });
};
