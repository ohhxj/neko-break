use crate::domain::break_history::BreakRecord;
use crate::persistence::break_history_store;

#[tauri::command]
pub async fn load_break_history(app: tauri::AppHandle) -> Result<Vec<BreakRecord>, String> {
    break_history_store::load(&app).await
}

#[tauri::command]
pub async fn record_break_outcome(
    app: tauri::AppHandle,
    record: BreakRecord,
) -> Result<Vec<BreakRecord>, String> {
    break_history_store::record(&app, record).await
}
