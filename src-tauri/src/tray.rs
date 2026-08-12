use crate::windows;
use std::{
    sync::{Mutex, OnceLock},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::image::Image;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Wry};

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
static TRAY_COUNTDOWN: OnceLock<Mutex<Option<TrayCountdown>>> = OnceLock::new();

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TrayCountdownState {
    Idle,
    Counting,
    BreakActive,
    Delayed,
    QuietHours,
    OutsideCompanionHours,
    PausedToday,
}

impl TrayCountdownState {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "idle" => Some(Self::Idle),
            "counting" => Some(Self::Counting),
            "break_active" => Some(Self::BreakActive),
            "delayed" => Some(Self::Delayed),
            "quiet_hours" => Some(Self::QuietHours),
            "outside_companion_hours" => Some(Self::OutsideCompanionHours),
            "paused_today" => Some(Self::PausedToday),
            _ => None,
        }
    }
}

#[derive(Clone, Debug)]
struct TrayCountdown {
    state: TrayCountdownState,
    deadline: Option<SystemTime>,
}

pub fn create_tray(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, ITEM_STATUS, "Neko Break 已就绪", false, None::<&str>)?;
    let open = MenuItem::with_id(app, ITEM_OPEN, "打开 Neko Break", true, None::<&str>)?;
    let start_break = MenuItem::with_id(app, ITEM_START_BREAK, "立即休息", true, None::<&str>)?;
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

/// Stores an absolute deadline so the native tray can refresh while macOS pauses WebView timers
/// during display sleep.
pub fn sync_countdown(
    app: &AppHandle<Wry>,
    state: &str,
    deadline_unix_ms: Option<i64>,
) -> tauri::Result<()> {
    let state = TrayCountdownState::parse(state)
        .ok_or_else(|| tauri::Error::AssetNotFound(format!("unknown scheduler state: {state}")))?;
    let deadline = deadline_unix_ms.and_then(system_time_from_unix_ms);
    let countdown = TrayCountdown { state, deadline };
    let countdown_state = TRAY_COUNTDOWN.get_or_init(|| Mutex::new(None));
    *countdown_state
        .lock()
        .map_err(|_| tauri::Error::AssetNotFound("tray countdown lock".into()))? = Some(countdown);
    refresh_countdown(app)
}

pub fn refresh_countdown(app: &AppHandle<Wry>) -> tauri::Result<()> {
    let Some(countdown) = TRAY_COUNTDOWN
        .get()
        .and_then(|state| state.lock().ok().and_then(|countdown| countdown.clone()))
    else {
        return Ok(());
    };

    let remaining_seconds = countdown
        .deadline
        .map(|deadline| remaining_seconds_until(deadline, SystemTime::now()))
        .unwrap_or(0);
    apply_countdown_presentation(app, countdown.state, remaining_seconds)
}

fn apply_countdown_presentation(
    app: &AppHandle<Wry>,
    state: TrayCountdownState,
    remaining_seconds: u64,
) -> tauri::Result<()> {
    let countdown = format_countdown(remaining_seconds);
    let (title, tooltip, status) = match state {
        TrayCountdownState::Idle => (
            "喵休息".to_string(),
            "休息计时器待开始".to_string(),
            "Neko Break 已就绪".to_string(),
        ),
        TrayCountdownState::PausedToday => (
            "已暂停".to_string(),
            "今日提醒已暂停".to_string(),
            "今日提醒已暂停".to_string(),
        ),
        TrayCountdownState::BreakActive => (
            format!("休息 {countdown}"),
            format!("休息中 · 还剩 {countdown}"),
            format!("休息中 · 还剩 {countdown}"),
        ),
        TrayCountdownState::QuietHours => (
            "勿扰".to_string(),
            format!("免打扰中 · {countdown} 后恢复"),
            format!("免打扰中 · {countdown} 后恢复"),
        ),
        TrayCountdownState::OutsideCompanionHours => (
            "等待".to_string(),
            format!("等待陪伴 · {countdown} 后开始"),
            format!("等待陪伴 · {countdown} 后开始"),
        ),
        TrayCountdownState::Delayed => (
            countdown.clone(),
            format!("已延后 · {countdown} 后再提醒"),
            format!("已延后 · {countdown} 后再提醒"),
        ),
        TrayCountdownState::Counting => (
            countdown.clone(),
            format!("下次休息还有 {countdown}"),
            format!("距离下次休息 {countdown}"),
        ),
    };

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_tooltip(Some(tooltip))?;
        #[cfg(not(target_os = "windows"))]
        tray.set_title(Some(title))?;
    }
    if let Some(items) = TRAY_MENU_ITEMS.get() {
        let items = items
            .lock()
            .map_err(|_| tauri::Error::AssetNotFound(ITEM_STATUS.into()))?;
        items.status.set_text(status)?;
        items
            .pause_today
            .set_text(if state == TrayCountdownState::PausedToday {
                "恢复提醒"
            } else {
                "今日暂停"
            })?;
        items.pause_today.set_enabled(true)?;
    }
    Ok(())
}

fn system_time_from_unix_ms(value: i64) -> Option<SystemTime> {
    u64::try_from(value)
        .ok()
        .and_then(|milliseconds| UNIX_EPOCH.checked_add(Duration::from_millis(milliseconds)))
}

fn remaining_seconds_until(deadline: SystemTime, now: SystemTime) -> u64 {
    match deadline.duration_since(now) {
        Ok(duration) => duration.as_secs() + u64::from(duration.subsec_nanos() > 0),
        Err(_) => 0,
    }
}

fn format_countdown(seconds: u64) -> String {
    format!("{:02}:{:02}", seconds / 60, seconds % 60)
}

#[cfg(test)]
mod tests {
    use super::{format_countdown, remaining_seconds_until};
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn formats_a_countdown_for_the_tray() {
        assert_eq!(format_countdown(65), "01:05");
    }

    #[test]
    fn rounds_a_future_deadline_up_to_the_next_second() {
        let now = UNIX_EPOCH + Duration::from_secs(100);
        let deadline = now + Duration::from_millis(1_001);
        assert_eq!(remaining_seconds_until(deadline, now), 2);
    }
}
