use wasm_bindgen::prelude::*;

use crate::boid::{compute_flee, compute_flocking, Boid};
use crate::predator::{chase_force, select_target, Predator};
use crate::vec2::{wrap_delta, wrap_distance_sq, Vec2};

#[wasm_bindgen]
pub struct Simulation {
    boids: Vec<Boid>,
    predators: Vec<Predator>,

    width: f32,
    height: f32,

    visual_range: f32,
    protected_range: f32,
    avoidance_factor: f32,
    matching_factor: f32,
    centering_factor: f32,
    max_speed: f32,
    min_speed: f32,
    flee_range: f32,
    flee_factor: f32,

    predator_speed: f32,
    chase_factor: f32,
    capture_radius: f32,
    confusion_threshold: u32,
    prefer_edge_target: bool,

    captures_total: u32,
    recent_captures: Vec<u32>,
    frame: u32,
    first_alert_frame: Option<u32>,
    all_alert_frame: Option<u32>,
    reaction_times: Vec<u32>,
    rng_state: u32,
    respawn_delay: u32,

    experiment_duration: u32,
    experiment_active: bool,
}

const STATS_COUNT: usize = 10;

#[wasm_bindgen]
impl Simulation {
    #[wasm_bindgen(constructor)]
    pub fn new(width: f32, height: f32, num_boids: u32, num_predators: u32) -> Self {
        let seed = (js_sys::Math::random() * 1_000_000.0) as u32;
        let mut sim = Self {
            boids: Vec::new(),
            predators: Vec::new(),
            width,
            height,
            visual_range: 75.0,
            protected_range: 15.0,
            avoidance_factor: 0.05,
            matching_factor: 0.05,
            centering_factor: 0.005,
            max_speed: 6.0,
            min_speed: 3.0,
            flee_range: 150.0,
            flee_factor: 0.5,
            predator_speed: 4.0,
            chase_factor: 0.03,
            capture_radius: 10.0,
            confusion_threshold: 5,
            prefer_edge_target: false,
            captures_total: 0,
            recent_captures: vec![0; 300],
            frame: 0,
            first_alert_frame: None,
            all_alert_frame: None,
            reaction_times: Vec::new(),
            rng_state: seed,
            respawn_delay: 30,
            experiment_duration: 0,
            experiment_active: false,
        };
        sim.spawn_boids(num_boids);
        sim.spawn_predators(num_predators);
        sim
    }

    fn next_rng(&mut self) -> f32 {
        self.rng_state ^= self.rng_state << 13;
        self.rng_state ^= self.rng_state >> 17;
        self.rng_state ^= self.rng_state << 5;
        (self.rng_state as f32) / (u32::MAX as f32)
    }

    fn spawn_boids(&mut self, n: u32) {
        self.boids.clear();
        for _ in 0..n {
            let x = self.next_rng() * self.width;
            let y = self.next_rng() * self.height;
            let vx = (self.next_rng() - 0.5) * 2.0 * self.max_speed;
            let vy = (self.next_rng() - 0.5) * 2.0 * self.max_speed;
            self.boids.push(Boid::new(x, y, vx, vy));
        }
    }

    fn spawn_predators(&mut self, n: u32) {
        self.predators.clear();
        for _ in 0..n {
            let x = self.next_rng() * self.width;
            let y = self.next_rng() * self.height;
            let vx = (self.next_rng() - 0.5) * 2.0;
            let vy = (self.next_rng() - 0.5) * 2.0;
            self.predators.push(Predator::new(x, y, vx, vy));
        }
    }

    // --- Setters ---

    #[wasm_bindgen(js_name = setNumBoids)]
    pub fn set_num_boids(&mut self, n: u32) { self.spawn_boids(n); }

    #[wasm_bindgen(js_name = setNumPredators)]
    pub fn set_num_predators(&mut self, n: u32) { self.spawn_predators(n); }

    #[wasm_bindgen(js_name = setVisualRange)]
    pub fn set_visual_range(&mut self, v: f32) { self.visual_range = v; }

    #[wasm_bindgen(js_name = setProtectedRange)]
    pub fn set_protected_range(&mut self, v: f32) { self.protected_range = v; }

    #[wasm_bindgen(js_name = setAvoidanceFactor)]
    pub fn set_avoidance_factor(&mut self, v: f32) { self.avoidance_factor = v; }

    #[wasm_bindgen(js_name = setMatchingFactor)]
    pub fn set_matching_factor(&mut self, v: f32) { self.matching_factor = v; }

    #[wasm_bindgen(js_name = setCenteringFactor)]
    pub fn set_centering_factor(&mut self, v: f32) { self.centering_factor = v; }

    #[wasm_bindgen(js_name = setMaxSpeed)]
    pub fn set_max_speed(&mut self, v: f32) { self.max_speed = v; }

