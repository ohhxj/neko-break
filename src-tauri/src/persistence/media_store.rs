use crate::domain::media::{ensure_scene_previews, LegacyMediaAsset, SceneAsset};
use serde_json::Value;
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

fn parse_scene_items(contents: &str) -> Result<Vec<SceneAsset>, String> {
    let raw: Value = serde_json::from_str(contents).map_err(|error| error.to_string())?;
    let Some(items) = raw.as_array() else {
        return Ok(Vec::new());
    };

    items.iter()
        .map(|item| {
            if item.get("loopClip").is_some() {
                serde_json::from_value::<SceneAsset>(item.clone()).map_err(|error| error.to_string())
            } else {
                serde_json::from_value::<LegacyMediaAsset>(item.clone())
                    .map(SceneAsset::from_legacy)
                    .map_err(|error| error.to_string())
            }
        })
        .collect()
}

pub async fn load_all(app: &tauri::AppHandle) -> Result<Vec<SceneAsset>, String> {
    let path = media_path(app)?;
    match fs::read_to_string(&path).await {
        Ok(contents) => {
            let mut scenes = parse_scene_items(&contents)?;
            for scene in &mut scenes {
                ensure_scene_previews(app, scene).await;
            }
            let payload = serde_json::to_string_pretty(&scenes).map_err(|error| error.to_string())?;
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).await.map_err(|error| error.to_string())?;
            }
            fs::write(&path, payload).await.map_err(|error| error.to_string())?;
            Ok(scenes)
        }
        Err(_) => Ok(Vec::new()),
    }
}

pub async fn upsert(app: &tauri::AppHandle, asset: &SceneAsset) -> Result<(), String> {
    let path = media_path(app)?;
    let mut items = load_all(app).await?;
    let mut asset = asset.clone();
    ensure_scene_previews(app, &mut asset).await;
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

pub async fn delete(app: &tauri::AppHandle, scene_id: &str) -> Result<Vec<SceneAsset>, String> {
    let path = media_path(app)?;
    let items = load_all(app).await?;
    let items: Vec<SceneAsset> = items
        .into_iter()
        .filter(|item| item.id != scene_id || item.built_in)
        .collect();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).await.map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&items).map_err(|error| error.to_string())?;
    fs::write(path, payload).await.map_err(|error| error.to_string())?;
    Ok(items)
}
