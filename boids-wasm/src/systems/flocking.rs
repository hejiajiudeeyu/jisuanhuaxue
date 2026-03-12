use crate::boid::Boid;
use crate::config::BoidParams;
use crate::experiment::ExperimentState;
use crate::vec2::{wrap_delta, Vec2};

pub fn compute_flock_center(boids: &[Boid], width: f32, height: f32) -> Vec2 {
    let active: Vec<&Boid> = boids.iter().filter(|b| b.is_active()).collect();
    if active.is_empty() {
        return Vec2::new(width * 0.5, height * 0.5);
    }

    let ref_pos = active[0].pos;
    let mut sum = Vec2::default();
    for boid in &active {
        sum += wrap_delta(boid.pos, ref_pos, width, height);
    }

    let avg_offset = sum * (1.0 / active.len() as f32);
    (ref_pos + avg_offset).wrap_pos(width, height)
}

pub fn update_boids(
    boids: &mut [Boid],
    predator_positions: &[Vec2],
    params: BoidParams,
    width: f32,
    height: f32,
    experiment: &mut ExperimentState,
) {
    let mut new_velocities = Vec::with_capacity(boids.len());
    let mut new_alerts = Vec::with_capacity(boids.len());

    for index in 0..boids.len() {
        if !boids[index].is_active() {
            new_velocities.push(boids[index].vel);
            new_alerts.push(0.0);
            continue;
        }

        let forces = compute_flocking(
            index,
            boids,
            params.visual_range,
            params.view_angle_deg,
            params.protected_range,
            width,
            height,
        );
        let (flee_force, direct_detection) = compute_flee(
            &boids[index],
            predator_positions,
            params.flee_range,
            params.view_angle_deg,
            width,
            height,
        );

        let new_velocity = (boids[index].vel
            + forces.separation * params.avoidance_factor
            + forces.alignment * params.matching_factor
            + forces.cohesion * params.centering_factor
            + flee_force * params.flee_factor)
            .clamp_length(params.min_speed, params.max_speed);

        let mut alert = boids[index].alert_level * params.alert_decay;
        if direct_detection {
            alert = 1.0;
        }
        let propagated = forces.alert_propagation * params.alert_spread_gain;
        if propagated > alert {
            alert = propagated;
        }

        new_velocities.push(new_velocity);
        new_alerts.push(alert);
    }

    for index in 0..boids.len() {
        if boids[index].captured_timer > 0 {
            boids[index].captured_timer -= 1;
            if boids[index].captured_timer == 0 {
                boids[index].pos = Vec2::new(
                    experiment.next_f32() * width,
                    experiment.next_f32() * height,
                );
                boids[index].vel = Vec2::new(
                    (experiment.next_f32() - 0.5) * params.max_speed,
                    (experiment.next_f32() - 0.5) * params.max_speed,
                );
            }
            continue;
        }

        boids[index].vel = new_velocities[index];
        boids[index].pos = (boids[index].pos + boids[index].vel).wrap_pos(width, height);
        boids[index].alert_level = new_alerts[index];
    }
}

struct FlockForces {
    separation: Vec2,
    alignment: Vec2,
    cohesion: Vec2,
    alert_propagation: f32,
}

fn compute_flocking(
    idx: usize,
    boids: &[Boid],
    visual_range: f32,
    view_angle_deg: f32,
    protected_range: f32,
    width: f32,
    height: f32,
) -> FlockForces {
    let me = &boids[idx];
    let visual_sq = visual_range * visual_range;
    let protected_sq = protected_range * protected_range;

    let mut separation = Vec2::default();
    let mut alignment = Vec2::default();
    let mut center = Vec2::default();
    let mut neighbors = 0u32;
    let mut max_neighbor_alert = 0.0;

    for (j, other) in boids.iter().enumerate() {
        if j == idx || !other.is_active() {
            continue;
        }

        let delta = wrap_delta(me.pos, other.pos, width, height);
        let dist_sq = delta.length_sq();

        if dist_sq < protected_sq {
            separation += delta;
        }

        if dist_sq < visual_sq && is_within_view(me.vel, delta * -1.0, view_angle_deg) {
            alignment += other.vel;
            center += delta;
            neighbors += 1;
            if other.alert_level > max_neighbor_alert {
                max_neighbor_alert = other.alert_level;
            }
        }
    }

    if neighbors > 0 {
        let inv = 1.0 / neighbors as f32;
        alignment = alignment * inv;
        center = center * inv;
    }

    FlockForces {
        separation,
        alignment: if neighbors > 0 { alignment - me.vel } else { Vec2::default() },
        cohesion: if neighbors > 0 { center } else { Vec2::default() },
        alert_propagation: max_neighbor_alert * 0.9,
    }
}

fn compute_flee(
    boid: &Boid,
    predator_positions: &[Vec2],
    flee_range: f32,
    view_angle_deg: f32,
    width: f32,
    height: f32,
) -> (Vec2, bool) {
    let flee_sq = flee_range * flee_range;
    let mut flee = Vec2::default();
    let mut detected = false;

    for &predator_pos in predator_positions {
        let delta = wrap_delta(boid.pos, predator_pos, width, height);
        let dist_sq = delta.length_sq();
        if dist_sq < flee_sq && dist_sq > 1e-9 && is_within_view(boid.vel, delta * -1.0, view_angle_deg) {
            flee += delta * (1.0 / dist_sq.sqrt());
            detected = true;
        }
    }

    (flee, detected)
}

fn is_within_view(velocity: Vec2, forward_delta: Vec2, view_angle_deg: f32) -> bool {
    if forward_delta.length_sq() < 1e-9 {
        return true;
    }
    if velocity.length_sq() < 1e-9 {
        return true;
    }

    let facing = velocity.normalized();
    let direction = forward_delta.normalized();
    let cos_half = (view_angle_deg.to_radians() * 0.5).cos();
    facing.dot(direction) >= cos_half
}
