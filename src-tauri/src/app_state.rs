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
    pub generation: u64,
    // 主层（单层模式下唯一层；双层模式下作为循环层）
    pub layer_ptr: usize,
    pub player_ptr: usize,
    pub looper_ptr: usize,
    // 入场层（仅双层模式使用；单层时保持为 0）
    pub intro_layer_ptr: usize,
    pub intro_player_ptr: usize,
    // 退场层（仅原生多层模式使用；单层时保持为 0）
    pub outro_layer_ptr: usize,
    pub outro_player_ptr: usize,
    // 防止入场结束的延迟任务在退场开始后重新点亮循环层。
    pub outro_started: bool,
    // 互动层随场景一次性预挂载，切换时只翻 opacity，不重建 AVPlayerLayer。
    pub interactions: Vec<NativeInteractionLayerState>,
    pub active_interaction_id: Option<String>,
    pub interaction_request: u64,
}

#[cfg(target_os = "macos")]
pub struct NativeInteractionLayerState {
    pub id: String,
    pub file_path: String,
    pub layer_ptr: usize,
    pub player_ptr: usize,
}
