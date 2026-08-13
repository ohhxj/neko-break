# Third-party notices

## FFmpeg (Windows installer)

The Windows build of Neko Break includes an unmodified FFmpeg command-line executable used as a
separate process to convert transparent MOV files to VP9-alpha WebM and to generate media previews.

- FFmpeg build: `ffmpeg-N-126086-ge5ecfe8970-win64-lgpl`
- Build provider: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds/releases/tag/autobuild-2026-08-12-13-15)
- Corresponding FFmpeg source: [FFmpeg commit e5ecfe8970](https://github.com/FFmpeg/FFmpeg/tree/e5ecfe8970)
- License: GNU Lesser General Public License v3; a copy is bundled as `FFmpeg-LICENSE.txt`

Neko Break does not modify FFmpeg or link FFmpeg libraries into the application. FFmpeg remains
copyright its respective contributors and is distributed under its own license.
