# Skeleton placeholders

Mockup: `skeleton-mockup.png`

- **Base fill:** `--color-skeleton-base` #E6ECEF on white/surface cards. On `canvas` (#F4F7F8) pages, place skeletons inside a white card.
- **Highlight:** `--color-skeleton-highlight` #F4F7F8, a soft band ~40% of the element's width.
- **Shapes match the real content:** text lines 12px tall (16px for titles), radius `--radius-sm` 6px; avatars are circles; buttons and images use the radius of the real component (`--radius-md` 10px / `--radius-lg` 14px). The last line of a paragraph is 60–70% width.
- **Shimmer:** linear-gradient(90deg, base 0%, highlight 45%, base 90%), background-size 800px, moving **1.4s linear, infinite**. Direction follows reading direction: left→right in LTR, right→left in RTL (`[dir=rtl]` reverses the keyframes).
- **Timing:** show skeletons only if loading takes > 300ms; swap to content with a 150ms fade.
- **Accessibility:** container gets `aria-busy="true"`, skeleton elements `aria-hidden="true"`.
- **Reduced motion:** `prefers-reduced-motion: reduce` → no shimmer; static base fill at full opacity.

```css
.skeleton { background: linear-gradient(90deg, var(--color-skeleton-base) 0%, var(--color-skeleton-highlight) 45%, var(--color-skeleton-base) 90%); background-size: 800px 100%; border-radius: var(--radius-sm); animation: shimmer 1.4s linear infinite; }
@keyframes shimmer { from { background-position: -400px 0 } to { background-position: 400px 0 } }
[dir="rtl"] .skeleton { animation-direction: reverse; }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; background: var(--color-skeleton-base); } }
```

## Other loaders
- `spinner.svg` — 48px, uses `currentColor` (defaults to brand #014D7D). Inline it and set `color: #fff` on teal/brand backgrounds. Reduced motion: static 3/4 arc.
- `splash.svg` — logomark breathes (scale 0.96) and the cross pulses, 2.4s loop. Reduced motion: static logomark. Center it on `canvas` at 120–160px.
- No Lottie: both animations are simple enough to stay as native SVG/CSS.
