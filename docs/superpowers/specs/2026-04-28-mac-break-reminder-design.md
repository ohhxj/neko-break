# Mac Break Reminder Design

## Overview

This document defines the first product design for a macOS desktop break reminder app inspired by the lightweight interruption style of the Cat Gatekeeper browser extension. The desktop version is intentionally not a lockout or enterprise control tool. It is a playful, media-driven break companion that interrupts the user at configured intervals, encourages short rest sessions, and makes that interruption feel delightful enough to keep enabled.

The first release is mac-only. It prioritizes validating the reminder loop, media presentation, and light-interruption behavior before any Windows work begins.

## Product Goal

Build a macOS app that can:

1. Run persistently from the menu bar.
2. Trigger break sessions on a user-defined schedule.
3. Show a high-presence break overlay with countdown, copy, and animated media.
4. Support built-in assets plus user-imported transparent media.
5. Keep the break overlay in front during a session without claiming to fully lock the system.
6. Offer soft escape valves such as delaying one session or pausing the rest of the day.

The product should feel playful, relaxing, and slightly mischievous rather than punitive.

## Non-Goals For Milestone 1

Milestone 1 does not need to:

1. Support Windows.
2. Detect or react to specific websites or browser tabs.
3. Provide account sync, cloud storage, or online asset sharing.
4. Guarantee system-level lockout or unskippable enforcement.
5. Include automatic media conversion or transcoding.
6. Include an asset marketplace or creator community.

## Product Positioning

This app is a self-care utility with entertainment logic. The user is not asking for compliance software. That means:

- the interruption should feel intentional and fun
- the media should carry most of the emotional value
- the user should be able to customize the app with their own assets
- the app should be firm enough to interrupt momentum without becoming hostile

The first release should optimize for "I want to keep this on" rather than "I cannot escape this."

## Target Platform

Milestone 1 targets macOS only.

This is a deliberate scope choice. The app depends on desktop-specific window behavior, menu bar presence, startup integration, and macOS permission flows. Shipping macOS first reduces cross-platform complexity and makes it easier to validate the real product value before building a Windows adaptation.

## Core User Experience

### First-Run Setup

On first launch, the user should be guided through a short setup flow:

1. understand what the app does
2. grant any recommended permissions
3. choose break frequency
4. choose break duration
5. select a built-in asset or import custom media
6. decide whether the app launches at login

The setup should be lightweight. The goal is to get the user into the reminder loop quickly.

### Daily Use

After setup, the app lives primarily in the menu bar. During normal work:

- the scheduler counts down in the background
- the app stays low-noise outside break events
- the user can inspect the next break time from the menu bar
- the user can temporarily pause or skip from the menu if needed

When a break starts:

1. the overlay appears in front of the user
2. the selected media begins playing
3. the countdown becomes immediately visible
4. optional supporting copy reinforces the tone of the break
5. the overlay remains prominent until the timer completes or the user uses an allowed soft-exit action

When the break ends:

- the overlay closes automatically
- a short completion state may appear
- the scheduler resets for the next interval

## MVP Features

Milestone 1 includes four primary capability groups.

### 1. Break Scheduling

The user can configure:

- break interval
- break duration
- launch at login
- pause reminders for the rest of the day
- delay the next reminder once

The first version uses fixed recurring intervals. It does not need adaptive behavior, activity sensing, or productivity heuristics.

### 2. Break Overlay

The overlay is the main product surface. It should:

- appear with strong visual presence
- support full-screen or near-full-screen presentation
- display a countdown clearly
- play a selected animated media asset
- show optional short copy
- stay in front as much as reasonably possible during the session

The overlay should feel like a playful interruption, not a system alarm.

### 3. Media Library

The app ships with built-in assets and supports user-imported assets.

Users can:

- browse built-in assets
- import local files
- preview assets
- enable or disable assets
- assign one as the default break asset
- optionally attach short text labels or copy themes

### 4. Light Interruption

During a break session, the app should try to keep the overlay as the dominant foreground surface by using window layering, focus recovery, and macOS integration where available.

This behavior is intentionally described as "light interruption," not "hard enforcement." The app should discourage immediate continuation of work without promising complete input capture or system lockout.

## Media Strategy

The product must support user-supplied real media rather than relying on generated placeholder art.

### Supported Formats For Milestone 1

The initial format strategy is:

1. `WebM` with alpha transparency
2. `MOV` with alpha transparency

Both should be accepted as import targets in the first release. This gives the product flexibility:

- the user already has WebM-based inspiration from the browser extension reference
- many professional transparent assets are distributed as MOV

