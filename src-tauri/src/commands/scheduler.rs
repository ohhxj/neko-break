use crate::app_state::AppState;
use crate::domain::scheduler::SchedulerSnapshot;
use tauri::State;

#[tauri::command]
pub async fn start_scheduler(state: State<'_, AppState>) -> Result<SchedulerSnapshot, String> {
    let snapshot = SchedulerSnapshot {
        state: "counting".into(),
        next_break_at: None,
        remaining_seconds: 90 * 60,
        active_break_seconds: 5 * 60,
    };
    let mut guard = state
        .scheduler
        .lock()
        .map_err(|_| "scheduler lock poisoned")?;
    *guard = snapshot.clone();
    Ok(snapshot)
}

#[tauri::command]
pub async fn delay_break(
    state: State<'_, AppState>,
    minutes: u32,
) -> Result<SchedulerSnapshot, String> {
    let snapshot = SchedulerSnapshot {
        state: "delayed".into(),
        next_break_at: None,
        remaining_seconds: minutes * 60,
        active_break_seconds: 5 * 60,
    };
    let mut guard = state
        .scheduler
        .lock()
        .map_err(|_| "scheduler lock poisoned")?;
    *guard = snapshot.clone();
    Ok(snapshot)
}

#[tauri::command]
pub async fn pause_today(state: State<'_, AppState>) -> Result<SchedulerSnapshot, String> {
    let snapshot = SchedulerSnapshot {
        state: "paused_today".into(),
        next_break_at: None,
        remaining_seconds: 0,
        active_break_seconds: 5 * 60,
    };
    let mut guard = state
        .scheduler
        .lock()
        .map_err(|_| "scheduler lock poisoned")?;
    *guard = snapshot.clone();
    Ok(snapshot)
}
