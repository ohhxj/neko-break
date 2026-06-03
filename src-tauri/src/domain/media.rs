use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbeResult {
    pub duration_seconds: f32,
    pub pixel_width: u32,
    pub pixel_height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneClip {
    pub id: String,
    pub file_path: String,
    pub preview_image_path: Option<String>,
    pub format: String,
    pub duration_seconds: f32,
    pub file_size_bytes: u64,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub has_transparency: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneAsset {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub preview_image_path: Option<String>,
    pub format: String,
    pub duration_seconds: f32,
    pub file_size_bytes: u64,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub has_transparency: bool,
    pub enabled: bool,
    pub built_in: bool,
    pub copy_theme: Option<String>,
    pub cover_image_path: Option<String>,
    pub intro_clip: Option<SceneClip>,
    pub loop_clip: SceneClip,
    pub outro_clip: Option<SceneClip>,
    pub overlay_style_hint: Option<String>,
    pub close_button_label: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyMediaAsset {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub preview_image_path: Option<String>,
    pub format: String,
    pub duration_seconds: f32,
    pub file_size_bytes: u64,
    pub pixel_width: u32,
    pub pixel_height: u32,
    pub has_transparency: bool,
    pub enabled: bool,
    pub built_in: bool,
    pub copy_theme: Option<String>,
}

impl SceneAsset {
    pub fn from_legacy(asset: LegacyMediaAsset) -> Self {
        let loop_clip = SceneClip {
            id: format!("{}-loop", asset.id),
            file_path: asset.file_path.clone(),
            preview_image_path: asset.preview_image_path.clone(),
            format: asset.format.clone(),
            duration_seconds: asset.duration_seconds,
            file_size_bytes: asset.file_size_bytes,
            pixel_width: asset.pixel_width,
            pixel_height: asset.pixel_height,
            has_transparency: asset.has_transparency,
        };

        Self {
            id: asset.id,
            name: asset.name,
            file_path: asset.file_path,
            preview_image_path: asset.preview_image_path.clone(),
            format: asset.format,
            duration_seconds: asset.duration_seconds,
            file_size_bytes: asset.file_size_bytes,
            pixel_width: asset.pixel_width,
            pixel_height: asset.pixel_height,
            has_transparency: asset.has_transparency,
            enabled: asset.enabled,
            built_in: asset.built_in,
            copy_theme: asset.copy_theme,
            cover_image_path: asset.preview_image_path,
            intro_clip: None,
            loop_clip,
            outro_clip: None,
            overlay_style_hint: None,
            close_button_label: None,
        }
    }
}

fn detect_format(file_path: &str) -> &'static str {
    let lower = file_path.to_lowercase();
    if lower.ends_with(".webm") {
        "webm_alpha"
    } else if lower.ends_with(".mov") {
        "mov_alpha"
    } else if lower.ends_with(".apng") || lower.ends_with(".png") {
        "apng_alpha"
    } else {
        "unknown"
    }
}

fn scene_clip_from_fields(
    id: &str,
    file_path: String,
    preview_image_path: Option<String>,
    format: String,
    duration_seconds: f32,
    file_size_bytes: u64,
    pixel_width: u32,
    pixel_height: u32,
    has_transparency: bool,
) -> SceneClip {
    SceneClip {
        id: format!("{id}-loop"),
        file_path,
        preview_image_path,
        format,
        duration_seconds,
        file_size_bytes,
        pixel_width,
        pixel_height,
        has_transparency,
    }
}

pub async fn ensure_scene_previews(app: &tauri::AppHandle, scene: &mut SceneAsset) {
    let mut poster_seed = scene.name.trim().to_string();
    if poster_seed.is_empty() {
        poster_seed = "scene".into();
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);

    if let Some(intro) = scene.intro_clip.as_mut() {
        if intro.preview_image_path.is_none() {
            let stem = format!("{poster_seed}-intro");
            intro.preview_image_path = generate_preview_image(app, &intro.file_path, &stem, stamp).await;
        }
    }

    if scene.loop_clip.preview_image_path.is_none() {
        let stem = format!("{poster_seed}-loop");
        scene.loop_clip.preview_image_path =
            generate_preview_image(app, &scene.loop_clip.file_path, &stem, stamp + 1).await;
    }

    if let Some(outro) = scene.outro_clip.as_mut() {
        if outro.preview_image_path.is_none() {
            let stem = format!("{poster_seed}-outro");
            outro.preview_image_path = generate_preview_image(app, &outro.file_path, &stem, stamp + 2).await;
        }
    }

    if scene.preview_image_path.is_none() {
        scene.preview_image_path = scene
            .loop_clip
            .preview_image_path
            .clone()
            .or_else(|| scene.intro_clip.as_ref().and_then(|clip| clip.preview_image_path.clone()))
            .or_else(|| scene.outro_clip.as_ref().and_then(|clip| clip.preview_image_path.clone()));
    }

    if scene.cover_image_path.is_none() {
        scene.cover_image_path = scene
            .preview_image_path
            .clone()
            .or_else(|| scene.loop_clip.preview_image_path.clone());
    }
}

async fn generate_preview_image(
    app: &tauri::AppHandle,
    file_path: &str,
    stem: &str,
    stamp: u128,
) -> Option<String> {
    let base = app.path().app_config_dir().ok()?.join("media-previews");
    fs::create_dir_all(&base).await.ok()?;

    let output_preview = base.join(format!("{stem}-poster-{stamp}.png"));
    let output_preview_string = output_preview.to_str()?.to_string();

    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            file_path,
            "-vf",
            "select=eq(n\\,0),scale=720:-1:flags=lanczos",
            "-frames:v",
            "1",
            &output_preview_string,
        ])
        .status()
        .ok()?;

    if !status.success() {
        return None;
    }

    Some(output_preview_string)
}

