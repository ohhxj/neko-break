use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub format: String,
    pub duration_seconds: f32,
    pub has_transparency: bool,
    pub enabled: bool,
    pub built_in: bool,
    pub copy_theme: Option<String>,
}

pub async fn import_asset(_app: &tauri::AppHandle, file_path: &str) -> Result<MediaAsset, String> {
    let name = Path::new(file_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Imported Asset")
        .to_string();
    let format = if file_path.to_lowercase().ends_with(".webm") {
        "webm_alpha"
    } else if file_path.to_lowercase().ends_with(".mov") {
        "mov_alpha"
    } else {
        "unknown"
    };
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(MediaAsset {
        id: format!("asset-{stamp}"),
        name,
        file_path: file_path.to_string(),
        format: format.to_string(),
        duration_seconds: 6.0,
        has_transparency: format != "unknown",
        enabled: true,
        built_in: false,
        copy_theme: Some("Time for a tiny pause.".into()),
    })
}
