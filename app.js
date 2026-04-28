import { renderBg } from './app/bg-layer.js';
import { render as renderField } from './app/render-field.js';
import { render as renderCards } from './app/render-cards.js';
import { wrap as wrapChrome } from './app/render-chrome.js';
import { mount as mountEditSidebar } from './app/edit-sidebar.js';
import { mount as mountBgPicker } from './app/bg-picker.js';

const DATA = window.X26BannerData || window.X26BannerGeneratorData;

if (!DATA) {
  throw new Error('X26BannerData is missing');
}

const UI = {
  labSelector: document.getElementById('labSelector'),
  modeButtons: document.getElementById('modeButtons'),
  styleButtons: document.getElementById('styleButtons'),
  recordSelector: document.getElementById('recordSelector'),
  randomButton: document.getElementById('randomButton'),
  resetTextButton: document.getElementById('resetTextButton'),
  resetPhotoButton: document.getElementById('resetPhotoButton'),
  downloadButton: document.getElementById('downloadButton'),
  previewFrame: document.getElementById('previewFrame'),
  previewScaler: document.getElementById('previewScaler'),
  previewLabel: document.getElementById('previewLabel'),
  recordMeta: document.getElementById('recordMeta'),
  recordSummary: document.getElementById('recordSummary'),
  bannerMount: document.getElementById('bannerMount'),
  uploadBlock: document.getElementById('uploadBlock'),
  photoInput: document.getElementById('photoInput'),
};

const MODE_OPTIONS = [
  { id: 'generic', label: 'generic cover' },
  { id: 'speaker', label: 'speaker cover' },
  { id: 'creator', label: 'creator page' },
  { id: 'participant', label: 'participant test' },
];

const state = {
  labId: DATA.defaultLab || 'x26',
  mode: 'generic',
  style: 'field',
  // Design-system mode: 'terminal' | 'editorial'.
  // Wave I4: layouts may force this (e.g. cards locks to editorial).
  designMode: 'terminal',
  selectedId: null,
  copyOverrides: {},
  // Per-record numeric font-sizes for editable fields. Wave J6 binds inputs
  // here ({ title: 130, eyebrow: 22, ... }), Wave J7 round-trips through
  // URL `fs` param + window.aimStudioExport/Import.
  copyFontSizes: {},
  photoOverrides: {},
  copy: {},
  // Wave J3: AI-generated background overrides lab default when set.
  // Shape: { type: 'ai-generated', src: <dataUrl>, opacity: 0.85 } | null
  bg: null,
};

// Wave J6: per-field font-size overrides keyed by field name.
state.copy.fontSizes = state.copy.fontSizes || {};

window.__X26_BANNER_READY__ = false;

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function aliasMode(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'profile') {
    return 'creator';
  }

  if (normalized === 'session') {
    return 'speaker';
  }

  if (normalized === 'participants') {
    return 'participant';
  }

  if (MODE_OPTIONS.some((item) => item.id === normalized)) {
    return normalized;
  }

  return 'generic';
}

function aliasLab(value) {
  const normalized = normalizeId(value);
  return DATA.labAliases?.[normalized] || (DATA.labs?.[normalized] ? normalized : DATA.defaultLab || 'x26');
}

function currentLab() {
  return DATA.labs?.[state.labId] || DATA.labs?.[DATA.defaultLab] || {};
}

function currentProgram() {
  return currentLab().program || DATA.program || {};
}

function currentModalities() {
  return currentLab().modalities || DATA.modalities || [];
}

function currentStyleOptions() {
  const lab = currentLab();
  return Array.isArray(lab.styles) && lab.styles.length
    ? lab.styles
    : [{ id: 'field', label: 'field system' }];
}

function ensureStyle() {
  const styleIds = currentStyleOptions().map((item) => item.id);

  if (!styleIds.includes(state.style)) {
    state.style = currentLab().defaultStyle || styleIds[0];
  }
}

function currentSpeakers() {
  return Array.isArray(currentLab().speakers) ? currentLab().speakers : [];
}

function creatorRecords() {
  const lab = currentLab();

  if (Array.isArray(lab.creatorPages) && lab.creatorPages.length) {
    return lab.creatorPages
      .map((entry) => {
        const speaker = currentSpeakers().find((item) => item.id === entry.personId);
        return speaker
          ? {
              id: entry.id || speaker.id,
              title: entry.title || `${speaker.name} · creator page`,
              hook: entry.hook || speaker.analysis,
              summary: entry.summary || speaker.focus,
              speaker,
            }
          : null;
      })
      .filter(Boolean);
  }

  return currentSpeakers().map((speaker) => ({
    id: speaker.id,
    title: `${speaker.name} · creator page`,
    hook: speaker.analysis,
    summary: speaker.focus,
    speaker,
  }));
}

function participantRecords() {
  return Array.isArray(currentLab().participantTests) ? currentLab().participantTests : [];
}

