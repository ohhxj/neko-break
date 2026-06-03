# Neko Break Visual Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the MVP frontend into alignment with the supplied settings, scene library, and scene detail design screenshots.

**Architecture:** First centralize visual decisions into tokens and shared UI primitives, then rebuild the app shell and one standard page before migrating modal and detail panel surfaces. The settings page is the standard page because it contains the full product layout, preview, controls, and scene entry points.

**Tech Stack:** React 18, TypeScript, Vite, Tauri API integration, CSS modules via global CSS files.

---

## File Structure

- Create: `src/styles/tokens.css` for colors, typography, spacing, radius, shadows, and layout constants.
- Modify: `src/main.tsx` or `src/styles/app.css` import path to ensure `tokens.css` loads before app styles.
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Switch.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/IconButton.tsx`
- Create: `src/components/ui/SegmentedControl.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/SceneCard.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/TopStatusBar.tsx`
- Create: `src/components/layout/BottomActionBar.tsx`
- Modify: `src/app/App.tsx` to compose app shell and page sections.
- Modify: `src/features/dashboard/DashboardScreen.tsx` to match the "今日节奏" design.
- Modify: `src/features/settings/SettingsScreen.tsx` to match "提醒规则" and "弹出方式".
- Modify: `src/features/media-library/MediaLibraryScreen.tsx` to use the scene strip, modal, summary panel, and integrated detail panel.
- Modify: `src/styles/app.css` to remove obsolete visual rules after replacements land.

## Task 1: Add Design Tokens

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create token stylesheet**

Create `src/styles/tokens.css` using the values from `docs/design/tokens.md`. Include `:root` variables for color, typography, spacing, radius, shadow, and layout.

- [ ] **Step 2: Import tokens before app styles**

Update `src/main.tsx` so token styles load before `app.css`:

```ts
import "./styles/tokens.css";
import "./styles/app.css";
```

- [ ] **Step 3: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete without errors.

## Task 2: Build UI Primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Select.tsx`
- Create: `src/components/ui/Switch.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/IconButton.tsx`
- Create: `src/components/ui/SegmentedControl.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Add typed primitive components**

Each primitive should accept `className`, children where relevant, and native element props. Keep behavior minimal; styling should come from component class names and tokens.

- [ ] **Step 2: Add primitive styles**

Add styles for:

- `.ui-button`
- `.ui-card`
- `.ui-field`
- `.ui-select`
- `.ui-switch`
- `.ui-badge`
- `.ui-icon-button`
- `.ui-segmented`

Use the variants and states defined in `docs/design/components.md`.

- [ ] **Step 3: Replace no page code yet**

Do not migrate pages in this task. Verify primitives compile independently.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: build passes.

## Task 3: Rebuild App Shell

**Files:**
- Create: `src/components/layout/AppShell.tsx`
- Create: `src/components/layout/TopStatusBar.tsx`
- Create: `src/components/layout/BottomActionBar.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Move topbar markup into `TopStatusBar`**

Props should include brand name, icon, next break label, interval label, break duration, countdown, enabled state, and start-break handler.

- [ ] **Step 2: Move footer markup into `BottomActionBar`**

Props should include selected scene, scheduler copy, test handler, and save/start handler.

- [ ] **Step 3: Wrap page with `AppShell`**

`AppShell` owns traffic lights, top status bar, main content slot, and bottom action bar.

- [ ] **Step 4: Align shell styles**

Use tokens for app max width, topbar height, footer height, page padding, radius, and shadows.

- [ ] **Step 5: Screenshot validation**

Run Vite and capture:

```bash
npm run dev -- --host 127.0.0.1
npx playwright screenshot --viewport-size=1516,1045 http://127.0.0.1:1420/ docs/design/current/settings-after-shell.png
```

Expected: top and bottom bars visually move toward the design screenshot without changing page behavior.

## Task 4: Refactor Standard Page Layout

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/dashboard/DashboardScreen.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/features/media-library/MediaLibraryScreen.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Match three-column layout**

Use layout tokens:

