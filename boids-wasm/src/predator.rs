use crate::vec2::Vec2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PredatorState {
    Search = 0,
    Locking = 1,
    Attack = 2,
}

#[derive(Clone, Debug)]
pub struct Predator {
    pub pos: Vec2,
    pub vel: Vec2,
    pub target_index: Option<usize>,
    pub attack_cooldown: u32,
    pub target_switch_cooldown: u32,
    pub confusion_level: f32,
    pub state: PredatorState,
    pub state_timer: u32,
    pub current_lock_frames: u32,
    pub completed_locks: u32,
    pub accumulated_lock_frames: u32,
    pub target_switches: u32,
    pub attack_attempts: u32,
    pub attack_successes: u32,
}

impl Predator {
    pub fn new(x: f32, y: f32, vx: f32, vy: f32) -> Self {
        Self {
            pos: Vec2::new(x, y),
            vel: Vec2::new(vx, vy),
            target_index: None,
            attack_cooldown: 0,
            target_switch_cooldown: 0,
            confusion_level: 0.0,
            state: PredatorState::Search,
            state_timer: 0,
            current_lock_frames: 0,
            completed_locks: 0,
            accumulated_lock_frames: 0,
            target_switches: 0,
            attack_attempts: 0,
            attack_successes: 0,
        }
    }

    pub fn set_state(&mut self, state: PredatorState) {
        if self.state != state {
            self.state = state;
            self.state_timer = 0;
        } else {
            self.state_timer += 1;
        }
    }

    pub fn finish_lock(&mut self) {
        if self.current_lock_frames > 0 {
            self.accumulated_lock_frames += self.current_lock_frames;
            self.completed_locks += 1;
            self.current_lock_frames = 0;
        }
    }
}
