use crate::boid::Boid;
use crate::config::PredatorParams;
use crate::experiment::ExperimentState;
use crate::metrics::MetricsState;
use crate::predator::{Predator, PredatorState};
use crate::vec2::{wrap_delta, wrap_distance_sq, Vec2};

pub fn update_predators(
    predators: &mut [Predator],
    boids: &mut [Boid],
    flock_center: Vec2,
    params: PredatorParams,
    width: f32,
    height: f32,
    experiment: &mut ExperimentState,
    metrics: &mut MetricsState,
) {
    let capture_radius_sq = params.capture_radius * params.capture_radius;

    for predator in predators.iter_mut() {
        if predator.attack_cooldown > 0 {
            predator.attack_cooldown -= 1;
        }
        if predator.target_switch_cooldown > 0 {
            predator.target_switch_cooldown -= 1;
        }

        let old_target = predator.target_index;
        let selection = select_target(
            predator,
            boids,
            params.confusion_threshold,
            experiment.next_f32(),
            params.prefer_edge_target,
            flock_center,
            width,
            height,
        );
        predator.confusion_level = selection.confusion_level;
        let new_target = selection.target_index;

        if new_target != old_target {
            predator.finish_lock();
            if old_target.is_some() && new_target.is_some() {
                predator.target_switches += 1;
                predator.target_switch_cooldown = 8;
            }
        }
        predator.target_index = new_target;

        let desired_velocity = if let Some(target_index) = new_target {
            if target_index < boids.len() && boids[target_index].is_active() {
                predator.current_lock_frames += 1;
                if predator.current_lock_frames >= params.lock_frames {
                    predator.set_state(PredatorState::Attack);
                } else {
                    predator.set_state(PredatorState::Locking);
                }

                let chase_scale = match predator.state {
                    PredatorState::Search => 0.2,
                    PredatorState::Locking => 0.7,
                    PredatorState::Attack => 1.0,
                };
                chase_force(predator, boids[target_index].pos, params.chase_factor * chase_scale, width, height)
            } else {
                predator.finish_lock();
                predator.set_state(PredatorState::Search);
                predator.current_lock_frames = 0;
                wander_force(predator, experiment.next_f32())
            }
        } else {
            predator.finish_lock();
            predator.current_lock_frames = 0;
            predator.set_state(PredatorState::Search);
            wander_force(predator, experiment.next_f32())
        };

        let mut velocity = blend_velocity(predator.vel, desired_velocity, params.turn_rate);
        let max_speed = match predator.state {
            PredatorState::Attack => params.predator_speed * 1.35,
            PredatorState::Locking => params.predator_speed * 1.1,
            PredatorState::Search => params.predator_speed,
        };
        velocity = velocity.clamp_length(1.0, max_speed);
        predator.vel = velocity;
        predator.pos = (predator.pos + velocity).wrap_pos(width, height);

        if predator.attack_cooldown != 0 || predator.state != PredatorState::Attack {
            continue;
        }

        let Some(target_index) = new_target else { continue; };
        if target_index >= boids.len() || !boids[target_index].is_active() {
            continue;
        }
        if wrap_distance_sq(predator.pos, boids[target_index].pos, width, height) >= capture_radius_sq {
            continue;
        }

        predator.attack_attempts += 1;

        let nearby_count = selection.nearby_count;
        let confusion_penalty = if nearby_count >= params.confusion_threshold {
            1.0 / (1.0 + predator.confusion_level)
        } else {
            1.0
        };
        let lock_bonus = (predator.current_lock_frames as f32 / params.lock_frames.max(1) as f32).min(1.35);
        let success = experiment.next_f32() <= (confusion_penalty * lock_bonus).min(0.95);

        if success {
            boids[target_index].captured_timer = experiment.respawn_delay;
            boids[target_index].alert_level = 0.0;
            metrics.record_capture();
            predator.attack_successes += 1;
            predator.attack_cooldown = 60;
            predator.target_switch_cooldown = 12;
            predator.finish_lock();
            predator.current_lock_frames = 0;
            predator.target_index = None;
            predator.set_state(PredatorState::Search);
        } else {
            predator.attack_cooldown = 20;
            predator.target_switch_cooldown = 12;
            predator.finish_lock();
            predator.current_lock_frames = 0;
            predator.target_index = None;
            predator.set_state(PredatorState::Search);
        }
    }
}

struct TargetSelection {
    target_index: Option<usize>,
    nearby_count: u32,
    confusion_level: f32,
}

