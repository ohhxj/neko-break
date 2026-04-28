use crate::domain::scheduler::SchedulerSnapshot;
use std::sync::Mutex;

pub struct AppState {
    pub scheduler: Mutex<SchedulerSnapshot>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            scheduler: Mutex::new(SchedulerSnapshot::default()),
        }
    }
}
