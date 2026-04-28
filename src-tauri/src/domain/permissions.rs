use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub accessibility_granted: bool,
}

pub fn current_permission_status() -> PermissionStatus {
    PermissionStatus {
        accessibility_granted: false,
    }
}