function activeRecords() {
  if (state.mode === 'generic') {
    return [{ id: 'generic-cover', name: 'generic cover' }];
  }

  if (state.mode === 'speaker') {
    return currentSpeakers();
  }

  if (state.mode === 'creator') {
    return creatorRecords();
  }

  if (state.mode === 'participant') {
    return participantRecords();
  }

  return [];
}

function ensureSelection() {
  const records = activeRecords();

  if (!records.length) {
    state.selectedId = null;
    return;
  }

  if (state.mode === 'generic') {
    state.selectedId = 'generic-cover';
    return;
  }

  if (!records.some((record) => record.id === state.selectedId)) {
    state.selectedId = records[0].id;
  }
}

function selectedSpeaker() {
  return currentSpeakers().find((speaker) => speaker.id === state.selectedId) || currentSpeakers()[0] || null;
}

function selectedCreator() {
  return creatorRecords().find((record) => record.id === state.selectedId) || creatorRecords()[0] || null;
}

function selectedParticipant() {
  return participantRecords().find((record) => record.id === state.selectedId) || participantRecords()[0] || null;
}

function speakerStatus(value) {
  return String(value || 'draft').replace(/\s+/g, ' ').trim();
}

function recordKey() {
  if (state.mode === 'generic') {
    return `${state.labId}:generic`;
  }

  return `${state.labId}:${state.mode}:${state.selectedId || 'default'}`;
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function copyDefaults() {
  const program = currentProgram();

  if (state.mode === 'generic') {
    return {
      eyebrow: program.eyebrow || currentLab().name || 'AI Mindset',
      title: program.title || currentLab().name || 'spring lab',
      accentTitle: program.accentTitle || '{cover}',
      subtitle:
        program.subtitle ||
        `${currentSpeakers().length} speakers · ${currentModalities().length} arcs · editable program cover`,
      note:
        currentLab().name === 'AI-Native Sprint S3'
          ? 'core contributors, guest experts and founder perspectives for the current sprint.'
          : 'speaker roster, creator pages and reusable covers for the current lab.',
    };
  }

  if (state.mode === 'speaker') {
    const speaker = selectedSpeaker();

    if (!speaker) {
      return { eyebrow: '', title: '', subtitle: '', analysis: '', signal: '', slot: '' };
    }

    return {
      eyebrow: [currentLab().name, speaker.modalityLabel || speaker.role, speakerStatus(speaker.status)].filter(Boolean).join(' · '),
      title: speaker.name,
      subtitle: speaker.focus || speaker.role || '',
      analysis: speaker.analysis || '',
      signal: speaker.signal || '',
      slot: [speaker.session?.title, speaker.session?.date].filter(Boolean).join(' · '),
    };
  }

  if (state.mode === 'creator') {
    const record = selectedCreator();

    if (!record) {
      return { eyebrow: '', title: '', hook: '', summary: '' };
    }

    return {
      eyebrow: `${currentLab().name} · creator page`,
      title: record.speaker.name,
      hook: record.hook || record.speaker.analysis || '',
      summary: record.summary || record.speaker.focus || '',
    };
  }

  const participant = selectedParticipant();

  if (!participant) {
    return { eyebrow: '', title: '', subtitle: '', analysis: '' };
  }

  return {
    eyebrow: `${currentLab().name} · participant test`,
    title: participant.name,
    subtitle: participant.focus || participant.role || '',
    analysis: participant.analysis || '',
  };
}

function currentCopy() {
  return {
    ...copyDefaults(),
    ...(state.copyOverrides[recordKey()] || {}),
  };
}

// Wave J6/J7: per-record numeric font-sizes. Wave J6 mutates this via
// edit-sidebar inputs, Wave J7 round-trips it. Returns plain `{ field: px }`.
function currentFontSizes() {
  return { ...(state.copyFontSizes[recordKey()] || {}) };
}

// Wave J7: apply persisted/imported font-sizes to CSS custom properties on
// the active canvas root. Called after every render so newly mounted DOM
// inherits the right --copy-<field>-fs vars (renderers consume them via
// `font-size: var(--copy-title-fs, 130px)` etc per Wave J6 design).
function applyFontSizesToCanvas() {
  const root = document.querySelector('.banner-root');
  if (!root) return;
  const sizes = state.copyFontSizes[recordKey()];
  if (!sizes) return;
  for (const [field, px] of Object.entries(sizes)) {
    if (typeof px === 'number' && Number.isFinite(px)) {
      root.style.setProperty(`--copy-${field}-fs`, `${px}px`);
    }
  }
}

function updateCopyField(field, value) {
  state.copyOverrides[recordKey()] = {
    ...(state.copyOverrides[recordKey()] || {}),
    [field]: value,
  };
}

// Wave J6/J7: numeric font-size mutator for sidebar inputs. Stores px as a
// number per (record, field). Caller (Wave J6 sidebar) is expected to clamp
// and re-render; we still update the CSS var inline for instant feedback so
// no full re-render is required when only the size changes.
function updateFontSize(field, px) {
  const key = recordKey();
  const next = { ...(state.copyFontSizes[key] || {}) };
  if (px === null || px === undefined || px === '') {
    delete next[field];
  } else {
    const num = Number(px);
    if (!Number.isFinite(num)) return;
    next[field] = num;
  }
  state.copyFontSizes[key] = next;
  const root = document.querySelector('.banner-root');
  if (root) {
    if (field in next) {
      root.style.setProperty(`--copy-${field}-fs`, `${next[field]}px`);
    } else {
      root.style.removeProperty(`--copy-${field}-fs`);
    }
  }
  syncQuery();
}

function resetCurrentCopy() {
  delete state.copyOverrides[recordKey()];
  delete state.copyFontSizes[recordKey()];
  render();
}

function activePhotoSpeaker() {
  if (state.mode === 'speaker') {
    return selectedSpeaker();
  }

  if (state.mode === 'creator') {
    return selectedCreator()?.speaker || null;
  }

  return null;
}

function resolvePhoto(speaker) {
  if (!speaker) {
    return null;
  }

  if (state.photoOverrides[speaker.id]) {
    return state.photoOverrides[speaker.id];
  }

  if (!speaker.photo) {
    return null;
  }

  const base = currentLab().photoBaseRelative || currentLab().photoBase || '';
  return `${base}/${speaker.photo}`;
}

function accentForRecord(record) {
  if (!record) {
    return currentLab().accent || '#16a34a';
  }

  return record.accent || currentLab().accent || '#16a34a';
}

function featuredSpeakers(limit) {
  // Prioritise speakers with a declared photo file. featuredIds order is
  // preserved within the photo-first bucket; ids without `photo` get pushed
  // to the end so cover/field layouts don't surface placeholder tiles.
  const speakers = currentSpeakers().slice();
  const featuredIds = Array.isArray(currentLab().featuredIds) ? currentLab().featuredIds : [];
  const pinned = featuredIds
    .map((id) => speakers.find((speaker) => speaker.id === id))
    .filter(Boolean);
  const pinnedIds = new Set(pinned.map((speaker) => speaker.id));
  const pinnedWithPhoto = pinned.filter((speaker) => !!speaker.photo);
  const pinnedNoPhoto = pinned.filter((speaker) => !speaker.photo);
  const restWithPhoto = speakers.filter((speaker) => !pinnedIds.has(speaker.id) && !!speaker.photo);
  const restNoPhoto = speakers.filter((speaker) => !pinnedIds.has(speaker.id) && !speaker.photo);
  return pinnedWithPhoto.concat(restWithPhoto, pinnedNoPhoto, restNoPhoto).slice(0, limit);
}

function editField(tag, className, field, value) {
  return `<${tag} class="${className}" contenteditable="true" spellcheck="false" data-edit-field="${field}">${escapeHtml(value || '')}</${tag}>`;
}

// Expose shared helpers for app/render-*.js modules (Wave I extraction). These
// modules are non-module classic scripts (matching app.js) that read helpers
// from window.aimStudioHelpers instead of `import`. Keep this in sync with the
// helpers actually consumed by the renderers (currently only mosaic).
window.aimStudioHelpers = {
  escapeHtml,
  accentForRecord,
  portraitSurface: (speaker, options) => portraitSurface(speaker, options),
  speakerStatus,
  editField,
};

function portraitSurface(speaker, options = {}) {
  const photo = resolvePhoto(speaker);
  const largeClass = options.large ? ' is-large' : '';

  if (photo) {
    return `
      <div class="photo-media${largeClass}">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(speaker.name)}">
        <div class="photo-overlay"></div>
      </div>
    `;
  }

  return `
    <div class="placeholder-card${largeClass}">
      <div class="placeholder-copy">
        <div class="placeholder-monogram">${escapeHtml(initials(speaker.name))}</div>
        <strong>${escapeHtml(speaker.name)}</strong>
        <p>photo pending · add a portrait via the upload control</p>
      </div>
    </div>
  `;
}

function photoCardMarkup(speaker, options = {}) {
  return `
    <article class="photo-card${options.large ? ' is-large' : ''}" style="--accent:${escapeHtml(accentForRecord(speaker))}">
      ${portraitSurface(speaker, { large: options.large })}
      <div class="photo-card-body">
        <p class="tile-kicker">${escapeHtml(speaker.modalityLabel || speaker.role || '')}</p>
        <strong>${escapeHtml(speaker.name)}</strong>
        <p>${escapeHtml(options.summary || speaker.focus || speaker.analysis || '')}</p>
      </div>
    </article>
  `;
}

// Expose shared helpers for app/render-*.js modules (Wave I extraction). These
// modules are non-module classic scripts (matching app.js) that read helpers
// from window.aimStudioHelpers instead of `import`. Keep this in sync with the
// helpers actually consumed by the renderers (currently only roster).
window.aimStudioHelpers = Object.assign(window.aimStudioHelpers || {}, {
  escapeHtml,
  accentForRecord,
  speakerStatus,
  editField,
  photoCardMarkup,
  portraitSurface: (speaker, options) => portraitSurface(speaker, options),
});

function modalitySummaryCard() {
  const items = currentModalities()
    .map((item) => `<p><strong>${escapeHtml(item.title || item.label)}</strong><br>${escapeHtml(item.label || item.key)}</p>`)
    .join('');

  return `
    <article class="feature-card" style="--accent:${escapeHtml(currentLab().accent || '#16a34a')}">
      <p class="tile-kicker">program arcs</p>
      <strong>${escapeHtml(currentProgram().dates?.display || currentLab().name || 'current lab')}</strong>
      ${items}
    </article>
  `;
}

// Field cover now lives in app/render-field.js (Wave I2 — refactor + density
// reduction). We assemble the lab context here (closures for resolvePhoto /
// accentForRecord) and inject the renderer's CSS once on first call.
let fieldStylesInjected = false;
function injectFieldStyles(css) {
  if (fieldStylesInjected || !css || typeof document === 'undefined') return;
  const tag = document.createElement('style');
  tag.setAttribute('data-render-field', 'v2');
  tag.textContent = css;
  document.head.appendChild(tag);
  fieldStylesInjected = true;
}

function fieldCoverMarkup(copy) {
  const lab = currentLab();
  const allSpeakers = currentSpeakers();
  const speakers = featuredSpeakers(2);
  const labCtx = {
    ...lab,
    program: currentProgram(),
    modalities: currentModalities(),
    allSpeakers,
    resolvePhoto,
    accentForRecord,
  };

  const { html, css } = renderField({
    copy,
    speakers,
    lab: labCtx,
    mode: lab.mode || 'terminal',
    bg: lab.bg || { type: 'plain', opacity: 1 },
    chrome: lab.chrome || { show: true, position: 'outer' },
  });

  injectFieldStyles(css);
  return html;
}

// Mosaic markup is implemented by app/render-mosaic.js (Wave I task I1 extraction).
// The renderer reads helpers from window.aimStudioHelpers (set up below in this file)
// and is invoked through window.renderMosaic. Keeping this thin shim preserves the
// existing callsite shape (mosaicCoverMarkup(copy)) so genericMarkup stays untouched.
function mosaicCoverMarkup(copy) {
  if (typeof window.renderMosaic !== 'function') {
    throw new Error('renderMosaic is not loaded — include app/render-mosaic.js after app.js helpers are exposed');
  }

  const lab = currentLab();
  const labContext = {
    ...lab,
    program: currentProgram(),
    speakers: currentSpeakers(),
    accent: lab.accent || '#16a34a',
    name: lab.name || '',
  };

  const result = window.renderMosaic({
    copy,
    speakers: featuredSpeakers(9),
    lab: labContext,
    mode: 'terminal',
    bg: { type: 'none', opacity: 1 },
    chrome: { show: true, position: 'corners' },
  });

  return result.html;
}

// Roster markup is implemented by app/render-roster.js (Wave I task I3 extraction).
// The renderer reads helpers from window.aimStudioHelpers (set up above) and is
// invoked through window.renderRoster. Per-row badge stack was condensed: the
// previous separate `01` / `W3` / `GUEST` spans are now a single merged badge
// (`01 · W3` with ` · G` suffix for guests).
function rosterCoverMarkup(copy) {
  if (typeof window.renderRoster !== 'function') {
    throw new Error('renderRoster is not loaded — include app/render-roster.js after app.js helpers are exposed');
  }

  const lab = currentLab();
  const labContext = {
    ...lab,
    program: currentProgram(),
    speakers: currentSpeakers(),
    accent: lab.accent || '#16a34a',
    name: lab.name || '',
  };

  const result = window.renderRoster({
    copy,
    speakers: currentSpeakers(),
    showcase: featuredSpeakers(4),
    lab: labContext,
    mode: 'terminal',
    bg: { type: 'none', opacity: 1 },
    chrome: { show: true, position: 'corners' },
  });

  return result.html;
}

function genericMarkup() {
  const copy = currentCopy();

  if (state.style === 'mosaic') {
    return mosaicCoverMarkup(copy);
  }

  if (state.style === 'roster') {
    return rosterCoverMarkup(copy);
  }

  if (state.style === 'cards') {
    const { html } = renderCards({
      copy,
      speakers: featuredSpeakers(6),
      lab: currentLab(),
      mode: state.designMode,
      bg: { type: 'paper' },
      chrome: { show: false },
    });
    return html;
  }

  return fieldCoverMarkup(copy);
}

function speakerMarkup(speaker) {
  const copy = currentCopy();
  const program = currentProgram();

  return `
    <main id="currentBanner" class="banner-root" data-banner-root="true" style="--accent:${escapeHtml(accentForRecord(speaker))}">
      <section class="speaker-layout">
        <div class="speaker-copy">
          <div class="speaker-main">
            ${editField('p', 'banner-eyebrow', 'eyebrow', copy.eyebrow)}
            ${editField('h1', 'banner-title', 'title', copy.title)}
            ${editField('p', 'banner-subtitle', 'subtitle', copy.subtitle)}
          </div>

          <div>
            ${editField('div', 'analysis-box', 'analysis', copy.analysis)}
            <div class="banner-footer" style="margin-top:14px;">
              <div class="banner-footer-meta">
                <span class="status-chip">${escapeHtml(speakerStatus(speaker.status))}</span>
                <span class="meta-chip">${escapeHtml(speaker.session?.code || speaker.week || '')}</span>
                <span class="meta-chip">${escapeHtml(speaker.session?.date || program.dates?.display || '')}</span>
              </div>
              <span class="meta-chip">${escapeHtml(program.footerRight || currentLab().name || '')}</span>
            </div>
          </div>
        </div>

        <div class="speaker-side">
          ${photoCardMarkup(speaker, { large: true, summary: speaker.role })}

          <div class="detail-grid">
            <article class="detail-card">
              <p class="tile-kicker">signal</p>
              ${editField('p', 'detail-copy', 'signal', copy.signal)}
            </article>
            <article class="detail-card">
              <p class="tile-kicker">slot</p>
              ${editField('p', 'detail-copy', 'slot', copy.slot)}
            </article>
          </div>
        </div>
      </section>
    </main>
  `;
}

function creatorMarkup(record) {
  const copy = currentCopy();
  const speaker = record.speaker;

  return `
    <main id="currentBanner" class="banner-root" data-banner-root="true" style="--accent:${escapeHtml(accentForRecord(speaker))}">
      <section class="creator-layout">
        <div class="creator-copy">
          <div>
            ${editField('p', 'banner-eyebrow', 'eyebrow', copy.eyebrow)}
            ${editField('h1', 'banner-title', 'title', copy.title)}
            ${editField('p', 'creator-summary', 'hook', copy.hook)}
          </div>

          <div>
            ${editField('div', 'analysis-box', 'summary', copy.summary)}
            <div class="banner-footer" style="margin-top:14px;">
              <div class="banner-footer-meta">
                <span class="status-chip">${escapeHtml(speakerStatus(speaker.status))}</span>
                <span class="meta-chip">${escapeHtml(speaker.session?.title || '')}</span>
              </div>
              <span class="meta-chip">${escapeHtml(currentProgram().footerRight || currentLab().name || '')}</span>
            </div>
          </div>
        </div>

        ${photoCardMarkup(speaker, { large: true, summary: speaker.analysis })}
      </section>
    </main>
  `;
}

function participantMarkup(record) {
  const copy = currentCopy();

  return `
    <main id="currentBanner" class="banner-root" data-banner-root="true" style="--accent:${escapeHtml(accentForRecord(record))}">
      <section class="participant-layout">
        <div class="creator-copy">
          <div>
            ${editField('p', 'banner-eyebrow', 'eyebrow', copy.eyebrow)}
            ${editField('h1', 'banner-title', 'title', copy.title)}
            ${editField('p', 'banner-subtitle', 'subtitle', copy.subtitle)}
          </div>

          <div>
            ${editField('div', 'analysis-box', 'analysis', copy.analysis)}
            <div class="banner-footer" style="margin-top:14px;">
              <div class="banner-footer-meta">
                <span class="status-chip">${escapeHtml(record.status || 'test')}</span>
                <span class="meta-chip">${escapeHtml(record.project || '')}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="participant-code">${escapeHtml(record.short || 'P')}</div>
      </section>
    </main>
  `;
}

function emptyStateMarkup() {
  return `
    <main id="currentBanner" class="banner-root" data-banner-root="true" style="--accent:${escapeHtml(currentLab().accent || '#16a34a')}">
      <section class="layout-field">
        <div class="cover-copy">
          <div class="cover-copy-main">
            <p class="banner-eyebrow">empty selection</p>
            <h1 class="banner-title">no matching record</h1>
            <p class="banner-subtitle">current lab + mode combination does not have any records.</p>
          </div>
        </div>
      </section>
    </main>
  `;
}

function recordLabel(record) {
  if (state.mode === 'generic') {
    return 'generic cover';
  }

  if (state.mode === 'speaker') {
    return `${record.name} · ${record.session?.title || record.role || ''}`;
  }

  if (state.mode === 'creator') {
    return `${record.speaker.name} · creator page`;
  }

  return `${record.name} · participant test`;
}

function syncLabSelector() {
  UI.labSelector.innerHTML = '';

  Object.keys(DATA.labs || {}).forEach((labId) => {
    const option = document.createElement('option');
    option.value = labId;
    option.textContent = DATA.labs[labId].name;
    option.selected = labId === state.labId;
    UI.labSelector.appendChild(option);
  });
}

function renderButtonRow(container, items, activeValue, onSelect) {
  container.innerHTML = '';

  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    button.className = item.id === activeValue ? 'is-active' : '';
    button.style.setProperty('--accent', currentLab().accent || '#16a34a');
    button.addEventListener('click', () => onSelect(item.id));
    container.appendChild(button);
  });
}