    #[wasm_bindgen(js_name = setMinSpeed)]
    pub fn set_min_speed(&mut self, v: f32) { self.min_speed = v; }

    #[wasm_bindgen(js_name = setFleeRange)]
    pub fn set_flee_range(&mut self, v: f32) { self.flee_range = v; }

    #[wasm_bindgen(js_name = setFleeFactor)]
    pub fn set_flee_factor(&mut self, v: f32) { self.flee_factor = v; }

    #[wasm_bindgen(js_name = setPredatorSpeed)]
    pub fn set_predator_speed(&mut self, v: f32) { self.predator_speed = v; }

    #[wasm_bindgen(js_name = setChaseFactor)]
    pub fn set_chase_factor(&mut self, v: f32) { self.chase_factor = v; }

    #[wasm_bindgen(js_name = setCaptureRadius)]
    pub fn set_capture_radius(&mut self, v: f32) { self.capture_radius = v; }

    #[wasm_bindgen(js_name = setConfusionThreshold)]
    pub fn set_confusion_threshold(&mut self, v: u32) { self.confusion_threshold = v; }

    #[wasm_bindgen(js_name = setPreferEdgeTarget)]
    pub fn set_prefer_edge_target(&mut self, v: bool) { self.prefer_edge_target = v; }

    #[wasm_bindgen(js_name = setSize)]
    pub fn set_size(&mut self, w: f32, h: f32) {
        self.width = w;
        self.height = h;
    }

    #[wasm_bindgen(js_name = setExperimentDuration)]
    pub fn set_experiment_duration(&mut self, frames: u32) {
        self.experiment_duration = frames;
        self.experiment_active = frames > 0;
    }

    #[wasm_bindgen(js_name = isExperimentDone)]
    pub fn is_experiment_done(&self) -> bool {
        self.experiment_active && self.frame >= self.experiment_duration
    }

    #[wasm_bindgen(js_name = resetStats)]
    pub fn reset_stats(&mut self) {
        self.captures_total = 0;
        self.recent_captures = vec![0; 300];
        self.reaction_times.clear();
        self.first_alert_frame = None;
        self.all_alert_frame = None;
        for p in &mut self.predators {
            p.target_switches = 0;
            p.attack_attempts = 0;
            p.attack_successes = 0;
        }
    }

    // --- Tick ---

