# Mac Break Reminder

macOS-first playful break reminder app built with Tauri.

## Development

1. Install Node.js and Rust
2. Run `npm install`
3. Run `npm run tauri:dev`

## MVP Features

- Menu bar oriented app shell
- Fixed-interval break scheduler
- Break overlay with countdown
- Built-in and imported transparent WebM / MOV assets
- Delay once and pause-today actions

## Media Notes

- Preferred input formats: transparent `.webm` and transparent `.mov`
- Transparent playback depends on source asset compatibility
- Unsupported files are rejected at import time