function syncControls() {
  syncLabSelector();
  renderButtonRow(UI.modeButtons, MODE_OPTIONS, state.mode, (mode) => {
    state.mode = mode;
    state.selectedId = null;
    render();
  });

  renderButtonRow(UI.styleButtons, currentStyleOptions(), state.style, (style) => {
    state.style = style;
    // Cards layout is editorial-mode-locked (Wave I4 contract): no terminal
    // chrome, soft shadows, paper surfaces. Other layouts default to terminal.
    if (style === 'cards') {
      state.designMode = 'editorial';
    } else {
      state.designMode = 'terminal';
    }
    render();
  });

  ensureSelection();

  UI.styleButtons.closest('.control-block').style.opacity = state.mode === 'generic' ? '1' : '0.4';
  UI.styleButtons.closest('.control-block').style.pointerEvents = state.mode === 'generic' ? 'auto' : 'none';

  UI.recordSelector.innerHTML = '';

  const records = activeRecords();

  if (!records.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'no records available';
    option.selected = true;
    UI.recordSelector.appendChild(option);
  } else {
    records.forEach((record) => {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = recordLabel(record);
      option.selected = record.id === state.selectedId;
      UI.recordSelector.appendChild(option);
    });
  }

  const photoSpeaker = activePhotoSpeaker();
  UI.uploadBlock.style.display = photoSpeaker ? 'block' : 'none';
  UI.resetPhotoButton.disabled = !photoSpeaker || !state.photoOverrides[photoSpeaker.id];
  UI.randomButton.disabled = state.mode === 'generic' || currentSpeakers().length < 2;
}

