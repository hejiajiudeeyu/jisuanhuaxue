#[derive(Clone, Copy, Debug)]
pub struct BoidParams {
    pub visual_range: f32,
    pub view_angle_deg: f32,
    pub protected_range: f32,
    pub avoidance_factor: f32,
    pub matching_factor: f32,
    pub centering_factor: f32,
    pub max_speed: f32,
    pub min_speed: f32,
    pub flee_range: f32,
    pub flee_factor: f32,
    pub alert_decay: f32,
    pub alert_spread_gain: f32,
}

impl Default for BoidParams {
    fn default() -> Self {
        Self {
            visual_range: 75.0,
            view_angle_deg: 240.0,
            protected_range: 15.0,
            avoidance_factor: 0.05,
            matching_factor: 0.05,
            centering_factor: 0.005,
            max_speed: 6.0,
            min_speed: 3.0,
            flee_range: 150.0,
            flee_factor: 0.5,
            alert_decay: 0.93,
            alert_spread_gain: 0.88,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct PredatorParams {
    pub predator_speed: f32,
    pub chase_factor: f32,
    pub turn_rate: f32,
    pub capture_radius: f32,
    pub confusion_threshold: u32,
    pub lock_frames: u32,
    pub prefer_edge_target: bool,
}

impl Default for PredatorParams {
    fn default() -> Self {
        Self {
            predator_speed: 5.0,
            chase_factor: 0.03,
            turn_rate: 0.16,
            capture_radius: 10.0,
            confusion_threshold: 5,
            lock_frames: 16,
            prefer_edge_target: false,
        }
    }
}
