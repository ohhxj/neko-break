use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub interval_minutes: u32,
    pub break_minutes: u32,
    pub launch_at_login: bool,
    pub allow_delay_once: bool,
    pub allow_pause_today: bool,
    pub do_not_disturb_enabled: bool,
    pub do_not_disturb_start: String,
    pub do_not_disturb_end: String,
    pub companion_enabled: bool,
    pub companion_start: String,
    pub companion_end: String,
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
            do_not_disturb_enabled: false,
            do_not_disturb_start: "12:00".into(),
            do_not_disturb_end: "13:30".into(),
            companion_enabled: false,
            companion_start: "09:00".into(),
            companion_end: "22:00".into(),
            default_scene_id: None,
            overlay_style: "immersive".into(),
        }
    }
}
