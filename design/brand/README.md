# Brand assets (source files)

Drop the files from Claude Design here, then push. They are the *sources*:
the website copies what it needs into `public/` and `src/app/` when the new
identity is applied.

| Folder | What to put | Preferred formats |
| --- | --- | --- |
| `logo/` | Main logo, logo mark (icon only), horizontal / stacked versions, light and dark variants | SVG (best), plus PNG 1024 px |
| `favicon/` | Favicon and app icons | SVG, `favicon.ico`, PNG 32 / 180 (Apple) / 192 / 512 |
| `loading/` | Loading states: spinner, skeletons, splash | SVG, Lottie JSON, GIF/MP4, or screenshots + notes |
| `system/` | Design system: colours, fonts, spacing, radius, shadows, component screenshots | Markdown / JSON tokens, CSS, PDF or PNG exports |

Tips:
- Name files clearly, e.g. `logo-horizontal-dark.svg`, `logomark.svg`.
- If the design system is a Claude Design link (claude.ai/…), paste the link in
  `system/LINKS.md` instead of exporting it.
