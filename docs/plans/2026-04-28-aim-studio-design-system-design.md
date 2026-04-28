# AIM Studio — Unified Design System & AI Backdrop · Design

**Date:** 2026-04-28
**Owner:** Alex Povaliaev
**Status:** Draft — awaiting approval before plan/execute
**Repo:** `_code/_generators/aim-studio` (GitHub: `ai-mindset-org/aim-studio`)
**Live:** `aim-studio.netlify.app`
**Inherits from:** `AIM-ain-visuals` (AI-Native DNA), `AIM-x26-visuals` (botanical-green DNA), DTCG 2025.10 spec
**Sprint pattern:** wave-letter branches (continues `wave-a..g` history)

---

## 1. Goals

1. **One design system, multiple aesthetics.** Mosaic stays as is (gold standard). Field/roster get pulled to its quality bar through shared tokens. Cards become explicitly non-terminal (editorial mode).
2. **AI-generated decorative backdrop for s3 / AI-Native** banners using **FLUX.2 Pro** via OpenRouter. Reuse canonical prompts from `AIM-ain-visuals/prompts.md` (botanical / circuit / radar / cellular / topo).
3. **Edit UI uplift** — text edit field прominent, font-size control inline (Recraft V3-style).
4. **Bug: terminal-chrome repetition** — when N labs match, render only one outer chrome (not N).
5. **Documented, agent-ready** — every wave produces docs the next wave can read without context-bleed.

## 2. Out of scope

- New layout primitives beyond field / mosaic / roster / cards (no `hero`, no `timeline`, no `grid-pro`).
- Cards-mode beyond "editorial" (one non-terminal aesthetic, not three).
- x26 AI backdrop in this sprint (already covered by `AIM-x26-visuals` external pipeline). x26 keeps its current visual; the **decorative-bg axis is opt-in per lab and ships only for s3 first.**
- Migration of existing exported PNGs (current `og-cover.png`, `.tmp-*.png`) — they re-export naturally on next render.
- Backwards-compatible JSON migration for `data/labs/*.json` — we extend, not break.

## 3. Locked decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Architecture: **axis-based** — `layout × mode × decorative-bg` | Resolves "cards not terminal" without contradicting "unified system" |
| D2 | Token model: **DTCG 3-layer** — primitive → semantic → component | Industry default 2025.10; Style Dictionary v5 native |
| D3 | Naming kept: `field / mosaic / roster / cards` | Less migration risk; no agent-prompt rename mass edit |
| D4 | Mode axis: **`terminal` ∣ `editorial`** (binary) | One axis, two values, nailed terminology |
| D5 | AI backdrop model: **FLUX.2 Pro** primary, FLUX.2 Klein fallback, gemini-2.5-flash retained as `cheap` option | User: "максимально качественной модели" |
| D6 | Backdrop scope phase 1: **s3 / AI-Native only** | User redirected from x26 to s3 |
| D7 | Found-cards chrome fix: **chrome only on active card in preview**, never repeated | Lowest visual noise |
| D8 | Sprint shape: **4 waves × ~7 agents = 28 units**, git worktree per agent | Research-backed; matches existing `wave-a..g` convention |
| D9 | Mosaic visual untouched, refactor only re-points it to new tokens | Zero regression risk on user's preferred style |
| D10 | Edit UI: **Recraft V3 pattern** — large numeric font-size + persistent inline toolbar | Reference from background research |

## 4. Architecture

### 4.1. Three orthogonal axes

```
layout ∈ { field, mosaic, roster, cards }            ← "what shape"
mode   ∈ { terminal, editorial }                     ← "what aesthetic"
bg     ∈ { plain, mesh-token, ai-generated:<style> } ← "what's behind"
```

**Default matrix per lab (`data/labs/*.json` extended):**

| Lab | Default layout | Default mode | Default bg |
|-----|----------------|--------------|------------|
| s3 (AI-Native) | mosaic | terminal | `ai-generated:circuit` (FLUX.2 Pro) |
| x26 | mosaic | terminal | `mesh-token` (current) |
| core | mosaic | editorial | `plain` |

User can override any axis per banner. Cards → mode auto-locks to `editorial` (UI hides terminal toggle when layout=cards).

### 4.2. DTCG token layers

```
data/tokens/
  primitive.json    ← raw values: hex, font-family, ms (no semantics)
  semantic.json     ← roles: --bg, --accent, --text-hero, --grid (refs primitive)
  component.json    ← per-component: --card-radius, --chrome-corner-size (refs semantic)

data/labs/
  s3.json           ← LAB OVERLAY: overrides specific semantic + component tokens
  x26.json
  core.json
```

