# AIM Studio Design System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. After each task, run smoke tests, commit, then proceed.

**Goal:** Refactor AIM Studio (`aim-studio.netlify.app`) to a 3-axis design system (`layout × mode × decorative-bg`) with DTCG 3-layer tokens, FLUX.2 Pro AI backdrops for s3, Recraft-style edit UI, and chrome-deduplication fix — without visually regressing the user-loved mosaic style.

**Architecture:** Wave-based parallel execution following existing `wave-a..g` git convention. Wave H locks tokens (sequential, 5 tasks). Wave I parallelizes 7 renderer agents (file-isolated). Wave J integrates AI + edit UI (7 agents). Wave K writes docs + deploys (5 agents). Token contract gated by `tokens-v1` git tag at end of Wave H.

**Tech Stack:** Vanilla JS (single-file → split into `app/*.js` modules), Netlify Functions for OpenRouter API, Playwright for screenshots, Style Dictionary v5 patterns (manually reproduced in 60-line resolver), DTCG 2025.10 token spec.

**Source design:** [`2026-04-28-aim-studio-design-system-design.md`](./2026-04-28-aim-studio-design-system-design.md) — read first.

**Branch convention:** `wave-h-tokens-foundation`, `wave-i-renderers/<agent>`, `wave-j-ai-and-edit/<agent>`, `wave-k-docs-deploy`. Each wave ends with merge to `main` + smoke pass.

---

## Pre-flight

**Before Wave H starts, verify these exist (~5 min):**

1. OpenRouter API key with FLUX.2 Pro access. Test:
   ```bash
   curl -sS -X POST https://openrouter.ai/api/v1/chat/completions \
     -H "Authorization: Bearer $(cat ~/.config/openrouter/api_key)" \
     -H "Content-Type: application/json" \
     -d '{"model":"black-forest-labs/flux-2-pro","messages":[{"role":"user","content":"test"}],"modalities":["image"],"max_tokens":1}' \
     | head -c 200
   ```
   Expected: 200/400 with model recognized (not 404 "model not found").
   If 404 → fall back to `flux-1.1-pro` or `flux-pro-1.1` (model ID may differ); update `MODEL_MAP` in Wave J.

2. AIM-ain-visuals canonical prompts readable:
   ```bash
   test -f ~/.claude/skills/AIM-ain-visuals/prompts.md && echo OK
   ```

3. Clean working tree:
   ```bash
   git status -sb  # must show "## main...origin/main" with nothing else
   ```

4. Baseline screenshot (snapshot-test reference):
   ```bash
   cd /Users/alex/Documents/_code/_generators/aim-studio
   npm run smoke:ui  # records baseline
   cp -r .tmp-*.png docs/baseline/  # or wherever smoke output lives — verify in Wave H1
   ```

If any step fails, stop and surface to user before Wave H.

---

# Wave H — Foundation (sequential, ~30 min)

**Branch:** `wave-h-tokens-foundation` (off `main`)

**Setup:**
```bash
cd /Users/alex/Documents/_code/_generators/aim-studio
git checkout -b wave-h-tokens-foundation
mkdir -p data/tokens docs/baseline
```

## Task H1: Create primitive token file

**Files:**
- Create: `data/tokens/primitive.json`

