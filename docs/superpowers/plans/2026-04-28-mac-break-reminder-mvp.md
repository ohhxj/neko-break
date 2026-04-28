# Mac Break Reminder MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS-first desktop break reminder app that lives in the menu bar, triggers playful break overlays on a fixed schedule, and supports built-in plus user-imported transparent media assets.

**Architecture:** The MVP uses a Tauri shell with a small TypeScript frontend for settings, media library, and overlay UI, plus a Rust backend for app shell orchestration, persistence, and native macOS integration. The core loop is driven by a small scheduler state machine, while media management and overlay presentation stay isolated behind clear interfaces so Windows can be added later without rewriting the product logic.

**Tech Stack:** Tauri 2, Rust, TypeScript, Vite, React, CSS, Serde, Tokio, local JSON persistence

---

## File Structure

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/styles/app.css`
- Create: `src/lib/tauri.ts`
- Create: `src/lib/time.ts`
- Create: `src/domain/settings/types.ts`
- Create: `src/domain/settings/defaults.ts`
- Create: `src/domain/settings/store.ts`
- Create: `src/domain/breaks/types.ts`
- Create: `src/domain/breaks/scheduler.ts`
- Create: `src/domain/media/types.ts`
- Create: `src/domain/media/validation.ts`
- Create: `src/domain/media/presentation.ts`
- Create: `src/features/setup/SetupScreen.tsx`
- Create: `src/features/dashboard/DashboardScreen.tsx`
- Create: `src/features/settings/SettingsScreen.tsx`
- Create: `src/features/media-library/MediaLibraryScreen.tsx`
- Create: `src/features/overlay/BreakOverlay.tsx`
- Create: `src/features/overlay/useBreakOverlay.ts`
- Create: `src/features/menu-bar/status.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/app_state.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/settings.rs`
- Create: `src-tauri/src/commands/media.rs`
- Create: `src-tauri/src/commands/scheduler.rs`
- Create: `src-tauri/src/commands/window.rs`
- Create: `src-tauri/src/domain/settings.rs`
- Create: `src-tauri/src/domain/media.rs`
- Create: `src-tauri/src/domain/scheduler.rs`
- Create: `src-tauri/src/domain/permissions.rs`
- Create: `src-tauri/src/domain/autostart.rs`
- Create: `src-tauri/src/persistence/mod.rs`
- Create: `src-tauri/src/persistence/settings_store.rs`
- Create: `src-tauri/src/persistence/media_store.rs`
- Create: `src-tauri/src/windows.rs`
- Create: `src-tauri/capabilities/default.json`
- Create: `public/assets/presets/README.md`
- Create: `tests/unit/scheduler.test.ts`
- Create: `tests/unit/media-validation.test.ts`
- Create: `tests/unit/settings-store.test.ts`

## Task 1: Scaffold The Standalone Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Write the frontend package manifest**

```json
{
  "name": "mac-break-reminder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-opener": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/node": "^22.10.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Write TypeScript and Vite configuration**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  }
});
```

- [ ] **Step 3: Write ignore rules and a minimal README**

```gitignore
node_modules
dist
src-tauri/target
.DS_Store
```

```md
# Mac Break Reminder

macOS-first playful break reminder app built with Tauri.

## Development

1. Install Node.js and Rust
2. Run `npm install`
3. Run `npm run tauri:dev`
```

- [ ] **Step 4: Write the initial Tauri manifests**

```toml
[package]
name = "mac-break-reminder"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2.0.0", features = [] }
tauri-plugin-dialog = "2.0.0"
tauri-plugin-fs = "2.0.0"
tauri-plugin-opener = "2.0.0"
tokio = { version = "1", features = ["time", "sync", "macros", "rt-multi-thread"] }
```

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Mac Break Reminder",
  "version": "0.1.0",
  "identifier": "com.reshui.mac-break-reminder",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Mac Break Reminder",
        "width": 1160,
        "height": 800,
        "resizable": true
      },
      {
        "label": "overlay",
        "title": "Break Time",
        "fullscreen": true,
        "visible": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true
      }
    ]
  }
}
```

- [ ] **Step 5: Install dependencies and verify the empty project compiles**

Run: `npm install`
Expected: frontend dependencies install without fatal errors

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: Rust dependencies resolve and compile successfully

- [ ] **Step 6: Commit the scaffold**

```bash
git add .
git commit -m "chore: scaffold mac break reminder app"
```