Build pipeline: `scripts/build-labs.mjs` (existing) extended to **flatten primitive → semantic → component → lab-overlay** into final `labs.bundle.js`. Style Dictionary v5 not introduced as a dep (overkill for 3 labs); a 60-line resolver in the script handles `{primitive.color.teal-500}` ref syntax.

### 4.3. Component contract

Every renderer (`fieldCoverMarkup`, `mosaicCoverMarkup`, `rosterCoverMarkup`, new `cardsCoverMarkup`) takes the **same shape**:

```js
renderXxxCover({
  copy,           // { title, accentTitle, sub, eyebrow, dates, footer, ... }
  speakers,       // [{ id, name, photo, role, week, accent }]
  lab,            // resolved tokens (after primitive→semantic→component→overlay)
  mode,           // 'terminal' | 'editorial'
  bg,             // { type: 'plain' | 'mesh' | 'ai', src?: dataUrl, opacity: 0..1 }
  chrome          // { show: boolean, position: 'outer' | 'card' }   ← single-source-of-truth for the bug fix
})
```

This contract is the **token-handoff** between Wave 1 (tokens locked) and Wave 2 (renderers parallelize). No renderer reads from globals.

## 5. AI backdrop flow (s3 / AI-Native)

### 5.1. Existing scaffold

`netlify/functions/generate-bg.mjs` already exists with style prefixes (biological/terminal/glitch/botanical/blueprint/evergreen/plain) and lab accents. Currently uses Gemini 2.5 Flash Image (`google/gemini-2.5-flash-image-preview`).

### 5.2. Extension (Wave 3)

```js
// POST /.netlify/functions/generate-bg
// {
//   prompt:  string,
//   style:   'botanical' | 'circuit' | 'radar' | 'cellular' | 'topo' | <user-typed>,
//   lab:     's3' | 'x26' | 'core',
//   model:   'flux-pro' | 'flux-klein' | 'gemini-flash',   // NEW — default 'flux-pro' for s3
//   aspect:  '21:9' | '1:1' | '9:16',                      // NEW
//   seed?:   number                                         // NEW for reproducibility
// }
// → { dataUrl, prompt, model, costUsd, cacheKey }
```

**Source of prompts:** copy 5 canonical subject phrases from `~/.claude/skills/AIM-ain-visuals/prompts.md` into `data/backdrops/s3-prompts.json`. Each entry:

```json
{
  "id": "circuit",
  "name": "Circuit × Botanical",
  "subject": "Architectural blueprint and circuit board diagrams overlaid with Victorian botanical plant forms...",
  "negation": "no text, no people, no faces"
}
```

The function builds the full prompt as `${subject}, cool teal monochrome hex 4dc9d4 on deep indigo-black 161620, 21:9 cinematic horizontal, ${negation}`. **Same DNA as ain-visuals** ⇒ visual coherence between AIM Studio outputs and team's existing s3 banners.

### 5.3. Post-processing (client-side, in `app.js`)

Match `make-banner.py:compose()` from ain-visuals: desaturate → duotone teal-pine `#0f3d38` @0.35 → scrim @0.43. Implemented as Canvas2D pipeline before injection into `<img>` of the layout. Result: AI-generated raw image becomes brand-coherent backdrop.

### 5.4. Caching

Hash `${prompt}|${model}|${seed}` → store dataUrl in Netlify Blobs (or `localStorage` for MVP, Blobs in Wave 4). Re-clicks of same combo are instant + free.

### 5.5. Cost & failure modes

| Model | Cost / image | Latency | Use |
|-------|--------------|---------|-----|
| FLUX.2 Pro | ~$0.04 | 8–14s | Default for s3 |
| FLUX.2 Klein 4B | ~$0.015 | 4–7s | Quick iterate |
| Gemini 2.5 Flash Image | ~$0.003 | 2–4s | Cheap fallback / x26 legacy |

**Critical API note (from research):** OpenRouter image gen needs `modalities: ["image"]` and base64 response parsing — NOT standard chat-completion shape. Existing `generate-bg.mjs` already handles this for Gemini; FLUX path follows the same envelope.

## 6. Edit UI redesign (Recraft V3 pattern)

### 6.1. Current pain (from your brief)

- Edit field doesn't visually announce itself
- No font-size control
- Inline `contenteditable` is invisible until user clicks the right element

### 6.2. Target

