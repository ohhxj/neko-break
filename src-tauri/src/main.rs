use mac_break_reminder_lib::{
    app_state::AppState,
    commands,
    domain::autostart,
    persistence::settings_store,
    tray,
    windows,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .setup(|app| {
            windows::ensure_overlay_defaults(app.handle())?;
            windows::install_main_window_close_behavior(app.handle())?;
            tray::create_tray(app.handle())?;
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(settings) = settings_store::load(&app_handle).await {
                    let _ = autostart::sync_launch_at_login(&app_handle, settings.launch_at_login).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::media::load_media,
            commands::media::resolve_preset_path,
            commands::media::probe_media,
            commands::media::load_preview_image,
            commands::media::import_clip,
            commands::media::save_scene,
            commands::media::delete_scene,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::media::import_media,
            commands::window::show_overlay,
            commands::window::hide_overlay,
            commands::window::update_overlay_media,
            commands::window::update_tray_tooltip,
            commands::window::update_tray_title,
            commands::window::update_tray_pause_label,
            commands::window::update_tray_pause_enabled,
            commands::scheduler::start_scheduler,
            commands::scheduler::delay_break,
            commands::scheduler::pause_today
        ])
        .run(tauri::generate_context!())
        .expect("error while running mac break reminder");
}