function updateSummary() {
  if (state.mode === 'generic') {
    UI.recordMeta.textContent = `${currentLab().name} · ${state.style}`;
    UI.recordSummary.innerHTML = `
      <p><strong>${escapeHtml(currentLab().name)}</strong></p>
      <p>${escapeHtml(currentProgram().subtitle || '')}</p>
      <p><strong>coverage:</strong> ${escapeHtml(String(currentSpeakers().length))} speakers · ${escapeHtml(String(currentModalities().length))} arcs</p>
      <p><strong>source:</strong> ${escapeHtml(currentProgram().dates?.display || '')}</p>
    `;
    return;
  }

  if (state.mode === 'speaker') {
    const speaker = selectedSpeaker();

    if (!speaker) {
      UI.recordMeta.textContent = 'speaker';
      UI.recordSummary.innerHTML = '<p>no speaker selected</p>';
      return;
    }

    UI.recordMeta.textContent = `${speaker.name} · ${speakerStatus(speaker.status)}`;
    UI.recordSummary.innerHTML = `
      <p><strong>${escapeHtml(speaker.name)}</strong></p>
      <p>${escapeHtml(speaker.role || '')}</p>
      <p><strong>focus:</strong> ${escapeHtml(speaker.focus || '')}</p>
      <p><strong>signal:</strong> ${escapeHtml(speaker.signal || '')}</p>
      <p><strong>slot:</strong> ${escapeHtml(speaker.session?.title || '')} · ${escapeHtml(speaker.session?.date || '')}</p>
    `;
    return;
  }

  if (state.mode === 'creator') {
    const record = selectedCreator();

    UI.recordMeta.textContent = record ? `${record.speaker.name} · creator` : 'creator';
    UI.recordSummary.innerHTML = record
      ? `
        <p><strong>${escapeHtml(record.speaker.name)}</strong></p>
        <p>${escapeHtml(record.summary || record.speaker.focus || '')}</p>
        <p><strong>source speaker status:</strong> ${escapeHtml(speakerStatus(record.speaker.status))}</p>
      `
      : '<p>no creator selected</p>';
    return;
  }

  const participant = selectedParticipant();
  UI.recordMeta.textContent = participant ? `${participant.name} · participant` : 'participant';
  UI.recordSummary.innerHTML = participant
    ? `
      <p><strong>${escapeHtml(participant.name)}</strong></p>
      <p>${escapeHtml(participant.analysis || '')}</p>
      <p><strong>project:</strong> ${escapeHtml(participant.project || '')}</p>
    `
    : '<p>no participant selected</p>';
}

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  state.labId = aliasLab(params.get('lab') || DATA.defaultLab);
  state.mode = aliasMode(params.get('mode'));
  state.style = normalizeId(params.get('style') || currentLab().defaultStyle || 'field');
  // Mirror the style→designMode rule (Wave I4): cards locks editorial.
  state.designMode = state.style === 'cards' ? 'editorial' : 'terminal';
  state.selectedId = params.get('id') || null;

  // Wave J7: hydrate per-record font-sizes from `fs` query param. Encoded as
  // a JSON object of `{ field: px }` for the *current* record. Defensive
  // parse — malformed JSON falls back to empty.
  const fsRaw = params.get('fs');
  if (fsRaw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(fsRaw));
      if (parsed && typeof parsed === 'object') {
        state.copyFontSizes[recordKey()] = parsed;
      }
    } catch (err) {
      console.warn('[aim-studio] ignored malformed fs param', err);
    }
  }

  // Wave J7: optional full-state import via `state` query param (base64 JSON).
  // Used by aimStudioImport() shareable links.
  const stateRaw = params.get('state');
  if (stateRaw) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(stateRaw)));
      applyImportedState(decoded);
    } catch (err) {
      console.warn('[aim-studio] ignored malformed state param', err);
    }
  }
}

