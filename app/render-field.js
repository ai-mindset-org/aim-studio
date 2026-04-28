// app/render-field.js
// Field cover renderer. Extracted from app.js (Wave I2).
//
// Density reduction vs original `fieldCoverMarkup`:
//   Tile body: dropped secondary `<p>` summary caption (analysis/focus paragraph).
//              Kept role kicker + name. Added compact week badge derived from
//              speaker.week (or parsed from role) — net-zero when absent.
//   modalitySummaryCard → renamed to compactArcsCard: dropped per-modality
//              `<p>` enumeration (was 3 items). Kept eyebrow ("program arcs")
//              + lab/dates `<strong>`. Result: ~50% fewer text rows per side card.
//   Banner footer: dropped `arcs` stat-chip and right-side `meta-chip`. Kept
//              `speakers` count + `dates` chip. Was 4 chips → now 2.
//
// Contract per docs/plans/2026-04-28-aim-studio-design-system-design.md §4.3:
//   render({ copy, speakers, lab, mode, bg, chrome }) → { html, css }
//
// `lab` is the resolved lab object (DTCG `$value` envelopes already unwrapped
// at point-of-use elsewhere; here we read plain fields lab.accent etc.).

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function editField(tag, className, field, value) {
  return `<${tag} class="${className}" contenteditable="true" spellcheck="false" data-edit-field="${field}">${escapeHtml(value || '')}</${tag}>`;
}

function initials(name) {
  if (!name) return '··';
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('') || '··';
}

function deriveWeekBadge(speaker) {
  if (!speaker) return '';
  if (speaker.week) return String(speaker.week).trim();
  // Fallback: parse from role like "W1 workshop · track" or "W2 guest"
  if (speaker.role) {
    const match = String(speaker.role).match(/\bW\d(?:[–-]\d)?\b/);
    if (match) return match[0];
  }
  return '';
}

function portraitSurface(speaker, options, ctx) {
  const photo = ctx.resolvePhoto(speaker);
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
        <p>photo pending</p>
      </div>
    </div>
  `;
}

// Density-reduced photo card: kept role kicker + name + week badge.
// Dropped secondary summary `<p>` that previously rendered analysis/focus text.
function fieldTileMarkup(speaker, options, ctx) {
  const accent = ctx.accentForRecord(speaker);
  const role = speaker.modalityLabel || speaker.role || '';
  const week = deriveWeekBadge(speaker);
  return `
    <article class="photo-card field-v2__tile${options.large ? ' is-large' : ''}" style="--accent:${escapeHtml(accent)}">
      ${portraitSurface(speaker, { large: options.large }, ctx)}
      <div class="photo-card-body field-v2__tile-body">
        <div class="field-v2__tile-meta">
          <p class="tile-kicker">${escapeHtml(role)}</p>
          ${week ? `<span class="field-v2__week">${escapeHtml(week)}</span>` : ''}
        </div>
        <strong>${escapeHtml(speaker.name)}</strong>
      </div>
    </article>
  `;
}

// Compact replacement for modalitySummaryCard. Dropped per-modality enumeration.
// Kept eyebrow + lab/dates headline.
function compactArcsCard(ctx) {
  const program = ctx.program || {};
  const dates = (program.dates && program.dates.display) || ctx.lab.name || 'current lab';
  const arcCount = ctx.modalities.length || 0;
  return `
    <article class="feature-card field-v2__arcs" style="--accent:${escapeHtml(ctx.lab.accent || '#16a34a')}">
      <p class="tile-kicker">program arcs</p>
      <strong>${escapeHtml(dates)}</strong>
      ${arcCount ? `<span class="field-v2__arc-count">${arcCount} arcs</span>` : ''}
    </article>
  `;
}

export function render({ copy, speakers, lab, mode, bg, chrome }) {
  // Lightweight ctx of helpers/data the renderer needs. Callers pass closures
  // for resolvePhoto / accentForRecord since those depend on app state.
  const ctx = {
    lab,
    program: lab.program || {},
    modalities: lab.modalities || [],
    resolvePhoto: lab.resolvePhoto || (() => ''),
    accentForRecord: lab.accentForRecord || ((rec) => (rec && rec.accent) || lab.accent || '#16a34a'),
  };

  const featureSet = (speakers || []).slice(0, 2);
  const hero = featureSet[0];
  const secondary = featureSet[1];
  const program = ctx.program;
  const accent = lab.accent || '#16a34a';
  const totalSpeakers = (lab.allSpeakers && lab.allSpeakers.length) || (speakers && speakers.length) || 0;

  const html = `
    <main id="currentBanner" class="banner-root field-v2" data-banner-root="true" style="--accent:${escapeHtml(accent)}">
      <section class="layout-field field-v2__layout">
        <div class="cover-copy">
          <div class="cover-copy-main">
            ${editField('p', 'banner-eyebrow', 'eyebrow', copy.eyebrow)}
            <h1 class="banner-title">
              <span contenteditable="true" spellcheck="false" data-edit-field="title">${escapeHtml(copy.title)}</span><br>
              <span class="banner-title-accent" contenteditable="true" spellcheck="false" data-edit-field="accentTitle">${escapeHtml(copy.accentTitle)}</span>
            </h1>
            ${editField('p', 'banner-subtitle', 'subtitle', copy.subtitle)}
          </div>

          <div class="cover-copy-bottom">
            ${editField('div', 'analysis-box', 'note', copy.note)}
            <div class="banner-footer field-v2__footer">
              <div class="banner-footer-meta">
                <span class="stat-chip">${escapeHtml(`${totalSpeakers} speakers`)}</span>
                <span class="stat-chip">${escapeHtml((program.dates && program.dates.display) || '')}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="feature-grid field-v2__grid">
          ${hero ? fieldTileMarkup(hero, { large: true }, ctx) : ''}
          <div class="feature-stack">
            ${secondary ? fieldTileMarkup(secondary, {}, ctx) : ''}
            ${compactArcsCard(ctx)}
          </div>
        </div>
      </section>
    </main>
  `;

  // Field-only style adjustments. Reuses --card-radius CSS var (set via
  // mode.terminal.card-radius / mode.editorial.card-radius). Does not touch
  // shared .photo-card / .feature-card rules.
  const css = `
    .field-v2__tile { border-radius: var(--card-radius, 22px); }
    .field-v2__arcs { border-radius: var(--card-radius, 22px); }
    .field-v2__tile-body { display: grid; gap: 6px; }
    .field-v2__tile-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .field-v2__tile-meta .tile-kicker { margin: 0; }
    .field-v2__week {
      font-size: 10px;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 38%, white 8%);
      color: color-mix(in srgb, var(--accent) 60%, white 40%);
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      white-space: nowrap;
    }
    .field-v2__arc-count {
      font-size: 11px;
      color: var(--dim, #8a9690);
      letter-spacing: 0.04em;
    }
  `;

  return { html, css };
}