### Media Requirements

Imported media should be validated against practical expectations:

- readable file type
- decodable video stream
- reasonable duration
- dimensions suitable for overlay display
- transparency support when expected

If a file is unsupported or appears to lack usable transparency, the app should show a clear product-facing explanation instead of a low-level media error.

### Media UX

For each asset, the library should track:

- display name
- original file path or imported managed copy
- media format
- transparency support status
- duration
- enabled or disabled state
- default selection flag
- optional associated copy theme

The user experience should make it easy to swap assets without touching files manually after import.

## macOS Behavior And Permission Strategy

The first release should use a hybrid approach: a desktop shell for UI plus targeted macOS integration for window behavior and permissions.

### Recommended Technical Direction

Use a desktop shell that supports:

- menu bar residency
- local file import
- persistent settings
- strong overlay window control
- limited native bridges for macOS-specific behavior

The current recommendation is a Tauri-based app with small native extensions where needed.

### Required macOS Capabilities

The app should support:

- menu bar presence
- launch at login
- foreground overlay presentation
- persistent local settings
- local media file access

### Recommended macOS Integrations

The app should also attempt:

- permission detection and onboarding for Accessibility-related features
- foreground recovery when the user leaves the overlay
- window-level behavior that keeps the break experience prominent

### Explicit Limitations

Milestone 1 does not promise:

- blocking `Cmd+Tab`
- blocking Mission Control or desktop switching
- blocking Force Quit
- true kiosk-mode behavior
- full device lockout

The product goal is to keep attention on the break overlay, not to defeat the operating system.

## System Design

The app should be split into focused modules with clean responsibilities.

### 1. App Shell

Responsible for:

- app lifecycle
- menu bar item
- startup flow
- window creation and disposal
- launch-at-login integration
- permission status display

### 2. Break Scheduler

Responsible for:

- tracking idle, counting, break-active, paused, and delayed states
- calculating next trigger time
- resetting state after a completed break
- applying user timing preferences

### 3. Break Overlay

Responsible for:

- rendering the visual break experience
- playing the selected media
- showing the countdown
- handling break-completion transitions
- applying in-session light interruption behavior

### 4. Media Library

Responsible for:

- built-in asset registration
- user asset import
- media validation
- preview handling
- default asset selection
- asset metadata persistence

### 5. Settings And Preferences

Responsible for:

- timing preferences
- startup preferences
- pause and delay options
- default asset selection
- future extensibility for themes or copy presets

### 6. macOS Integration Layer

Responsible for:

- permission checks
- launch-at-login integration
- focus and foreground helpers
- any native bridges needed for window control

Business logic should not live directly in this layer.

## State Model

Milestone 1 can use a simple app state model:

1. `idle`
   - app launched but scheduler not started or waiting for config
2. `counting`
   - active timer running toward next break
3. `break_active`
   - overlay visible and countdown in progress
4. `delayed`
   - one-time user delay applied before next break
5. `paused_today`
   - reminders suspended until the next day or manual resume

This state model is sufficient for the first release and should remain explicit rather than being inferred from many loose flags.

## Soft Exit Policy

The product needs flexibility without undermining its main loop.

Milestone 1 should allow:

- delay once
- pause for the rest of the day

These actions should exist, but they should not dominate the overlay UI. The break overlay should primarily encourage completion, not avoidance.

## Error Handling Expectations

The first release should fail gracefully in these cases:

- unsupported media import
- media decode failure
- missing or moved imported files
- insufficient permissions for stronger foreground behavior
- launch-at-login registration failure

Each of these should produce user-readable feedback with a concrete next step where possible.

## MVP Acceptance Criteria

Milestone 1 is complete when all of the following are true:

- the app can be installed and opened on macOS
- the user can complete first-run setup
- the app can live in the menu bar
- the user can configure break interval and duration
- the scheduler reliably triggers break sessions
- the break overlay appears and shows a countdown
- the overlay can play built-in assets
- the overlay can play imported transparent WebM assets
- the overlay can play imported transparent MOV assets
- the user can preview, enable, disable, and select assets
- the user can delay one session or pause the rest of the day
- the overlay attempts to remain in front during break sessions
- permissions or capability limitations are surfaced clearly when relevant

## Expansion Paths After Milestone 1

If the macOS release validates the product, likely next steps are:

1. Windows version
2. richer asset theming and copy packs
3. optional browser-aware triggering logic
4. import helpers or format-conversion support
5. stronger analytics around completion and skip behavior

These are explicitly follow-up opportunities, not part of the first build.
