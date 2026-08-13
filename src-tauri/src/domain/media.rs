use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(target_os = "windows")]
use tauri::path::BaseDirectory;
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
pub struct SceneInteraction {
    pub id: String,
    pub name: String,
    pub clip: SceneClip,
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
    #[serde(default)]
    pub interactions: Vec<SceneInteraction>,
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
            interactions: Vec::new(),
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

fn managed_media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("media-files"))
}

async fn copy_to_managed_media(
    app: &tauri::AppHandle,
    source_path: &str,
    file_id: &str,
) -> Result<String, String> {
    let source = PathBuf::from(source_path);
    let media_dir = managed_media_dir(app)?;
    if source.starts_with(&media_dir) {
        return Ok(source_path.to_string());
    }

    fs::create_dir_all(&media_dir)
        .await
        .map_err(|error| format!("Could not create managed media directory: {error}"))?;
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mov");
    let destination = media_dir.join(format!("{file_id}.{extension}"));
    fs::copy(&source, &destination)
        .await
        .map_err(|error| format!("无法把素材复制到应用资料库：{error}"))?;
    destination
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| "Managed media path could not be encoded.".to_string())
}

async fn ensure_managed_clip(app: &tauri::AppHandle, clip: &mut SceneClip) {
    match copy_to_managed_media(app, &clip.file_path, &clip.id).await {
        Ok(path) => clip.file_path = path,
        Err(error) => eprintln!("Could not migrate clip {}: {error}", clip.id),
    }
}

pub async fn ensure_managed_scene_media(app: &tauri::AppHandle, scene: &mut SceneAsset) {
    if let Some(intro) = scene.intro_clip.as_mut() {
        ensure_managed_clip(app, intro).await;
    }
    ensure_managed_clip(app, &mut scene.loop_clip).await;
    if let Some(outro) = scene.outro_clip.as_mut() {
        ensure_managed_clip(app, outro).await;
    }
    for interaction in &mut scene.interactions {
        ensure_managed_clip(app, &mut interaction.clip).await;
    }

    scene.file_path = scene.loop_clip.file_path.clone();
    scene.format = scene.loop_clip.format.clone();
    scene.duration_seconds = scene.loop_clip.duration_seconds;
    scene.file_size_bytes = scene.loop_clip.file_size_bytes;
    scene.pixel_width = scene.loop_clip.pixel_width;
    scene.pixel_height = scene.loop_clip.pixel_height;
    scene.has_transparency = scene.loop_clip.has_transparency;
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
            match generate_preview_image(app, &intro.file_path, &stem, stamp).await {
                Ok(path) => intro.preview_image_path = Some(path),
                Err(error) => eprintln!("Could not generate intro preview: {error}"),
            }
        }
    }

    if scene.loop_clip.preview_image_path.is_none() {
        let stem = format!("{poster_seed}-loop");
        match generate_preview_image(app, &scene.loop_clip.file_path, &stem, stamp + 1).await {
            Ok(path) => scene.loop_clip.preview_image_path = Some(path),
            Err(error) => eprintln!("Could not generate loop preview: {error}"),
        }
    }

    if let Some(outro) = scene.outro_clip.as_mut() {
        if outro.preview_image_path.is_none() {
            let stem = format!("{poster_seed}-outro");
            match generate_preview_image(app, &outro.file_path, &stem, stamp + 2).await {
                Ok(path) => outro.preview_image_path = Some(path),
                Err(error) => eprintln!("Could not generate outro preview: {error}"),
            }
        }
    }

    for interaction in &mut scene.interactions {
        if interaction.clip.preview_image_path.is_none() {
            let stem = format!("{poster_seed}-interaction-{}", interaction.id);
            match generate_preview_image(app, &interaction.clip.file_path, &stem, stamp + 3).await {
                Ok(path) => interaction.clip.preview_image_path = Some(path),
                Err(error) => eprintln!("Could not generate interaction preview: {error}"),
            }
        }
    }

    if scene.preview_image_path.is_none() {
        scene.preview_image_path = scene
            .loop_clip
            .preview_image_path
            .clone()
            .or_else(|| {
                scene
                    .intro_clip
                    .as_ref()
                    .and_then(|clip| clip.preview_image_path.clone())
            })
            .or_else(|| {
                scene
                    .outro_clip
                    .as_ref()
                    .and_then(|clip| clip.preview_image_path.clone())
            });
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
) -> Result<String, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("media-previews");
    fs::create_dir_all(&base)
        .await
        .map_err(|error| format!("Could not create preview directory: {error}"))?;

    let output_preview = base.join(format!("{stem}-poster-{stamp}.png"));
    let output_preview_string = output_preview
        .to_str()
        .ok_or_else(|| "Preview path could not be encoded.".to_string())?
        .to_string();
    let quick_look_error =
        generate_preview_with_quick_look(file_path, &output_preview, stamp).err();

    if !output_preview.exists() {
        if let Err(ffmpeg_error) = generate_preview_with_ffmpeg(app, file_path, &output_preview) {
            return Err(format!(
                "封面提取失败。Quick Look: {}; ffmpeg: {ffmpeg_error}",
                quick_look_error.unwrap_or_else(|| "没有生成图片".to_string())
            ));
        }
    }

    Ok(output_preview_string)
}

