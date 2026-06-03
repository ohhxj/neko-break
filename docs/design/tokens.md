# Design Tokens

Date: 2026-05-11

## Source Of Truth

Primary visual source is the supplied screenshot set:

- Settings page: `/Users/reshui/Desktop/已生成图像 1.png`
- Scene library modal: `/Users/reshui/Desktop/场景库页面.png`
- Scene detail panel: `/Users/reshui/Desktop/抽屉页面.png`

No Figma frame URL is available in the workspace yet. Until a Figma frame is provided, these images are the visual facts. Do not mix in styling from earlier MVP screens unless this document explicitly allows it.

## Token Files To Create

Target file:

- `src/styles/tokens.css`

`src/styles/app.css` should eventually consume these tokens rather than defining one-off values.

## Color Tokens

```css
:root {
  --color-bg-window: #f7f1e8;
  --color-bg-surface: #fffdf8;
  --color-bg-surface-soft: #fbf7ef;
  --color-bg-preview: #f0ece5;
  --color-bg-overlay: rgba(16, 18, 18, 0.42);

  --color-text-strong: #162b27;
  --color-text: #253733;
  --color-text-muted: #61716d;
  --color-text-soft: #8a928f;
  --color-text-inverse: #ffffff;

  --color-border: #eadfce;
  --color-border-strong: #d9cbb8;
  --color-border-focus: #7d5ff3;

  --color-primary: #2f8a6f;
  --color-primary-hover: #28765f;
  --color-primary-soft: #dff1e8;

  --color-accent: #7f5cf0;
  --color-accent-hover: #6e4ddb;
  --color-accent-soft: #eee8ff;

  --color-warning: #e9783d;
  --color-warning-soft: #fff0e6;
  --color-danger: #f05c51;

  --color-control-bg: #ffffff;
}
```

## Typography Tokens

Use system UI fonts for macOS fidelity.

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif;

  --text-hero: 40px;
  --text-title: 24px;
  --text-section: 16px;
  --text-body: 14px;
  --text-small: 12px;
  --text-micro: 11px;

  --line-tight: 1.1;
  --line-title: 1.25;
  --line-body: 1.45;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-heavy: 800;
}
```

Rules:

- Avoid negative letter spacing for Chinese labels.
- Use heavy weight only for hero numbers, metric values, and selected scene names.
- Keep metadata at 12px, not below 11px.

## Spacing Tokens

Use a compact desktop scale.

```css
:root {
  --space-2: 2px;
  --space-4: 4px;
  --space-6: 6px;
  --space-8: 8px;
  --space-10: 10px;
  --space-12: 12px;
  --space-16: 16px;
  --space-18: 18px;
  --space-20: 20px;
  --space-24: 24px;
  --space-28: 28px;
  --space-32: 32px;
}
```

Recommended use:

- app shell padding: `18px`
- topbar padding: `20px 24px`
- card padding: `18px`
- modal padding: `24px 30px`
- component gap: `8px` or `12px`
- page grid gap: `12px`

## Radius Tokens

```css
:root {
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-pill: 999px;
}
```

Rules:

- Buttons use `--radius-sm` or `--radius-md`, not pill by default.
- Cards use `--radius-lg`.
- Topbar and bottom bar use `--radius-xl`.
- Pills and switches are the only default `999px` components.

## Shadow Tokens

```css
:root {
  --shadow-card: 0 8px 24px rgba(88, 70, 42, 0.06);
  --shadow-modal: 0 24px 72px rgba(20, 25, 24, 0.24);
  --shadow-button: 0 8px 18px rgba(110, 77, 219, 0.20);
  --shadow-soft: 0 4px 14px rgba(88, 70, 42, 0.05);
}
```

Rules:

- Prefer border + subtle shadow over stacked gradients.
- Avoid large decorative radial backgrounds in primary UI surfaces.
- Modal backdrop blur should be visible but not milky.

## Layout Tokens

```css
:root {
  --app-max-width: 1480px;
  --app-min-width: 1180px;
  --topbar-height: 132px;
  --footer-height: 104px;

  --dashboard-col: 386px;
  --settings-col: 510px;
  --studio-col: 556px;

  --scene-modal-width: 996px;
  --scene-modal-max-height: 770px;
  --scene-detail-width: 316px;
}
```

These values are starting points extracted from the screenshots and should be refined with browser screenshot comparison.

