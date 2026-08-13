# Neko Break v0.1.2

这个版本完善了休息倒计时、互动场景以及 Windows 素材导入体验。

## 应该下载哪个文件？

安装 Neko Break 时，只需要下载与你电脑系统对应的安装包；素材包和转换器都是可选内容。

| 你的需求 | 下载文件 | 适用情况 |
| --- | --- | --- |
| 在 Mac 上安装 Neko Break | `Neko.Break_0.1.2_aarch64.dmg` | 适用于 Apple Silicon 芯片的 Mac，包括 M1、M2、M3、M4 等；当前未提供 Intel Mac 安装包 |
| 在 Windows 上安装 Neko Break | `Neko.Break_0.1.2_x64-setup.exe` | 适用于 64 位 Windows 10 / 11；安装包已内置 FFmpeg，普通用户下载这个文件即可 |
| 下载免费透明猫咪素材 | `Neko.Break_Transparent_Cat_Assets_WebM.zip` | 主要供 Windows 版使用；解压后把其中的 WebM 文件导入场景库 |
| 单独转换 MOV 素材 | `Neko.WebM.Converter_0.1.0_x64-setup.exe` | 可选的 Windows 转换工具，适合在应用外把透明 MOV 转成 WebM；正常在 Neko Break 中导入 MOV 时不需要下载 |

> Mac 用户下载 `.dmg`，Windows 用户下载名称中带 `x64-setup.exe` 的安装包。不要把素材包或转换器当成主程序安装包。

## 主要更新

- 循环场景支持添加并命名多个互动动作，休息弹窗中右键即可触发
- 互动动作播放结束后自动回到默认循环素材
- 循环与互动素材采用预加载叠层切换，修复切换时闪白和素材中断
- 修复应用从隐藏状态恢复时任务栏倒计时连续快速跳秒的问题
- 修复托盘菜单更新可能导致的程序死锁和崩溃
- Windows 导入 MOV 时增加处理状态提示，并隐藏 FFmpeg 命令行窗口
- Windows 安装包内置固定版本的 LGPL FFmpeg，用户不需要另外安装

## 已知限制

- 当前安装包暂未使用开发者证书签名或平台公证
- Windows 当前主要提供 NSIS `.exe` 安装包
- macOS 推荐透明 MOV，Windows 推荐透明 WebM；素材格式混用时无法使用无缝叠层播放

## 许可

源码采用 Source Available 半开源许可。允许学习和反馈，不允许未经授权商用、二次分发、复刻品牌或复用内置素材。
