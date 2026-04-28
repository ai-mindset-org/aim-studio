# AIM Studio Design System

**Status:** Wave K (2026-04-28). Live at <https://aim-studio.netlify.app>.

This document is the architecture reference for the AIM Studio banner generator. It explains the **3-axis design system**, the **DTCG token layer cake**, and the four extension points (new lab · new layout · new prompt · new model).

---

## 1. The 3 axes

Every banner is parameterised on three orthogonal axes. The UI exposes one selector per axis; renderers branch on them.

| Axis | Values | Locked by | Where consumed |
|------|--------|-----------|----------------|
| **layout** | `field` · `mosaic` · `roster` · `cards` | `state.style` | `app/render-{layout}.js` |
| **mode** | `terminal` · `editorial` | `state.designMode` (auto-derived: cards → editorial, others → terminal) | renderer CSS surface (paper vs CRT) |
| **decorative-bg** | `plain` · `mesh-token` · `ai-generated:<style>` | `state.bg` (from bg picker) overrides `lab.axes.defaultBg` | `app/bg-layer.js` injects `<aside data-bg-type>` as first child of `.banner-root` |

The cartesian product is `4 × 2 × 3 = 24` shapes per lab. Three labs → 72 visual combinations covered by the smoke matrix (see `scripts/smoke-ui.mjs`).

### Axis precedence (resolution order)

1. URL query string (`?style=mosaic&lab=s3` etc.)
2. `state.bg` set by the bg picker (live UI)
3. `lab.axes.default{Layout,Mode,Bg}` from `data/labs/<lab>.json`
4. Hard-coded fallback in `app.js` (`field` / `terminal` / `plain`)

A layout may **force** mode (cards → editorial). Modes never force a layout.

---

## 2. Token layer cake

Tokens follow the **DTCG 2025-10 draft** with `.$value` envelopes. They cascade in four layers, lowest to highest specificity:

```
data/tokens/primitive.json    ← raw values (colors, sizes, durations, fonts)
data/tokens/semantic.json     ← role-based aliases (text.body → primitive.neutral.100, ...)
data/tokens/component.json    ← component slots (chrome.corner.size, banner.title.fs, ...)
data/labs/<lab>.json          ← per-lab overlay (accent + speakers + program + axes defaults)
```

`scripts/build-labs.mjs` resolves the cake into `data/labs.bundle.js` (single classic-script bundle for the browser; `window.X26BannerData`).

**Resolution rule:** later layers override earlier ones by exact key match. Unrecognised keys are passed through. The resolver is ~60 lines; intentionally simpler than Style Dictionary because we only have one output target (browser JS) and one platform (web).

`scripts/sync-claude-designs.mjs` snapshots the resolved bundle as `claude-designs/design-tokens.jsx` for upload to Claude Designs (manual mirror; that surface has no API).

---

## 3. Adding a new lab

1. Create `data/labs/<labId>.json`. Required keys:
   ```json
   {
     "axes": { "defaultLayout": "field", "defaultMode": "terminal", "defaultBg": { "type": "plain" } },
     "id": "<labId>",
     "name": "<Display Name>",
     "accent": "#xxxxxx",
     "accentRgb": "r,g,b",
     "fonts": { "mono": "...", "display": "...", "googleFontsHref": "..." },
     "dates": "...",
     "footer": "...",
     "speakers": [],
     "featuredIds": []
   }
   ```
2. (Optional) override `styles` array if the lab should expose only a subset of layouts.
3. Run `npm run build:labs` to regenerate `data/labs.bundle.js`.
4. Run `npm run sync:designs` to refresh the Claude Designs export.
5. Commit JSON + bundle. Live page picks it up automatically via the `lab` query param.

---

## 4. Adding a new layout

Each renderer is a self-contained module matching the shared contract:

```js
// app/render-<layout>.js
export function render({ copy, speakers, lab, mode, bg, chrome }) {
  // returns { html: string, css: string }
}
```

- **Inputs:** plain objects. `copy` is the resolved per-record text; `speakers` is the slice already filtered by `featuredSpeakers(N)`; `lab` has `accent`/`program`/`modalities`/etc.; `mode`/`bg`/`chrome` are advisory.
- **Output:** `{ html, css }`. The orchestrator (`app.js → render()`) injects `css` once via a `<style data-render-<layout>>` tag and inserts `html` into `#bannerMount`.
- **Chrome rule:** renderers MUST NOT emit `corner-bracket` SVG / `.chrome-*` markup. Outer chrome is hoisted to a single wrapper by `app/render-chrome.js → wrap()`. See task I5 in the implementation plan.
- **Mode rule:** if your layout is mode-locked, set the lock in `syncControls()` style-button handler (see how `cards` flips to editorial there).

