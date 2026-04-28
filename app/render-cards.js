// app/render-cards.js
// Cards layout — editorial mode (NEW for Wave I4).
//
// Editorial style:
// - Soft shadows, paper-tinted card surfaces, 16px border-radius.
// - No terminal corner brackets, no grid overlay, generous whitespace.
// - Mono kept for labels/eyebrows; body type larger and looser-tracked.
//
// Token contract:
//   component.card.radius → defaults to mode.terminal.card-radius (4px) in
//   data/tokens/component.json. For editorial cards we override to
//   mode.editorial.card-radius (16px) directly via the .cards-v2__card class
//   below. DTCG envelopes store values under `.$value` — that lookup is left
//   to the resolver (`scripts/build-labs.mjs`); the CSS in this layout reads
//   raw 16px to stay independent of resolver state.
//
// Common renderer contract:
//   export function render({ copy, speakers, lab, mode, bg, chrome })
//     → { html, css }

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function speakerStatus(value) {
  return String(value || 'draft').replace(/\s+/g, ' ').trim();
}

function accentFor(record, lab) {
  return record?.accent || lab?.accent || '#16a34a';
}

function cardPortrait(speaker) {
  const photo = speaker?.photo;
  if (photo) {
    return `
      <figure class="cards-v2__portrait">
        <img src="${esc(photo)}" alt="${esc(speaker.name)}">
        <span class="cards-v2__portrait-vignette" aria-hidden="true"></span>
      </figure>
    `;
  }

  return `
    <figure class="cards-v2__portrait cards-v2__portrait--placeholder">
      <span class="cards-v2__monogram">${esc(initials(speaker.name))}</span>
    </figure>
  `;
}

function cardMarkup(speaker, index, lab) {
  const idx = String(index + 1).padStart(2, '0');
  const role = speaker.modalityLabel || speaker.role || '';
  const summary = speaker.focus || speaker.analysis || '';

  return `
    <article class="cards-v2__card" style="--accent:${esc(accentFor(speaker, lab))}">
      ${cardPortrait(speaker)}
      <div class="cards-v2__body">
        <p class="cards-v2__eyebrow">
          <span>${esc(idx)}</span>
          ${role ? `<span class="cards-v2__sep">·</span><span>${esc(role)}</span>` : ''}
        </p>
        <h3 class="cards-v2__name">${esc(speaker.name)}</h3>
        ${summary ? `<p class="cards-v2__summary">${esc(summary)}</p>` : ''}
        <div class="cards-v2__foot">
          <span class="cards-v2__chip">${esc(speakerStatus(speaker.status))}</span>
          ${speaker.week ? `<span class="cards-v2__chip cards-v2__chip--ghost">W${esc(speaker.week)}</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

export function render({ copy = {}, speakers = [], lab = {}, mode = 'editorial', bg = {}, chrome = {} } = {}) {
  // Pick up to 6 speakers for the editorial wall — keeps the layout breathable.
  const visible = speakers.slice(0, 6);
  const accent = lab.accent || '#16a34a';
  const programDates = lab?.program?.dates?.display || '';
  const programFooter = lab?.program?.footerRight || lab.name || '';

  const html = `
    <main id="currentBanner" class="banner-root cards-v2" data-banner-root="true" data-mode="editorial" style="--accent:${esc(accent)}">
      <section class="cards-v2__shell">
        <header class="cards-v2__head">
          <p class="cards-v2__kicker">${esc(copy.eyebrow || lab.name || '')}</p>
          <h1 class="cards-v2__title">
            <span contenteditable="true" spellcheck="false" data-edit-field="title">${esc(copy.title || '')}</span>
            ${copy.accentTitle ? `<span class="cards-v2__title-accent" contenteditable="true" spellcheck="false" data-edit-field="accentTitle">${esc(copy.accentTitle)}</span>` : ''}
          </h1>
          ${copy.subtitle ? `<p class="cards-v2__lede" contenteditable="true" spellcheck="false" data-edit-field="subtitle">${esc(copy.subtitle)}</p>` : ''}
        </header>

        <div class="cards-v2__grid" data-count="${visible.length}">
          ${visible.map((speaker, index) => cardMarkup(speaker, index, lab)).join('')}
        </div>

        <footer class="cards-v2__foot-row">
          <span class="cards-v2__meta">${esc(`${speakers.length || visible.length} speakers`)}</span>
          ${programDates ? `<span class="cards-v2__meta">${esc(programDates)}</span>` : ''}
          <span class="cards-v2__meta cards-v2__meta--right">${esc(programFooter)}</span>
        </footer>
      </section>
    </main>
  `;

  // CSS returned for completeness per renderer contract; the canonical
  // styles live in styles.css under "cards layout (editorial mode)".
  const css = '';

  return { html, css };
}

export default { render };
