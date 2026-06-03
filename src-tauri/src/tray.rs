use crate::windows;
use tauri::image::Image;
use tauri::menu::MenuEvent;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Wry};

const ITEM_OPEN: &str = "tray_open";
const ITEM_START_BREAK: &str = "tray_start_break";
const ITEM_PAUSE_TODAY: &str = "tray_pause_today";
const ITEM_QUIT: &str = "tray_quit";
const TRAY_ID: &str = "break-reminder-tray";

pub fn create_tray(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, ITEM_OPEN, "Open Dashboard", true, None::<&str>)?;
    let start_break =
        MenuItem::with_id(app, ITEM_START_BREAK, "Start Break Now", true, None::<&str>)?;
    let pause_today =
        MenuItem::with_id(app, ITEM_PAUSE_TODAY, "Pause Today", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, ITEM_QUIT, "Quit", true, None::<&str>)?;

    let menu = Menu::new(app)?;
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
    Ok(())
}

pub fn set_tray_tooltip(app: &AppHandle<Wry>, tooltip: &str) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_tooltip(Some(tooltip))?;
    }
    Ok(())
}

pub fn set_tray_title(app: &AppHandle<Wry>, title: &str) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_title(Some(title))?;
    }
    Ok(())
}

pub fn set_pause_menu_label(app: &AppHandle<Wry>, label: &str) -> tauri::Result<()> {
    if let Some(menu) = app.menu() {
        if let Some(item) = menu.get(ITEM_PAUSE_TODAY) {
            item.as_menuitem()
                .ok_or_else(|| tauri::Error::AssetNotFound(ITEM_PAUSE_TODAY.into()))?
                .set_text(label)?;
        }
    }
    Ok(())
}

pub fn set_pause_menu_enabled(app: &AppHandle<Wry>, enabled: bool) -> tauri::Result<()> {
    if let Some(menu) = app.menu() {
        if let Some(item) = menu.get(ITEM_PAUSE_TODAY) {
            item.as_menuitem()
                .ok_or_else(|| tauri::Error::AssetNotFound(ITEM_PAUSE_TODAY.into()))?
                .set_enabled(enabled)?;
        }
    }
    Ok(())
}
