# Wave L — UX Rework, Scoped AI Backdrops, Sync with Lab Skills

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans

**Date:** 2026-04-28 (same day, post-v1)
**Status:** Active
**Repo:** `_code/_generators/aim-studio`
**Inherits from:** `v2-design-system` tag (post-Wave-K state)
**Reference aesthetic (live):** `https://x26-banners.netlify.app/?lab=s3&mode=speaker&format=wide&id=alexander-povaliaev&speakerStyle=surname&palette=week&bw=1`
**Reference skills:** `~/.claude/skills/AIM-x26-visuals/`, `~/.claude/skills/AIM-ain-visuals/`

---

## What's wrong with v2 (user feedback)

1. **AI background covers whole banner with heavy halftone scrim** → photo + text drown in noise. Reference x26-banners shows **clean dark grid** with focused content. AI-generation should live inside small decorative slots, not as full-banner overlay.
2. **`Choose file` тiny input** for photo override — almost no affordance. Need a big drop zone.
3. **Click-to-edit not visible** — text is editable but no visual hint (no hover outline, no edit-pencil cursor).
4. **UI feels crowded** — bg picker + edit sidebar + form controls compete for attention.
5. **No sync with AIM-x26-visuals / AIM-ain-visuals** — those skills define the canonical aesthetic but aim-studio doesn't read their tokens.

## Goals

1. **Clean banner aesthetic** matching x26-banners reference: dark grid bg, no halftone, subtle teal/green hairlines.
2. **AI bg becomes block-scoped:** `bg.scope = 'banner' | 'photo-card' | 'side-card' | 'mockup-block-N'`. Default for s3 speaker layout: `bg.scope = 'side-card'` (the small decorative card on the right of the speaker photo).
3. **Big photo drop zone** replacing tiny file input.
4. **Click-to-edit affordance:** hover dashed outline + cursor:text on every editable text. Sidebar continues to mirror.
5. **Sync labs with skill canonical tokens:** read `~/.claude/skills/AIM-{x26,ain}-visuals/tokens.md` once, mirror into `data/labs/*.json`.
6. **Mockup-block library:** new layout-internal primitive — small `app.studio` / `core cadence` / `governance` cards with their own AI bg slots, like Image #14.

---

## Locked decisions