    pub fn tick(&mut self) -> js_sys::Float32Array {
        if self.experiment_active && self.frame >= self.experiment_duration {
            return self.build_output();
        }

        self.frame += 1;
        let w = self.width;
        let h = self.height;
        let capture_radius_sq = self.capture_radius * self.capture_radius;

        let pred_positions: Vec<Vec2> = self.predators.iter().map(|p| p.pos).collect();
        let flock_center = self.compute_flock_center();

        let n = self.boids.len();
        let mut new_vels: Vec<Vec2> = Vec::with_capacity(n);
        let mut new_alerts: Vec<f32> = Vec::with_capacity(n);

        for i in 0..n {
            if !self.boids[i].is_active() {
                new_vels.push(self.boids[i].vel);
                new_alerts.push(0.0);
                continue;
            }

            let forces = compute_flocking(
                i, &self.boids, self.visual_range, self.protected_range, w, h,
            );

            let (flee_force, detected_predator) =
                compute_flee(&self.boids[i], &pred_positions, self.flee_range, w, h);

            let new_vel = (self.boids[i].vel
                + forces.separation * self.avoidance_factor
                + forces.alignment * self.matching_factor
                + forces.cohesion * self.centering_factor
                + flee_force * self.flee_factor)
                .clamp_length(self.min_speed, self.max_speed);

            let mut alert = self.boids[i].alert_level * 0.95;
            if detected_predator {
                alert = 1.0;
            }
            if forces.alert_propagation > alert {
                alert = forces.alert_propagation;
            }

            new_vels.push(new_vel);
            new_alerts.push(alert);
        }

        for i in 0..n {
            if self.boids[i].captured_timer > 0 {
                self.boids[i].captured_timer -= 1;
                if self.boids[i].captured_timer == 0 {
                    self.boids[i].pos = Vec2::new(
                        self.next_rng() * w,
                        self.next_rng() * h,
                    );
                    self.boids[i].vel = Vec2::new(
                        (self.next_rng() - 0.5) * self.max_speed,
                        (self.next_rng() - 0.5) * self.max_speed,
                    );
                }
                continue;
            }
            self.boids[i].vel = new_vels[i];
            self.boids[i].pos = (self.boids[i].pos + self.boids[i].vel).wrap_pos(w, h);
            self.boids[i].alert_level = new_alerts[i];
        }

        self.track_reaction_time();

        // Update predators
        let np = self.predators.len();
        for pi in 0..np {
            if self.predators[pi].attack_cooldown > 0 {
                self.predators[pi].attack_cooldown -= 1;
            }

            let rng_val = self.next_rng();

            let old_target = self.predators[pi].target_index;
            let new_target = select_target(
                &self.predators[pi],
                &self.boids,
                self.confusion_threshold,
                rng_val,
                self.prefer_edge_target,
                flock_center,
                w, h,
            );

            if new_target != old_target {
                self.predators[pi].target_switches += 1;
            }
            self.predators[pi].target_index = new_target;

            let mut vel = self.predators[pi].vel;
            if let Some(ti) = new_target {
                if ti < self.boids.len() && self.boids[ti].is_active() {
                    vel = vel + chase_force(
                        &self.predators[pi], self.boids[ti].pos, self.chase_factor, w, h,
                    );
                }
            }

            vel = vel.clamp_length(1.0, self.predator_speed);
            self.predators[pi].vel = vel;
            self.predators[pi].pos = (self.predators[pi].pos + vel).wrap_pos(w, h);

            // Capture check
            if self.predators[pi].attack_cooldown == 0 {
                if let Some(ti) = new_target {
                    if ti < self.boids.len()
                        && self.boids[ti].is_active()
                        && wrap_distance_sq(self.predators[pi].pos, self.boids[ti].pos, w, h)
                            < capture_radius_sq
                    {
                        self.predators[pi].attack_attempts += 1;

                        let nearby_count = self
                            .boids
                            .iter()
                            .filter(|b| {
                                b.is_active()
                                    && wrap_distance_sq(self.predators[pi].pos, b.pos, w, h)
                                        < capture_radius_sq * 16.0
                            })
                            .count() as u32;

                        let mut success = true;
                        if nearby_count >= self.confusion_threshold {
                            let prob = 1.0 / (nearby_count as f32).sqrt();
                            let r = self.next_rng();
                            if r > prob {
                                success = false;
                            }
                        }

                        if success {
                            self.boids[ti].captured_timer = self.respawn_delay;
                            self.boids[ti].alert_level = 0.0;
                            self.captures_total += 1;
                            self.predators[pi].attack_successes += 1;
                            self.predators[pi].attack_cooldown = 60;
                            self.predators[pi].target_index = None;
                        } else {
                            self.predators[pi].attack_cooldown = 20;
                            self.predators[pi].target_index = None;
                        }
                    }
                }
            }
        }

        let frame_idx = (self.frame as usize) % self.recent_captures.len();
        self.recent_captures[frame_idx] = self.captures_total;

        self.build_output()
    }

    fn compute_flock_center(&self) -> Vec2 {
        let active: Vec<&Boid> = self.boids.iter().filter(|b| b.is_active()).collect();
        if active.is_empty() {
            return Vec2::new(self.width * 0.5, self.height * 0.5);
        }
        let ref_pos = active[0].pos;
        let mut sum = Vec2::default();
        for b in &active {
            sum += wrap_delta(b.pos, ref_pos, self.width, self.height);
        }
        let avg_offset = sum * (1.0 / active.len() as f32);
        (ref_pos + avg_offset).wrap_pos(self.width, self.height)
    }

    fn track_reaction_time(&mut self) {
        if self.predators.is_empty() {
            return;
        }
        let any_alert = self.boids.iter().any(|b| b.is_active() && b.alert_level > 0.5);
        let all_active = self.boids.iter().filter(|b| b.is_active()).count();
        let alert_count = self
            .boids
            .iter()
            .filter(|b| b.is_active() && b.alert_level > 0.3)
            .count();

        if any_alert && self.first_alert_frame.is_none() {
            self.first_alert_frame = Some(self.frame);
        }
        if all_active > 0 && alert_count * 2 >= all_active && self.all_alert_frame.is_none() {
            if let Some(first) = self.first_alert_frame {
                self.all_alert_frame = Some(self.frame);
                self.reaction_times.push(self.frame - first);
            }
        }
        if !any_alert {
            self.first_alert_frame = None;
            self.all_alert_frame = None;
        }
    }