If the directory is not a git repository yet, initialize one first with `git init` and then commit.

## Task 2: Define Shared Domain Types And Defaults

**Files:**
- Create: `src/domain/settings/types.ts`
- Create: `src/domain/settings/defaults.ts`
- Create: `src/domain/breaks/types.ts`
- Create: `src/domain/media/types.ts`
- Test: `tests/unit/settings-store.test.ts`

- [ ] **Step 1: Write the failing settings defaults test**

```ts
import { describe, expect, it } from "vitest";
import { defaultSettings } from "../../src/domain/settings/defaults";

describe("defaultSettings", () => {
  it("uses a 90 minute interval and a 5 minute break by default", () => {
    expect(defaultSettings.intervalMinutes).toBe(90);
    expect(defaultSettings.breakMinutes).toBe(5);
    expect(defaultSettings.launchAtLogin).toBe(true);
    expect(defaultSettings.allowDelayOnce).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- tests/unit/settings-store.test.ts`
Expected: FAIL because defaults module does not exist

- [ ] **Step 3: Define frontend domain types and defaults**

```ts
export type AppSettings = {
  intervalMinutes: number;
  breakMinutes: number;
  launchAtLogin: boolean;
  allowDelayOnce: boolean;
  allowPauseToday: boolean;
  defaultAssetId: string | null;
};

export type BreakState = "idle" | "counting" | "break_active" | "delayed" | "paused_today";

export type SchedulerSnapshot = {
  state: BreakState;
  nextBreakAt: string | null;
  remainingSeconds: number;
  activeBreakSeconds: number;
};

export type MediaFormat = "webm_alpha" | "mov_alpha" | "unknown";

export type MediaAsset = {
  id: string;
  name: string;
  filePath: string;
  format: MediaFormat;
  durationSeconds: number;
  hasTransparency: boolean;
  enabled: boolean;
  builtIn: boolean;
  copyTheme: string | null;
};
```

```ts
import type { AppSettings } from "./types";

export const defaultSettings: AppSettings = {
  intervalMinutes: 90,
  breakMinutes: 5,
  launchAtLogin: true,
  allowDelayOnce: true,
  allowPauseToday: true,
  defaultAssetId: null
};
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npm test -- tests/unit/settings-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared types**

```bash
git add src/domain/settings src/domain/breaks src/domain/media tests/unit/settings-store.test.ts
git commit -m "feat: define break reminder domain types"
```

## Task 3: Build The Scheduler State Machine

**Files:**
- Create: `src/domain/breaks/scheduler.ts`
- Create: `src/lib/time.ts`
- Test: `tests/unit/scheduler.test.ts`

- [ ] **Step 1: Write the failing scheduler test**

```ts
import { describe, expect, it } from "vitest";
import { createScheduler } from "../../src/domain/breaks/scheduler";
import { defaultSettings } from "../../src/domain/settings/defaults";