/// 仅支持透明 MOV（HEVC-alpha / ProRes 4444）。
/// WebM 在 macOS WebView 里无法透明合成，直接拒绝导入；
/// 返回校验通过的文件大小（字节）。
async fn validate_mov_alpha_input(file_path: &str) -> Result<u64, String> {
    let metadata = fs::metadata(file_path)
        .await
        .map_err(|_| "The selected file could not be found.".to_string())?;
    if !metadata.is_file() {
        return Err("The selected path is not a file.".into());
    }
    if metadata.len() == 0 {
        return Err("The selected file is empty. Try a valid transparent MOV.".into());
    }

    match detect_format(file_path) {
        "mov_alpha" => Ok(metadata.len()),
        "webm_alpha" => {
            Err("目前仅支持透明 MOV（mov-alpha）素材，WebM 在 macOS 上无法透明显示。".into())
        }
        _ => Err("Unsupported file type. Import a transparent MOV file.".into()),
    }
}

pub async fn import_clip(
    app: &tauri::AppHandle,
    file_path: &str,
    duration_seconds: f32,
    pixel_width: u32,
    pixel_height: u32,
) -> Result<SceneClip, String> {
    let file_size_bytes = validate_mov_alpha_input(file_path).await?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let id = format!("clip-{stamp}");
    let stem = Path::new(file_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("clip");
    let preview_image_path = generate_preview_image(app, file_path, stem, stamp).await;

    Ok(SceneClip {
        id,
        file_path: file_path.to_string(),
        preview_image_path,
        format: "mov_alpha".to_string(),
        duration_seconds,
        file_size_bytes,
        pixel_width,
        pixel_height,
        has_transparency: true,
    })
}

pub async fn import_asset(
    app: &tauri::AppHandle,
    file_path: &str,
    duration_seconds: f32,
    pixel_width: u32,
    pixel_height: u32,
) -> Result<SceneAsset, String> {
    let file_size_bytes = validate_mov_alpha_input(file_path).await?;

    let name = Path::new(file_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Imported Asset")
        .to_string();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let id = format!("scene-{stamp}");
    let file_path_string = file_path.to_string();
    let preview_image_path = generate_preview_image(app, file_path, &name, stamp).await;
    let loop_clip = scene_clip_from_fields(
        &id,
        file_path_string.clone(),
        preview_image_path.clone(),
        "mov_alpha".to_string(),
        duration_seconds,
        file_size_bytes,
        pixel_width,
        pixel_height,
        true,
    );

    Ok(SceneAsset {
        id,
        name,
        file_path: file_path_string,
        preview_image_path: preview_image_path.clone(),
        format: "mov_alpha".to_string(),
        duration_seconds,
        file_size_bytes,
        pixel_width,
        pixel_height,
        has_transparency: true,
        enabled: true,
        built_in: false,
        copy_theme: None,
        cover_image_path: preview_image_path,
        intro_clip: None,
        loop_clip,
        outro_clip: None,
        overlay_style_hint: None,
        close_button_label: None,
    })
}

#[cfg(target_os = "macos")]
pub fn probe_asset(file_path: &str) -> Result<MediaProbeResult, String> {
    use objc2_av_foundation::AVAsset;
    use objc2_foundation::NSURL;

    let url =
        NSURL::from_file_path(file_path).ok_or("The selected file path could not be opened.".to_string())?;
    let asset = unsafe { AVAsset::assetWithURL(&url) };
    let duration = unsafe { asset.duration() };

    let duration_seconds = if duration.timescale > 0 {
        duration.value as f64 / duration.timescale as f64
    } else {
        0.0
    };

    let natural_size = unsafe { asset.naturalSize() };

    if duration_seconds <= 0.0 {
        return Err("This video did not report a usable duration.".into());
    }

    Ok(MediaProbeResult {
        duration_seconds: duration_seconds as f32,
        pixel_width: natural_size.width.abs().round() as u32,
        pixel_height: natural_size.height.abs().round() as u32,
    })
}

#[cfg(not(target_os = "macos"))]
pub fn probe_asset(_file_path: &str) -> Result<MediaProbeResult, String> {
    Err("Native media probing is not available on this platform yet.".into())
}
