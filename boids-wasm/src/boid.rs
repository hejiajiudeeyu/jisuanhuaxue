use crate::vec2::{wrap_delta, Vec2};

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

pub struct FlockForces {
    pub separation: Vec2,
    pub alignment: Vec2,
    pub cohesion: Vec2,
    pub alert_propagation: f32,
}

pub fn compute_flocking(
    idx: usize,
    boids: &[Boid],
    visual_range: f32,
    protected_range: f32,
    w: f32,
    h: f32,
) -> FlockForces {
    let me = &boids[idx];
    let visual_sq = visual_range * visual_range;
    let protected_sq = protected_range * protected_range;

    let mut sep = Vec2::default();
    let mut align = Vec2::default();
    let mut center = Vec2::default();
    let mut neighbors = 0u32;
    let mut max_neighbor_alert: f32 = 0.0;

    for (j, other) in boids.iter().enumerate() {
        if j == idx || !other.is_active() {
            continue;
        }
        let delta = wrap_delta(me.pos, other.pos, w, h);
        let dist_sq = delta.length_sq();

        if dist_sq < protected_sq {
            sep += delta;
        }

        if dist_sq < visual_sq {
            align += other.vel;
            center += delta;
            neighbors += 1;
            if other.alert_level > max_neighbor_alert {
                max_neighbor_alert = other.alert_level;
            }
        }
    }

    if neighbors > 0 {
        let n = neighbors as f32;
        align = align * (1.0 / n);
        center = center * (1.0 / n);
    }

    let cohesion = if neighbors > 0 {
        center
    } else {
        Vec2::default()
    };
    let alignment = if neighbors > 0 {
        align - me.vel
    } else {
        Vec2::default()
    };

    FlockForces {
        separation: sep,
        alignment,
        cohesion,
        alert_propagation: max_neighbor_alert * 0.9,
    }
}

pub fn compute_flee(
    boid: &Boid,
    predator_positions: &[Vec2],
    flee_range: f32,
    w: f32,
    h: f32,
) -> (Vec2, bool) {
    let flee_sq = flee_range * flee_range;
    let mut flee = Vec2::default();
    let mut detected = false;

    for &pred_pos in predator_positions {
        let delta = wrap_delta(boid.pos, pred_pos, w, h);
        let dist_sq = delta.length_sq();
        if dist_sq < flee_sq && dist_sq > 1e-9 {
            let dist = dist_sq.sqrt();
            flee += delta * (1.0 / dist);
            detected = true;
        }
    }

    (flee, detected)
}
