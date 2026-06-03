# Neko Break Scene Media Design

## Overview

This document defines the next media-system upgrade for Neko Break. The current app treats one break asset as a single looping media file. That works for simple transparent cat loops, but it breaks down as soon as the animation has narrative structure, such as:

1. a cat entering the screen
2. a stable idle loop while the break is active
3. a cat leaving the screen when the user dismisses the reminder

The product needs to support scene-based media instead of only single-file loop assets.

## Product Goal

Allow one break reminder to play as a complete scene:

1. optionally enter the screen once
2. remain on screen in a stable loop
3. optionally leave the screen once when the break ends or the user dismisses it

This should work for both floating and immersive reminder styles without forcing creators to manufacture fake loopable files.

## Core Product Decision

Do not expose this as "four user-facing playback modes."

Instead, define one scene as three clip slots:

- `introClip`: optional, play once
- `loopClip`: required, loop continuously
- `outroClip`: optional, play once

This single model naturally supports the four combinations the user wants:

1. `loop`
2. `intro + loop`
3. `intro + loop + outro`
4. `loop + outro`

The UI should present this as a scene editor, not a mode matrix.

## Why This Change Is Needed

### Current Limitation

Today, a media asset is assumed to be one loopable file. That creates three problems:

1. scene-based animation is hard to author because the creator must force an entry action into a seamless loop
2. more expressive cat behavior becomes impossible without awkward editing
3. the app cannot play a dismissal animation when the user clicks the close action

### New Outcome

With scene media:

- artists can author more natural motion
- imported media does not need to be fake-looped
- dismissal feels more polished because the cat can react before disappearing
- future multi-character or themed scenes become easier to support

## User Experience

### Scene Setup

Users configure a scene rather than a single clip.

Each scene contains:

- scene name
- cover image or preview image
- intro clip: optional
- loop clip: required
- outro clip: optional
- optional style hint: floating or immersive
- optional button-label override

### Break Start

When a break begins:

1. if `introClip` exists, play it once
2. when `introClip` finishes, switch automatically to `loopClip`
3. if no `introClip` exists, start directly on `loopClip`

### Break Active

While the break is active:

- `loopClip` repeats continuously
- the HUD stays visible above the scene
- the break UI continues to work the same way regardless of scene structure

### Dismissal

When the user clicks the close action:

1. if `outroClip` exists, play it once
2. when `outroClip` ends, close the overlay
3. if no `outroClip` exists, close immediately

### Timer Completion

When the timer reaches zero:

1. if `outroClip` exists, play it once
2. then close the overlay
3. otherwise close immediately

The first implementation should use the same outro behavior for both manual dismissal and natural completion.

## Media Model

### New Product Concept

Introduce a `SceneAsset` as the top-level selectable object.

The old `MediaAsset` concept remains useful, but only as a clip-level record.

### Proposed Data Model

```ts
export type MediaFormat = "webm_alpha" | "mov_alpha" | "apng_alpha" | "unknown";

export type SceneClip = {
  id: string;
  filePath: string;
  previewImagePath: string | null;
  format: MediaFormat;
  durationSeconds: number;
  fileSizeBytes: number;
  pixelWidth: number;
  pixelHeight: number;
  hasTransparency: boolean;
};

export type SceneAsset = {
  id: string;
  name: string;
  coverImagePath: string | null;
  introClip: SceneClip | null;
  loopClip: SceneClip;
  outroClip: SceneClip | null;
  builtIn: boolean;
  enabled: boolean;
  overlayStyleHint: "floating" | "immersive" | null;
  closeButtonLabel: string | null;
};
```

### Compatibility Rule

Existing single-file assets must migrate automatically into scene assets like this:

- `loopClip = existing asset`
- `introClip = null`
- `outroClip = null`

This keeps all existing built-in and imported assets usable.

## Playback State Machine

The overlay player should move from simple loop playback to explicit scene states.

Recommended runtime states:

1. `idle`
2. `intro`
3. `loop`
4. `outro`
5. `closing`

Transitions:

- `idle -> intro` when a scene starts and intro exists
- `idle -> loop` when a scene starts without intro
- `intro -> loop` when intro finishes
- `loop -> outro` when dismiss or timer-end happens and outro exists
- `loop -> closing` when no outro exists
- `outro -> closing` when outro finishes

This state machine should exist in the overlay player rather than being scattered across ad hoc conditions.

## UI Changes

### Settings Screen

The default selection target should become a default scene, not a default clip.

Show:

- default scene picker
- scene preview
- clip availability summary
  - intro: configured or not
  - loop: configured
  - outro: configured or not

### Media Library

The media library should become scene-oriented.

Primary actions:

1. create scene
2. edit scene
3. assign intro clip
4. assign loop clip
5. assign outro clip
6. preview scene flow

Loop clip must be required. Intro and outro remain optional.

### Preview

The settings preview should support a full scene simulation:

1. play intro once
2. switch to loop
3. allow testing outro by clicking the dismiss action

## Technical Scope

### First Delivery

The first implementation only needs:

1. scene data model
2. migration from single clip to scene
3. intro playback
4. loop playback
5. outro playback on dismiss and timer end
6. scene selection in settings
7. scene editing in media library

### Not Required In The First Scene Delivery

The first scene release does not need:

1. scene audio
2. multiple intro variants
3. conditional outro behavior
4. random scene playlists
5. network sync or cloud scene sharing
6. per-style dual-scene mapping

## Risks

### 1. Clip Transition Timing

If different formats decode differently, transitions between intro, loop, and outro may show visible gaps.

Mitigation:

- prefer consistent media formats within one scene
- keep scene transitions simple in the first release
- test heavily with transparent MOV and WebM imports

### 2. Overlay Close Coordination

Today the overlay can close immediately. After this change, the close action must sometimes wait for outro completion.

Mitigation:

- make close behavior state-driven
- centralize dismissal logic in the overlay player

### 3. Data Migration

Existing saved assets must still load without user repair work.

Mitigation:

- implement one-time migration with backwards compatibility
- preserve existing IDs when wrapping old assets into default loop-only scenes

## Success Criteria

This feature is complete when:

1. an existing single looping asset still works without modification
2. a new scene with `intro + loop` plays correctly
3. a new scene with `loop + outro` closes correctly
4. a new scene with `intro + loop + outro` handles start, idle, and dismissal correctly
5. settings and media library both speak in terms of scenes instead of one-off clip files

