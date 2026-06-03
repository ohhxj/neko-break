use crate::domain::autostart;
use crate::domain::settings::AppSettings;
use crate::persistence::settings_store;

#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    settings_store::load(&app)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn save_settings(
    app: tauri::AppHandle,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    settings_store::save(&app, &settings)
        .await
        .map_err(|error| error.to_string())?;
    autostart::sync_launch_at_login(&app, settings.launch_at_login).await?;
    Ok(settings)
}