| # | Decision |
|---|----------|
| L-D1 | AI bg API: `bg = { scope, src, opacity, postprocess }` — `scope` is the new axis |
| L-D2 | Default scope per layout: speaker → `side-card`, plate → `mockup-block-bg`, generic → `banner` (reduced opacity 0.18 max, no scrim) |
| L-D3 | `mode: terminal` clean grid bg = canonical default, NO halftone |
| L-D4 | Photo drop zone: 200×200px in sidebar, drag-target with dashed border |
| L-D5 | Click-to-edit hover: 1px dashed `var(--accent)` outline, `cursor: text` |
| L-D6 | Token sync source: `~/.claude/skills/AIM-{x26,ain}-visuals/tokens.md` parsed at build time by `scripts/sync-skill-tokens.mjs` |
| L-D7 | New layout `mockup-plate` for the org-style decorative-card composition (Image #14 style) |

---

## Tasks

### L0 — Pre-flight: read live reference + skills, lock canonical tokens

```bash
# Read live x26-banners
curl -sS "https://x26-banners.netlify.app/?lab=s3&mode=speaker&format=wide&id=alexander-povaliaev&speakerStyle=surname&palette=week&bw=1" -o /tmp/x26-ref.html
# Read skill tokens
cat ~/.claude/skills/AIM-x26-visuals/tokens.md > /tmp/x26-tokens.md
cat ~/.claude/skills/AIM-ain-visuals/tokens.md > /tmp/ain-tokens.md
```

Identify in `/tmp/x26-ref.html`:
- Background structure (CSS for `.banner-grid` or similar)
- Speaker photo overlay markers (red squares, vertical line — what's the source SVG/img?)
- Badge styles (W0-W4, HOST, dates)

Document findings in `docs/wave-l-reference-audit.md`. Commit.

### L1 — Strip full-banner halftone bg

Find in `app/render-*.js` and `styles.css` where `.bg-ai` opacity = 0.85 and where it scrims. Reduce default opacity to 0.18 for `scope: 'banner'`. Drop client-side `scrim` in `bg-postprocess.js` for banner-scope. Keep tint @0.20 (was 0.35).

Commit: `fix(bg): banner-scope opacity 0.18, no scrim by default`.

### L2 — Add `bg.scope` axis

In `app/bg-layer.js`, accept `scope` in the props. Switch on scope:
- `banner` → outer absolute, low opacity
- `photo-card` → inset to `.speaker-side .photo-card`
- `side-card` → inset to a dedicated `.speaker-side .card-bg-slot` (new DOM)
- `mockup-block-N` → inset to a specific mockup card (new layout L7)

In `data/labs/{x26,s3,core}.json axes.defaultBg`, add `scope` key. Default for speaker layout in s3: `scope: 'side-card'`.

In `app/bg-picker.js`, add scope dropdown next to model.

Commit: `feat(bg): scope axis (banner/photo-card/side-card/mockup-block)`.

### L3 — Big photo drop zone in sidebar

In `app/edit-sidebar.js`, replace `<input type="file">` with:
```html
<div class="photo-dropzone" data-field="photo">
  <div class="photo-preview"><!-- current photo or placeholder --></div>
  <p class="photo-hint">drop image · or click to browse</p>
  <input type="file" hidden>
</div>
```

Wire drag-events: `dragover` → highlight border, `drop` → call existing photoOverride handler.

CSS: 200×200, dashed border, hover state, current-photo preview.

Commit: `feat(edit-ui): big photo drop zone replaces file input`.

### L4 — Click-to-edit affordance

In `styles.css`, add:
```css
[contenteditable="true"]:hover {
  outline: 1px dashed var(--accent, #4dc9d4);
  outline-offset: 4px;
  cursor: text;
}
[contenteditable="true"]:focus {
  outline: 1px solid var(--accent, #4dc9d4);
  background: rgba(77,201,212,0.05);
}
```

Add a discreet info hint near banner: `↗ click any text to edit · drop photo on portrait`.

Commit: `feat(edit-ui): hover dashed outline on editable text`.

### L5 — Sync skill tokens into lab JSONs

Create `scripts/sync-skill-tokens.mjs` that:
1. Reads `~/.claude/skills/AIM-x26-visuals/tokens.md`, extracts the CSS variable block, parses to JSON.
2. Same for `~/.claude/skills/AIM-ain-visuals/tokens.md`.
3. Updates `data/labs/x26.json` and `data/labs/s3.json` with canonical accents, week colors, fonts, grid params — adding any tokens missing.
4. Re-runs `npm run build:labs`.

Don't OVERWRITE existing copy/dates in lab JSONs — only sync visual tokens.

Commit: `chore(sync): pull canonical tokens from AIM-{x26,ain}-visuals skills`.

### L6 — Reduce overall UI density

Move bg picker into a collapsible panel that opens from a single icon button (top-left, `≪ ai bg ≫`). Default collapsed. Same for edit-sidebar — small toggle button, expanded by default but collapsible.

Commit: `refactor(ui): collapsible bg picker + edit sidebar`.

### L7 — New `mockup-plate` layout

New `app/render-mockup-plate.js`. Composition: large heading on left, 3 floating mockup-style cards on right (`core cadence` / `ops` / `governance` style — see Image #14). Each card has a `data-bg-slot` attribute consuming a different AI-bg generation.

Skip cards content templating — for v1 just hard-code 3 example mockup cards. Polish in L8.

Commit: `feat(layout): new mockup-plate layout (3 floating org cards)`.

### L8 — Visual polish + smoke

- Run smoke against all layouts × all labs × all modes.
- Visually check at `localhost:18770` that:
  - Banner clean, no halftone
  - Photo drop zone visible & responds to drag
  - Click hover on text shows dashed outline
  - Generate AI bg → it appears INSIDE side-card, not over whole banner
  - mockup-plate layout renders 3 floating cards

Commit: `test: smoke for L1-L7 changes`.

### L9 — Deploy + tag

```bash
git checkout main && git merge --no-ff wave-l-ux-rework -m "merge wave-l: UX rework + scoped AI bg"
git push origin main
netlify deploy --prod --dir .
git tag -a v2.1-ux-rework -m "Wave L: UX rework, block-scoped AI bg, lab token sync"
git push origin v2.1-ux-rework
```

---

## Acceptance

- [ ] Banner has clean dark grid bg, no halftone overlay
- [ ] AI generation default scope = `side-card` for speaker layout (NOT full banner)
- [ ] Photo drop zone is large (200×200) with drag highlight
- [ ] Hovering any text shows dashed outline
- [ ] x26 lab pulls #16a34a green from `AIM-x26-visuals/tokens.md` (verify in compiled bundle)
- [ ] s3 lab pulls #4dc9d4 teal from `AIM-ain-visuals/tokens.md`
- [ ] mockup-plate layout renders 3 floating cards
- [ ] BG picker collapsible; default collapsed
- [ ] Live URL `https://aim-studio.netlify.app` reflects all changes
- [ ] Tag `v2.1-ux-rework` on origin
