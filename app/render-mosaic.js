// Mosaic renderer — extracted from app.js (Wave I, Task I1).
//
// Contract (shared across Wave I renderers):
//   render({ copy, speakers, lab, mode, bg, chrome }) → { html, css }
//
// `mode` ∈ 'terminal' | 'editorial'. `bg` = { type, src?, opacity }.
// `chrome` = { show, position }.
//
// I1 scope: pure extraction, zero visual change. mode/bg/chrome are accepted
// to honour the shared contract but not consumed yet (other Wave I agents
// will wire them in). Helpers are read from `window.aimStudioHelpers` so
// app.js can keep being non-module / classic-script.
//
// Helpers expected on `window.aimStudioHelpers`:
//   - escapeHtml(value) → string
//   - accentForRecord(record) → css color
//   - portraitSurface(speaker, options?) → html
//   - speakerStatus(value) → string
//   - editField(tag, className, field, value) → html

(function (root) {
  const FALLBACK_ACCENT = '#16a34a';

  function getHelpers() {
    const helpers = root && root.aimStudioHelpers;
    if (!helpers) {
      throw new Error('render-mosaic: window.aimStudioHelpers is not initialised');
    }
    return helpers;
  }

  function mosaicTileMarkup(speaker, index, helpers) {
    const pattern = [
      'is-wide is-tall',
      'is-tall',
      '',
      '',
      'is-wide',
      '',
      'is-wide',
      '',
      '',
    ];
    const classes = pattern[index] || '';

    return `
    <article class="mosaic-tile ${classes}" style="--accent:${helpers.escapeHtml(helpers.accentForRecord(speaker))}">
      ${helpers.portraitSurface(speaker)}
      <div class="mosaic-label">
        <strong>${helpers.escapeHtml(speaker.short || speaker.name)}</strong>
        <p>${helpers.escapeHtml(helpers.speakerStatus(speaker.status))}</p>
      </div>
    </article>
  `;
  }

  function render(args) {
    const { copy, speakers, lab } = args || {};
    // mode, bg, chrome accepted for contract parity; not consumed in I1.

    const helpers = getHelpers();
    const program = (lab && lab.program) || {};
    const featured = Array.isArray(speakers) ? speakers : [];
    const labAccent = (lab && lab.accent) || FALLBACK_ACCENT;
    const totalSpeakers = (lab && Array.isArray(lab.speakers)) ? lab.speakers.length : featured.length;
    const labName = (lab && lab.name) || '';

    const html = `
    <main id="currentBanner" class="banner-root" data-banner-root="true" style="--accent:${helpers.escapeHtml(labAccent)}">
      <section class="layout-mosaic">
        <div class="mosaic-copy">
          <div>
            ${helpers.editField('p', 'banner-eyebrow', 'eyebrow', copy.eyebrow)}
            <h1 class="banner-title">
              <span contenteditable="true" spellcheck="false" data-edit-field="title">${helpers.escapeHtml(copy.title)}</span><br>
              <span class="banner-title-accent" contenteditable="true" spellcheck="false" data-edit-field="accentTitle">${helpers.escapeHtml(copy.accentTitle)}</span>
            </h1>
            ${helpers.editField('p', 'banner-subtitle', 'subtitle', copy.subtitle)}
          </div>

          <div>
            ${helpers.editField('div', 'analysis-box', 'note', copy.note)}
            <div class="banner-footer" style="margin-top:14px;">
              <div class="banner-footer-meta">
                <span class="stat-chip">${helpers.escapeHtml(`${totalSpeakers} records`)}</span>
                <span class="stat-chip">${helpers.escapeHtml((program.dates && program.dates.display) || '')}</span>
              </div>
              <span class="meta-chip">${helpers.escapeHtml(program.footerRight || labName || '')}</span>
            </div>
          </div>
        </div>

        <div class="mosaic-wall">
          <div class="mosaic-grid">
            ${featured.map((speaker, index) => mosaicTileMarkup(speaker, index, helpers)).join('')}
          </div>
        </div>
      </section>
    </main>
  `;

    return { html, css: '' };
  }

  // Expose for non-module app.js.
  root.renderMosaic = render;
  root.aimStudioRenderMosaic = { render };
})(typeof window !== 'undefined' ? window : globalThis);
