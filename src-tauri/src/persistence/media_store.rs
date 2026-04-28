use crate::domain::media::MediaAsset;
use std::path::PathBuf;
use tauri::Manager;
use tokio::fs;

fn media_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    Ok(base.join("media-library.json"))
}

async fn load_all(app: &tauri::AppHandle) -> Result<Vec<MediaAsset>, String> {
    let path = media_path(app)?;
    match fs::read_to_string(path).await {
        Ok(contents) => serde_json::from_str(&contents).map_err(|error| error.to_string()),
        Err(_) => Ok(Vec::new()),
    }
}

pub async fn upsert(app: &tauri::AppHandle, asset: &MediaAsset) -> Result<(), String> {
    let path = media_path(app)?;
    let mut items = load_all(app).await?;
    if let Some(index) = items.iter().position(|item| item.id == asset.id) {
        items[index] = asset.clone();
    } else {
        items.push(asset.clone());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&items).map_err(|error| error.to_string())?;
    fs::write(path, payload).await.map_err(|error| error.to_string())
}
