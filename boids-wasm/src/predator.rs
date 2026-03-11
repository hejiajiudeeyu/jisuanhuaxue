use crate::boid::Boid;
use crate::vec2::{wrap_delta, wrap_distance_sq, Vec2};

#[derive(Clone, Debug)]
pub struct Predator {
    pub pos: Vec2,
    pub vel: Vec2,
    pub target_index: Option<usize>,
    pub attack_cooldown: u32,
    pub confusion_level: f32,
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
            confusion_level: 0.0,
            target_switches: 0,
            attack_attempts: 0,
            attack_successes: 0,
        }
    }
}

pub fn select_target(
    predator: &Predator,
    boids: &[Boid],
    confusion_threshold: u32,
    rng_val: f32,
    prefer_edge: bool,
    flock_center: Vec2,
    w: f32,
    h: f32,
) -> Option<usize> {
    let perception_sq: f32 = 200.0 * 200.0;

    let mut nearby: Vec<(usize, f32)> = Vec::new();
    for (i, b) in boids.iter().enumerate() {
        if !b.is_active() {
            continue;
        }
        let d = wrap_distance_sq(predator.pos, b.pos, w, h);
        if d < perception_sq {
            nearby.push((i, d));
        }
    }

    if nearby.is_empty() {
        return find_nearest_active(predator, boids, w, h);
    }

    let n_nearby = nearby.len() as u32;
    let confused = n_nearby >= confusion_threshold;

    if confused {
        let success_prob = 1.0 / (n_nearby as f32).sqrt();
        if rng_val > success_prob {
            let pick = (rng_val * nearby.len() as f32) as usize % nearby.len();
            return Some(nearby[pick].0);
        }
    }

    if prefer_edge {
        nearby.sort_by(|a, b| {
            let da = wrap_distance_sq(boids[a.0].pos, flock_center, w, h);
            let db = wrap_distance_sq(boids[b.0].pos, flock_center, w, h);
            db.partial_cmp(&da).unwrap_or(std::cmp::Ordering::Equal)
        });
        return Some(nearby[0].0);
    }

    nearby.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    Some(nearby[0].0)
}

fn find_nearest_active(predator: &Predator, boids: &[Boid], w: f32, h: f32) -> Option<usize> {
    let mut best: Option<(usize, f32)> = None;
    for (i, b) in boids.iter().enumerate() {
        if !b.is_active() {
            continue;
        }
        let d = wrap_distance_sq(predator.pos, b.pos, w, h);
        if best.is_none() || d < best.unwrap().1 {
            best = Some((i, d));
        }
    }
    best.map(|(i, _)| i)
}

pub fn chase_force(
    predator: &Predator,
    target_pos: Vec2,
    chase_factor: f32,
    w: f32,
    h: f32,
) -> Vec2 {
    let delta = wrap_delta(target_pos, predator.pos, w, h);
    delta * chase_factor
}
