use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerSnapshot {
    pub state: String,
    pub next_break_at: Option<String>,
    pub remaining_seconds: u32,
    pub active_break_seconds: u32,
}

impl Default for SchedulerSnapshot {
    fn default() -> Self {
        Self {
            state: "idle".into(),
            next_break_at: None,
            remaining_seconds: 0,
            active_break_seconds: 300,
        }
    }
}