```
┌─ EDITABLE COPY ────────────────────────────────┐
│ TITLE        ┃ ai-native sprint                │
│              ┃                          [- 64 +]│  ← font-size numeric input + ± buttons
│ ACCENT TITLE ┃ {s3}                            │
│              ┃                          [- 96 +]│
│ SUB          ┃ 4 weeks · setup / systems...    │
│              ┃                          [- 14 +]│
│ DATES        ┃ 2 MAY – 25 MAY 2026             │
│              ┃                          [- 18 +]│
└────────────────────────────────────────────────┘
```

- Sidebar panel, **persistent** (not modal, not collapsed by default)
- Each editable field gets: label · live `<input>` · numeric font-size with ± · live preview pushes to canvas immediately
- Canvas `contenteditable` stays as a backup (click-on-text-to-edit), but sidebar is now the primary surface
- Font-size stored in `copy.fontSizes` namespace, persisted with copy

### 6.3. Out of scope this sprint

Color picker, weight selector, alignment — these are next iteration. Goal here: **clear field affordance + size control. Done.**

## 7. Bug fix: repeating terminal chrome

### 7.1. Symptom

When user filters/searches and N labs/cards match, the corner-bracket chrome (`PREVIEW · S3-...` header + L-brackets at 4 corners) renders N times — once per card. Visually noisy.

### 7.2. Fix

Move chrome out of per-card markup into a single outer wrapper. Add `chrome.show: boolean` and `chrome.position: 'outer' | 'card'` to the renderer contract (§4.3). For list/multi views: chrome always `position: 'outer'`, rendered once around the active selection. For single-banner export: chrome always `position: 'card'`. This is a one-line CSS scope fix in `styles.css` plus a markup hoist in `app.js`.

## 8. Sprint plan — 4 waves

Branch convention: `wave-h-*`, `wave-i-*`, `wave-j-*`, `wave-k-*` (continues `wave-a..g`). Each wave merges to `main` before next starts. **Token-contract is locked at end of Wave 1** — Wave 2+ agents are forbidden from changing token shape.

### Wave H — Foundation (5 agents, sequential within wave)

**Branch:** `wave-h-tokens-foundation`

| Agent | Task | Output |
|-------|------|--------|
| H1 | Create `data/tokens/{primitive,semantic,component}.json` | New files |
| H2 | Extend `scripts/build-labs.mjs` with 3-layer resolver | Updated script |
| H3 | Migrate `data/labs/{x26,s3,core}.json` to overlay-only shape | Updated JSONs |
| H4 | Add `mode: terminal\|editorial` and `bg` axes to lab schema | Schema + validation |
| H5 | Smoke test: `npm run build:labs` produces stable `labs.bundle.js` | Test passes |

**Gate to Wave 2:** `labs.bundle.js` byte-stable, all existing renders pixel-equal to current main.

### Wave I — Renderer parallelization (7 agents, fully parallel)

**Branch:** `wave-i-renderers` (each agent on subbranch `wave-i-renderers/<agent>`, merged into wave-i then wave-i → main)

| Agent | Task |
|-------|------|
| I1 | Refactor `mosaicCoverMarkup` to consume new contract (no visual change) |
| I2 | Refactor `fieldCoverMarkup` + pull to mosaic-quality density |
| I3 | Refactor `rosterCoverMarkup` + simplify badge load |
| I4 | New `cardsCoverMarkup` in `mode: editorial` — soft shadows, paper surface |
| I5 | Hoist chrome to outer wrapper, add `chrome.show/position` |
| I6 | New backdrop layer rendering (consumes `bg.src` dataUrl) |
| I7 | Edit UI sidebar shell (no font-size yet, just layout) |

**Gate:** all 4 layouts render without console errors in `npm run smoke:ui`.

### Wave J — AI integration + Edit UI fill-in (7 agents)

**Branch:** `wave-j-ai-and-edit`

| Agent | Task |
|-------|------|
| J1 | Extend `netlify/functions/generate-bg.mjs` with FLUX.2 Pro/Klein paths |
| J2 | Copy 5 canonical prompts from ain-visuals → `data/backdrops/s3-prompts.json` |
| J3 | Wire prompt picker UI (style dropdown + custom-prompt textarea) |
| J4 | Implement client-side post-processing (desaturate + duotone + scrim) |
| J5 | Cache layer (`localStorage`-backed for MVP) |
| J6 | Edit UI: numeric font-size inputs + live binding to canvas |
| J7 | Persistence: `copy.fontSizes` namespace round-trips through export/import |

