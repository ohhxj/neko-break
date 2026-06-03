# Component Specification

Date: 2026-05-11

## Component Foundation

Create shared primitives before page refactors:

- `src/components/ui/Button.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/Switch.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/IconButton.tsx`
- `src/components/ui/SegmentedControl.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/SceneCard.tsx`

All components should consume `src/styles/tokens.css`.

## Button

Variants:

- `primary`: green filled, used for "立即休息", "正在使用", primary scene actions.
- `accent`: purple filled, used for "保存设置", "完成", "保存场景".
- `secondary`: white surface with border, used for "测试弹窗", "取消", "设为当前".
- `ghost`: transparent or near-transparent, used for low-emphasis controls.
- `danger`: red text, no heavy fill, used for "删除场景".
- `icon`: square icon-only button, used for close, add, more.

Sizes:

- `sm`: 32px height
- `md`: 40px height
- `lg`: 56px height

States:

- default
- hover
- active
- focus-visible
- disabled
- selected
- loading, only if async operation is visible

Design notes:

- Default radius is 8-12px, not full pill.
- Include icons for action buttons when the design shows them.
- Do not use emoji as production icons.

## Card

Variants:

- `section`: outer page section, white surface, subtle border.
- `metric`: dashboard metric tile, fixed min-height, large value.
- `control`: form row/card.
- `scene`: scene library tile.
- `preview`: media preview container.

States:

- default
- selected
- focused
- disabled
- warning/missing

Design notes:

- Border should carry most visual separation.
- Shadow should be subtle.
- No decorative gradient stripe.
- Card radius should be consistent at 16px unless nested content requires 12px.

## Input And Select

Shared dimensions:

- height: 36-40px
- radius: 8-10px
- border: `--color-border`
- background: `--color-control-bg`
- font size: 13-14px

States:

- default
- focus-visible
- disabled
- invalid

Required controls:

- numeric stepper for interval/break/duration
- text input for scene name and close button label
- search input for scene library
- select/dropdown for sorting and style hint

## Switch

Dimensions:

- width: 44-46px
- height: 26-28px
- thumb: 20-22px

States:

- on
- off
- disabled
- focus-visible

Design notes:

- On state uses green.
- Off state uses warm gray.
- Thumb should be white with light shadow.

## Badge

Variants:

- `current`: green filled/tint, "当前使用".
- `configured`: green tint, "已配置".
- `missing`: orange tint, "缺少退场" or "未配置".
- `new`: purple tint, "新添加".
- `optional`: neutral tint, "可选".
- `required`: green or neutral, "必填".

Design notes:

- Scene library badges should be compact and high-readability.
- Avoid overly round or oversized badges.

## Segmented Control

Used for scene library filters:

- 全部
- 已配置
- 缺少片段
- 最近添加

Design notes:

- Container is a rounded white/neutral capsule.
- Active segment uses green fill in the design source.
- Text weight: 600.

## Modal

Scene library modal:

- centered
- width near 996px on 1516px viewport
- max height near 770px
- radius 12-14px
- backdrop: dark translucent blur
- footer separated by a top border

Structure:

- header with title/subtitle, search, add, close
- toolbar with tabs and sort select
- content grid with scene cards and right detail panel
- footer with count, cancel, done

## Scene Detail Panel

The design source shows an integrated right-side panel inside the scene library modal. Treat it as a `SceneDetailPanel`, not a global drawer.

Sections:

- header: title, scene name, collapse button
- basic info
- material clips
- display and behavior
- preview
- footer actions

States:

- expanded inside modal
- collapsed back to selection summary
- disabled fields for built-in scenes, where needed

## Scene Card

Content:

- cover thumbnail
- status badge
- overflow menu button
- scene name
- clip summary and duration
- primary action
- detail action

States:

- default
- selected/current
- configured
- missing clip
- newly added
- hover
- focus-visible

Design notes:

- Current card border is green.
- Focused but not selected card should not use a second competing purple outline unless the design explicitly requires keyboard focus.
- Three-dot menu is always visible in the top-right corner.