function syncQuery() {
  const params = new URLSearchParams();
  params.set('lab', state.labId);
  params.set('mode', state.mode);

  if (state.mode === 'generic') {
    params.set('style', state.style);
  } else if (state.selectedId) {
    params.set('id', state.selectedId);
  }

  // Wave J7: persist per-record font-sizes in URL. Skip when empty so the
  // common case stays clean.
  const fontSizes = state.copyFontSizes[recordKey()];
  if (fontSizes && Object.keys(fontSizes).length) {
    params.set('fs', encodeURIComponent(JSON.stringify(fontSizes)));
  }

  const next = params.toString();
  const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
  window.history.replaceState({}, '', url);
}

// Wave J7: full-state export/import for shareable JSON or links. Round-trips
// every override so a recipient sees identical text + font-sizes + photos +
// selection. Exposed on window for the edit-sidebar (Wave J6) or any future
// "copy share link" / "download JSON" button.
function exportState() {
  return {
    version: 1,
    labId: state.labId,
    mode: state.mode,
    style: state.style,
    selectedId: state.selectedId,
    copyOverrides: state.copyOverrides,
    copyFontSizes: state.copyFontSizes,
    photoOverrides: state.photoOverrides,
  };
}

function applyImportedState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  if (snapshot.labId) state.labId = aliasLab(snapshot.labId);
  if (snapshot.mode) state.mode = aliasMode(snapshot.mode);
  if (snapshot.style) {
    state.style = normalizeId(snapshot.style);
    state.designMode = state.style === 'cards' ? 'editorial' : 'terminal';
  }
  if ('selectedId' in snapshot) state.selectedId = snapshot.selectedId || null;
  if (snapshot.copyOverrides && typeof snapshot.copyOverrides === 'object') {
    state.copyOverrides = { ...snapshot.copyOverrides };
  }
  if (snapshot.copyFontSizes && typeof snapshot.copyFontSizes === 'object') {
    state.copyFontSizes = { ...snapshot.copyFontSizes };
  }
  if (snapshot.photoOverrides && typeof snapshot.photoOverrides === 'object') {
    state.photoOverrides = { ...snapshot.photoOverrides };
  }
}