- left column: today rhythm
- middle column: reminder rules and popup method
- right column: realtime preview and scene library

- [ ] **Step 2: Update dashboard labels and metrics**

The four cards should be:

- 间隔
- 休息
- 剩余时间
- 弹出模式

- [ ] **Step 3: Merge reminder inputs and switches**

`SettingsScreen` should render a "提醒规则" card containing interval input, break duration input, and three switches.

- [ ] **Step 4: Keep popup method as the second middle card**

Render two option cards: "可爱弹窗" and "全屏播放".

- [ ] **Step 5: Update preview and scene strip hierarchy**

Right column should match:

- "实时预览"
- current scene selector row
- preview stage
- metadata chips
- "场景库" strip

- [ ] **Step 6: Screenshot validation**

Capture `docs/design/current/settings-after-standard-page.png` at 1516x1045 and compare to `/Users/reshui/Desktop/已生成图像 1.png`.

Expected: visual structure, column widths, header/footer placement, card spacing, and type hierarchy match the design direction.

## Task 5: Rebuild Scene Library Modal

**Files:**
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/SceneCard.tsx`
- Modify: `src/features/media-library/MediaLibraryScreen.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Add modal header controls**

Add search input, add video button, and close icon button.

- [ ] **Step 2: Add toolbar controls**

Add segmented filters and sort select. If search/sort/filter are initially visual-only, keep their state local and non-destructive.

- [ ] **Step 3: Replace current scene grid cards with `SceneCard`**

Each card should show thumbnail, badge, overflow menu, title, clip summary, set-current action, and detail action.

- [ ] **Step 4: Rebuild right selected summary panel**

Match the design summary: preview, scene fields, clip status chips, primary/secondary/test actions, and help copy.

- [ ] **Step 5: Add footer count, cancel, and done**

Footer must match design hierarchy.

- [ ] **Step 6: Screenshot validation**

Capture `docs/design/current/library-after-refactor.png` and compare to `/Users/reshui/Desktop/场景库页面.png`.

Expected: modal proportions, controls, card hierarchy, selected panel, and footer match the design screenshot.

## Task 6: Replace Fullscreen Drawer With Integrated Detail Panel

**Files:**
- Modify: `src/features/media-library/MediaLibraryScreen.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Remove fixed viewport drawer behavior**

Replace `.scene-drawer-backdrop` and `.scene-drawer` usage with an integrated right panel inside the modal.

- [ ] **Step 2: Implement detail panel header**

Use title "场景详情", scene name subtitle, and "收起" button.

- [ ] **Step 3: Match detail sections**

Render:

- 基础信息
- 素材片段
- 展示与行为
- 预览

- [ ] **Step 4: Add behavior controls**

Render switches for follow-global popup mode and auto-close after countdown, plus numeric countdown control.

- [ ] **Step 5: Match footer actions**

Use delete, cancel, and save scene hierarchy from the screenshot.

- [ ] **Step 6: Screenshot validation**

Capture `docs/design/current/drawer-after-refactor.png` and compare to `/Users/reshui/Desktop/抽屉页面.png`.

Expected: detail panel is inside the scene library modal, not a full viewport drawer.

## Task 7: Clean Obsolete CSS And Verify

**Files:**
- Modify: `src/styles/app.css`
- Modify: affected component files only if class names change

- [ ] **Step 1: Remove obsolete gradient-heavy rules**

Remove outdated rules for old panel gradients, pill default buttons, extra radial backgrounds, and old drawer overlay.

- [ ] **Step 2: Run tests**

Run:

```bash
npm run test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 3: Final screenshot set**

Capture:

```bash
docs/design/current/settings-final-1516x1045.png
docs/design/current/library-final-1516x1045.png
docs/design/current/drawer-final-1516x1045.png
```

Expected: screenshots are close enough to the supplied design sources for manual review.

## Execution Recommendation

Use subagent-driven execution for Tasks 1-2 and Task 7 because they are separable. Execute Tasks 3-6 sequentially because layout, standard page, modal, and detail panel build on each other.

