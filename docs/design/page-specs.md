# Page Specifications

Date: 2026-05-11

## Visual Source Decision

The supplied image screenshots are the current source of truth:

1. Settings page: `/Users/reshui/Desktop/已生成图像 1.png`
2. Scene library modal: `/Users/reshui/Desktop/场景库页面.png`
3. Scene detail panel: `/Users/reshui/Desktop/抽屉页面.png`

If a Figma frame becomes available, compare it against these screenshots before replacing this source. Until then, use these images for layout, color, type, spacing, and state decisions.

## Standard Page

Use the settings page as the standard page for the rescue. It contains all major product surfaces:

- app shell
- top status bar
- dashboard metrics
- settings form controls
- preview card
- scene strip
- bottom action bar
- modal entry point

Do not begin by refactoring scene library modal. First make the settings page match the design language; then migrate modal and detail panel using the same primitives.

## App Shell

Desktop layout:

- centered window content
- warm off-white background
- macOS traffic lights at top-left
- app title text beside traffic lights
- content max width around 1480px
- body padding around 18px
- section gap around 12px

Topbar:

- brand block at left with icon and "Neko Break"
- centered next-break title and timer
- right-side enable switch and primary break button
- white translucent surface with subtle border
- height close to design screenshot, not oversized

Footer:

- left current configuration block with icon and selected scene name
- right action buttons: test preview and save settings
- same visual language as topbar
- should not feel like a floating sticky web CTA; it is part of the desktop app frame

## Settings Main Page

Body columns:

- left: Today rhythm
- middle: Reminder rules and popup method
- right: Realtime preview and scene library

Left column:

- title: 今日节奏
- four metric cards in a 2x2 grid:
  - 间隔
  - 休息
  - 剩余时间
  - 弹出模式
- action buttons:
  - 立即休息
  - 延后一次
  - 今日暂停

Middle column:

- Reminder rules card:
  - 休息间隔 numeric input
  - 休息时长 numeric input
  - 开机自动启动 switch
  - 允许今日暂停 switch
  - 允许延迟一次 switch
- Popup method card:
  - 可爱弹窗 option
  - 全屏播放 option

Right column:

- Realtime preview:
  - scene selector row
  - preview stage
  - metadata chips
- Scene library strip:
  - title and default-scene select
  - visible scene tiles
  - add video tile
  - more tile

Acceptance criteria:

- Visual structure matches the settings design screenshot.
- Header height matches the screenshot within about 8px.
- Main columns align with the screenshot and do not collapse on desktop.
- Card gaps and internal padding use tokens, not ad hoc values.
- Metric cards show the same information hierarchy as the design.
- Button states are consistent and no longer globally pill-shaped.
- The page remains usable at medium desktop widths.

### Pixel Acceptance Targets For 1505x1045 Source

Use `/Users/reshui/Desktop/已生成图像 1.png` as the measurement source.

- window titlebar: traffic lights around `x=14, y=16`, title around `x=100, y=17`
- topbar: `x=18, y=44, w=1469, h=132`
- body top: `y=199`
- body column gap: about `12px`
- left column: `x=19, w=384, h=689`
- middle column: `x=414, w=506, h=689`
- right column: `x=932, w=556, h=689`
- left metric card: about `165x154`
- primary left action button: about `336x56`
- preview card: about `h=432`
- scene library card: about `h=232`
- footer: `x=19, y=913, w=1469, h=103`

Current page should fit within a 1516x1045 Playwright viewport without full-page screenshot height exceeding the viewport by more than 8px.

## Scene Library Modal

Structure:

- centered modal over blurred/dimmed settings page
- header:
  - title "场景库"
  - subtitle "管理全部视频场景，选择当前使用的治愈片段"
  - search input
  - add video button
  - close icon button
- toolbar:
  - tabs: 全部, 已配置, 缺少片段, 最近添加
  - sort dropdown: 按更新时间排序
- content:
  - left scene card grid
  - right current selected summary panel
- footer:
  - left count: 共 18 个场景
  - right buttons: 取消, 完成

Acceptance criteria:

- Modal width and height match screenshot proportions.
- Search, add, close, tabs, sort, count, cancel, and done controls exist.
- Scene cards match image ratio, badge location, action row, and selected state.
- Right summary panel matches information density and action hierarchy.
- Backdrop preserves visible but subdued settings page.

## Scene Detail Panel

Structure:

- integrated right-side panel inside the scene library modal
- left scene grid remains visible
- right panel title: 场景详情
- collapse button: 收起

Sections:

- 基础信息
- 素材片段
- 展示与行为
- 预览
- footer actions

Acceptance criteria:

- Detail panel is not a full viewport drawer.
- Panel width follows the screenshot proportion.
- Scene grid and panel share one modal shell.
- Fields align as compact label/control rows.
- Clip slots show optional/required/configured/missing states.
- Preview stage is compact and visually aligned with modal preview.
- Footer actions match delete/cancel/save hierarchy.

## Responsive Expectations

Desktop first:

- 1516x1045 is the primary validation viewport.
- 1280px wide should not overlap or truncate primary controls.
- Modal should stay within viewport with internal scroll only where needed.

Mobile/narrow fallback:

- Three columns collapse to one column.
- Scene strip becomes horizontal scroll or two-column grid.
- Scene library modal becomes near-fullscreen.
- Detail panel stacks below or replaces the grid with a clear back/collapse action.
