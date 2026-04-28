# AIM Studio · Claude Designs Prerequisite Pack

Paste-ready folder for mirroring the **aim-studio** banner generator design system inside **Claude Designs** (the claude.ai canvas product).

This is a **manual mirror**, not a deploy. Claude Designs has no public CLI / API, so we sync via file upload. Tokens stay authoritative in **`data/tokens/*.json`** (DTCG primitive → semantic → component layer cake, regenerated with the lab overlays from `data/labs/*.json`); the `.jsx` artifact below is regenerated and re-uploaded whenever those JSONs change.

---

## **3-axis design system**

Every artifact in this pack — and every banner the live studio renders — is parameterised on three orthogonal axes:

| Axis | Values | Source |
|------|--------|--------|
| **layout** | `field` · `mosaic` · `roster` · `cards` | `app/render-{field,mosaic,roster,cards}.js` |
| **mode** | `terminal` · `editorial` (cards locks editorial) | `state.designMode` derived from layout |
| **decorative-bg** | `plain` · `mesh-token` · `ai-generated:<style>` | `app/bg-layer.js` + `netlify/functions/generate-bg` |

`DESIGN_TOKENS` in `design-tokens.jsx` resolves the **lab overlay** (axes defaults + accent + fonts + speakers + program copy). The DTCG layer cake — primitive → semantic → component — sits underneath and is built from `data/tokens/{primitive,semantic,component}.json` via `scripts/build-labs.mjs`. **`data/tokens/` is the canonical source for shared design primitives**; lab JSONs only override what differs.

---

## **Quick Start**

### **Step 1 — Create the Claude Designs project**

1. Open [claude.ai](https://claude.ai)
2. **Settings → Projects → New Design Project**
3. Suggested name: `AIM Studio · Multi-Lab Design System`
4. Description: `Paste-ready tokens & components for x26 / s3 / core lab brands. Synced from aim-studio repo.`

### **Step 2 — Upload files (in this order)**

Upload **one at a time** into the project's Files panel:

1. `design-tokens.jsx` — the canonical token bundle (x26, s3, core)
2. `styles.css` — fonts, reset, lab CSS variables
3. `components/sprint-banner.jsx` — 3:1 hero banner (1800×600)
4. `components/speaker-card.jsx` — 4:5 speaker portrait (1080×1350)
5. `components/lab-poster.jsx` — square modality poster (1080×1080)
6. `components/evergreen-block.jsx` — 3:1 mauve core block (1500×500)
7. `sample-prompts.md` — reference prompts to paste into Claude chat

Order matters because later components reference `DESIGN_TOKENS` from `design-tokens.jsx`.

### **Step 3 — Use in chat**

Reference `DESIGN_TOKENS` directly in any Claude chat inside the project:

> Generate a sprint banner for **x26** lab using `DESIGN_TOKENS`. Eyebrow: "AI MINDSET · SPRING LAB X26". Title: "spring lab {x26}". Dates: "27 APR – 25 MAY 2026".

> Render a `<SpeakerCard labId="s3" name="Sereja Ris" role="curator" week="W1" />` using the s3 token palette.

See [`sample-prompts.md`](./sample-prompts.md) for more examples.

### **Step 4 — Sync after token changes**

Whenever you edit `data/labs/x26.json`, `s3.json`, or `core.json` in the repo:

```bash
npm run sync:designs
```

This regenerates `claude-designs/design-tokens.jsx`. **Re-upload it** to the Claude Designs project (overwrite the previous version). Components don't change unless you manually iterate them.

---

## **Why manual?**

Claude Designs (canvas) has **no API and no CLI**. There's no programmatic way to push files into a project. The trade-off:

- **Pro:** tokens live in one source of truth (`data/labs/*.json`)
- **Pro:** Claude Designs canvas can iterate visually without breaking the deploy pipeline
- **Con:** every token change → manual re-upload of `design-tokens.jsx`

Acceptable cost. The sync script keeps the artifact deterministic so re-uploads are mechanical.

---

## **File map**

```
claude-designs/
  README.md                       ← this file
  design-tokens.jsx               ← AUTO-GENERATED, do not edit
  styles.css                      ← shared fonts, reset, lab vars
  sample-prompts.md               ← reference chat prompts
  components/
    sprint-banner.jsx             ← 3:1 hero (1800×600)
    speaker-card.jsx              ← 4:5 portrait (1080×1350)
    lab-poster.jsx                ← square poster (1080×1080)
    evergreen-block.jsx           ← 3:1 core (1500×500)
```

## **Lab quick reference**

| Lab | Accent | Use |
|-----|--------|-----|
| **x26** | `#16a34a` green | Spring Lab x26 — 27 Apr – 25 May 2026 |
| **s3** | `#8ddff2` blue | AI-Native Sprint S3 — 2 May – 25 May 2026 |
| **core** | `#a78bfa` mauve | Evergreen / cross-cohort content |

---

## **Linked rules**

- AIM logo canonical path: `/Users/alex/My Drive/AI mindset/pics/logo_light.png`
- Source repo: `/Users/alex/Documents/_code/_generators/aim-studio/`
- Sync script: `/Users/alex/Documents/_code/_generators/aim-studio/scripts/sync-claude-designs.mjs`