window.aimStudioExport = exportState;
window.aimStudioImport = (snapshot) => {
  applyImportedState(snapshot);
  remountEditSidebar();
  render();
};

function fitPreview() {
  const available = UI.previewFrame.clientWidth - 36;
  const scale = Math.min(1, available / DATA.design.size.width);
  UI.previewScaler.style.transform = `scale(${scale})`;
  UI.previewScaler.style.width = `${DATA.design.size.width}px`;
  UI.previewScaler.style.height = `${DATA.design.size.height}px`;
  UI.previewFrame.style.height = `${DATA.design.size.height * scale + 36}px`;
}

function bindEditableFields(root) {
  root.querySelectorAll('[data-edit-field]').forEach((node) => {
    node.addEventListener('input', () => {
      updateCopyField(node.dataset.editField, node.textContent.trim());
    });
  });
}

function waitForVisuals(root) {
  const images = Array.from(root.querySelectorAll('img'));

  if (!images.length) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map((image) => {
      if (image.complete) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    })
  );
}

function chromeLabel() {
  // Compact tag for the single-source-of-truth chrome header: "<LAB> · <MODE> · <STYLE-or-SELECTION>"
  const lab = (currentLab().short || currentLab().name || state.labId || '').toString().toUpperCase();
  const mode = state.mode.toUpperCase();
  const tail =
    state.mode === 'generic' ? state.style.toUpperCase() :
    state.mode === 'speaker' ? (selectedSpeaker()?.short || selectedSpeaker()?.name || '').toString().toUpperCase() :
    state.mode === 'creator' ? (selectedCreator()?.speaker?.short || selectedCreator()?.speaker?.name || '').toString().toUpperCase() :
                               (selectedParticipant()?.short || selectedParticipant()?.name || '').toString().toUpperCase();
  const dims = `${DATA.design.size.width}×${DATA.design.size.height}`;
  return [lab, mode, tail, dims].filter(Boolean).join(' · ');
}