fn select_target(
    predator: &Predator,
    boids: &[Boid],
    confusion_threshold: u32,
    rng_val: f32,
    prefer_edge: bool,
    flock_center: Vec2,
    width: f32,
    height: f32,
) -> TargetSelection {
    let perception_sq = 200.0 * 200.0;
    let mut nearby = Vec::new();

    for (index, boid) in boids.iter().enumerate() {
        if !boid.is_active() {
            continue;
        }

        let distance = wrap_distance_sq(predator.pos, boid.pos, width, height);
        if distance < perception_sq {
            nearby.push((index, distance));
        }
    }

    if nearby.is_empty() {
        return TargetSelection {
            target_index: find_nearest_active(predator, boids, width, height),
            nearby_count: 0,
            confusion_level: 0.0,
        };
    }

    let nearby_count = nearby.len() as u32;
    let confusion_level = if nearby_count >= confusion_threshold {
        (nearby_count.saturating_sub(confusion_threshold) + 1) as f32 / confusion_threshold.max(1) as f32
    } else {
        0.0
    };

    if let Some(current_target) = predator.target_index {
        if nearby.iter().any(|(index, _)| *index == current_target) {
            if predator.target_switch_cooldown > 0 {
                return TargetSelection {
                    target_index: Some(current_target),
                    nearby_count,
                    confusion_level,
                };
            }
            let retention = (0.82 - confusion_level * 0.28).clamp(0.18, 0.82);
            if rng_val <= retention {
                return TargetSelection {
                    target_index: Some(current_target),
                    nearby_count,
                    confusion_level,
                };
            }
        }
    }

    if nearby_count >= confusion_threshold {
        let scatter_prob = (0.25 + confusion_level * 0.18).clamp(0.0, 0.75);
        if rng_val < scatter_prob {
            let pick = (rng_val * nearby.len() as f32) as usize % nearby.len();
            return TargetSelection {
                target_index: Some(nearby[pick].0),
                nearby_count,
                confusion_level,
            };
        }
    }

    if prefer_edge {
        nearby.sort_by(|a, b| {
            let da = local_risk_score(a.0, boids, flock_center, width, height);
            let db = local_risk_score(b.0, boids, flock_center, width, height);
            db.partial_cmp(&da).unwrap_or(std::cmp::Ordering::Equal)
        });
        return TargetSelection {
            target_index: Some(nearby[0].0),
            nearby_count,
            confusion_level,
        };
    }

    nearby.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    TargetSelection {
        target_index: Some(nearby[0].0),
        nearby_count,
        confusion_level,
    }
}

fn find_nearest_active(predator: &Predator, boids: &[Boid], width: f32, height: f32) -> Option<usize> {
    let mut best: Option<(usize, f32)> = None;
    for (index, boid) in boids.iter().enumerate() {
        if !boid.is_active() {
            continue;
        }
        let distance = wrap_distance_sq(predator.pos, boid.pos, width, height);
        if best.is_none() || distance < best.unwrap().1 {
            best = Some((index, distance));
        }
    }
    best.map(|(index, _)| index)
}

fn chase_force(predator: &Predator, target_pos: Vec2, chase_factor: f32, width: f32, height: f32) -> Vec2 {
    wrap_delta(target_pos, predator.pos, width, height) * chase_factor
}

fn wander_force(predator: &Predator, rng: f32) -> Vec2 {
    let angle = rng * std::f32::consts::TAU;
    predator.vel * 0.3 + Vec2::new(angle.cos(), angle.sin()) * 0.4
}

fn blend_velocity(current: Vec2, desired: Vec2, turn_rate: f32) -> Vec2 {
    current * (1.0 - turn_rate.clamp(0.01, 1.0)) + desired * turn_rate.clamp(0.01, 1.0)
}

fn local_risk_score(index: usize, boids: &[Boid], flock_center: Vec2, width: f32, height: f32) -> f32 {
    let me = &boids[index];
    let mut neighbor_distances = Vec::new();
    for (other_index, other) in boids.iter().enumerate() {
        if other_index == index || !other.is_active() {
            continue;
        }
        neighbor_distances.push(wrap_distance_sq(me.pos, other.pos, width, height).sqrt());
    }
    neighbor_distances.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let local_mean = neighbor_distances.iter().take(8).sum::<f32>() / neighbor_distances.len().clamp(1, 8) as f32;
    let global_offset = wrap_distance_sq(me.pos, flock_center, width, height).sqrt();
    local_mean * 0.7 + global_offset * 0.3
}
