// app/edit-sidebar.js
// Persistent edit sidebar shell for AIM Studio.
// Wave I7 — label + text input rows. Wave J6 — per-field font-size controls.
//
// Contract:
//   mount({ root, state, onChange })
//     root:     HTMLElement target for the sidebar markup
//     state:    application state with state.copy (or current copy snapshot)
//               state.copy.fontSizes — optional namespace for size overrides
//     onChange: (fieldKey, value) => void  — wired to updateCopyField
//
// Field keys are derived from the current copy snapshot so that the sidebar
// stays in sync with whatever mode is active (generic / speaker / creator /
// participant). Each row exposes a text input bound to onChange plus a
// numeric font-size input with ± steppers that live-binds to the canvas via
// a CSS variable on `.banner-root`: `--copy-<fieldKey>-fs`.

const FIELD_LABEL_OVERRIDES = {
  accentTitle: 'ACCENT TITLE',
  subtitle: 'SUB',
  sub: 'SUB',
};

// Wave J6: default font sizes (px) per field. Used when state.copy.fontSizes
// has no entry for the field. Renderers can pick these up via
// `var(--copy-<key>-fs, <default>px)` once they wire up.
const DEFAULT_FONT_SIZES = {
  title: 130,
  accentTitle: 96,
  sub: 14,
  subtitle: 14,
  eyebrow: 20,
  dates: 18,
  footer: 11,
};

const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 200;

function readCopySnapshot(state) {
  if (!state) return {};

  // Preferred: explicit state.copy (per task contract).
  if (state.copy && typeof state.copy === 'object') {
    return state.copy;
  }

  // Fallback: AIM Studio merges defaults with overrides via currentCopy().
  if (typeof window !== 'undefined' && typeof window.currentCopy === 'function') {
    try {
      return window.currentCopy() || {};
    } catch (_err) {
      return {};
    }
  }

  return {};
}

function readFontSizeStore(state) {
  if (!state) return null;
  if (state.copy && typeof state.copy === 'object') {
    state.copy.fontSizes = state.copy.fontSizes || {};
    return state.copy.fontSizes;
  }
  return null;
}

function defaultFontSize(key) {
  if (key in DEFAULT_FONT_SIZES) return DEFAULT_FONT_SIZES[key];
  // Sensible fallback for unknown fields: medium body size.
  return 14;
}

function clampFontSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(n)));
}

function applyFontSizeVar(key, value) {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('.banner-root');
  if (!root) return;
  root.style.setProperty(`--copy-${key}-fs`, `${value}px`);
}

function fieldLabel(key) {
  if (FIELD_LABEL_OVERRIDES[key]) return FIELD_LABEL_OVERRIDES[key];
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildRow(key, value, onChange, fontSizeStore) {
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.field = key;

  const label = document.createElement('label');
  label.htmlFor = `edit-sidebar-input-${key}`;
  label.textContent = fieldLabel(key);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = `edit-sidebar-input-${key}`;
  input.name = key;
  input.value = value == null ? '' : String(value);
  input.autocomplete = 'off';
  input.spellcheck = false;

  input.addEventListener('input', (event) => {
    if (typeof onChange === 'function') {
      onChange(key, event.target.value);
    }
  });

  row.appendChild(label);
  row.appendChild(input);

  // Wave J6: font-size controls (numeric input + ± steppers).
  const initialSize =
    (fontSizeStore && fontSizeStore[key] != null)
      ? clampFontSize(fontSizeStore[key]) ?? defaultFontSize(key)
      : defaultFontSize(key);

  const controls = document.createElement('div');
  controls.className = 'row-controls';

  const fsInput = document.createElement('input');
  fsInput.type = 'number';
  fsInput.min = String(FONT_SIZE_MIN);
  fsInput.max = String(FONT_SIZE_MAX);
  fsInput.step = '1';
  fsInput.dataset.fontsizeKey = key;
  fsInput.value = String(initialSize);
  fsInput.setAttribute('aria-label', `${fieldLabel(key)} font size`);

  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'fs-step';
  minusBtn.dataset.step = '-1';
  minusBtn.textContent = '−'; // minus sign
  minusBtn.setAttribute('aria-label', `${fieldLabel(key)} font size decrement`);

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'fs-step';
  plusBtn.dataset.step = '+1';
  plusBtn.textContent = '+';
  plusBtn.setAttribute('aria-label', `${fieldLabel(key)} font size increment`);

  fsInput.addEventListener('input', (event) => {
    const next = clampFontSize(event.target.value);
    if (next == null) return;
    if (fontSizeStore) {
      fontSizeStore[key] = next;
    }
    applyFontSizeVar(key, next);
  });

  function bumpFontSize(delta) {
    const current = clampFontSize(fsInput.value) ?? defaultFontSize(key);
    const next = clampFontSize(current + delta);
    if (next == null || next === current) return;
    fsInput.value = String(next);
    fsInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  minusBtn.addEventListener('click', () => bumpFontSize(-1));
  plusBtn.addEventListener('click', () => bumpFontSize(+1));

  controls.appendChild(fsInput);
  controls.appendChild(minusBtn);
  controls.appendChild(plusBtn);
  row.appendChild(controls);

  // Apply initial CSS var so renderers (when wired) see the chosen size.
  applyFontSizeVar(key, initialSize);

  return row;
}

export function mount({ root, state, onChange } = {}) {
  if (!root) return null;

  root.innerHTML = '';

  const header = document.createElement('h2');
  header.textContent = 'EDITABLE COPY';
  root.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'edit-sidebar-rows';
  root.appendChild(rows);

  const copy = readCopySnapshot(state);
  const fontSizeStore = readFontSizeStore(state);
  const keys = Object.keys(copy).filter((k) => k !== 'fontSizes');

  if (!keys.length) {
    const empty = document.createElement('p');
    empty.className = 'edit-sidebar-empty';
    empty.textContent = 'no editable fields for this view.';
    rows.appendChild(empty);
  } else {
    keys.forEach((key) => {
      rows.appendChild(buildRow(key, copy[key], onChange, fontSizeStore));
    });
  }

  function refresh(nextState) {
    const snapshot = readCopySnapshot(nextState || state);
    Array.from(rows.querySelectorAll('input[type="text"]')).forEach((input) => {
      const key = input.name;
      if (key in snapshot) {
        const next = snapshot[key] == null ? '' : String(snapshot[key]);
        if (document.activeElement !== input && input.value !== next) {
          input.value = next;
        }
      }
    });
  }

  return { root, refresh };
}

export default { mount };