async fn save_preview_data_url(
    app: &tauri::AppHandle,
    stem: &str,
    stamp: u128,
    data_url: &str,
) -> Result<String, String> {
    let encoded = data_url
        .strip_prefix("data:image/png;base64,")
        .ok_or_else(|| "Preview image must be a PNG data URL.".to_string())?;
    let bytes = STANDARD
        .decode(encoded)
        .map_err(|error| format!("Could not decode preview image: {error}"))?;
    if bytes.is_empty() {
        return Err("Preview image was empty.".into());
    }

    let base = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("media-previews");
    fs::create_dir_all(&base)
        .await
        .map_err(|error| format!("Could not create preview directory: {error}"))?;
    let output_preview = base.join(format!("{stem}-poster-{stamp}.png"));
    fs::write(&output_preview, bytes)
        .await
        .map_err(|error| format!("Could not save preview image: {error}"))?;
    output_preview
        .to_str()
        .map(str::to_string)
        .ok_or_else(|| "Preview path could not be encoded.".to_string())
}

#[cfg(target_os = "macos")]
fn generate_preview_with_quick_look(
    file_path: &str,
    output_preview: &Path,
    stamp: u128,
) -> Result<(), String> {
    let temp_dir = output_preview.with_extension(format!("quicklook-{stamp}"));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("Could not create Quick Look directory: {error}"))?;

    let result = (|| {
        let status = Command::new("/usr/bin/qlmanage")
            .args(["-t", "-s", "720", "-o"])
            .arg(&temp_dir)
            .arg(file_path)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|error| format!("Could not start Quick Look: {error}"))?;

        if !status.success() {
            return Err(format!("Quick Look exited with {status}."));
        }

        let generated_preview = std::fs::read_dir(&temp_dir)
            .map_err(|error| format!("Could not read Quick Look output: {error}"))?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .find(|path| {
                path.extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("png"))
            })
            .ok_or_else(|| "Quick Look did not produce a PNG preview.".to_string())?;

        std::fs::rename(&generated_preview, output_preview)
            .map_err(|error| format!("Could not save Quick Look preview: {error}"))
    })();

    let _ = std::fs::remove_dir_all(&temp_dir);
    result
}

#[cfg(not(target_os = "macos"))]
fn generate_preview_with_quick_look(
    _file_path: &str,
    _output_preview: &Path,
    _stamp: u128,
) -> Result<(), String> {
    Err("Quick Look is only available on macOS.".into())
}

fn ffmpeg_candidates(_app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/opt/homebrew/bin/ffmpeg"));
        candidates.push(PathBuf::from("/usr/local/bin/ffmpeg"));
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(path) = _app
            .path()
            .resolve("resources/bin/ffmpeg.exe", BaseDirectory::Resource)
        {
            candidates.push(path);
        }
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidates.push(exe_dir.join("resources").join("bin").join("ffmpeg.exe"));
                candidates.push(exe_dir.join("ffmpeg.exe"));
            }
        }
        candidates.push(PathBuf::from("ffmpeg.exe"));
    }
    candidates.push(PathBuf::from("ffmpeg"));
    candidates
}

