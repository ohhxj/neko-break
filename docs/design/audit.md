# Frontend Visual Audit

Date: 2026-05-11

## Scope

This audit compares the current MVP frontend against the supplied design screenshots:

- Design source, settings page: `/Users/reshui/Desktop/已生成图像 1.png`
- Design source, scene library modal: `/Users/reshui/Desktop/场景库页面.png`
- Design source, scene detail drawer: `/Users/reshui/Desktop/抽屉页面.png`

Current implementation screenshots captured from Vite:

- `docs/design/current/settings-current-1516x1045.png`
- `docs/design/current/library-current-1516x1045.png`
- `docs/design/current/drawer-current-1516x1045.png`

Relevant implementation files:

- `src/app/App.tsx`
- `src/features/dashboard/DashboardScreen.tsx`
- `src/features/settings/SettingsScreen.tsx`
- `src/features/media-library/MediaLibraryScreen.tsx`
- `src/styles/app.css`

## Summary

The gap is not only token-level. Color, type, spacing, radius, and shadow tokens are inconsistent with the screenshots, but the larger mismatch is structural: the current MVP still reflects an earlier "compact control center" model, while the design source is a precise desktop settings workspace with a top status header, three-column body, bottom action bar, scene-oriented library modal, and an integrated right-side scene detail panel.

This means the rescue should not start by tuning isolated CSS values. The foundation needs to be rebuilt first: design tokens, primitive UI components, app shell layout, card system, modal/drawer primitives, then page-by-page replacement.

## 1. Page Structure Differences

### Settings Page

- Design uses a macOS-like app window: traffic lights, app title, a wide top status bar, a three-column body, and a bottom configuration/action bar.
- Current `App.tsx` has a topbar and three-column grid, but the body composition differs:
  - left column is `DashboardScreen`
  - middle column is `SettingsScreen`
  - right column combines preview and `MediaLibraryScreen`
- Design left column is "今日节奏" with four metric cards plus action buttons.
- Current left column uses different labels: "休息时长", "当前状态", "倒计时", "弹出方式".
- Design middle column has "提醒规则" and "弹出方式"; current middle column splits rhythm and preference rules into three separate panels.
- Design right column has "实时预览" and "场景库"; current right column has a more verbose reminder preview plus a separate default scene row above scene strip.
- Design bottom bar has "当前配置" at left and two actions at right. Current bottom bar exists but is sticky, uses heavier styling, and copy differs.

### Scene Library Modal

- Design modal contains:
  - title/subtitle
  - search input
  - add video button
  - close icon
  - filter tabs
  - sort dropdown
  - three-column scene grid
  - right detail summary
  - footer with count, cancel, done
- Current modal lacks search and sort as functional/visual controls.
- Current modal title says "管理全部视频场景"; design title hierarchy starts with "场景库" and subtitle below.
- Current scene cards expose technical metadata such as file size, resolution, and transparency; design cards emphasize scene state, title, clip mode, duration, and actions.
- Current footer only has completion copy and "完成"; design has scene count on the left and "取消 / 完成" on the right.

### Scene Detail Drawer

- Design drawer is integrated as the modal's right detail panel, not a full-screen side overlay.
- Current implementation opens a fixed full-height drawer above the modal.
- Design keeps the scene grid visible and narrows the library content; current overlay covers the right side of the full viewport.
- Design drawer header uses "场景详情", scene name subtitle, and a "收起" button. Current header uses an eyebrow plus title and a generic close button.

## 2. Information Hierarchy Differences

- Design hero strongly emphasizes "下一次休息 18:29"; current H1 is similar in content but weaker in scale, spacing, and numeric emphasis.
- Design dashboard metric cards prioritize large numeric values and short labels. Current card labels are more product-state oriented and not aligned with the visual hierarchy.
- Design "提醒规则" puts number inputs first, then toggle rows in one enclosed block. Current settings split related controls, reducing scanning speed.
- Design preview selector puts "当前场景：" inline before the preview. Current preview uses a separate `asset-summary` block and supporting copy.
- Design scene library cards are visually led by cover image, status badge, scene name, and concise clip summary. Current cards include additional low-priority metadata.
- Design right detail panel presents scene fields as compact key-value rows. Current detail summary uses stacked cards, causing lower information density.
- Design drawer groups "基础信息", "素材片段", "展示与行为", "预览". Current drawer has similar groups but inserts summary badges and extra "设为默认场景" action, making the primary save/edit flow less direct.

## 3. Spacing Differences

