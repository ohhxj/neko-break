use crate::commands::window::NativeOverlayMedia;
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewWindow, WindowEvent};

fn main_window(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or("main window missing".into())
}

fn overlay_window(app: &tauri::AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("overlay")
}

pub fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub fn show_overlay_window(
    app: &tauri::AppHandle,
    style: &str,
    media: Option<&NativeOverlayMedia>,
) -> Result<(), String> {
    if let Ok(main) = main_window(app) {
        let _ = main.hide();
    }

    let window = overlay_window(app).ok_or("overlay window missing")?;
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    window
        .set_fullscreen(false)
        .map_err(|error| error.to_string())?;

    if style == "floating" {
        window
            .set_size(LogicalSize::new(460.0, 300.0))
            .map_err(|error| error.to_string())?;
        position_floating_overlay(&window)?;
        window
            .set_resizable(false)
            .map_err(|error| error.to_string())?;
    } else {
        position_immersive_overlay(&window)?;
        window
            .set_resizable(false)
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        crate::native_overlay::sync_overlay_video(app, &window, media)
            .map_err(|error| error.to_string())?;
    }

    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn position_immersive_overlay(window: &WebviewWindow) -> Result<(), String> {
    let Some(monitor) = window
        .current_monitor()
        .map_err(|error| error.to_string())?
    else {
        return window.maximize().map_err(|error| error.to_string());
    };

    let scale_factor = monitor.scale_factor();
    let monitor_size = monitor.size().to_logical::<f64>(scale_factor);
    let monitor_position = monitor.position().to_logical::<f64>(scale_factor);

    window
        .set_size(LogicalSize::new(monitor_size.width, monitor_size.height))
        .map_err(|error| error.to_string())?;
    window
        .set_position(LogicalPosition::new(monitor_position.x, monitor_position.y))
        .map_err(|error| error.to_string())
}

fn position_floating_overlay(window: &WebviewWindow) -> Result<(), String> {
    let Some(monitor) = window
        .current_monitor()
        .map_err(|error| error.to_string())?
    else {
        return window.center().map_err(|error| error.to_string());
    };

    let scale_factor = monitor.scale_factor();
    let monitor_size = monitor.size().to_logical::<f64>(scale_factor);
    let monitor_position = monitor.position().to_logical::<f64>(scale_factor);
    let width = 460.0;
    let height = 300.0;
    let x = monitor_position.x + monitor_size.width - width - 28.0;
    let y = monitor_position.y + monitor_size.height - height - 48.0;

    window
        .set_position(LogicalPosition::new(
            x.max(monitor_position.x + 24.0),
            y.max(monitor_position.y + 24.0),
        ))
        .map_err(|error| error.to_string())
}

pub fn hide_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = overlay_window(app) {
        let _ = overlay.hide();
    }
    let window = main_window(app)?;
    window.hide().map_err(|error| error.to_string())
}

pub fn toggle_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    let visible = window.is_visible().map_err(|error| error.to_string())?;
    if visible {
        window.hide().map_err(|error| error.to_string())
    } else {
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())
    }
}

pub fn ensure_overlay_defaults(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = overlay_window(app) {
        window.hide().map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        crate::native_overlay::teardown_overlay_video(app).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn hide_overlay_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = overlay_window(app) {
        window.hide().map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        crate::native_overlay::teardown_overlay_video(app).map_err(|error| error.to_string())?;
    }
    show_main_window(app)
}

pub fn hide_overlay_window_silently(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = overlay_window(app) {
        window.hide().map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        crate::native_overlay::teardown_overlay_video(app).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn play_overlay_outro(app: &tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::native_overlay::play_overlay_outro(app).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn update_overlay_media(
    app: &tauri::AppHandle,
    media: Option<&NativeOverlayMedia>,
) -> Result<(), String> {
    let window = overlay_window(app).ok_or("overlay window missing")?;
    #[cfg(target_os = "macos")]
    {
        crate::native_overlay::sync_overlay_video(app, &window, media)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn install_main_window_close_behavior(app: &tauri::AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    let app_handle = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = hide_main_window(&app_handle);
        }
    });
    Ok(())
}