/// FFmpeg is a background worker for imports, never an interactive console. On Windows the
/// default child-process flags can briefly create a blank console window; closing it terminates
/// the conversion and therefore interrupts the import.
#[cfg(target_os = "windows")]
fn configure_background_command(command: &mut Command) {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn configure_background_command(_command: &mut Command) {}

fn generate_preview_with_ffmpeg(
    app: &tauri::AppHandle,
    file_path: &str,
    output_preview: &Path,
) -> Result<(), String> {
    let candidates = ffmpeg_candidates(app);
    let mut last_error = "ffmpeg is not installed".to_string();

    for candidate in candidates {
        let mut command = Command::new(&candidate);
        configure_background_command(&mut command);
        match command
            .args([
                "-y",
                "-ss",
                "0.5",
                "-i",
                file_path,
                "-vf",
                "scale=720:-1:flags=lanczos",
                // Keep the alpha plane in the PNG poster. Without an explicit
                // output format, some FFmpeg builds flatten transparent MOV
                // pixels to black while extracting the first frame.
                "-pix_fmt",
                "rgba",
                "-frames:v",
                "1",
            ])
            .arg(output_preview)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
        {
            Ok(status) if status.success() => return Ok(()),
            Ok(status) => last_error = format!("{} exited with {status}", candidate.display()),
            Err(error) => last_error = format!("{}: {error}", candidate.display()),
        }
    }

    Err(last_error)
}

#[cfg(target_os = "windows")]
fn parse_duration_seconds(log: &str) -> Option<f32> {
    let start = log.find("Duration:")? + "Duration:".len();
    let time = log[start..].trim_start().split(',').next()?.trim();
    let mut parts = time.split(':');
    let hours = parts.next()?.parse::<f32>().ok()?;
    let minutes = parts.next()?.parse::<f32>().ok()?;
    let seconds = parts.next()?.parse::<f32>().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

#[cfg(target_os = "windows")]
fn parse_video_size(log: &str) -> Option<(u32, u32)> {
    for token in log.split(|value: char| value.is_whitespace() || value == ',') {
        let value = token.trim_matches(|value: char| {
            !(value.is_ascii_alphanumeric() || value == 'x' || value == 'X')
        });
        let Some(separator) = value.find('x').or_else(|| value.find('X')) else {
            continue;
        };
        let width = &value[..separator];
        let height = &value[separator + 1..];
        if width.is_empty() || height.is_empty() {
            continue;
        }
        if !width.chars().all(|value| value.is_ascii_digit())
            || !height.chars().all(|value| value.is_ascii_digit())
        {
            continue;
        }
        let width = width.parse::<u32>().ok()?;
        let height = height.parse::<u32>().ok()?;
        if width >= 16 && height >= 16 {
            return Some((width, height));
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn probe_media_with_ffmpeg(
    app: &tauri::AppHandle,
    file_path: &str,
) -> Result<MediaProbeResult, String> {
    let mut last_error = "ffmpeg is not installed".to_string();

    for candidate in ffmpeg_candidates(app) {
        let mut command = Command::new(&candidate);
        configure_background_command(&mut command);
        match command
            .args(["-hide_banner", "-i", file_path])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
        {
            Ok(output) => {
                let mut log = String::from_utf8_lossy(&output.stderr).to_string();
                log.push_str(&String::from_utf8_lossy(&output.stdout));
                if let (Some(duration_seconds), Some((pixel_width, pixel_height))) =
                    (parse_duration_seconds(&log), parse_video_size(&log))
                {
                    return Ok(MediaProbeResult {
                        duration_seconds,
                        pixel_width,
                        pixel_height,
                    });
                }
                last_error = format!("{} 无法识别视频时长或尺寸", candidate.display());
            }
            Err(error) => last_error = format!("{}: {error}", candidate.display()),
        }
    }

    Err(format!(
        "无法读取素材信息，请确认文件是可播放的透明视频：{last_error}"
    ))
}

#[cfg(target_os = "windows")]
async fn convert_mov_to_managed_webm(
    app: &tauri::AppHandle,
    source_path: &str,
    file_id: &str,
) -> Result<(String, u64, MediaProbeResult), String> {
    let media_dir = managed_media_dir(app)?;
    fs::create_dir_all(&media_dir)
        .await
        .map_err(|error| format!("Could not create managed media directory: {error}"))?;

    let destination = media_dir.join(format!("{file_id}.webm"));
    let mut last_error = "ffmpeg is not installed".to_string();

    for candidate in ffmpeg_candidates(app) {
        let mut command = Command::new(&candidate);
        configure_background_command(&mut command);
        match command
            .args([
                "-y",
                "-i",
                source_path,
                "-map",
                "0:v:0",
                "-an",
                "-c:v",
                "libvpx-vp9",
                "-pix_fmt",
                "yuva420p",
                "-auto-alt-ref",
                "0",
                "-b:v",
                "0",
                "-crf",
                "18",
                "-deadline",
                "good",
                "-row-mt",
                "1",
            ])
            .arg(&destination)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
        {
            Ok(output) if output.status.success() && destination.exists() => {
                let metadata = fs::metadata(&destination)
                    .await
                    .map_err(|error| format!("无法读取转换后的 WebM：{error}"))?;
                if metadata.len() == 0 {
                    last_error = "转换后的 WebM 文件为空".to_string();
                    continue;
                }
                let destination_string = destination
                    .to_str()
                    .map(str::to_string)
                    .ok_or_else(|| "Converted media path could not be encoded.".to_string())?;
                let probe = probe_media_with_ffmpeg(app, &destination_string)?;
                return Ok((destination_string, metadata.len(), probe));
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let detail = stderr.lines().rev().find(|line| !line.trim().is_empty());
                last_error = match detail {
                    Some(line) => format!("{} 转换失败：{}", candidate.display(), line.trim()),
                    None => format!("{} 转换失败：{}", candidate.display(), output.status),
                };
            }
            Err(error) => last_error = format!("{}: {error}", candidate.display()),
        }
    }

    let _ = fs::remove_file(&destination).await;
    Err(format!(
        "透明 MOV 自动转换失败，请确认素材带透明通道，或先用转换工具导出 WebM：{last_error}"
    ))
}

/// macOS 使用透明 MOV，Windows 使用 VP9-alpha WebM。
/// 返回校验通过的文件大小与识别出的格式。
async fn validate_platform_media_input(file_path: &str) -> Result<(u64, String), String> {
    let metadata = fs::metadata(file_path)
        .await
        .map_err(|_| "The selected file could not be found.".to_string())?;
    if !metadata.is_file() {
        return Err("The selected path is not a file.".into());
    }
    if metadata.len() == 0 {
        return Err("The selected file is empty.".into());
    }

    let format = detect_format(file_path);
    #[cfg(target_os = "macos")]
    {
        return match format {
            "mov_alpha" => Ok((metadata.len(), format.to_string())),
            "webm_alpha" => Err(
                "macOS 版本请导入透明 MOV；WebM 在 macOS WebView 中无法稳定显示透明通道。".into(),
            ),
            _ => Err("不支持的素材格式，请导入透明 MOV。".into()),
        };
    }
    #[cfg(target_os = "windows")]
    {
        return match format {
            "webm_alpha" => Ok((metadata.len(), format.to_string())),
            "mov_alpha" => {
                Err("Windows 版本请导入 VP9-alpha WebM；透明 MOV 仅用于 macOS 版本。".into())
            }
            _ => Err("不支持的素材格式，请导入 VP9-alpha WebM。".into()),
        };
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        match format {
            "mov_alpha" | "webm_alpha" => Ok((metadata.len(), format.to_string())),
            _ => Err("Unsupported media type. Import a transparent MOV or WebM file.".into()),
        }
    }
}

pub async fn import_clip(
    app: &tauri::AppHandle,
    file_path: &str,
    duration_seconds: f32,
    pixel_width: u32,
    pixel_height: u32,
    preview_image_data_url: Option<&str>,
) -> Result<SceneClip, String> {
    #[cfg(target_os = "windows")]
    if detect_format(file_path) == "mov_alpha" {
        let metadata = fs::metadata(file_path)
            .await
            .map_err(|_| "The selected file could not be found.".to_string())?;
        if !metadata.is_file() {
            return Err("The selected path is not a file.".into());
        }
        if metadata.len() == 0 {
            return Err("The selected file is empty.".into());
        }

        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis();
        let id = format!("clip-{stamp}");
        let stem = Path::new(file_path)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("clip");
        let (managed_file_path, file_size_bytes, probe) =
            convert_mov_to_managed_webm(app, file_path, &id).await?;
        // FFmpeg's VP9 decoder drops the alpha plane when it reads the WebM
        // it just created. Extracting the poster from that file therefore
        // bakes transparent pixels into black. The source MOV still exposes
        // its alpha plane to FFmpeg, so use it for the static poster while the
        // converted WebM remains the clip used during playback.
        let preview_image_path = Some(generate_preview_image(app, file_path, stem, stamp).await?);

        return Ok(SceneClip {
            id,
            file_path: managed_file_path,
            preview_image_path,
            format: "webm_alpha".to_string(),
            duration_seconds: probe.duration_seconds,
            file_size_bytes,
            pixel_width: probe.pixel_width,
            pixel_height: probe.pixel_height,
            has_transparency: true,
        });
    }

    let (file_size_bytes, format) = validate_platform_media_input(file_path).await?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let id = format!("clip-{stamp}");
    let stem = Path::new(file_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("clip");
    let managed_file_path = copy_to_managed_media(app, file_path, &id).await?;
    let preview_image_path = Some(match preview_image_data_url {
        Some(data_url) => save_preview_data_url(app, stem, stamp, data_url).await?,
        None => generate_preview_image(app, &managed_file_path, stem, stamp).await?,
    });

    Ok(SceneClip {
        id,
        file_path: managed_file_path,
        preview_image_path,
        format,
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
    preview_image_data_url: Option<&str>,
) -> Result<SceneAsset, String> {
    #[cfg(target_os = "windows")]
    if detect_format(file_path) == "mov_alpha" {
        let metadata = fs::metadata(file_path)
            .await
            .map_err(|_| "The selected file could not be found.".to_string())?;
        if !metadata.is_file() {
            return Err("The selected path is not a file.".into());
        }
        if metadata.len() == 0 {
            return Err("The selected file is empty.".into());
        }

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
        let (file_path_string, file_size_bytes, probe) =
            convert_mov_to_managed_webm(app, file_path, &format!("{id}-loop")).await?;
        // See the equivalent clip-import branch above: render the poster from
        // the MOV so its transparent pixels do not turn into a black preview.
        let preview_image_path = Some(generate_preview_image(app, file_path, &name, stamp).await?);
        let loop_clip = scene_clip_from_fields(
            &id,
            file_path_string.clone(),
            preview_image_path.clone(),
            "webm_alpha".to_string(),
            probe.duration_seconds,
            file_size_bytes,
            probe.pixel_width,
            probe.pixel_height,
            true,
        );

        return Ok(SceneAsset {
            id,
            name,
            file_path: file_path_string,
            preview_image_path: preview_image_path.clone(),
            format: "webm_alpha".to_string(),
            duration_seconds: probe.duration_seconds,
            file_size_bytes,
            pixel_width: probe.pixel_width,
            pixel_height: probe.pixel_height,
            has_transparency: true,
            enabled: true,
            built_in: false,
            copy_theme: None,
            cover_image_path: preview_image_path,
            intro_clip: None,
            loop_clip,
            outro_clip: None,
            interactions: Vec::new(),
            overlay_style_hint: None,
            close_button_label: None,
        });
    }

    let (file_size_bytes, format) = validate_platform_media_input(file_path).await?;

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
    let file_path_string = copy_to_managed_media(app, file_path, &format!("{id}-loop")).await?;
    let preview_image_path = Some(match preview_image_data_url {
        Some(data_url) => save_preview_data_url(app, &name, stamp, data_url).await?,
        None => generate_preview_image(app, &file_path_string, &name, stamp).await?,
    });
    let loop_clip = scene_clip_from_fields(
        &id,
        file_path_string.clone(),
        preview_image_path.clone(),
        format.clone(),
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
        format,
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
        interactions: Vec::new(),
        overlay_style_hint: None,
        close_button_label: None,
    })
}

#[cfg(target_os = "macos")]
pub fn probe_asset(file_path: &str) -> Result<MediaProbeResult, String> {
    use objc2_av_foundation::AVAsset;
    use objc2_foundation::NSURL;

    let url = NSURL::from_file_path(file_path)
        .ok_or("The selected file path could not be opened.".to_string())?;
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
