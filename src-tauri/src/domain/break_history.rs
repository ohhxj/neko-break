use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakRecord {
    pub session_id: u64,
    pub outcome: String,
    pub occurred_at: String,
    pub actual_seconds: u32,
    pub planned_seconds: u32,
}
