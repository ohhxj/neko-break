# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

`Neko Break`（仓库名 `mac-break-reminder`）——一个仅支持 macOS 的菜单栏休息提醒应用，基于 Tauri 2 + React + TypeScript 构建。范围刻意限定在 macOS；产品定位是「俏皮的、媒体驱动的休息伙伴」，不是强制锁屏类工具。产品意图见 [docs/superpowers/specs/2026-04-28-mac-break-reminder-design.md](docs/superpowers/specs/2026-04-28-mac-break-reminder-design.md)。

## 常用命令

- `npm run tauri:dev` — 主开发入口；启动 Tauri 外壳，由它通过 `beforeDevCommand` 拉起 `vite`（端口 `1420`，strict 模式）。
- `npm run dev` — 仅前端（无原生外壳，`isTauri()` 为 false，所有 Tauri-only 代码路径被跳过）。
- `npm run build` — `tsc -p tsconfig.json && vite build` → 输出到 `dist/`。Tauri 的 `beforeBuildCommand` 也会调用它。
- `npm run tauri:build` — 产出可签名的 macOS 应用包。Bundle id 为 `com.reshui.mac-break-reminder`，产品名 `Neko Break`。
- `npm test` / `npm run test:watch` — Vitest，运行环境为 `node`（见 [vite.config.ts](vite.config.ts)）。跑单个文件：`npx vitest run tests/unit/scheduler-reconcile.test.ts`。按用例名筛选：`npx vitest run -t "restarts counting"`。
- Rust 侧：`cd src-tauri && cargo check` / `cargo test`。没有单独的 lint 配置，依赖 `tsc` + `cargo check`。

## 架构

### 双窗口 Tauri 外壳

定义在 [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)：

- **`main`** — 设置 / 仪表盘 / 媒体库 UI。
- **`overlay`** — 透明、置顶、无边框的休息覆盖窗。默认隐藏，通过 `show_overlay` 命令调出。

两个窗口加载同一份 React bundle。[src/app/App.tsx](src/app/App.tsx) 根据 `getCurrentWindow().label` 分支：`overlay` 标签只渲染 `<BreakOverlay>`，`main` 标签渲染完整 shell。**任何修改调度器状态或与 tray 通信的逻辑都必须用 `currentWindowLabel === "main"` 守卫**，否则两个窗口会互相打架。

跨窗口通信使用 Tauri 事件（`emitTo("overlay", "break-preview", payload)`）加上 `invoke()` 调原生命令。overlay 窗口订阅 `break-preview` 来接收 `OverlayPayload`。

### 调度器在前端

调度器是一段纯 TS 状态机，位于 [src/domain/breaks/scheduler.ts](src/domain/breaks/scheduler.ts)，返回 `SchedulerSnapshot`（`idle | counting | break_active | delayed | paused_today`）。每秒一次的 tick 是 `App.tsx` 里的 `setInterval`。Rust 的 `commands::scheduler` 模块虽然存在，但实际的循环目前由前端持有 —— Rust 只在 `AppState` 里被动持有一份 `SchedulerSnapshot`。

设置变更走 [src/domain/breaks/reconcile.ts](src/domain/breaks/reconcile.ts)，由它决定是重启倒计时、保持当前休息、还是从暂停恢复。**设置保存后调度器的变化必须经过 `reconcileSchedulerAfterSettingsChange`**，不要直接 setState `scheduler`。

### macOS 原生 MOV-alpha 覆盖

`.webm` 在 WebView 内播放。带 alpha 通道的 `.mov` 通过 `objc2` 把 `AVPlayerLayer` 挂到 overlay 窗口 `NSWindow` 的 content view 上（见 [src-tauri/src/native_overlay.rs](src-tauri/src/native_overlay.rs)）。前端通过给 `show_overlay` 传 `nativeMedia` 且 `format: "mov_alpha"` 来触发这条路径。指针（`layer_ptr`、`player_ptr`、`looper_ptr`）暂存在 `AppState::native_overlay` 中，便于 hide 时清理。所有用到 `objc2_*` 系列 crate 的代码都必须 `#[cfg(target_os = "macos")]` 门控 —— 必须保持这点，因为 `lib` crate 在其他平台上仍要能构建以支持测试。

