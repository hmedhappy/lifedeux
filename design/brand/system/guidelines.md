# Medelys — brand guidelines (short)

## Colour
- **brand #014D7D** — primary buttons, links, active tab, header logo. White text on it: 8.9:1.
- **brand-dark #003965** — hover/pressed for brand, dark sections, footer.
- **brand-soft #E6F0F7** — selected rows, info panels, the patient's chat bubble.
- **brand-bright #2A86C8** — focus rings, progress, illustrations only (not for text).
- **accent #017680** (teal, from the leaf and cross) — secondary highlights, online status, "consultation" moments. White on it: 5.4:1.
- **accent-ink #075E5C** on **accent-soft #E3F4F3** — teal badges and tags.
- **trip #A84B24** / **trip-soft #FBEDE5** — only for the surgery + medical-stay journey (travel steps, stay badges, itinerary). Never for errors.
- **ink #12304F** headings/body, **ink-soft #2B4560** secondary text, **muted #5B6B7A** captions (5.5:1 on white).
- **line #DCE4E8** dividers, **line-strong #B7C4CC** input borders.
- **canvas #F4F7F8** page ground, **surface/white** cards.
- **Status:** success #1E7A4C, warning #9A5B00, danger #C0352B, info #1F6FB2. Each has a `-soft` background; put the strong colour on its soft background for text.
- **theme-color:** `<meta name="theme-color" content="#014D7D">`
- **Never** put white text on any `-soft` colour or on brand-bright. Gradients: only the brand → accent bar on marketing visuals; never behind text in the UI.

## Typography
- Latin: **Poppins** 400 / 500 / 600. Arabic: **Tajawal** 400 / 500 / 700 (same geometric, low-contrast feel). Switch with `:lang(ar)`.
- Body 16px / 1.6. Headings 600, 1.2. Arabic: same sizes and +0.1 line height. No letter-spacing on Arabic.

## Logo
- Files: horizontal (header), stacked (splash, emails), logomark (avatar, app icon), white versions for brand/teal/dark grounds.
- **Clear space:** the height of the cross on every side.
- **Minimum size:** horizontal 24px high; logomark 16px (use favicon.svg below 24px).
- The wordmark stays in Latin letters and the logo is **never mirrored** in RTL. Only its position moves (header start = right side in Arabic).
- Don't recolour, stretch, add shadows/outlines, rotate, put on photos without a solid panel, or use the full-colour logo on brand/teal grounds (use white).

## Buttons (height 44px, radius md 10px, 16px/500, padding 0 20px)
- **Primary:** brand fill, white text. Hover brand-dark. Disabled: line fill, muted text.
- **Secondary:** white fill, 1px line-strong border, brand text. Hover brand-soft fill.
- **Ghost:** no border, brand text. Hover brand-soft fill.
- **Danger:** danger fill, white text. Hover #9E2A22.
- Focus: 2px brand-bright outline, 2px offset. Min touch target 44px. One primary per view.
- Icons in buttons mirror in RTL only if directional (arrows, chevrons).

## Layout & motion
- 4px spacing base (4, 8, 12, 16, 24, 32, 48, 64). Cards: white, radius lg 14px, shadow-card, 1px line border.
- Use logical CSS properties (`margin-inline-start`, `ps-*`/`pe-*` in Tailwind) so RTL mirrors automatically.
- Motion: 150ms hover, 250ms panels, 400ms page. Easing cubic-bezier(0.2,0,0,1). Respect prefers-reduced-motion.

## Tone
Calm, clear, reassuring. Short sentences, plain words, no medical jargon without explanation. Speak to the patient ("your consultation"), never alarmist. Same tone in FR, EN and AR.
