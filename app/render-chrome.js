// app/render-chrome.js
//
// Single source of truth for terminal-chrome decoration around the active
// banner preview. Replaces the legacy per-card `baseHTML()` corner-bracket
// emission that caused N-fold repetition when N speakers/labs matched a
// filter. Always render ONCE around the active card stack at the
// orchestrator level — never per-card.
//
// Contract (matches design.md §4.3 and PLAN.md Task I5):
//
//   render({ show, position, label, dimensions }) -> { html, css }
//
//   show       : boolean — when false, return inert wrapper that simply
//                passes content through (no corners, no header).
//   position   : 'outer' | 'card' — wave I-5 only emits 'outer'. 'card'
//                is reserved for single-banner export contexts in later
//                waves; we keep the parameter so the contract stays stable.
//   label      : string — header text, displayed as `PREVIEW · <label>`
//                e.g. "S3 / SPEAKER / 1800×600". Caller is responsible for
//                passing an already-formatted string.
//   dimensions : { w, h } — banner dimensions in pixels. Used to size the
//                inner aspect cell so chrome corners hug the actual banner.
//
// Returns:
//   { html, css }
//     html — opening + closing wrapper as a tagged template `<frame>${''}</frame>`.
//            Caller splices content into the slot via String.replace, OR uses
//            `wrap(content)` helper for convenience.
//     css  — empty string (styles live in styles.css under .chrome-outer scope).
//            Returned for API parity in case future iterations inject
//            per-instance CSS variables.

const DEFAULT_DIMENSIONS = { w: 1800, h: 600 };
const CORNER_SIZE_PX = 20; // {component.chrome.corner-size} → {size.corner-mark}

function buildHeader(label) {
  const safe = String(label ?? '').trim() || 'banner';
  return `<div class="chrome-header"><span class="chrome-header-tag">PREVIEW</span> · ${escape(safe)}</div>`;
}

function buildCorners() {
  return (
    '<span class="chrome-corner chrome-corner-tl" aria-hidden="true"></span>' +
    '<span class="chrome-corner chrome-corner-tr" aria-hidden="true"></span>' +
    '<span class="chrome-corner chrome-corner-bl" aria-hidden="true"></span>' +
    '<span class="chrome-corner chrome-corner-br" aria-hidden="true"></span>'
  );
}

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;'  :
    c === '>' ? '&gt;'  :
    c === '"' ? '&quot;' : '&#39;'
  );
}

/**
 * Wrap arbitrary HTML content in a single chrome shell.
 *
 * @param {string} content   Inner banner markup (already-rendered).
 * @param {object} options   { show, position, label, dimensions } per contract.
 * @returns {string}         Composed HTML string.
 */
export function wrap(content, options = {}) {
  const { html } = render(options);
  // Slot marker is inserted by render() at the position content should live.
  return html.replace('<!--CHROME_SLOT-->', content || '');
}

/**
 * Build chrome wrapper HTML around a slot marker. Caller typically uses
 * `wrap(content, options)` instead, but `render()` is exposed for parity
 * with the renderer contract used by I1-I4 sibling files.
 *
 * @param {object} options
 * @param {boolean} [options.show=true]
 * @param {'outer'|'card'} [options.position='outer']
 * @param {string} [options.label='banner']
 * @param {{w:number,h:number}} [options.dimensions]
 */
export function render(options = {}) {
  const show = options.show !== false;
  const position = options.position === 'card' ? 'card' : 'outer';
  const label = options.label;
  const dim = options.dimensions || DEFAULT_DIMENSIONS;

  if (!show) {
    return {
      html: '<div class="chrome-bypass"><!--CHROME_SLOT--></div>',
      css: '',
    };
  }

  const header = buildHeader(label);
  const corners = buildCorners();
  const styleAttr =
    `style="--chrome-corner-size:${CORNER_SIZE_PX}px;` +
    `--chrome-banner-w:${Number(dim.w) || DEFAULT_DIMENSIONS.w}px;` +
    `--chrome-banner-h:${Number(dim.h) || DEFAULT_DIMENSIONS.h}px;"`;

  const html =
    `<div class="chrome-outer chrome-outer--${position}" data-chrome="outer" ${styleAttr}>` +
      header +
      `<div class="chrome-frame">` +
        corners +
        `<div class="chrome-stage"><!--CHROME_SLOT--></div>` +
      `</div>` +
    `</div>`;

  return { html, css: '' };
}

// Expose to classic-script consumers (current app.js loads as a non-module).
// Once app.js converts to type=module, this fallback is harmless.
if (typeof window !== 'undefined') {
  window.AIMChrome = { render, wrap };
}