**Step 1.** Extract raw values from existing `data/labs/{x26,s3,core}.json`. Write `primitive.json`:

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/draft-2025-10/",
  "color": {
    "neutral-950":  { "$value": "#0a0a0f", "$type": "color" },
    "neutral-900":  { "$value": "#0d1117", "$type": "color" },
    "neutral-850":  { "$value": "#141419", "$type": "color" },
    "neutral-800":  { "$value": "#161620", "$type": "color" },
    "neutral-700":  { "$value": "#1c1c2e", "$type": "color" },
    "neutral-100":  { "$value": "#e6edf3", "$type": "color" },
    "neutral-050":  { "$value": "#f1f5f9", "$type": "color" },

    "teal-500":     { "$value": "#4dc9d4", "$type": "color" },
    "teal-pine":    { "$value": "#0f3d38", "$type": "color" },
    "blue-s3":      { "$value": "#8ddff2", "$type": "color" },
    "amber-s3":     { "$value": "#f0b84b", "$type": "color" },
    "green-x26":    { "$value": "#16a34a", "$type": "color" },
    "mauve-core":   { "$value": "#a78bfa", "$type": "color" },
    "pink-w3":      { "$value": "#ff3b8b", "$type": "color" },
    "amber-w4":     { "$value": "#fcbb00", "$type": "color" }
  },
  "font-family": {
    "mono":     { "$value": "'IBM Plex Mono', ui-monospace, Menlo, monospace", "$type": "fontFamily" },
    "display":  { "$value": "'Space Grotesk', system-ui, sans-serif", "$type": "fontFamily" },
    "code":     { "$value": "'JetBrains Mono', ui-monospace, monospace", "$type": "fontFamily" }
  },
  "size": {
    "grid":         { "$value": "60px", "$type": "dimension" },
    "corner-mark":  { "$value": "20px", "$type": "dimension" },
    "radius-md":    { "$value": "4px",  "$type": "dimension" },
    "radius-lg":    { "$value": "8px",  "$type": "dimension" },
    "radius-xl":    { "$value": "16px", "$type": "dimension" }
  }
}
```

**Step 2.** Commit:
```bash
git add data/tokens/primitive.json
git commit -m "feat(tokens): add DTCG primitive layer"
```

## Task H2: Add semantic + component layers

**Files:**
- Create: `data/tokens/semantic.json`
- Create: `data/tokens/component.json`

**Step 1.** `data/tokens/semantic.json`:

```json
{
  "bg": {
    "deep":     { "$value": "{color.neutral-950}", "$type": "color" },
    "default":  { "$value": "{color.neutral-800}", "$type": "color" },
    "card":     { "$value": "{color.neutral-700}", "$type": "color" },
    "terminal": { "$value": "{color.neutral-850}", "$type": "color" }
  },
  "text": {
    "default":  { "$value": "{color.neutral-100}", "$type": "color" },
    "hero":     { "$value": "{color.neutral-050}", "$type": "color" },
    "subtle":   { "$value": "rgba(230,237,243,0.5)", "$type": "color" }
  },
  "accent": {
    "ainative": { "$value": "{color.teal-500}",  "$type": "color" },
    "x26":      { "$value": "{color.green-x26}", "$type": "color" },
    "core":     { "$value": "{color.mauve-core}", "$type": "color" }
  },
  "grid": {
    "size":    { "$value": "{size.grid}", "$type": "dimension" },
    "color":   { "$value": "rgba(77,201,212,0.06)", "$type": "color" }
  },
  "mode": {
    "terminal": {
      "chrome-show":   { "$value": true,  "$type": "other" },
      "corner-marks":  { "$value": true,  "$type": "other" },
      "card-radius":   { "$value": "{size.radius-md}", "$type": "dimension" }
    },
    "editorial": {
      "chrome-show":   { "$value": false, "$type": "other" },
      "corner-marks":  { "$value": false, "$type": "other" },
      "card-radius":   { "$value": "{size.radius-xl}", "$type": "dimension" }
    }
  }
}
```

**Step 2.** `data/tokens/component.json`:

```json
{
  "card": {
    "radius":     { "$value": "{mode.terminal.card-radius}", "$type": "dimension" },
    "padding":    { "$value": "20px", "$type": "dimension" },
    "shadow":     { "$value": "0 4px 18px rgba(0,0,0,0.45)", "$type": "shadow" }
  },
  "chrome": {
    "corner-size": { "$value": "{size.corner-mark}", "$type": "dimension" },
    "padding":     { "$value": "28px", "$type": "dimension" },
    "border":      { "$value": "1px solid rgba(77,201,212,0.18)", "$type": "border" }
  },
  "edit-sidebar": {
    "width":       { "$value": "320px", "$type": "dimension" },
    "row-gap":     { "$value": "12px",  "$type": "dimension" }
  }
}
```

**Step 3.** Commit:
```bash
git add data/tokens/semantic.json data/tokens/component.json
git commit -m "feat(tokens): add semantic and component layers"
```

## Task H3: Build a 3-layer resolver in scripts/build-labs.mjs

**Files:**
- Modify: `scripts/build-labs.mjs`

**Step 1.** Add resolver function at top of file (after imports):

```js
function resolveRefs(node, root) {
  if (typeof node === 'string') {
    const m = node.match(/^\{([\w.-]+)\}$/);
    if (!m) return node;
    const path = m[1].split('.');
    let cur = root;
    for (const p of path) cur = cur?.[p];
    if (cur && '$value' in cur) return resolveRefs(cur.$value, root);
    return cur;
  }
  if (Array.isArray(node)) return node.map(n => resolveRefs(n, root));
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = resolveRefs(node[k], root);
    return out;
  }
  return node;
}