- Design outer shell uses about 18-20px page padding and 12-16px inter-card gaps. Current CSS uses mixed values: `.shell` ends at 24px padding and 18px gap, with older 32px/24px rules still present earlier in the file.
- Design topbar height is compact but stable. Current topbar is taller and more decorative because of gradients, shadows, and 20-24px padding.
- Design cards use consistent internal padding around 18px. Current panels vary between 8px, 10px, 12px, 14px, 16px, 18px, and 20px without a token system.
- Design dashboard metric cards are taller and visually balanced. Current `.stats div` use `min-height: 126px`, but internal label/value placement differs from the mock.
- Design modal grid spacing is tighter and more regular. Current `.media-modal-grid` has 12px gap, card padding 10px, and variable image heights.
- Design drawer uses compact sections with about 10-12px vertical rhythm. Current drawer uses mixed section gaps and larger full-height padding.

## 4. Typography Differences

- Current global font is `"Avenir Next", "Helvetica Neue", sans-serif`; design appears closer to macOS system UI typography for Chinese content.
- Current root font size is 14px. Design uses a clearer scale: 12px metadata, 14px body, 16px section titles, 20-24px page/module titles, and 32-40px hero number.
- Current CSS uses negative letter spacing in multiple places (`-0.04em`, `-0.05em`, `-0.06em`). Design does not show aggressive negative tracking for Chinese labels.
- Current button and card labels often use `font-weight: 800/900`; design uses heavy weight for values and titles, but buttons and labels are closer to 600-700.
- Current small text is often `0.68rem` to `0.72rem`, which reads smaller than design subtitles and chip labels.

## 5. Color Differences

- Design background is a warm off-white desktop surface. Current body uses strong orange and purple radial gradients.
- Design cards are near-white with subtle warm borders. Current cards often use stacked radial and linear gradients.
- Design primary green is muted and solid. Current green `#1f7a63` plus gradients can look darker and heavier.
- Design purple action buttons are blue-violet with a restrained shadow. Current purple buttons use `#9b74ff` to `#7554df` with stronger shadow.
- Design semantic badges use distinct states:
  - current/in use: green
  - configured: green-tint
  - missing: orange
  - newly added: purple
- Current badges mostly reuse green or generic labels such as "内置推荐" and "我的导入".

## 6. Radius And Shadow Differences

- Design outer cards usually sit around 12-18px radius. Current CSS has many 22px, 24px, 28px, 30px, 32px, and `999px` radii.
- Design buttons are rounded rectangles. Current global `button` rule forces `border-radius: 999px`, causing over-pill styling.
- Design modal shadow is present but soft. Current modal uses `0 30px 90px rgba(...)`, which is heavier.
- Design inner cards use light borders and minimal elevation. Current panels use multiple inset shadows and decorative gradients.
- Current `.settings-panel::before` adds a vertical gradient stripe that is not in the design.

## 7. Missing Component States

- Scene library search input is missing.
- Scene library sort dropdown is missing.
- Scene library close icon button does not match the design's icon-only close control.
- Scene library footer lacks "取消".
- Scene card three-dot overflow menu is missing.
- Scene card state variants are incomplete: current, configured, missing outro, newly added.
- Scene clip chips in the detail panel do not match the design's compact state pills.
- Drawer "收起" state is missing.
- Drawer "展示与行为" switches and countdown stepper are missing as a design-matched group.
- Button states are not centralized: primary, secondary, ghost, danger, disabled, icon-only, and selected states are distributed across ad hoc selectors.
- Input/select focus and disabled states are not tokenized.

## 8. Responsive Problems

- Current responsive behavior has only one breakpoint at `max-width: 720px`, which is insufficient for a desktop app with large modal and three-column layout.
- Main layout uses fixed three-column minimums: `280px / 360px / 380px`. Medium-width windows can squeeze text and scene controls.
- Scene library modal remains a three-column grid inside `84vw`, which becomes too narrow on medium screens.
- Drawer uses `width: min(390px, 92vw)` and full viewport height. This does not match the design's integrated right-panel behavior.
- Scene strip uses fixed grid assumptions: three scene tiles plus add and more cards. It needs overflow behavior or a breakpoint.
- Preview uses `aspect-ratio: 16 / 9`, but the design preview has a more fixed card height and stable media/HUD placement.

## Rescue Judgment

The current mismatch is structural. Tokens alone will improve color, type, spacing, radius, and shadows, but they will not make the page match the screenshots. The recommended path is:

1. Freeze the supplied screenshots as the visual source of truth.
2. Extract and implement tokens.
3. Rebuild primitive components.
4. Rebuild app shell and layout.
5. Use the settings page as the standard page.
6. Replace scene library modal and detail panel after the standard page is stable.

