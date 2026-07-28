use crate::windows;
use tauri::image::Image;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Wry};
use std::sync::{Mutex, OnceLock};

const ITEM_STATUS: &str = "tray_status";
const ITEM_OPEN: &str = "tray_open";
const ITEM_START_BREAK: &str = "tray_start_break";
const ITEM_PAUSE_TODAY: &str = "tray_pause_today";
const ITEM_QUIT: &str = "tray_quit";
const TRAY_ID: &str = "break-reminder-tray";

struct TrayMenuItems {
    status: MenuItem<Wry>,
    pause_today: MenuItem<Wry>,
}

static TRAY_MENU_ITEMS: OnceLock<Mutex<TrayMenuItems>> = OnceLock::new();

pub fn create_tray(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, ITEM_STATUS, "Neko Break 已就绪", false, None::<&str>)?;
    let open = MenuItem::with_id(app, ITEM_OPEN, "打开 Neko Break", true, None::<&str>)?;
    let start_break =
        MenuItem::with_id(app, ITEM_START_BREAK, "立即休息", true, None::<&str>)?;
    let pause_today = MenuItem::with_id(app, ITEM_PAUSE_TODAY, "暂停今日提醒", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, ITEM_QUIT, "退出 Neko Break", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::new(app)?;
    menu.append(&status)?;
    menu.append(&separator)?;
    menu.append(&open)?;
    menu.append(&start_break)?;
    menu.append(&pause_today)?;
    menu.append(&quit)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("Neko Break")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event: MenuEvent| match event.id().as_ref() {
            ITEM_OPEN => {
                let _ = windows::show_main_window(app);
            }
            ITEM_START_BREAK => {
                let _ = windows::show_main_window(app);
                let _ = app.emit_to("main", "tray-start-break", ());
            }
            ITEM_PAUSE_TODAY => {
                let _ = app.emit_to("main", "tray-pause-today", ());
            }
            ITEM_QUIT => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray: &TrayIcon<Wry>, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle().clone();
                let _ = windows::toggle_main_window(&app);
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(Image::from(icon));
    }

    let _ = builder.build(app)?;
    let _ = TRAY_MENU_ITEMS.set(Mutex::new(TrayMenuItems {
        status,
        pause_today,
    }));
    Ok(())
}

pub fn set_tray_tooltip(app: &AppHandle<Wry>, tooltip: &str) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_tooltip(Some(tooltip))?;
    }
    Ok(())
}

pub fn set_tray_title(app: &AppHandle<Wry>, title: &str) -> tauri::Result<()> {
    #[cfg(not(target_os = "windows"))]
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_title(Some(title))?;
    }
    if let Some(items) = TRAY_MENU_ITEMS.get() {
        let status = if title.trim().is_empty() {
            "Neko Break 已就绪".to_string()
        } else {
            format!("距离下次休息 {title}")
        };
        items
            .lock()
            .map_err(|_| tauri::Error::AssetNotFound(ITEM_STATUS.into()))?
            .status
            .set_text(status)?;
    }
    Ok(())
}

pub fn set_pause_menu_label(app: &AppHandle<Wry>, label: &str) -> tauri::Result<()> {
    let _ = app;
    if let Some(items) = TRAY_MENU_ITEMS.get() {
        items
            .lock()
            .map_err(|_| tauri::Error::AssetNotFound(ITEM_PAUSE_TODAY.into()))?
            .pause_today
            .set_text(label)?;
    }
    Ok(())
}

pub fn set_pause_menu_enabled(app: &AppHandle<Wry>, enabled: bool) -> tauri::Result<()> {
    let _ = app;
    if let Some(items) = TRAY_MENU_ITEMS.get() {
        items
            .lock()
            .map_err(|_| tauri::Error::AssetNotFound(ITEM_PAUSE_TODAY.into()))?
            .pause_today
            .set_enabled(enabled)?;
    }
    Ok(())
}
