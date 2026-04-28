// Roster renderer — extracted from app.js (Wave I, Task I3).
//
// Contract (shared across Wave I renderers):
//   render({ copy, speakers, lab, mode, bg, chrome }) → { html, css }
//
// `mode` ∈ 'terminal' | 'editorial'. `bg` = { type, src?, opacity }.
// `chrome` = { show, position }.
//
// I3 scope: extract `rosterCoverMarkup` + `rosterListMarkup` and merge the
// per-row badge stack. The previous list rendered three separate spans
// (`01` index, `W3` week, `GUEST` type). I3 condenses them into a single
// badge of the form `01 · W3` with ` · G` appended for guest speakers.
// `mode`/`bg`/`chrome` are accepted for contract parity but not consumed.
//
// DTCG token leaves carry a `.$value` envelope (Wave H). Roster currently
// reads `lab.accent` directly (already resolved upstream); the helper
// `tokenValue()` is provided for future token consumers.
//
// Helpers expected on `window.aimStudioHelpers`:
//   - escapeHtml(value) → string
//   - accentForRecord(record) → css color
//   - speakerStatus(value) → string
//   - editField(tag, className, field, value) → html
//   - photoCardMarkup(speaker, options?) → html

(function (root) {
  const FALLBACK_ACCENT = '#16a34a';

  function getHelpers() {
    const helpers = root && root.aimStudioHelpers;
    if (!helpers) {
      throw new Error('render-roster: window.aimStudioHelpers is not initialised');
    }
    return helpers;
  }

  // Read a DTCG token leaf (`{ $value: ... }`) or a raw value transparently.
  function tokenValue(node) {
    if (node && typeof node === 'object' && '$value' in node) return node.$value;
    return node;
  }

  // Compose the merged roster badge: `NN · WX[ · G]`.
  // - index: 1-based row number, padded → `01..10`
  // - speaker.week: source string like `W3` or `W0–W5`; passed through as-is
  // - speaker.type === 'guest': append ` · G` suffix
  function rosterBadgeText(speaker, index) {
    const idx = String(index + 1).padStart(2, '0');
    const week = (speaker && speaker.week) ? String(speaker.week).trim() : '';
    const isGuest = speaker && speaker.type === 'guest';

    let text = idx;
    if (week) text += ` · ${week}`;
    if (isGuest) text += ' · G';
    return text;
  }

  function rosterListMarkup(speakers, lab, helpers) {
    const labAccent = (lab && lab.accent) || FALLBACK_ACCENT;

    const items = speakers
      .map((speaker, index) => `
      <article class="speaker-list-item" style="--accent:${helpers.escapeHtml(helpers.accentForRecord(speaker))}">
        <span class="speaker-list-index" data-roster-badge="merged">${helpers.escapeHtml(rosterBadgeText(speaker, index))}</span>
        <div>
          <strong>${helpers.escapeHtml(speaker.name)}</strong>
          <p>${helpers.escapeHtml(speaker.focus || speaker.role || '')}</p>
        </div>
        <span class="status-chip">${helpers.escapeHtml(helpers.speakerStatus(speaker.status))}</span>
      </article>
    `)
      .join('');

    return `
    <article class="list-panel" style="--accent:${helpers.escapeHtml(labAccent)}">
      <p class="list-label">speaker roster</p>
      <div class="speaker-list">${items}</div>
    </article>
  `;
  }

  function render(args) {
    const { copy, speakers, lab, showcase } = args || {};
    // mode, bg, chrome accepted for contract parity; not consumed in I3.

    const helpers = getHelpers();
    const program = (lab && lab.program) || {};
    const labAccent = (lab && lab.accent) || FALLBACK_ACCENT;
    const labName = (lab && lab.name) || '';
    const rosterSpeakers = Array.isArray(speakers) ? speakers : [];
    const thumbs = Array.isArray(showcase) ? showcase : rosterSpeakers.slice(0, 4);
    const totalCount = rosterSpeakers.length;

    const html = `
    <main id="currentBanner" class="banner-root" data-banner-root="true" style="--accent:${helpers.escapeHtml(labAccent)}">
      <section class="layout-roster">
        <div class="roster-copy">
          <div>
            ${helpers.editField('p', 'banner-eyebrow', 'eyebrow', copy.eyebrow)}
            <h1 class="banner-title">
              <span contenteditable="true" spellcheck="false" data-edit-field="title">${helpers.escapeHtml(copy.title)}</span><br>
              <span class="banner-title-accent" contenteditable="true" spellcheck="false" data-edit-field="accentTitle">${helpers.escapeHtml(copy.accentTitle)}</span>
            </h1>
            ${helpers.editField('p', 'banner-subtitle', 'subtitle', copy.subtitle)}
          </div>

          <div class="cover-copy-bottom">
            ${helpers.editField('div', 'analysis-box', 'note', copy.note)}
            <div class="banner-footer">
              <div class="banner-footer-meta">
                <span class="stat-chip">${helpers.escapeHtml(`${totalCount} speakers`)}</span>
                <span class="stat-chip">${helpers.escapeHtml((program.dates && program.dates.display) || '')}</span>
              </div>
              <span class="meta-chip">${helpers.escapeHtml(program.footerLeft || labName || '')}</span>
            </div>
          </div>
        </div>

        <div class="roster-grid">
          ${rosterListMarkup(rosterSpeakers, lab, helpers)}
          <div class="thumb-stack">
            ${thumbs.map((speaker) => helpers.photoCardMarkup(speaker, { summary: speaker.analysis })).join('')}
          </div>
        </div>
      </section>
    </main>
  `;

    return { html, css: '' };
  }

  // Expose for non-module app.js.
  root.renderRoster = render;
  root.aimStudioRenderRoster = { render, rosterBadgeText, tokenValue };
})(typeof window !== 'undefined' ? window : globalThis);
