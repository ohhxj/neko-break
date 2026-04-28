use mac_break_reminder_lib::{
    app_state::AppState,
    commands,
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::media::load_media,
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
