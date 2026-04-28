use crate::domain::settings::AppSettings;
use std::path::PathBuf;
use tauri::Manager;
use tokio::fs;

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    Ok(base.join("settings.json"))
}

pub async fn load(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    match fs::read_to_string(&path).await {
        Ok(contents) => serde_json::from_str(&contents).map_err(|error| error.to_string()),
        Err(_) => Ok(AppSettings::default()),
    }
}

pub async fn save(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent).await.map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, payload).await.map_err(|error| error.to_string())
}
