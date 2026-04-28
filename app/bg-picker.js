// app/bg-picker.js
// Wave J3 — Prompt Picker UI for AI-generated banner backgrounds.
//
// Contract:
//   mount({ root, state, prompts, onBgChange })
//     root:        HTMLElement target for the picker markup
//     state:       application state — uses state.labId for lab routing
//     prompts:     [{ id, name, subject, negation }] (optional; mount() will
//                  fetch ./data/backdrops/s3-prompts.json if empty)
//     onBgChange:  (bg) => void — bg = { type:'ai-generated', src, opacity }
//
// Endpoint: POST /.netlify/functions/generate-bg
// Body: { prompt, style, lab, model, seed }
// Response: { dataUrl }
//
// Cache + postprocess are wired via app/bg-cache.js (J5) and
// app/bg-postprocess.js (J4). Both are imported lazily so this module mounts
// even before those siblings land — calls are wrapped in try/catch with
// pass-through fallbacks.

let _postprocess = null;
let _cache = null;

async function loadDeps() {
  if (_postprocess === null) {
    try {
      const mod = await import('./bg-postprocess.js');
      _postprocess = typeof mod.postprocess === 'function' ? mod.postprocess : passthrough;
    } catch (_err) {
      _postprocess = passthrough;
    }
  }
  if (_cache === null) {
    try {
      const mod = await import('./bg-cache.js');
      _cache = {
        get: typeof mod.get === 'function' ? mod.get : () => null,
        set: typeof mod.set === 'function' ? mod.set : () => {},
      };
    } catch (_err) {
      _cache = { get: () => null, set: () => {} };
    }
  }
}

async function passthrough(dataUrl) {
  return dataUrl;
}

const MODEL_OPTIONS = [
  { id: 'gemini-3-pro', label: 'gemini 3 pro (default)' },
  { id: 'gpt-5-image', label: 'gpt-5 image' },
  { id: 'gemini-flash', label: 'gemini flash' },
];

function buildLabel(text) {
  const label = document.createElement('label');
  label.textContent = text;
  label.className = 'bg-picker-label';
  return label;
}

function buildSelect(id, options) {
  const select = document.createElement('select');
  select.id = id;
  select.className = 'bg-picker-select';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.id;
    o.textContent = opt.label || opt.name || opt.id;
    select.appendChild(o);
  }
  return select;
}

function buildButton(id, text, variant = 'primary') {
  const btn = document.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.className = `bg-picker-button bg-picker-button--${variant}`;
  btn.textContent = text;
  return btn;
}

function composePrompt(promptDef, customText) {
  if (!promptDef || promptDef.id === 'custom') {
    return String(customText || '').trim();
  }
  const subject = promptDef.subject || '';
  const negation = promptDef.negation || '';
  return [subject, negation].filter(Boolean).join('. ');
}

function cacheKeyFor({ prompt, model, seed }) {
  return `${prompt}|${model}|${seed || ''}`;
}