    fn build_output(&self) -> js_sys::Float32Array {
        let nb = self.boids.len();
        let np = self.predators.len();
        let boid_stride = 6;
        let pred_stride = 7;
        let header = 2;
        let total = header + STATS_COUNT + nb * boid_stride + np * pred_stride;

        let mut data = vec![0.0f32; total];
        data[0] = nb as f32;
        data[1] = np as f32;

        let flock_center = self.compute_flock_center();

        let capture_rate = self.compute_capture_rate();
        let compactness = self.compute_compactness(flock_center);
        let edge_ratio = self.compute_edge_capture_ratio(flock_center);
        let total_switches: u32 = self.predators.iter().map(|p| p.target_switches).sum();
        let total_attempts: u32 = self.predators.iter().map(|p| p.attack_attempts).sum();
        let total_successes: u32 = self.predators.iter().map(|p| p.attack_successes).sum();
        let success_rate = if total_attempts > 0 {
            total_successes as f32 / total_attempts as f32
        } else {
            0.0
        };
        let avg_reaction = if self.reaction_times.is_empty() {
            0.0
        } else {
            self.reaction_times.iter().sum::<u32>() as f32 / self.reaction_times.len() as f32
        };

        let exp_capture_rate = if self.experiment_active && self.frame > 0 {
            self.captures_total as f32 / self.frame as f32 * 60.0
        } else {
            0.0
        };
        let exp_progress = if self.experiment_active && self.experiment_duration > 0 {
            (self.frame as f32 / self.experiment_duration as f32).min(1.0)
        } else {
            0.0
        };

        let so = header;
        data[so] = self.captures_total as f32;
        data[so + 1] = capture_rate;
        data[so + 2] = avg_reaction;
        data[so + 3] = compactness;
        data[so + 4] = edge_ratio;
        data[so + 5] = total_switches as f32;
        data[so + 6] = success_rate;
        data[so + 7] = self.boids.iter().filter(|b| b.is_active()).count() as f32;
        data[so + 8] = exp_capture_rate;
        data[so + 9] = exp_progress;

        let bo = header + STATS_COUNT;
        for (i, b) in self.boids.iter().enumerate() {
            let off = bo + i * boid_stride;
            data[off] = b.pos.x;
            data[off + 1] = b.pos.y;
            data[off + 2] = b.vel.x;
            data[off + 3] = b.vel.y;
            data[off + 4] = b.alert_level;
            data[off + 5] = if b.is_active() { 1.0 } else { 0.0 };
        }

        let po = bo + nb * boid_stride;
        for (i, p) in self.predators.iter().enumerate() {
            let off = po + i * pred_stride;
            data[off] = p.pos.x;
            data[off + 1] = p.pos.y;
            data[off + 2] = p.vel.x;
            data[off + 3] = p.vel.y;
            let (tx, ty) = if let Some(ti) = p.target_index {
                if ti < self.boids.len() {
                    (self.boids[ti].pos.x, self.boids[ti].pos.y)
                } else {
                    (-1.0, -1.0)
                }
            } else {
                (-1.0, -1.0)
            };
            data[off + 4] = tx;
            data[off + 5] = ty;
            data[off + 6] = p.confusion_level;
        }

        let arr = js_sys::Float32Array::new_with_length(total as u32);
        arr.copy_from(&data);
        arr
    }

    fn compute_capture_rate(&self) -> f32 {
        let window = self.recent_captures.len();
        if self.frame < window as u32 {
            return 0.0;
        }
        let oldest_idx = ((self.frame as usize) + 1) % window;
        let oldest = self.recent_captures[oldest_idx];
        let current = self.captures_total;
        if current >= oldest {
            (current - oldest) as f32 / window as f32 * 60.0
        } else {
            0.0
        }
    }

    fn compute_compactness(&self, center: Vec2) -> f32 {
        let active: Vec<&Boid> = self.boids.iter().filter(|b| b.is_active()).collect();
        if active.is_empty() {
            return 0.0;
        }
        let sum: f32 = active
            .iter()
            .map(|b| wrap_distance_sq(b.pos, center, self.width, self.height).sqrt())
            .sum();
        sum / active.len() as f32
    }

    fn compute_edge_capture_ratio(&self, center: Vec2) -> f32 {
        let active: Vec<&Boid> = self.boids.iter().filter(|b| b.is_active()).collect();
        if active.is_empty() {
            return 0.0;
        }
        let mut distances: Vec<f32> = active
            .iter()
            .map(|b| wrap_distance_sq(b.pos, center, self.width, self.height).sqrt())
            .collect();
        distances.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let median = distances[distances.len() / 2];
        let edge_captured = self
            .boids
            .iter()
            .filter(|b| {
                !b.is_active()
                    && wrap_distance_sq(b.pos, center, self.width, self.height).sqrt() > median
            })
            .count();
        let inner_captured = self
            .boids
            .iter()
            .filter(|b| {
                !b.is_active()
                    && wrap_distance_sq(b.pos, center, self.width, self.height).sqrt() <= median
            })
            .count();
        let total = edge_captured + inner_captured;
        if total == 0 {
            0.5
        } else {
            edge_captured as f32 / total as f32
        }
    }

    pub fn reset(&mut self, num_boids: u32, num_predators: u32) {
        self.spawn_boids(num_boids);
        self.spawn_predators(num_predators);
        self.reset_stats();
        self.frame = 0;
    }
}
