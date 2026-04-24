# Sample Prompts · AIM Studio Claude Designs

Paste any of these into the chat panel of your Claude Designs project. They reference `DESIGN_TOKENS` exported from `design-tokens.jsx`.

Mix Russian and English freely — that's how the AIM team writes.

---

## **1. Sprint banner — x26**

> Render `<SprintBanner labId="x26" />` using DESIGN_TOKENS. Pull eyebrow, title, accentTitle, dates, footer from the x26 token set automatically. Show it at full 1800×600 size in the canvas.

## **2. Sprint banner — s3 with custom title**

> Render `<SprintBanner labId="s3" />`, but override the title to "vol 2" and accentTitle to "{ainative}". Keep dates and footer from the s3 tokens. Use IBM Plex Mono.

## **3. Speaker card — x26 W2 image guest**

> Build `<SpeakerCard labId="x26" name="Олег Цербаев" role="image guest · W2" week="W2" modalityLabel="image" telegram="@oleg" />`. Use a placeholder portrait silhouette if no photo. The W2 badge should be violet (#a78bfa) per x26 weekAccents.

## **4. Speaker card — s3 curator**

> Generate `<SpeakerCard labId="s3" name="Sereja Ris" role="curator" week="W1" modalityLabel="setup" telegram="@ris" />`. Use a soft gradient placeholder for the photo. Lab stripe at the bottom should read "AI-Native Sprint S3".

## **5. Lab poster — x26 modality grid**

> Render `<LabPoster labId="x26" />` at 1080×1080. Pull title "spring lab", accent "{x26}", dates "27 APR – 25 MAY 2026" from tokens. The 4-modality row should use weekAccents: W1 amber → text, W2 violet → image, W3 blue → audio, W4 green → code.

## **6. Lab poster — s3 variant**

> Render `<LabPoster labId="s3" />`. Auto-fill title "ai-native sprint", accent "{s3}", dates "2 MAY – 25 MAY 2026". Modalities should use s3 weekAccents (cyan, mint, magenta, gold).

## **7. Evergreen block — FOS announcement**

> Build `<EvergreenBlock headline="Founder OS · Spring Workshop" sub="онлайн воркшоп · 4 ч + 30 дней практики" cta="Записаться →" ctaUrl="https://aimindset.org/fos" />`. Mauve accent only. No roster, no week badges. Single CTA button on the right.

## **8. Evergreen block — Substack digest**

> Generate `<EvergreenBlock headline="AI Mindset Digest · апрель 2026" sub="лучшее за месяц · видео · разборы · карточки" cta="Read on Substack" ctaUrl="https://aimindset.substack.com" />`. Same mauve treatment, just text + CTA at 1500×500.

---

## **Tips**

- Reference `DESIGN_TOKENS.x26.weekAccents.W2` directly in chat to ask for specific colors.
- All text in components is `contentEditable` — drag a component into canvas, click on text, and edit inline.
- When in doubt about which lab to use:
  - **x26** — Spring Lab (Apr–May 2026)
  - **s3** — AI-Native Sprint (May 2026)
  - **core** — anything evergreen / cross-cohort / Founder OS
- After token JSON edits in the source repo, run `npm run sync:designs` and re-upload `design-tokens.jsx`.
