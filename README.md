# Neko Break

Neko Break 是一个可爱的桌面休息提醒工具。它会按你设置的节奏弹出透明小猫素材，提醒你离开屏幕、活动肩颈、喝水和认真休息一下。

> 代码采用 Source Available 半开源许可。你可以阅读、学习和提交反馈，但不能未经授权商用、二次分发、复刻品牌或复用内置素材。

## 下载

正式安装包会发布在 GitHub Releases：

[下载最新版 Neko Break](https://github.com/ohhxj/mac-break-reminder/releases/latest)

| 平台 | 安装包 | 说明 |
| --- | --- | --- |
| macOS Apple Silicon | `Neko Break_0.1.1_aarch64.dmg` | 适用于 M 系列芯片 Mac |
| Windows x64 | `Neko Break_0.1.1_x64-setup.exe` | 适用于 64 位 Windows |

当前安装包暂未做代码签名。macOS 首次打开时可能需要在系统设置中允许打开，Windows 可能会出现安全提示。

## 适合谁

- 长时间写代码、设计、剪辑、运营、写作的人
- 想要一个不冰冷的休息提醒工具的人
- 喜欢自定义桌面小猫、桌宠、透明视频素材的人

## 功能

- 固定间隔休息提醒
- 陪伴时间与免打扰时间
- 今日暂停与立即休息
- 休息记录、真实休息时长、提前结束/延后统计
- 透明素材休息弹窗
- 场景库与自定义场景导入
- Mac 菜单栏 / Windows 托盘状态
- 支持作者与素材共创社群入口

## 素材格式

Neko Break 当前强调透明背景素材：

- macOS：推荐带 Alpha 通道的 `.mov`
- Windows：推荐带透明通道的 `.webm`
- 普通视频也可以用于全屏休息场景，但不能产生桌面透明悬浮效果

MOV 转 WebM 可使用：

```bash
ffmpeg -i input.mov \
  -c:v libvpx-vp9 \
  -pix_fmt yuva420p \
  -auto-alt-ref 0 \
  -b:v 0 \
  -crf 24 \
  output.webm
```

## 本地开发

环境要求：

- Node.js
- Rust
- Tauri CLI
- macOS 构建 Windows 包时需要 `cargo-xwin` 和 `llvm-rc`

安装依赖：

```bash
npm install
```

运行开发环境：

```bash
npm run tauri:dev
```

构建 macOS：

```bash
npm run tauri:build
```

构建 Windows：

```bash
PATH="/opt/homebrew/opt/llvm/bin:$PATH" \
npm exec tauri -- build \
  --runner cargo-xwin \
  --config src-tauri/tauri.windows.conf.json \
  --target x86_64-pc-windows-msvc
```

测试：

```bash
npm test -- --run
```

## 半开源说明

这个仓库用于公开项目进展、安装包、问题反馈和部分源码。以下内容不代表可以自由复用：

- Neko Break 品牌、名称、图标和视觉风格
- 内置小猫素材、封面图、光标图、休息卡片图
- 社群二维码、赞赏二维码
- 打包产物、签名配置、未来商业化能力

如果你想基于 Neko Break 做二次开发、商用合作、素材合作或重新分发，请先联系作者。

## 反馈与路线

欢迎在 Issues 里提交：

- Bug 反馈
- Windows / macOS 兼容性问题
- 透明素材导入问题
- 休息逻辑建议
- 素材场景建议

路线和问题分级见 [项目管理说明](docs/project-management.md)。

## 作者

作者：小水

Neko Break 仍在快速迭代中，如果它真的让你多休息了一分钟，那它今天就算工作得不错。
