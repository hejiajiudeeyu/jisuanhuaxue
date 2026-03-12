use crate::vec2::Vec2;

#[derive(Clone, Debug)]
pub struct Boid {
    pub pos: Vec2,
    pub vel: Vec2,
    pub alert_level: f32,
    pub captured_timer: u32,
}

impl Boid {
    pub fn new(x: f32, y: f32, vx: f32, vy: f32) -> Self {
        Self {
            pos: Vec2::new(x, y),
            vel: Vec2::new(vx, vy),
            alert_level: 0.0,
            captured_timer: 0,
        }
    }

    pub fn is_active(&self) -> bool {
        self.captured_timer == 0
    }
}