### 媒体模型：Scene 与 Clip

`SceneAsset`（[src/domain/media/types.ts](src/domain/media/types.ts)）打包了最多三个 `SceneClip`：`introClip`（入场）、`loopClip`（循环，必填）、`outroClip`（退场），外加展示提示（`overlayStyleHint`、`closeButtonLabel`、`copyTheme`）。`MediaAsset` 是 `SceneAsset` 的过渡别名，新代码请直接用 `SceneAsset`。`primaryClip(scene)` 返回循环 clip。

预设场景放在 [src/domain/media/presets.ts](src/domain/media/presets.ts)。用户导入的场景由 Rust 的 `media_store` 持久化，再用 `mergeAssets(presetAssets, loaded)` 合并进列表。

### Tauri 命令面

在 [src-tauri/src/main.rs](src-tauri/src/main.rs) 注册：

- `commands::media` — `load_media`、`import_media`、`import_clip`、`probe_media`、`save_scene`、`delete_scene`、`load_preview_image`、`remove_black_background`。
- `commands::settings` — `load_settings`、`save_settings`（JSON 写到 `app_config_dir/settings.json`，加载时会做迁移，见 [src-tauri/src/persistence/settings_store.rs](src-tauri/src/persistence/settings_store.rs)）。
- `commands::window` — `show_overlay`、`hide_overlay`、`update_overlay_media`，以及 `update_tray_{tooltip,title,pause_label,pause_enabled}`。
- `commands::scheduler` — 命令存在，但当前 UI 基本没用到。

前端用 store 包裹这些命令：`createSettingsStore` / `createMediaStore` 接收一个 `invoke` 函数，便于测试注入伪实现。`App.tsx` 里传入 `@tauri-apps/api/core` 的 `invoke`；测试里传 stub。

### Tray

托盘菜单由 Rust 管理（[src-tauri/src/tray.rs](src-tauri/src/tray.rs)）。前端每次调度器 snapshot 变化时，通过 `invoke` 调 `update_tray_*` 命令把标题 / tooltip / 暂停标签同步过去。托盘菜单点击会触发窗口事件（`tray-start-break`、`tray-pause-today`），由主窗口监听。

### 前端布局

- [src/app/App.tsx](src/app/App.tsx) — 根组件，持有调度器状态、设置、素材、overlay payload，以及所有跨窗口协调逻辑。又大又中心化，大多数行为改动都落在这里。
- [src/features/](src/features) — 屏幕级 UI（`setup`、`dashboard`、`settings`、`media-library`、`overlay`、`menu-bar`）。屏幕只负责展示，状态都在 `App.tsx`。
- [src/domain/](src/domain) — 纯逻辑 + 类型（`breaks`、`media`、`settings`、`brand`）。被测试 import 的代码必须保持无 Tauri / DOM 依赖。
- [src/lib/](src/lib) — 框架小适配器（`tauri.ts`、`time.ts`）。

### 测试

Vitest，`node` 环境。测试对象是纯 domain 模块 —— 调度器、展示辅助函数、注入 `invoke` stub 的 store。**不要在 domain 代码里 import `@tauri-apps/api/*`**，否则会破坏测试环境。

## 值得记住的约定

- 文案是简体中文。新增用户可见字符串时，参考 [src/features/menu-bar/status.ts](src/features/menu-bar/status.ts) 里的语气。
- 设置序列化两侧都是 `camelCase` —— Rust struct 用 `#[serde(rename_all = "camelCase")]`。新加字段时保持一致，或在 `migrate_settings_value` 里加迁移分支。
- [src/domain/settings/defaults.ts](src/domain/settings/defaults.ts) 里的 `defaults` 必须和 Rust 侧 [src-tauri/src/domain/settings.rs](src-tauri/src/domain/settings.rs) 的 `AppSettings::default()` 保持一致。
- 导入的媒体先在前端用 `probeMediaFile` 校验和探测，再交给 Rust；不支持的格式在导入时直接拒绝。