**Gate:** generate s3 banner with circuit backdrop end-to-end, verify visual coherence with ain-visuals reference plate.

### Wave K — Docs, smoke, deploy (~5 agents, sequential)

**Branch:** `wave-k-docs-deploy`

| Agent | Task |
|-------|------|
| K1 | Update `claude-designs/README.md` + regenerate `design-tokens.jsx` |
| K2 | Add `docs/design-system.md` documenting axes, modes, bg pipeline |
| K3 | Extend `scripts/smoke-ui.mjs` to cover all 4 layouts × 2 modes × 3 bg types |
| K4 | Update `og-cover.html` with new design system |
| K5 | Deploy + verify `dig +short ai-studio.aimindset.org @8.8.8.8` resolves; fall back to netlify default if pending |

## 9. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Token-contract drift between waves | End-of-Wave-H tag in git: `tokens-v1`. Wave I+ agents read from this tag, not HEAD. |
| FLUX.2 Pro 5xx in production | Auto-fallback to Klein → Gemini Flash → cached default plate (5 PNGs shipped in repo) |
| Mosaic regresses pixel-wise | Visual snapshot test in Wave H gate (Playwright `toMatchSnapshot`) |
| Multi-agent merge conflicts in `app.js` (4582-line monolith) | Wave I splits monolith into `app/{render-mosaic,render-field,...}.js` modules first; each agent owns one file |
| User sees "nothing changed" feeling (your earlier comment) | Wave H ends with a visible diff: lab dropdown shows `mode` + `bg` selectors even if defaults render identically |
| OpenRouter API key for FLUX.2 not provisioned | Verify in Wave H pre-flight via `curl` test; surface to user before Wave J starts |
| Backwards-compatible exports break | Wave H smoke includes export-old-format-import-new-format roundtrip |

## 10. Acceptance criteria

A reviewer must be able to confirm each:

1. ✅ All 4 layouts (field/mosaic/roster/cards) render across all 3 labs with no console errors
2. ✅ Mosaic visual is pixel-equal to pre-sprint screenshot (zero regression)
3. ✅ Cards layout uses editorial mode by default; terminal toggle hidden when layout=cards
4. ✅ s3 banner with `bg: ai-generated:circuit` produces a teal-monochrome plate consistent with ain-visuals reference
5. ✅ Multi-card preview shows exactly **one** chrome wrapper (not N)
6. ✅ Edit UI sidebar has numeric font-size input next to each editable text; size persists through export/import
7. ✅ `npm run sync:designs` regenerates `claude-designs/design-tokens.jsx` reflecting new 3-layer model
8. ✅ `docs/design-system.md` exists and documents the 3 axes
9. ✅ Cost: each AI bg generation logs `costUsd` to console; FLUX.2 Pro path tested to be < $0.05/image
10. ✅ Netlify deploy succeeds; live URL serves new build

## 11. Files touched (estimate)

```
NEW
  data/tokens/primitive.json
  data/tokens/semantic.json
  data/tokens/component.json
  data/backdrops/s3-prompts.json
  app/render-field.js
  app/render-mosaic.js
  app/render-roster.js
  app/render-cards.js
  app/render-chrome.js
  app/edit-sidebar.js
  app/bg-pipeline.js
  docs/design-system.md
  docs/plans/2026-04-28-aim-studio-design-system-design.md (THIS DOC)

MODIFIED
  app.js                              (split into app/* modules; thinner)
  index.html                          (sidebar markup, mode/bg selectors)
  styles.css                          (chrome scoping, editorial mode tokens)
  data/labs/s3.json                   (mode + bg overlay)
  data/labs/x26.json                  (mode + bg overlay)
  data/labs/core.json                 (mode + bg overlay)
  netlify/functions/generate-bg.mjs   (FLUX paths, model param)
  scripts/build-labs.mjs              (3-layer resolver)
  scripts/sync-claude-designs.mjs     (emit new schema)
  scripts/smoke-ui.mjs                (extend matrix)
  claude-designs/design-tokens.jsx    (regenerated)
  claude-designs/README.md            (axis vocabulary)
  README.md                           (high-level overview update)
```

## 12. Next step (post-approval)

1. Commit this design doc to `main`.
2. Invoke `superpowers:writing-plans` to expand each wave into a per-agent execution plan with explicit file boundaries, contracts, and gates.
3. Start Wave H from `main` via `superpowers:using-git-worktrees`.
4. Run waves sequentially; within wave, agents go parallel via `superpowers:dispatching-parallel-agents`.
5. After each wave merge to `main`, run smoke tests; gate to next wave.
