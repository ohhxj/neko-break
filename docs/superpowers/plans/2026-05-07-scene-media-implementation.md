# Neko Break Scene Media Implementation Plan

> **For agentic workers:** implement this plan task-by-task and keep compatibility with the current single-asset flow until migration is complete.

**Goal:** Upgrade Neko Break from single looping media assets to scene-based media with optional intro and outro clips around a required looping clip.

**Architecture:** Keep the current Tauri + React structure, but introduce a new `SceneAsset` model above clip-level media records. The overlay player becomes a small state machine that can move across intro, loop, and outro phases while preserving the existing HUD, scheduling, and transparent playback behavior.

**Tech Stack:** Tauri 2, Rust, TypeScript, React, Vite, local JSON persistence

---

## Delivery Strategy

Implement this feature in four passes:

1. model and persistence
2. overlay playback state machine
3. media-library scene authoring
4. settings and preview integration

Do not attempt all of this as one giant UI rewrite.

## Task 1: Introduce Scene-Level Domain Types

**Files:**
- Update: `src/domain/media/types.ts`
- Update: `src/domain/media/presentation.ts`
- Update: `src/domain/media/presets.ts`
- Update: `src-tauri/src/domain/media.rs`

- [ ] Add `SceneClip` and `SceneAsset` types in TypeScript
- [ ] Keep existing clip metadata fields but move them under clip-level objects
- [ ] Add matching Rust structs for persisted scene assets
- [ ] Update built-in presets so the current built-in cat asset becomes a loop-only scene

**Acceptance Criteria**

- there is one canonical top-level `SceneAsset`
- a scene always has `loopClip`
- intro and outro remain optional

## Task 2: Add Compatibility Migration

**Files:**
- Update: `src/domain/media/store.ts`
- Update: `src-tauri/src/persistence/media_store.rs`
- Update: `src-tauri/src/commands/media.rs`

- [ ] Detect legacy saved single-file assets during load
- [ ] Wrap each legacy asset into a loop-only scene
- [ ] Preserve old IDs where possible to avoid breaking default selections
- [ ] Write migrated scene data back in the new shape

**Acceptance Criteria**

- current user assets still appear after upgrade
- built-in and imported assets work without manual repair

## Task 3: Replace Overlay Playback With A Scene State Machine

**Files:**
- Update: `src/features/overlay/BreakOverlay.tsx`
- Update: `src/features/overlay/useBreakOverlay.ts`
- Update: `src/domain/breaks/types.ts`
- Update: `src/app/App.tsx`

- [ ] Add runtime states for `intro`, `loop`, `outro`, and `closing`
- [ ] Start playback with intro when present
- [ ] Automatically switch from intro to loop after intro ends
- [ ] On dismiss or timer completion, switch to outro when present
- [ ] Close overlay only after outro finishes
- [ ] Preserve current transparent playback path for loop-only scenes

**Acceptance Criteria**

- loop-only scenes still work
- intro plays once then hands off to loop
- outro plays once before close

## Task 4: Extend Overlay Payload And Native Commands

**Files:**
- Update: `src/domain/breaks/types.ts`
- Update: `src-tauri/src/commands/window.rs`
- Update: `src-tauri/src/windows.rs`

- [ ] Replace the single `asset` field in overlay payload with a scene reference or resolved scene payload
- [ ] Ensure native overlay commands understand which clip should currently be shown
- [ ] Keep actual overlay-window behavior unchanged from the user perspective

**Acceptance Criteria**

- overlay payload structure supports scene progression cleanly
- native transparent playback can still be used for active clips

## Task 5: Convert Media Library From Clip List To Scene List

**Files:**
- Update: `src/features/media-library/MediaLibraryScreen.tsx`
- Update: `src/domain/media/store.ts`
- Update: `src/domain/media/presentation.ts`

- [ ] Show scene cards instead of raw clip cards
- [ ] Support creating a new scene
- [ ] Add three clip slots: intro, loop, outro
- [ ] Make loop slot required
- [ ] Allow editing or replacing each slot independently
- [ ] Keep imported single-clip flow as a fast path that creates a loop-only scene

**Acceptance Criteria**

- user can create all four scene combinations without confusion
- UI language refers to scenes, not just videos

## Task 6: Update Settings To Select Scenes

**Files:**
- Update: `src/features/settings/SettingsScreen.tsx`
- Update: `src/app/App.tsx`
- Update: `src/domain/settings/types.ts`
- Update: `src/domain/settings/defaults.ts`
- Update: `src/domain/settings/store.ts`

- [ ] Replace default asset selection with default scene selection
- [ ] Show whether intro and outro are present for the selected scene
- [ ] Keep the rest of the scheduling controls unchanged

**Acceptance Criteria**

- selected default scene drives future reminders
- old settings migrate cleanly

## Task 7: Upgrade The Settings Preview

**Files:**
- Update: `src/features/overlay/BreakOverlay.tsx`
- Update: `src/app/App.tsx`
- Update: `src/styles/app.css`

- [ ] Preview should simulate intro then loop
- [ ] Preview dismiss action should simulate outro
- [ ] Preview should still honor floating vs immersive layout
- [ ] Keep HUD styling consistent with the live overlay

**Acceptance Criteria**

- the user can see the full scene lifecycle in settings without waiting for a real break

## Task 8: Preserve Current Behavior While Rolling Forward

**Files:**
- Update: relevant tests and migration helpers

- [ ] Add tests for loop-only scenes
- [ ] Add tests for intro-to-loop transition
- [ ] Add tests for loop-to-outro close flow
- [ ] Add tests for legacy-asset migration

**Acceptance Criteria**

- core scene combinations are covered by tests
- migration regressions are easy to catch

## Task 9: Ship In This Order

- [ ] Land type changes and migration first
- [ ] Land playback state machine second
- [ ] Land media-library scene authoring third
- [ ] Land settings and preview fourth
- [ ] Run a final compatibility pass on existing imported assets

## Suggested Follow-Ups

After the first scene release is stable, consider:

- scene-specific close button labels
- different scenes for floating vs immersive mode
- optional outro on timer-end toggle
- random scene rotation
- scene cover thumbnails and better preview tooling