export function mount({ root, state, prompts = [], onBgChange } = {}) {
  if (!root) return null;

  root.innerHTML = '';
  root.classList.add('bg-picker-mounted');

  const header = document.createElement('h2');
  header.textContent = 'AI BACKGROUND';
  header.className = 'bg-picker-header';
  root.appendChild(header);

  // Style dropdown
  const styleRow = document.createElement('div');
  styleRow.className = 'bg-picker-row';
  styleRow.appendChild(buildLabel('STYLE'));
  const styleSelect = buildSelect('bg-picker-style', [
    { id: '__loading', name: 'loading prompts…' },
  ]);
  styleSelect.disabled = true;
  styleRow.appendChild(styleSelect);
  root.appendChild(styleRow);

  // Model selector
  const modelRow = document.createElement('div');
  modelRow.className = 'bg-picker-row';
  modelRow.appendChild(buildLabel('MODEL'));
  const modelSelect = buildSelect('bg-picker-model', MODEL_OPTIONS);
  modelRow.appendChild(modelSelect);
  root.appendChild(modelRow);

  // Custom prompt textarea (collapsed by default)
  const customRow = document.createElement('div');
  customRow.className = 'bg-picker-row bg-picker-row--custom';
  customRow.style.display = 'none';
  customRow.appendChild(buildLabel('CUSTOM PROMPT'));
  const customTextarea = document.createElement('textarea');
  customTextarea.id = 'bg-picker-custom';
  customTextarea.className = 'bg-picker-textarea';
  customTextarea.rows = 4;
  customTextarea.placeholder = 'describe the backdrop…';
  customRow.appendChild(customTextarea);
  root.appendChild(customRow);

  // Seed (hidden, internal — incremented by regen button)
  const seedRow = document.createElement('div');
  seedRow.className = 'bg-picker-row bg-picker-row--seed';
  seedRow.appendChild(buildLabel('SEED'));
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.id = 'bg-picker-seed';
  seedInput.className = 'bg-picker-seed';
  seedInput.value = '';
  seedInput.placeholder = '(auto)';
  seedRow.appendChild(seedInput);
  root.appendChild(seedRow);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'bg-picker-buttons';
  const generateBtn = buildButton('bg-picker-generate', 'GENERATE', 'primary');
  const regenBtn = buildButton('bg-picker-regen', 'REGEN ↻', 'secondary');
  regenBtn.title = 'increment seed and regenerate';
  btnRow.appendChild(generateBtn);
  btnRow.appendChild(regenBtn);
  root.appendChild(btnRow);

  // Status messages
  const errorEl = document.createElement('div');
  errorEl.className = 'bg-picker-error';
  errorEl.style.display = 'none';
  root.appendChild(errorEl);

  const noticeEl = document.createElement('div');
  noticeEl.className = 'bg-picker-notice';
  noticeEl.style.display = 'none';
  root.appendChild(noticeEl);

  const spinnerEl = document.createElement('div');
  spinnerEl.className = 'bg-picker-spinner';
  spinnerEl.style.display = 'none';
  spinnerEl.textContent = '◌ generating…';
  root.appendChild(spinnerEl);

  // ── State + helpers ───
  let promptList = Array.isArray(prompts) ? prompts.slice() : [];

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    noticeEl.style.display = 'none';
  }

  function showNotice(msg) {
    noticeEl.textContent = msg;
    noticeEl.style.display = 'block';
    errorEl.style.display = 'none';
  }

  function clearStatus() {
    errorEl.style.display = 'none';
    noticeEl.style.display = 'none';
  }

  function refreshStyleSelect() {
    styleSelect.innerHTML = '';
    for (const p of promptList) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name || p.id;
      styleSelect.appendChild(o);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'custom (write your own)';
    styleSelect.appendChild(customOpt);
    styleSelect.disabled = false;
  }

  styleSelect.addEventListener('change', () => {
    customRow.style.display = styleSelect.value === 'custom' ? 'flex' : 'none';
    clearStatus();
  });

  async function loadPromptsIfNeeded() {
    if (promptList.length) {
      refreshStyleSelect();
      return;
    }
    try {
      const resp = await fetch('./data/backdrops/s3-prompts.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      if (Array.isArray(data)) {
        promptList = data;
      }
    } catch (_err) {
      // J2 may not have landed yet; provide a single fallback so UI is usable.
      promptList = [
        {
          id: 'fallback',
          name: '(prompts unavailable — use custom)',
          subject: '',
          negation: '',
        },
      ];
    }
    refreshStyleSelect();
  }

  function selectedPromptDef() {
    const id = styleSelect.value;
    if (id === 'custom') return { id: 'custom' };
    return promptList.find((p) => p.id === id) || null;
  }

  async function runGenerate({ bumpSeed = false } = {}) {
    clearStatus();
    await loadDeps();

    const def = selectedPromptDef();
    const promptText = composePrompt(def, customTextarea.value);
    if (!promptText) {
      showError('prompt is required (pick a style or write a custom prompt)');
      return;
    }

    const model = modelSelect.value;
    const lab = state?.labId || 's3';
    const styleId = def?.id || 'custom';

    // Seed: if regen, increment current seed (or start at 1 if empty).
    let seed = seedInput.value ? Number(seedInput.value) : null;
    if (bumpSeed) {
      seed = (Number.isFinite(seed) ? seed : 0) + 1;
      seedInput.value = String(seed);
    }

    const cacheKey = cacheKeyFor({ prompt: promptText, model, seed });

    // Cache lookup (fast path)
    try {
      const cached = _cache.get(cacheKey);
      if (cached && !bumpSeed) {
        if (typeof onBgChange === 'function') {
          onBgChange({ type: 'ai-generated', src: cached, opacity: 0.85 });
        }
        showNotice('cached result applied');
        return;
      }
    } catch (_err) { /* ignore */ }

    // Network fetch
    generateBtn.disabled = true;
    regenBtn.disabled = true;
    spinnerEl.style.display = 'block';
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'generating…';

    try {
      const body = { prompt: promptText, style: styleId, lab, model };
      if (seed != null && Number.isFinite(seed)) body.seed = seed;

      const resp = await fetch('/.netlify/functions/generate-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('AI bg requires Netlify deploy (run `netlify dev` or deploy).');
      }
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
      if (!data.dataUrl) throw new Error('no image returned');

      // Postprocess (desat + tint + scrim)
      let finalUrl = data.dataUrl;
      try {
        finalUrl = await _postprocess(data.dataUrl);
      } catch (err) {
        console.warn('[bg-picker] postprocess failed, using raw:', err);
      }

      // Cache + apply
      try { _cache.set(cacheKey, finalUrl); } catch (_err) { /* quota */ }
      if (typeof onBgChange === 'function') {
        onBgChange({ type: 'ai-generated', src: finalUrl, opacity: 0.85 });
      }
      showNotice('generated and applied');
    } catch (err) {
      let msg = (err && err.message) || String(err);
      if (msg === 'Failed to fetch' || /NetworkError|TypeError/i.test(msg)) {
        msg = 'AI bg requires Netlify deploy (run `netlify dev` or deploy).';
      }
      showError(msg);
    } finally {
      generateBtn.disabled = false;
      regenBtn.disabled = false;
      spinnerEl.style.display = 'none';
      generateBtn.textContent = originalText;
    }
  }

  generateBtn.addEventListener('click', () => runGenerate({ bumpSeed: false }));
  regenBtn.addEventListener('click', () => runGenerate({ bumpSeed: true }));

  // Kick off prompt fetch
  loadPromptsIfNeeded();

  return { root, refresh: () => {} };
}

export default { mount };