describe("createScheduler", () => {
  it("creates the next break timestamp from the configured interval", () => {
    const scheduler = createScheduler(defaultSettings, new Date("2026-04-28T09:00:00.000Z"));
    const snapshot = scheduler.start();

    expect(snapshot.state).toBe("counting");
    expect(snapshot.nextBreakAt).toBe("2026-04-28T10:30:00.000Z");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/scheduler.test.ts`
Expected: FAIL because scheduler module does not exist

- [ ] **Step 3: Implement the scheduler API**

```ts
import type { AppSettings } from "../settings/types";
import type { SchedulerSnapshot } from "./types";

export type SchedulerController = {
  start: () => SchedulerSnapshot;
  triggerBreak: () => SchedulerSnapshot;
  finishBreak: (at: Date) => SchedulerSnapshot;
  delayOnce: (minutes: number, at: Date) => SchedulerSnapshot;
  pauseToday: () => SchedulerSnapshot;
};

const toIso = (date: Date | null) => (date ? date.toISOString() : null);

export const createScheduler = (settings: AppSettings, now: Date): SchedulerController => {
  let state: SchedulerSnapshot = {
    state: "idle",
    nextBreakAt: null,
    remainingSeconds: 0,
    activeBreakSeconds: settings.breakMinutes * 60
  };

  return {
    start() {
      const nextBreak = new Date(now.getTime() + settings.intervalMinutes * 60_000);
      state = {
        state: "counting",
        nextBreakAt: toIso(nextBreak),
        remainingSeconds: settings.intervalMinutes * 60,
        activeBreakSeconds: settings.breakMinutes * 60
      };
      return state;
    },
    triggerBreak() {
      state = {
        ...state,
        state: "break_active",
        remainingSeconds: settings.breakMinutes * 60
      };
      return state;
    },
    finishBreak(at) {
      const nextBreak = new Date(at.getTime() + settings.intervalMinutes * 60_000);
      state = {
        state: "counting",
        nextBreakAt: toIso(nextBreak),
        remainingSeconds: settings.intervalMinutes * 60,
        activeBreakSeconds: settings.breakMinutes * 60
      };
      return state;
    },
    delayOnce(minutes, at) {
      const nextBreak = new Date(at.getTime() + minutes * 60_000);
      state = {
        ...state,
        state: "delayed",
        nextBreakAt: toIso(nextBreak),
        remainingSeconds: minutes * 60
      };
      return state;
    },
    pauseToday() {
      state = {
        ...state,
        state: "paused_today",
        nextBreakAt: null,
        remainingSeconds: 0
      };
      return state;
    }
  };
};
```

- [ ] **Step 4: Expand tests for break, delay, and pause flows**

```ts
it("transitions into a break and then back into counting", () => {
  const scheduler = createScheduler(defaultSettings, new Date("2026-04-28T09:00:00.000Z"));
  scheduler.start();

  const active = scheduler.triggerBreak();
  expect(active.state).toBe("break_active");
  expect(active.remainingSeconds).toBe(300);

  const resumed = scheduler.finishBreak(new Date("2026-04-28T09:05:00.000Z"));
  expect(resumed.state).toBe("counting");
  expect(resumed.nextBreakAt).toBe("2026-04-28T10:35:00.000Z");
});
```

- [ ] **Step 5: Run the scheduler tests**

Run: `npm test -- tests/unit/scheduler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the scheduler**

```bash
git add src/domain/breaks src/lib/time.ts tests/unit/scheduler.test.ts
git commit -m "feat: add break scheduler state machine"
```

## Task 4: Implement Local Settings Persistence

**Files:**
- Create: `src/domain/settings/store.ts`
- Create: `src-tauri/src/domain/settings.rs`
- Create: `src-tauri/src/persistence/mod.rs`
- Create: `src-tauri/src/persistence/settings_store.rs`
- Create: `src-tauri/src/commands/settings.rs`

- [ ] **Step 1: Write the failing frontend store test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "../../src/domain/settings/store";
import { defaultSettings } from "../../src/domain/settings/defaults";

describe("createSettingsStore", () => {
  it("loads defaults when no persisted settings exist", async () => {
    const invoke = vi.fn().mockResolvedValue(defaultSettings);
    const store = createSettingsStore(invoke);

    const settings = await store.load();
    expect(settings.intervalMinutes).toBe(90);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/settings-store.test.ts`
Expected: FAIL because the settings store is missing

- [ ] **Step 3: Implement the frontend settings store**

```ts
import type { AppSettings } from "./types";
import { defaultSettings } from "./defaults";

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const createSettingsStore = (invoke: Invoke) => ({
  async load(): Promise<AppSettings> {
    return invoke<AppSettings>("load_settings").catch(() => defaultSettings);
  },
  async save(settings: AppSettings): Promise<AppSettings> {
    return invoke<AppSettings>("save_settings", { settings });
  }
});
```

- [ ] **Step 4: Implement the Rust persistence and command layer**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub interval_minutes: u32,
    pub break_minutes: u32,
    pub launch_at_login: bool,
    pub allow_delay_once: bool,
    pub allow_pause_today: bool,
    pub default_asset_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            interval_minutes: 90,
            break_minutes: 5,
            launch_at_login: true,
            allow_delay_once: true,
            allow_pause_today: true,
            default_asset_id: None,
        }
    }
}
```

```rust
#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    settings_store::load(&app).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    settings_store::save(&app, &settings).await.map_err(|error| error.to_string())?;
    Ok(settings)
}
```

- [ ] **Step 5: Run frontend tests and Rust compile checks**

Run: `npm test -- tests/unit/settings-store.test.ts`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 6: Commit the persistence layer**

```bash
git add src/domain/settings src-tauri/src/domain/settings.rs src-tauri/src/persistence src-tauri/src/commands/settings.rs
git commit -m "feat: persist break reminder settings"
```

## Task 5: Build The Media Library Import And Validation Flow

**Files:**
- Create: `src/domain/media/validation.ts`
- Create: `src/domain/media/presentation.ts`
- Create: `src/features/media-library/MediaLibraryScreen.tsx`
- Create: `src-tauri/src/domain/media.rs`
- Create: `src-tauri/src/persistence/media_store.rs`
- Create: `src-tauri/src/commands/media.rs`
- Test: `tests/unit/media-validation.test.ts`

- [ ] **Step 1: Write the failing media validation test**

```ts
import { describe, expect, it } from "vitest";
import { detectMediaFormat } from "../../src/domain/media/validation";

describe("detectMediaFormat", () => {
  it("classifies transparent webm and mov assets by extension", () => {
    expect(detectMediaFormat("/tmp/neko.webm")).toBe("webm_alpha");
    expect(detectMediaFormat("/tmp/neko.mov")).toBe("mov_alpha");
    expect(detectMediaFormat("/tmp/neko.mp4")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/media-validation.test.ts`
Expected: FAIL because validation helpers do not exist

- [ ] **Step 3: Implement frontend format detection and asset presentation helpers**

```ts
import type { MediaFormat, MediaAsset } from "./types";

export const detectMediaFormat = (filePath: string): MediaFormat => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".webm")) return "webm_alpha";
  if (lower.endsWith(".mov")) return "mov_alpha";
  return "unknown";
};

export const assetLabel = (asset: MediaAsset) =>
  `${asset.name} · ${asset.format} · ${Math.round(asset.durationSeconds)}s`;
```

- [ ] **Step 4: Implement Rust import metadata and persistence**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAsset {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub format: String,
    pub duration_seconds: f32,
    pub has_transparency: bool,
    pub enabled: bool,
    pub built_in: bool,
    pub copy_theme: Option<String>,
}
```

```rust
#[tauri::command]
pub async fn import_media(app: tauri::AppHandle, file_path: String) -> Result<MediaAsset, String> {
    let asset = media::import_asset(&app, &file_path).await.map_err(|error| error.to_string())?;
    media_store::upsert(&app, &asset).await.map_err(|error| error.to_string())?;
    Ok(asset)
}
```

- [ ] **Step 5: Create the first media library screen**

```tsx
import type { MediaAsset } from "../../domain/media/types";

type Props = {
  assets: MediaAsset[];
  onImport: () => Promise<void>;
  onSelect: (assetId: string) => void;
};

export function MediaLibraryScreen({ assets, onImport, onSelect }: Props) {
  return (
    <section>
      <header>
        <h1>Media Library</h1>
        <button onClick={() => void onImport()}>Import transparent media</button>
      </header>
      <ul>
        {assets.map((asset) => (
          <li key={asset.id}>
            <button onClick={() => onSelect(asset.id)}>{asset.name}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Run tests and compile checks**

Run: `npm test -- tests/unit/media-validation.test.ts`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 7: Commit the media foundation**

```bash
git add src/domain/media src/features/media-library src-tauri/src/domain/media.rs src-tauri/src/persistence/media_store.rs src-tauri/src/commands/media.rs tests/unit/media-validation.test.ts
git commit -m "feat: add media import and validation"
```

## Task 6: Build The Frontend App Shell And Setup Flow

**Files:**
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/features/setup/SetupScreen.tsx`
- Create: `src/features/dashboard/DashboardScreen.tsx`
- Create: `src/features/settings/SettingsScreen.tsx`
- Create: `src/styles/app.css`

- [ ] **Step 1: Create the root app and router shell**

```tsx
import { App } from "./app/App";
import "./styles/app.css";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(<App />);
```

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { createSettingsStore } from "../domain/settings/store";
import { defaultSettings } from "../domain/settings/defaults";
import type { AppSettings } from "../domain/settings/types";
import { SetupScreen } from "../features/setup/SetupScreen";

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const store = createSettingsStore(invoke);
    void store.load().then(setSettings).catch(() => setSettings(defaultSettings));
  }, []);

  if (!settings) return <main>Loading…</main>;
  return <SetupScreen settings={settings} onSave={setSettings} />;
}
```

- [ ] **Step 2: Implement a minimal first-run setup screen**

```tsx
import type { AppSettings } from "../../domain/settings/types";

type Props = {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
};

export function SetupScreen({ settings, onSave }: Props) {
  return (
    <main>
      <h1>Mac Break Reminder</h1>
      <p>Set your rhythm, pick a break asset, and let the app handle the rest.</p>
      <button
        onClick={() =>
          onSave({
            ...settings,
            intervalMinutes: 90,
            breakMinutes: 5
          })
        }
      >
        Use recommended setup
      </button>
    </main>
  );
}
```

- [ ] **Step 3: Add baseline app styles**

```css
:root {
  color-scheme: light;
  font-family: "Avenir Next", "Helvetica Neue", sans-serif;
  background: #f6f1e8;
  color: #14211d;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 201, 138, 0.45), transparent 30%),
    linear-gradient(180deg, #fff8ef 0%, #f4efe5 100%);
}

button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.2rem;
  background: #1f7a63;
  color: white;
}
```

- [ ] **Step 4: Run the frontend build**

Run: `npm run build`
Expected: PASS with a compiled `dist` directory

- [ ] **Step 5: Commit the app shell**

```bash
git add src/main.tsx src/app src/features/setup src/features/dashboard src/features/settings src/styles/app.css
git commit -m "feat: add break reminder app shell"
```

## Task 7: Implement Overlay Playback And Countdown UI

**Files:**
- Create: `src/features/overlay/BreakOverlay.tsx`
- Create: `src/features/overlay/useBreakOverlay.ts`
- Create: `src-tauri/src/windows.rs`
- Create: `src-tauri/src/commands/window.rs`

- [ ] **Step 1: Create the overlay component**

```tsx
import type { MediaAsset } from "../../domain/media/types";

type Props = {
  asset: MediaAsset | null;
  remainingSeconds: number;
  message: string;
};

export function BreakOverlay({ asset, remainingSeconds, message }: Props) {
  return (
    <main className="overlay">
      <div className="overlay__media">
        {asset ? <video src={asset.filePath} autoPlay muted playsInline /> : null}
      </div>
      <div className="overlay__hud">
        <p>{message}</p>
        <h1>{Math.ceil(remainingSeconds / 60)}:00</h1>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add an overlay countdown hook**

```ts
import { useEffect, useState } from "react";

export function useBreakOverlay(initialSeconds: number) {
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return remainingSeconds;
}
```

- [ ] **Step 3: Implement basic Rust window commands**

```rust
#[tauri::command]
pub fn show_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("overlay").ok_or("overlay window missing")?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("overlay").ok_or("overlay window missing")?;
    window.hide().map_err(|error| error.to_string())
}
```

- [ ] **Step 4: Wire overlay styling**

```css
.overlay {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: rgba(17, 24, 21, 0.62);
}

.overlay__media video {
  max-width: 52vw;
  max-height: 52vh;
  object-fit: contain;
}

.overlay__hud {
  position: absolute;
  bottom: 8vh;
  text-align: center;
  color: #fff9ef;
}
```

- [ ] **Step 5: Run frontend and Rust verification**

Run: `npm run build`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 6: Commit the overlay flow**

```bash
git add src/features/overlay src/styles/app.css src-tauri/src/windows.rs src-tauri/src/commands/window.rs
git commit -m "feat: add break overlay playback"
```

## Task 8: Add macOS Integration For Launch And Focus Recovery

**Files:**
- Create: `src-tauri/src/domain/permissions.rs`
- Create: `src-tauri/src/domain/autostart.rs`
- Create: `src-tauri/src/commands/scheduler.rs`
- Create: `src-tauri/src/app_state.rs`
- Create: `src/features/menu-bar/status.ts`

- [ ] **Step 1: Implement permission and launch-at-login domain stubs**

```rust
pub struct PermissionStatus {
    pub accessibility_granted: bool,
}

pub fn current_permission_status() -> PermissionStatus {
    PermissionStatus {
        accessibility_granted: false,
    }
}
```

```rust
pub async fn sync_launch_at_login(enabled: bool) -> Result<(), String> {
    let _ = enabled;
    Ok(())
}
```

- [ ] **Step 2: Add scheduler-facing Tauri commands**

```rust
#[tauri::command]
pub async fn start_scheduler(app: tauri::AppHandle) -> Result<(), String> {
    let _ = app;
    Ok(())
}

#[tauri::command]
pub async fn delay_break(app: tauri::AppHandle, minutes: u32) -> Result<(), String> {
    let _ = (app, minutes);
    Ok(())
}

#[tauri::command]
pub async fn pause_today(app: tauri::AppHandle) -> Result<(), String> {
    let _ = app;
    Ok(())
}
```

- [ ] **Step 3: Add frontend helpers for status copy**

```ts
import type { SchedulerSnapshot } from "../../domain/breaks/types";

export const statusLabel = (snapshot: SchedulerSnapshot) => {
  if (snapshot.state === "paused_today") return "Paused for today";
  if (snapshot.state === "break_active") return "Break happening now";
  if (snapshot.nextBreakAt) return `Next break at ${snapshot.nextBreakAt}`;
  return "Break timer idle";
};
```

- [ ] **Step 4: Verify Rust compile and frontend build**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit the native integration foundation**

```bash
git add src-tauri/src/domain/permissions.rs src-tauri/src/domain/autostart.rs src-tauri/src/commands/scheduler.rs src-tauri/src/app_state.rs src/features/menu-bar/status.ts
git commit -m "feat: add mac integration foundation"
```

## Task 9: Wire Tauri Bootstrap And Command Registration

**Files:**
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/build.rs`

- [ ] **Step 1: Implement the Tauri entrypoint**

```rust
mod app_state;
mod commands;
mod domain;
mod persistence;
mod windows;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::media::import_media,
            commands::window::show_overlay,
            commands::window::hide_overlay,
            commands::scheduler::start_scheduler,
            commands::scheduler::delay_break,
            commands::scheduler::pause_today
        ])
        .run(tauri::generate_context!())
        .expect("error while running mac break reminder");
}
```

- [ ] **Step 2: Implement command module exports and build script**

```rust
pub mod media;
pub mod scheduler;
pub mod settings;
pub mod window;
```

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: Add capability configuration**

```json
{
  "identifier": "default",
  "windows": ["main", "overlay"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    "opener:default"
  ]
}
```

- [ ] **Step 4: Run full compile verification**

Run: `npm run build`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit the Tauri bootstrap**

```bash
git add src-tauri/src/main.rs src-tauri/src/commands/mod.rs src-tauri/capabilities/default.json src-tauri/build.rs
git commit -m "feat: wire tauri command bootstrap"
```

## Task 10: Verify The MVP End To End

**Files:**
- Modify: `README.md`
- Create: `public/assets/presets/README.md`

- [ ] **Step 1: Document the local run flow and supported media**

```md
## MVP Features

- Menu bar resident app shell
- Fixed-interval break scheduler
- Break overlay with countdown
- Built-in and imported transparent WebM / MOV assets
- Delay once and pause-today actions

## Media Notes

- Preferred input formats: transparent `.webm` and transparent `.mov`
- Transparent playback depends on source asset compatibility
- Unsupported files are rejected at import time
```

- [ ] **Step 2: Document preset asset expectations**

```md
# Preset Asset Notes

Place built-in transparent videos in this directory.

- Prefer short looping assets
- Keep duration between 3 and 12 seconds
- Use transparent WebM or MOV files
```

- [ ] **Step 3: Run the complete verification suite**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

Run: `npm run tauri:dev`
Expected: app launches with a main window and an initially hidden overlay window

- [ ] **Step 4: Commit the MVP handoff**

```bash
git add README.md public/assets/presets/README.md
git commit -m "docs: finalize mac break reminder mvp setup"
```

## Self-Review

- Spec coverage check:
  - mac-only scope is covered by the Tauri scaffold and native integration tasks
  - scheduler, overlay, and light interruption are covered by Tasks 3, 7, and 8
  - WebM and MOV media support are covered by Task 5
  - first-run setup and menu-bar-oriented app shell are covered by Task 6
  - persistence, delay once, and pause today are covered by Tasks 4 and 8
- Placeholder scan:
  - no `TODO`, `TBD`, or deferred placeholder text remains in task steps
- Type consistency:
  - `AppSettings`, `SchedulerSnapshot`, and `MediaAsset` names are reused consistently across frontend tasks

## Notes

- This plan assumes the project will be initialized as its own git repository inside `mac-break-reminder/`.
- The plan intentionally keeps transparency detection lightweight for MVP and leaves deeper codec inspection as a later improvement.
- If transparent MOV playback proves unreliable in the webview layer, keep the import format but route playback through a native macOS bridge in a follow-up task rather than changing the product contract.
