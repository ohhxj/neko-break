use crate::domain::settings::AppSettings;
use serde_json::Value;
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

fn migrate_settings_value(mut value: Value) -> Result<AppSettings, String> {
    if let Some(object) = value.as_object_mut() {
        if object.get("defaultSceneId").is_none() {
            if let Some(default_asset_id) = object.remove("defaultAssetId") {
                object.insert("defaultSceneId".into(), default_asset_id);
            }
        }
        object.insert("allowDelayOnce".into(), Value::Bool(true));
        object.insert("allowPauseToday".into(), Value::Bool(true));
        object
            .entry("doNotDisturbEnabled")
            .or_insert(Value::Bool(false));
        object
            .entry("doNotDisturbStart")
            .or_insert(Value::String("12:00".into()));
        object
            .entry("doNotDisturbEnd")
            .or_insert(Value::String("13:30".into()));
        object
            .entry("companionEnabled")
            .or_insert(Value::Bool(false));
        object
            .entry("companionStart")
            .or_insert(Value::String("09:00".into()));
        object
            .entry("companionEnd")
            .or_insert(Value::String("22:00".into()));
    }
    serde_json::from_value(value).map_err(|error| error.to_string())
}

pub async fn load(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    match fs::read_to_string(&path).await {
        Ok(contents) => {
            let raw: Value = serde_json::from_str(&contents).map_err(|error| error.to_string())?;
            let settings = migrate_settings_value(raw)?;
            save(app, &settings).await?;
            Ok(settings)
        }
        Err(_) => Ok(AppSettings::default()),
    }
}

pub async fn save(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, payload)
        .await
        .map_err(|error| error.to_string())
}