async function render() {
  ensureStyle();
  ensureSelection();
  syncControls();
  updateSummary();
  syncQuery();
  window.__X26_BANNER_READY__ = false;

  let markup = emptyStateMarkup();

  if (state.mode === 'generic') {
    markup = genericMarkup();
  } else if (state.mode === 'speaker' && selectedSpeaker()) {
    markup = speakerMarkup(selectedSpeaker());
  } else if (state.mode === 'creator' && selectedCreator()) {
    markup = creatorMarkup(selectedCreator());
  } else if (state.mode === 'participant' && selectedParticipant()) {
    markup = participantMarkup(selectedParticipant());
  }

  // Wave I6: backdrop layer — inject bg as the first child of .banner-root
  // (chrome container). z-order: backdrop (lowest) → chrome border → content.
  // Resolution: lab.axes.defaultBg (Wave H tokens) is the source of truth for
  // now. Wave J will plug AI-generated `src` into this same slot.
  // Wave J3: state.bg (set by bg-picker) overrides lab default.
  const bg = state.bg || currentLab().axes?.defaultBg || { type: 'plain' };
  const bgHtml = renderBg(bg);

  if (bgHtml) {
    markup = markup.replace(
      /(<main[^>]*class="[^"]*banner-root[^"]*"[^>]*>)/,
      `$1${bgHtml}`
    );
  }

  // Hoist terminal chrome (corner brackets + PREVIEW header) to a SINGLE
  // outer wrapper around the active card stack. Per-card chrome is forbidden
  // — see Task I5 in 2026-04-28-aim-studio-design-system-PLAN.md.
  // Renderers must NOT emit their own corner-bracket SVG / .chrome-* markup.
  const chromedMarkup = wrapChrome(markup, {
    show: true,
    position: 'outer',
    label: chromeLabel(),
    dimensions: { w: DATA.design.size.width, h: DATA.design.size.height },
  });

  UI.bannerMount.innerHTML = chromedMarkup;
  applyFontSizesToCanvas();
  bindEditableFields(UI.bannerMount);
  UI.previewLabel.textContent = `${DATA.design.size.width} × ${DATA.design.size.height}`;
  await waitForVisuals(UI.bannerMount);
  fitPreview();
  window.__X26_BANNER_READY__ = true;
}

