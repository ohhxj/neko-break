use crate::domain::media::{self, MediaProbeResult, SceneAsset, SceneClip};
use crate::persistence::media_store;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::{path::BaseDirectory, Manager};
use tokio::fs;

#[tauri::command]
pub async fn load_media(app: tauri::AppHandle) -> Result<Vec<SceneAsset>, String> {
    media_store::load_all(&app)
        .await
        .map_err(|error| error.to_string())
}

/// 把打包进 app 的预设媒体（resources/presets/<name>）解析成绝对文件路径。
/// 原生 AVPlayerLayer 需要真实文件路径，而打包资源在前端只有 URL，
/// 因此预设的 mov 路径必须在运行时经此命令解析。
#[tauri::command]
pub fn resolve_preset_path(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let path = app
        .path()
        .resolve(format!("resources/presets/{name}"), BaseDirectory::Resource)
        .map_err(|error| error.to_string())?;
    path.to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| "preset path could not be encoded".to_string())
}

#[tauri::command]
pub async fn import_media(
    app: tauri::AppHandle,
    file_path: String,
    duration_seconds: f32,
    pixel_width: u32,
    pixel_height: u32,
) -> Result<SceneAsset, String> {
    let asset = media::import_asset(&app, &file_path, duration_seconds, pixel_width, pixel_height)
        .await
        .map_err(|error| error.to_string())?;
    media_store::upsert(&app, &asset)
        .await
        .map_err(|error| error.to_string())?;
    Ok(asset)
}

#[tauri::command]
pub async fn import_clip(
    app: tauri::AppHandle,
    file_path: String,
    duration_seconds: f32,
    pixel_width: u32,
    pixel_height: u32,
) -> Result<SceneClip, String> {
    media::import_clip(&app, &file_path, duration_seconds, pixel_width, pixel_height).await
}

#[tauri::command]
pub fn probe_media(file_path: String) -> Result<MediaProbeResult, String> {
    media::probe_asset(&file_path)
}


#[tauri::command]
pub async fn save_scene(app: tauri::AppHandle, scene: SceneAsset) -> Result<SceneAsset, String> {
    media_store::upsert(&app, &scene)
        .await
        .map_err(|error| error.to_string())?;
    Ok(scene)
}

#[tauri::command]
pub async fn delete_scene(app: tauri::AppHandle, scene_id: String) -> Result<Vec<SceneAsset>, String> {
    media_store::delete(&app, &scene_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn load_preview_image(file_path: String) -> Result<String, String> {
    let bytes = fs::read(&file_path)
        .await
        .map_err(|error| format!("Could not load preview image: {error}"))?;
    let mime = if file_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else {
        "application/octet-stream"
    };
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}