function flattenTokens(layers) {
  // layers: { primitive, semantic, component } — merge in order
  const merged = { ...layers.primitive, ...layers.semantic, ...layers.component };
  return resolveRefs(merged, merged);
}
```

**Step 2.** In the main build loop, before processing `data/labs/*.json`, load + flatten tokens:

```js
const primitive = JSON.parse(fs.readFileSync('data/tokens/primitive.json'));
const semantic  = JSON.parse(fs.readFileSync('data/tokens/semantic.json'));
const component = JSON.parse(fs.readFileSync('data/tokens/component.json'));
const baseTokens = flattenTokens({ primitive, semantic, component });

// per-lab merge
const labOverlay = JSON.parse(fs.readFileSync(`data/labs/${labId}.json`));
const finalTokens = { ...baseTokens, ...labOverlay };
```

Emit into `data/labs.bundle.js` exactly as before, but with `finalTokens` not raw `labOverlay`.

**Step 3.** Test:
```bash
node scripts/build-labs.mjs
# expected: data/labs.bundle.js regenerated, no errors
diff <(node scripts/build-labs.mjs && cat data/labs.bundle.js) <(git show main:data/labs.bundle.js) | head -20
# expected: differences only in newly-resolvable token paths, no removed keys
```

**Step 4.** Commit:
```bash
git add scripts/build-labs.mjs data/labs.bundle.js
git commit -m "feat(build): 3-layer DTCG token resolver"
```

## Task H4: Extend lab JSONs with mode + bg axes

**Files:**
- Modify: `data/labs/s3.json`
- Modify: `data/labs/x26.json`
- Modify: `data/labs/core.json`

**Step 1.** Add to each lab JSON (top-level keys):

For `s3.json`:
```json
{
  "axes": {
    "defaultLayout": "mosaic",
    "defaultMode": "terminal",
    "defaultBg": { "type": "ai-generated", "style": "circuit", "model": "flux-pro" }
  }
}
```

For `x26.json`:
```json
{
  "axes": {
    "defaultLayout": "mosaic",
    "defaultMode": "terminal",
    "defaultBg": { "type": "mesh-token" }
  }
}
```

For `core.json`:
```json
{
  "axes": {
    "defaultLayout": "mosaic",
    "defaultMode": "editorial",
    "defaultBg": { "type": "plain" }
  }
}
```

**Step 2.** Re-build:
```bash
node scripts/build-labs.mjs
```

**Step 3.** Commit:
```bash
git add data/labs/*.json data/labs.bundle.js
git commit -m "feat(tokens): add mode + bg axes per lab"
```

## Task H5: Snapshot baseline + tag tokens-v1

**Files:**
- Create: `docs/baseline/mosaic-{x26,s3,core}.png`

**Step 1.** Run smoke + capture mosaic baselines:
```bash
npm run smoke:ui
# manually save renders for x26/s3/core mosaic via:
node scripts/export.mjs --lab=s3 --layout=mosaic --out=docs/baseline/mosaic-s3.png
node scripts/export.mjs --lab=x26 --layout=mosaic --out=docs/baseline/mosaic-x26.png
node scripts/export.mjs --lab=core --layout=mosaic --out=docs/baseline/mosaic-core.png
```

If `export.mjs` doesn't take these flags, use the existing format and rename outputs accordingly.

**Step 2.** Commit + tag:
```bash
git add docs/baseline/
git commit -m "test: lock mosaic visual baselines"
git tag tokens-v1
git push origin wave-h-tokens-foundation tokens-v1
```

**Step 3.** Merge to main:
```bash
git checkout main
git merge --no-ff wave-h-tokens-foundation -m "merge wave-h: token foundation"
git push origin main
```

**Wave H Gate:** All three baselines exist; `node scripts/build-labs.mjs` produces byte-stable output; tag `tokens-v1` exists.

---

# Wave I — Renderer Parallelization (7 agents, parallel)

**Branch base:** `wave-i-renderers` (off `main` after Wave H merged)

**Setup (orchestrator side):**
```bash
git checkout main && git pull
git checkout -b wave-i-renderers
mkdir -p app
# Each I-agent runs in its own worktree:
git worktree add ../aim-studio-wave-i-1 wave-i-renderers/i1-mosaic
git worktree add ../aim-studio-wave-i-2 wave-i-renderers/i2-field
# ... (7 worktrees total)
```

**Common contract for every Wave I agent (read first):**

```js
// Every renderer in app/render-{layout}.js exports:
export function render({ copy, speakers, lab, mode, bg, chrome }) {
  // returns { html, css }
}
```

`mode` ∈ `'terminal'|'editorial'`. `bg` = `{ type, src?, opacity }`. `chrome` = `{ show, position }`.

## Task I1: Mosaic renderer (zero visual change)

**Worktree:** `../aim-studio-wave-i-1` · **Branch:** `wave-i-renderers/i1-mosaic`

**Files:**
- Create: `app/render-mosaic.js`
- Modify: `app.js` (extract existing `mosaicCoverMarkup` + `mosaicTileMarkup`)

**Step 1.** Move `mosaicCoverMarkup` and `mosaicTileMarkup` from `app.js` into `app/render-mosaic.js`. Wrap in `render()` exported function matching contract.

**Step 2.** In `app.js`, replace inline functions with `import { render as renderMosaic } from './app/render-mosaic.js'`.

**Step 3.** Run baseline diff:
```bash
node scripts/export.mjs --lab=s3 --layout=mosaic --out=/tmp/mosaic-s3-after.png
diff <(md5 docs/baseline/mosaic-s3.png) <(md5 /tmp/mosaic-s3-after.png)
# expected: identical (zero visual change)
```

**Step 4.** Commit:
```bash
git add app/render-mosaic.js app.js
git commit -m "refactor(mosaic): extract to app/render-mosaic.js, no visual change"
```

## Task I2: Field renderer — pull to mosaic quality

**Worktree:** `../aim-studio-wave-i-2` · **Branch:** `wave-i-renderers/i2-field`

**Files:**
- Create: `app/render-field.js`
- Modify: `app.js`

**Step 1.** Extract `fieldCoverMarkup` to `app/render-field.js` with new contract.

**Step 2.** Apply density reduction: cut badge count per tile by 50% (drop secondary metadata badges, keep only role + week). Reuse mosaic's tile-shadow/border tokens via component.json.

**Step 3.** Visual diff (expected: cleaner, less crowded — not byte-equal):
```bash
node scripts/export.mjs --lab=s3 --layout=field --out=/tmp/field-s3.png
# manually open + compare against docs/baseline/ (none exists for field — it's new quality)
```

**Step 4.** Commit:
```bash
git add app/render-field.js app.js
git commit -m "refactor(field): extract + density reduction"
```

## Task I3: Roster renderer — simplify badges

**Worktree:** `../aim-studio-wave-i-3` · **Branch:** `wave-i-renderers/i3-roster`

**Files:**
- Create: `app/render-roster.js`
- Modify: `app.js`

**Step 1.** Extract `rosterCoverMarkup` and `rosterListMarkup`. Reduce badge variety: keep `01..10` index + `W{N}` week. Drop "GUEST" badge merged with index (badge says `03 · W1` instead of two separate badges).

**Step 2.** Commit:
```bash
git add app/render-roster.js app.js
git commit -m "refactor(roster): extract + simplify badge stack"
```

## Task I4: Cards renderer (NEW) — editorial mode

**Worktree:** `../aim-studio-wave-i-4` · **Branch:** `wave-i-renderers/i4-cards`

**Files:**
- Create: `app/render-cards.js`
- Modify: `app.js` (register layout)
- Modify: `index.html` (add `cards` button to layout selector if not present)

**Step 1.** New renderer. Implement editorial mode:
- Card border-radius from `component.card.radius` resolved via `mode.editorial.card-radius` = 16px
- Soft shadow: `0 8px 30px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15)`
- No corner brackets, no terminal grid overlay
- Whitespace: padding 32px instead of 20px
- Speaker photo: subtle vignette, no duotone teal-pine

**Step 2.** When user picks `cards`, force `mode = 'editorial'` in `app.js` state setter (prevents toggle to terminal).

**Step 3.** Commit:
```bash
git add app/render-cards.js app.js index.html
git commit -m "feat(cards): new layout in editorial mode"
```

## Task I5: Chrome dedup fix

**Worktree:** `../aim-studio-wave-i-5` · **Branch:** `wave-i-renderers/i5-chrome`

**Files:**
- Create: `app/render-chrome.js`
- Modify: `app.js`
- Modify: `styles.css`

**Step 1.** Extract chrome (corner brackets + PREVIEW header) to `app/render-chrome.js` with `render({ show, position, label, dimensions })`.

**Step 2.** In `app.js` outer render, call `renderChrome` ONCE around the active card stack. Inside per-card markup, REMOVE all corner-bracket SVG.

**Step 3.** Update `styles.css` to scope `.chrome-corner` to `.chrome-outer` only (not `.card`).

**Step 4.** Visual test: select multiple speakers, confirm exactly one chrome wrapper renders.

**Step 5.** Commit:
```bash
git add app/render-chrome.js app.js styles.css
git commit -m "fix(chrome): single outer wrapper, never per-card"
```

## Task I6: Backdrop layer rendering

**Worktree:** `../aim-studio-wave-i-6` · **Branch:** `wave-i-renderers/i6-bg`

**Files:**
- Create: `app/bg-layer.js`

**Step 1.** Implement:
```js
export function renderBg({ type, src, opacity = 1 }) {
  if (type === 'plain') return '<div class="bg-plain"></div>';
  if (type === 'mesh-token') return '<div class="bg-mesh"></div>';  // existing CSS
  if (type === 'ai-generated' && src) {
    return `<img class="bg-ai" src="${src}" style="opacity:${opacity}" alt="">`;
  }
  return '';
}
```

**Step 2.** Inject as the lowest z-index layer behind chrome and content.

**Step 3.** Commit:
```bash
git add app/bg-layer.js
git commit -m "feat(bg): backdrop layer rendering primitive"
```

## Task I7: Edit sidebar shell (no font-size yet)

**Worktree:** `../aim-studio-wave-i-7` · **Branch:** `wave-i-renderers/i7-sidebar`

**Files:**
- Create: `app/edit-sidebar.js`
- Modify: `index.html` (sidebar markup slot)
- Modify: `styles.css` (sidebar layout)

**Step 1.** Build sidebar shell with one row per editable field, label + input. No font-size control yet (Wave J6).

**Step 2.** Wire to existing `updateCopyField` so sidebar inputs propagate to canvas.

**Step 3.** Commit:
```bash
git add app/edit-sidebar.js index.html styles.css
git commit -m "feat(edit-ui): persistent sidebar shell"
```

## Wave I integration

After all 7 sub-branches done:
```bash
cd /Users/alex/Documents/_code/_generators/aim-studio  # main worktree
git checkout wave-i-renderers
for sub in i1-mosaic i2-field i3-roster i4-cards i5-chrome i6-bg i7-sidebar; do
  git merge --no-ff wave-i-renderers/$sub -m "merge $sub into wave-i"
done
npm run smoke:ui
# verify all 4 layouts render no console errors
git checkout main
git merge --no-ff wave-i-renderers -m "merge wave-i: renderer parallelization"
git push origin main
```

**Wave I Gate:** All 4 layouts × 3 labs × 2 modes (where applicable) render; mosaic baseline byte-equal.

---

# Wave J — AI Integration + Edit UI fill (7 agents, parallel)

**Branch base:** `wave-j-ai-and-edit` (off `main` after Wave I)

## Task J1: Extend generate-bg.mjs with FLUX paths

**Files:**
- Modify: `netlify/functions/generate-bg.mjs`

**Step 1.** Add model map at top:
```js
const MODEL_MAP = {
  'flux-pro':     'black-forest-labs/flux-2-pro',
  'flux-klein':   'black-forest-labs/flux-2-klein-4b',
  'gemini-flash': 'google/gemini-2.5-flash-image-preview',
};
const COST_USD = { 'flux-pro': 0.04, 'flux-klein': 0.015, 'gemini-flash': 0.003 };
```

**Step 2.** Accept `model` from request body, default `'flux-pro'`. Build OpenRouter request with `modalities: ["image"]` and parse base64 from `choices[0].message.content[0].image_url.url` (FLUX) OR existing Gemini envelope.

**Step 3.** Add fallback chain: `flux-pro` 5xx → `flux-klein` → `gemini-flash` → throw.

**Step 4.** Return `{ dataUrl, prompt, model, costUsd, cacheKey }` where `cacheKey = sha256(prompt|model|seed)`.

**Step 5.** Commit:
```bash
git add netlify/functions/generate-bg.mjs
git commit -m "feat(bg-fn): FLUX.2 Pro/Klein paths + fallback chain"
```

## Task J2: Copy s3 canonical prompts

**Files:**
- Create: `data/backdrops/s3-prompts.json`

**Step 1.** Copy 5 prompts from `~/.claude/skills/AIM-ain-visuals/prompts.md` (botanical / circuit / radar / cellular / topo). Format:

```json
[
  {
    "id": "botanical",
    "name": "Botanical Plate",
    "subject": "Victorian botanical plate engraving, detailed ferns, leaves, cross-hatching, vine tendrils",
    "negation": "no text, no humans, no faces"
  },
  { "id": "circuit", "name": "Circuit × Botanical", "subject": "...", "negation": "..." },
  { "id": "radar",   "name": "Radar Scope",         "subject": "...", "negation": "..." },
  { "id": "cellular","name": "Cellular Microscopy", "subject": "...", "negation": "..." },
  { "id": "topo",    "name": "Topo × Mycelium",     "subject": "...", "negation": "..." }
]
```

**Step 2.** Commit:
```bash
git add data/backdrops/s3-prompts.json
git commit -m "feat(bg): canonical s3 prompts from ain-visuals"
```

## Task J3: Prompt picker UI

**Files:**
- Modify: `index.html` (bg control panel)
- Create: `app/bg-picker.js`

**Step 1.** Add panel: style dropdown (5 + custom), model selector (flux-pro default, klein, gemini-flash), generate button, regenerate-with-new-seed button, custom-prompt textarea (collapsed unless "custom" picked).

**Step 2.** On generate, POST to `/.netlify/functions/generate-bg` with `{ style, lab, model, prompt }`. Inject result `dataUrl` into `bg.src` of current state.

**Step 3.** Loading skeleton on the canvas behind banner during generation.

**Step 4.** Commit:
```bash
git add index.html app/bg-picker.js
git commit -m "feat(bg-ui): prompt picker + model selector"
```

## Task J4: Client-side post-processing

**Files:**
- Create: `app/bg-postprocess.js`

**Step 1.** Implement Canvas2D pipeline matching `make-banner.py:compose`:

```js
export async function postprocess(srcDataUrl, { tint = '#0f3d38', tintAlpha = 0.35, scrimAlpha = 0.43 } = {}) {
  // 1) load img
  // 2) draw to canvas
  // 3) desaturate (ctx.filter = 'grayscale(100%)')
  // 4) overlay tint with globalAlpha = tintAlpha
  // 5) overlay solid black scrim with globalAlpha = scrimAlpha
  // 6) return canvas.toDataURL('image/png')
}
```

**Step 2.** Wire into bg-picker: after function returns dataUrl, run postprocess before assigning to `bg.src`.

**Step 3.** Commit:
```bash
git add app/bg-postprocess.js app/bg-picker.js
git commit -m "feat(bg): canvas2d post-processing pipeline"
```

## Task J5: Cache layer

**Files:**
- Create: `app/bg-cache.js`

**Step 1.** localStorage-backed:
```js
const KEY = 'aim-studio-bg-cache-v1';
export function get(cacheKey) { /* return dataUrl or null */ }
export function set(cacheKey, dataUrl) { /* store, evict LRU at 50 entries */ }
```

**Step 2.** Wire into bg-picker before posting to function.

**Step 3.** Commit:
```bash
git add app/bg-cache.js app/bg-picker.js
git commit -m "feat(bg): localStorage cache layer"
```

## Task J6: Edit UI font-size inputs

**Files:**
- Modify: `app/edit-sidebar.js`
- Modify: `styles.css`

**Step 1.** For each editable field row, add `<input type="number" min="8" max="200">` with ± buttons. Bind to `state.copy.fontSizes[fieldKey]`.

**Step 2.** On change, update CSS variable `--copy-${fieldKey}-fs` on canvas root, propagating to renderers via `font-size: var(--copy-title-fs, 130px);` etc.

**Step 3.** Visual: input is 56px wide, monospace, label "px" suffix.

**Step 4.** Commit:
```bash
git add app/edit-sidebar.js styles.css
git commit -m "feat(edit-ui): per-field numeric font-size with ± controls"
```

## Task J7: Persistence round-trip

**Files:**
- Modify: `app.js` (export/import handlers)

**Step 1.** Extend export JSON to include `copy.fontSizes`. On import, restore.

**Step 2.** Test:
```bash
# Manually: change font-size, export, reload, import — sizes preserved
```

**Step 3.** Commit:
```bash
git add app.js
git commit -m "feat(edit-ui): font-sizes persist through export/import"
```

## Wave J merge

```bash
git checkout wave-j-ai-and-edit
for sub in j1 j2 j3 j4 j5 j6 j7; do git merge --no-ff wave-j-ai-and-edit/$sub; done
npm run smoke:ui
git checkout main && git merge --no-ff wave-j-ai-and-edit -m "merge wave-j: AI bg + edit UI"
git push origin main
```

**Wave J Gate:** Generate s3 banner with circuit backdrop end-to-end via UI; verify visual is teal-monochrome plate, post-processed, < $0.05 per generation in console log.

---

# Wave K — Docs + Deploy (5 agents, mostly sequential)

**Branch:** `wave-k-docs-deploy`

## Task K1: Regenerate Claude Designs export

```bash
npm run sync:designs
```

Then in `claude-designs/README.md`, update "Lab quick reference" table to mention 3-axis system. Commit.

## Task K2: docs/design-system.md

**Files:**
- Create: `docs/design-system.md`

Document:
- 3-axis vocabulary (`layout × mode × decorative-bg`)
- Token layer cake (primitive → semantic → component → lab overlay)
- How to add a new lab
- How to add a new layout
- How to use the AI bg pipeline (with example POST + response)
- Cost reference table for AI models

Commit.

## Task K3: Extended smoke

**Files:**
- Modify: `scripts/smoke-ui.mjs`

Loop matrix: `4 layouts × 3 labs × 2 modes × 3 bg-types = 72 renders`. Run via Playwright headless. Capture PNGs to `.tmp-smoke/`. Compare mosaic ones to baseline by md5.

Commit.

## Task K4: Update og-cover

**Files:**
- Modify: `og-cover.html`

Refresh to reflect new design system (use editorial mode for OG card). Re-render `og-cover.png`.

Commit.

## Task K5: Deploy + verify

```bash
git checkout main && git pull
git merge --no-ff wave-k-docs-deploy -m "merge wave-k: docs + deploy"
git push origin main
# Netlify auto-deploys; wait ~2 min
dig +short aim-studio.aimindset.org @8.8.8.8
# if pending: use netlify default URL from `netlify status`
curl -sS https://aim-studio.netlify.app | head -c 200
# verify HTML body contains new design-system markers (e.g. data-axis attributes)
```

Tag final release:
```bash
git tag -a v2-design-system -m "Unified design system + AI backdrop"
git push origin v2-design-system
```

**Wave K Gate:** Live URL serves new build; tag pushed; smoke matrix passes 72/72.

---

# Acceptance Checklist (final)

Run after Wave K:

- [ ] All 4 layouts render across 3 labs without console errors
- [ ] Mosaic baseline byte-equal to `tokens-v1` snapshots
- [ ] Cards forces `mode: editorial` (UI test: layout=cards → terminal toggle hidden)
- [ ] s3 + circuit backdrop generates teal-monochrome plate matching ain-visuals reference visually
- [ ] Multi-speaker preview shows exactly 1 chrome wrapper
- [ ] Edit sidebar has numeric font-size next to each editable field; persists through export/import
- [ ] `npm run sync:designs` regenerates `claude-designs/design-tokens.jsx`
- [ ] `docs/design-system.md` exists, documents 3 axes
- [ ] Cost log: FLUX.2 Pro generation < $0.05/img
- [ ] Live URL serves v2 build; `v2-design-system` tag exists

---

# Execution Handoff

**Plan complete and saved to `docs/plans/2026-04-28-aim-studio-design-system-PLAN.md`.**

User explicitly mandated "не спрашивай меня, реализуем всё" → defaulting to **Subagent-Driven (this session)**.

**REQUIRED SUB-SKILL:** Use `superpowers:subagent-driven-development` to dispatch one fresh agent per Wave H task, gate-check, then dispatch Wave I in parallel via `superpowers:dispatching-parallel-agents`, etc.

Sequence:
1. Pre-flight checks (orchestrator does these directly)
2. Wave H: 5 sequential agents
3. Wave H gate + merge
4. Wave I: 7 parallel agents (each in own worktree via `superpowers:using-git-worktrees`)
5. Wave I merge
6. Wave J: 7 parallel agents
7. Wave J merge
8. Wave K: 5 sequential agents
9. Final acceptance check
