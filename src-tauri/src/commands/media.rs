use crate::domain::media::{self, MediaAsset};
use crate::persistence::media_store;

#[tauri::command]
pub async fn load_media(app: tauri::AppHandle) -> Result<Vec<MediaAsset>, String> {
    media_store::load_all(&app)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn import_media(app: tauri::AppHandle, file_path: String) -> Result<MediaAsset, String> {
    let asset = media::import_asset(&app, &file_path)
        .await
        .map_err(|error| error.to_string())?;
    media_store::upsert(&app, &asset)
        .await
        .map_err(|error| error.to_string())?;
    Ok(asset)
}