ESM renderers (`field`, `cards`, `chrome`, `bg-layer`, `bg-picker`, `edit-sidebar`) are imported by `app.js`. Classic-script renderers (`mosaic`, `roster`) attach to `window.renderMosaic` / `window.renderRoster` and must be loaded before `app.js` in `index.html`.

After adding the file, expose its id in `DEFAULT_LAYOUT_OPTIONS` inside `app.js`, and add a smoke combo to `scripts/smoke-ui.mjs`.

---

## 5. AI background pipeline

**Endpoint:** `POST /.netlify/functions/generate-bg`.

**Request:**

```http
POST /.netlify/functions/generate-bg
Content-Type: application/json

{
  "prompt": "dense circuit board with botanical overlay, monochrome teal",
  "style": "circuit",
  "lab": "s3",
  "model": "gemini-3-pro",
  "seed": 12345
}
```

**Response:**

```json
{
  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAA...",
  "prompt": "<finalised prompt incl. style prefix + lab accent>",
  "model": "google/gemini-3-pro-image-preview",
  "costUsd": 0.04,
  "cacheKey": "sha256:..."
}
```

**Model fallback chain** (ordered): `gemini-3-pro` → `gpt-5-image` → `gemini-flash`. On 5xx / provider error the function walks the chain and returns the first success.

**Style prefixes** (auto-prepended by the function): `biological`, `terminal`, `glitch`, `botanical`, `blueprint`, `evergreen`, `plain`. See `STYLE_PREFIXES` in `netlify/functions/generate-bg.mjs`.

**Cache:** the client-side LRU keeps 50 entries in `localStorage` (`x26-banner:bg-cache`). Cache key = `sha256(prompt + style + lab + model + seed)`. Cache hits cost $0.

**Post-process:** images returned from the API run through `app/bg-postprocess.js` — desaturate → tint with `lab.accent` → scrim. Result is what the bg-layer commits as `<aside data-bg-type="ai-generated" style="background-image:url(...)">` first child of `.banner-root`.

### Cost reference

| Model id | OpenRouter route | Cost / image |
|----------|------------------|--------------|
| `gemini-3-pro` (default) | `google/gemini-3-pro-image-preview` | **$0.04** |
| `gpt-5-image` | `openai/gpt-5-image` | $0.04 |
| `gemini-flash` (fallback) | `google/gemini-2.5-flash-image` | **$0.003** |

A typical session of 10 generations on the default model is $0.40. Use `gemini-flash` for rapid iteration when fidelity is non-critical.

---

## 6. Files quick map

| Concern | File |
|---------|------|
| Bootstrapping | `app.js` (ESM entry; `index.html` loads it last) |
| Renderers | `app/render-{field,mosaic,roster,cards}.js` |
| Chrome dedup | `app/render-chrome.js` |
| Backdrop layer | `app/bg-layer.js` |
| Backdrop picker UI | `app/bg-picker.js` |
| Backdrop cache | `app/bg-cache.js` |
| Backdrop post-process | `app/bg-postprocess.js` |
| Edit sidebar | `app/edit-sidebar.js` |
| Tokens (primitive) | `data/tokens/primitive.json` |
| Tokens (semantic) | `data/tokens/semantic.json` |
| Tokens (component) | `data/tokens/component.json` |
| Lab overlays | `data/labs/{x26,s3,core}.json` |
| Lab bundle (build output) | `data/labs.bundle.js` |
| AI bg function | `netlify/functions/generate-bg.mjs` |
| Token build | `scripts/build-labs.mjs` |
| Claude Designs sync | `scripts/sync-claude-designs.mjs` |
| Smoke matrix | `scripts/smoke-ui.mjs` |
| OG cover | `og-cover.html` → `og-cover.png` |

---

## 7. Conventions worth remembering

- `state.copyOverrides[recordKey()]` is the per-record text override map. Keys are generated by `recordKey()` and look like `x26:speaker:arseny-popov`.
- `state.copyFontSizes[recordKey()]` mirrors the same key shape for numeric font-size overrides (Wave J6/J7). Persisted via `?fs=` URL param.
- `state.bg` overrides `lab.axes.defaultBg` only for the active session; clear via the bg picker or by deleting it from `state`.
- Do not edit `data/labs.bundle.js` or `claude-designs/design-tokens.jsx` by hand — both are auto-generated.
- Renderers receive `mode`/`bg`/`chrome` for contract parity even if they don't yet consume them. New renderers are expected to honour all three.
