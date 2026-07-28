use crate::domain::break_history::BreakRecord;
use std::path::PathBuf;
use tauri::Manager;
use tokio::fs;

const MAX_RECORDS: usize = 1000;

fn history_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    Ok(base.join("break-history.json"))
}

pub async fn load(app: &tauri::AppHandle) -> Result<Vec<BreakRecord>, String> {
    let path = history_path(app)?;
    match fs::read_to_string(path).await {
        Ok(contents) => serde_json::from_str(&contents).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(error.to_string()),
    }
}

pub async fn record(
    app: &tauri::AppHandle,
    record: BreakRecord,
) -> Result<Vec<BreakRecord>, String> {
    let path = history_path(app)?;
    let mut records = load(app).await?;
    if records.iter().any(|item| item.session_id == record.session_id) {
        return Ok(records);
    }

    records.push(record);
    records.sort_by(|left, right| left.occurred_at.cmp(&right.occurred_at));
    if records.len() > MAX_RECORDS {
        records.drain(0..records.len() - MAX_RECORDS);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_string_pretty(&records).map_err(|error| error.to_string())?;
    fs::write(path, payload)
        .await
        .map_err(|error| error.to_string())?;
    Ok(records)
}
