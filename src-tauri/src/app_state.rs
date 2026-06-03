use crate::domain::scheduler::SchedulerSnapshot;
use std::sync::Mutex;

pub struct AppState {
    pub scheduler: Mutex<SchedulerSnapshot>,
    #[cfg(target_os = "macos")]
    pub native_overlay: Mutex<NativeOverlayState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            scheduler: Mutex::new(SchedulerSnapshot::default()),
            #[cfg(target_os = "macos")]
            native_overlay: Mutex::new(NativeOverlayState::default()),
        }
    }
}

#[cfg(target_os = "macos")]
#[derive(Default)]
pub struct NativeOverlayState {
    // 主层（单层模式下唯一层；双层模式下作为循环层）
    pub layer_ptr: usize,
    pub player_ptr: usize,
    pub looper_ptr: usize,
    // 入场层（仅双层模式使用；单层时保持为 0）
    pub intro_layer_ptr: usize,
    pub intro_player_ptr: usize,
}
