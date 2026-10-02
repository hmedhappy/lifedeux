# Medelys — brand handoff

- `logo/` — vector logos (traced from the source logo, outlined, flat hex fills) + 1024px PNGs
- `favicon/` — favicon.svg/.ico (16/32/48), PWA icons, apple-touch-icon, og-image
- `loading/` — spinner.svg, splash.svg (CSS-animated, reduced-motion aware), skeleton.md + mockup
- `system/` — tokens.json, tokens.css (with Tailwind 4 `@theme` block), guidelines.md, components.png

theme-color: `#014D7D`

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#014D7D">
<meta property="og:image" content="/og-image.png">
```

Manifest icons: icon-192.png, icon-512.png (purpose "any"), icon-512-maskable.png (purpose "maskable").
