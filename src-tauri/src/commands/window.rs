use crate::tray;
use crate::windows;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOverlayMedia {
    // 旧字段：单层模式，update_overlay_media 在 phase 切换时也复用。
    pub file_path: Option<String>,
    pub format: Option<String>,
    pub should_loop: Option<bool>,
    pub next_file_path: Option<String>,
    pub next_format: Option<String>,
    // 新增：双层入场 + 循环模式（Rust 自管时序）。
    // 这两个 path 同时给出时进入双层分支，旧字段会被忽略。
    pub intro_file_path: Option<String>,
    pub intro_format: Option<String>,
    pub intro_duration_ms: Option<u64>,
    pub loop_file_path: Option<String>,
    pub loop_format: Option<String>,
    pub outro_file_path: Option<String>,
    pub outro_format: Option<String>,
    pub outro_duration_ms: Option<u64>,
}

#[tauri::command]
pub fn show_overlay(
    app: tauri::AppHandle,
    style: String,
    media: Option<NativeOverlayMedia>,
) -> Result<(), String> {
    windows::show_overlay_window(&app, &style, media.as_ref())
}

#[tauri::command]
pub fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    windows::hide_overlay_window(&app)
}

#[tauri::command]
pub fn hide_overlay_silently(app: tauri::AppHandle) -> Result<(), String> {
    windows::hide_overlay_window_silently(&app)
}

#[tauri::command]
pub fn play_overlay_outro(app: tauri::AppHandle) -> Result<(), String> {
    windows::play_overlay_outro(&app)
}

#[tauri::command]
pub fn update_overlay_media(
    app: tauri::AppHandle,
    media: Option<NativeOverlayMedia>,
) -> Result<(), String> {
    windows::update_overlay_media(&app, media.as_ref())
}

#[tauri::command]
pub fn update_tray_tooltip(app: tauri::AppHandle, tooltip: String) -> Result<(), String> {
    tray::set_tray_tooltip(&app, &tooltip).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_tray_title(app: tauri::AppHandle, title: String) -> Result<(), String> {
    tray::set_tray_title(&app, &title).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_tray_pause_label(app: tauri::AppHandle, label: String) -> Result<(), String> {
    tray::set_pause_menu_label(&app, &label).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_tray_pause_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    tray::set_pause_menu_enabled(&app, enabled).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn sync_tray_countdown(
    app: tauri::AppHandle,
    state: String,
    deadline_unix_ms: Option<i64>,
) -> Result<(), String> {
    tray::sync_countdown(&app, &state, deadline_unix_ms).map_err(|error| error.to_string())
}