async function downloadCurrentBanner() {
  const button = UI.downloadButton;
  button.classList.add('is-active');
  button.disabled = true;
  button.textContent = 'rendering...';

  await document.fonts.ready;

  const banner = document.getElementById('currentBanner');

  if (!banner || !window.domtoimage) {
    button.disabled = false;
    button.classList.remove('is-active');
    button.textContent = 'download PNG';
    return;
  }

  banner.querySelectorAll('[contenteditable="true"]').forEach((node) => node.blur());
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const dataUrl = await window.domtoimage.toPng(banner, {
      width: DATA.design.size.width,
      height: DATA.design.size.height,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
      },
    });

    const link = document.createElement('a');
    const suffix = state.mode === 'generic' ? `${state.labId}-${state.style}` : `${state.labId}-${state.selectedId || state.mode}`;
    link.download = `aim-cover-${suffix}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error(error);
    alert(`Render error: ${error.message}`);
  } finally {
    button.disabled = false;
    button.classList.remove('is-active');
    button.textContent = 'download PNG';
  }
}

function pickRandomSpeaker() {
  if (state.mode !== 'speaker' || currentSpeakers().length < 2) {
    return;
  }

  const speakers = currentSpeakers().filter((speaker) => speaker.id !== state.selectedId);
  const next = speakers[Math.floor(Math.random() * speakers.length)];

  if (!next) {
    return;
  }

  state.selectedId = next.id;
  render();
}

function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  const speaker = activePhotoSpeaker();

  if (!file || !speaker) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.photoOverrides[speaker.id] = reader.result;
    UI.photoInput.value = '';
    render();
  };
  reader.readAsDataURL(file);
}

function resetPhotoOverride() {
  const speaker = activePhotoSpeaker();

  if (!speaker) {
    return;
  }

  delete state.photoOverrides[speaker.id];
  render();
}

UI.labSelector.addEventListener('change', () => {
  state.labId = aliasLab(UI.labSelector.value);
  state.selectedId = null;
  state.style = currentLab().defaultStyle || 'field';
  remountEditSidebar();
  render();
});

UI.recordSelector.addEventListener('change', () => {
  state.selectedId = UI.recordSelector.value || null;
  render();
});

UI.randomButton.addEventListener('click', pickRandomSpeaker);
UI.resetTextButton.addEventListener('click', resetCurrentCopy);
UI.resetPhotoButton.addEventListener('click', resetPhotoOverride);
UI.downloadButton.addEventListener('click', downloadCurrentBanner);
UI.photoInput.addEventListener('change', handlePhotoUpload);
window.addEventListener('resize', fitPreview);
window.addEventListener('popstate', () => {
  readQuery();
  render();
});

readQuery();

function remountEditSidebar() {
  mountEditSidebar({
    root: document.getElementById('edit-sidebar'),
    // Wave J7: surface fontSizes to the sidebar (Wave J6 binds inputs here).
    // Reading via `state.copy.fontSizes` matches the design-doc shape; the
    // map is the per-record slice, not the full keyed structure.
    state: { ...state, copy: { ...currentCopy(), fontSizes: currentFontSizes() } },
    onChange: updateCopyField,
    onFontSizeChange: updateFontSize,
  });
}

remountEditSidebar();

// Wave J3: BG picker — prompt selector + model + generate.
// prompts is empty: bg-picker.js fetches data/backdrops/s3-prompts.json itself.
mountBgPicker({
  root: document.getElementById('bg-picker'),
  state,
  prompts: [],
  onBgChange: (bg) => {
    state.bg = bg;
    render();
  },
});

render();
