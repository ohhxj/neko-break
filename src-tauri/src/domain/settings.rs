use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub interval_minutes: u32,
    pub break_minutes: u32,
    pub launch_at_login: bool,
    pub allow_delay_once: bool,
    pub allow_pause_today: bool,
    pub default_scene_id: Option<String>,
    pub overlay_style: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            interval_minutes: 90,
            break_minutes: 5,
            launch_at_login: true,
            allow_delay_once: true,
            allow_pause_today: true,
            default_scene_id: None,
            overlay_style: "immersive".into(),
        }
    }
}
