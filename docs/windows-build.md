# Windows Build

## Environment

- Windows 10 or Windows 11
- Visual Studio Build Tools with the Desktop development with C++ workload
- Rust stable with the `x86_64-pc-windows-msvc` target
- Node.js 20+
- WebView2 Runtime (included with current Windows 10/11; the installer can bootstrap it when missing)

## Build

```powershell
npm ci
npm run test
npm run tauri:build:windows
```

The Windows installers are written under:

```text
src-tauri\target\release\bundle\nsis
src-tauri\target\release\bundle\msi
```

## Windows Media Policy

- Import VP9-alpha `.webm` files.
- A scene still consists of a required loop clip plus optional intro and outro clips.
- Imported clips and generated PNG covers are copied into the app config directory, so normal installer upgrades preserve them.
- The bundled Windows preset resolves `cat-intro.webm` and `cat-loop.webm`; macOS continues to resolve the matching `.mov` resources.

## Tray Behavior

Windows does not support text next to a notification-area icon. Neko Break therefore exposes the current countdown through the tray tooltip and the first disabled tray menu row. The tray icon, click behavior, pause action, start-break action, and close-to-tray behavior remain available.
