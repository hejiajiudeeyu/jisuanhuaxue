use wasm_bindgen::prelude::*;

use crate::boid::Boid;
use crate::config::{BoidParams, PredatorParams};
use crate::experiment::ExperimentState;
use crate::metrics::{MetricsState, StatsSnapshot};
use crate::predator::Predator;
use crate::systems::flocking::{compute_flock_center, update_boids};
use crate::systems::predation::update_predators;
use crate::vec2::Vec2;

const STATS_COUNT: usize = 14;
const HEADER_COUNT: usize = 2;
const BOID_STRIDE: usize = 6;
const PREDATOR_STRIDE: usize = 8;

#[wasm_bindgen]
pub struct Simulation {
    boids: Vec<Boid>,
    predators: Vec<Predator>,
    width: f32,
    height: f32,
    boid_params: BoidParams,
    predator_params: PredatorParams,
    experiment: ExperimentState,
    metrics: MetricsState,
}

#[wasm_bindgen]
impl Simulation {
    #[wasm_bindgen(constructor)]
    pub fn new(width: f32, height: f32, num_boids: u32, num_predators: u32) -> Self {
        let mut sim = Self {
            boids: Vec::new(),
            predators: Vec::new(),
            width,
            height,
            boid_params: BoidParams::default(),
            predator_params: PredatorParams::default(),
            experiment: ExperimentState::new(),
            metrics: MetricsState::new(),
        };
        sim.spawn_boids(num_boids);
        sim.spawn_predators(num_predators);
        sim
    }

    #[wasm_bindgen(js_name = setNumBoids)]
    pub fn set_num_boids(&mut self, n: u32) {
        self.spawn_boids(n);
    }

    #[wasm_bindgen(js_name = setNumPredators)]
    pub fn set_num_predators(&mut self, n: u32) {
        self.spawn_predators(n);
    }

    #[wasm_bindgen(js_name = setVisualRange)]
    pub fn set_visual_range(&mut self, v: f32) {
        self.boid_params.visual_range = v;
    }

    #[wasm_bindgen(js_name = setViewAngle)]
    pub fn set_view_angle(&mut self, v: f32) {
        self.boid_params.view_angle_deg = v;
    }

    #[wasm_bindgen(js_name = setProtectedRange)]
    pub fn set_protected_range(&mut self, v: f32) {
        self.boid_params.protected_range = v;
    }

    #[wasm_bindgen(js_name = setAvoidanceFactor)]
    pub fn set_avoidance_factor(&mut self, v: f32) {
        self.boid_params.avoidance_factor = v;
    }

    #[wasm_bindgen(js_name = setMatchingFactor)]
    pub fn set_matching_factor(&mut self, v: f32) {
        self.boid_params.matching_factor = v;
    }

    #[wasm_bindgen(js_name = setCenteringFactor)]
    pub fn set_centering_factor(&mut self, v: f32) {
        self.boid_params.centering_factor = v;
    }

    #[wasm_bindgen(js_name = setMaxSpeed)]
    pub fn set_max_speed(&mut self, v: f32) {
        self.boid_params.max_speed = v;
    }

    #[wasm_bindgen(js_name = setMinSpeed)]
    pub fn set_min_speed(&mut self, v: f32) {
        self.boid_params.min_speed = v;
    }

    #[wasm_bindgen(js_name = setFleeRange)]
    pub fn set_flee_range(&mut self, v: f32) {
        self.boid_params.flee_range = v;
    }

    #[wasm_bindgen(js_name = setFleeFactor)]
    pub fn set_flee_factor(&mut self, v: f32) {
        self.boid_params.flee_factor = v;
    }

    #[wasm_bindgen(js_name = setAlertSpread)]
    pub fn set_alert_spread(&mut self, v: f32) {
        self.boid_params.alert_spread_gain = v;
    }

    #[wasm_bindgen(js_name = setPredatorSpeed)]
    pub fn set_predator_speed(&mut self, v: f32) {
        self.predator_params.predator_speed = v;
    }

    #[wasm_bindgen(js_name = setChaseFactor)]
    pub fn set_chase_factor(&mut self, v: f32) {
        self.predator_params.chase_factor = v;
    }

    #[wasm_bindgen(js_name = setPredatorTurnRate)]
    pub fn set_predator_turn_rate(&mut self, v: f32) {
        self.predator_params.turn_rate = v;
    }

    #[wasm_bindgen(js_name = setCaptureRadius)]
    pub fn set_capture_radius(&mut self, v: f32) {
        self.predator_params.capture_radius = v;
    }

    #[wasm_bindgen(js_name = setConfusionThreshold)]
    pub fn set_confusion_threshold(&mut self, v: u32) {
        self.predator_params.confusion_threshold = v;
    }

    #[wasm_bindgen(js_name = setLockFrames)]
    pub fn set_lock_frames(&mut self, v: u32) {
        self.predator_params.lock_frames = v.max(1);
    }

    #[wasm_bindgen(js_name = setPreferEdgeTarget)]
    pub fn set_prefer_edge_target(&mut self, v: bool) {
        self.predator_params.prefer_edge_target = v;
    }

    #[wasm_bindgen(js_name = setSeed)]
    pub fn set_seed(&mut self, seed: u32) {
        self.experiment.set_seed(seed);
    }

    #[wasm_bindgen(js_name = getSeed)]
    pub fn get_seed(&self) -> u32 {
        self.experiment.seed()
    }

    #[wasm_bindgen(js_name = setSize)]
    pub fn set_size(&mut self, w: f32, h: f32) {
        self.width = w;
        self.height = h;
    }

    #[wasm_bindgen(js_name = setExperimentDuration)]
    pub fn set_experiment_duration(&mut self, frames: u32) {
        self.experiment.set_duration(frames);
    }

    #[wasm_bindgen(js_name = isExperimentDone)]
    pub fn is_experiment_done(&self) -> bool {
        self.experiment.is_done()
    }

    #[wasm_bindgen(js_name = resetStats)]
    pub fn reset_stats(&mut self) {
        self.metrics.reset(&mut self.predators);
    }

    #[wasm_bindgen(js_name = resetSimulation)]
    pub fn reset_simulation(&mut self) {
        self.reset(self.boids.len() as u32, self.predators.len() as u32);
    }

    pub fn tick(&mut self) -> js_sys::Float32Array {
        if self.experiment.is_done() {
            return self.build_output();
        }

        self.experiment.advance_frame();
        let predator_positions: Vec<Vec2> = self.predators.iter().map(|p| p.pos).collect();
        let flock_center = compute_flock_center(&self.boids, self.width, self.height);

        update_boids(
            &mut self.boids,
            &predator_positions,
            self.boid_params,
            self.width,
            self.height,
            &mut self.experiment,
        );

        self.metrics
            .track_reaction_time(self.experiment.frame, &self.boids, &self.predators);

        update_predators(
            &mut self.predators,
            &mut self.boids,
            flock_center,
            self.predator_params,
            self.width,
            self.height,
            &mut self.experiment,
            &mut self.metrics,
        );

        self.metrics.record_frame(self.experiment.frame);

        self.build_output()
    }

    pub fn reset(&mut self, num_boids: u32, num_predators: u32) {
        self.spawn_boids(num_boids);
        self.spawn_predators(num_predators);
        self.reset_stats();
        self.experiment.reset_progress();
    }
}

impl Simulation {
    fn spawn_boids(&mut self, n: u32) {
        self.boids.clear();
        for _ in 0..n {
            let x = self.experiment.next_f32() * self.width;
            let y = self.experiment.next_f32() * self.height;
            let vx = (self.experiment.next_f32() - 0.5) * 2.0 * self.boid_params.max_speed;
            let vy = (self.experiment.next_f32() - 0.5) * 2.0 * self.boid_params.max_speed;
            self.boids.push(Boid::new(x, y, vx, vy));
        }
    }

    fn spawn_predators(&mut self, n: u32) {
        self.predators.clear();
        for _ in 0..n {
            let x = self.experiment.next_f32() * self.width;
            let y = self.experiment.next_f32() * self.height;
            let vx = (self.experiment.next_f32() - 0.5) * 2.0;
            let vy = (self.experiment.next_f32() - 0.5) * 2.0;
            self.predators.push(Predator::new(x, y, vx, vy));
        }
    }

    fn build_output(&self) -> js_sys::Float32Array {
        let total = HEADER_COUNT
            + STATS_COUNT
            + self.boids.len() * BOID_STRIDE
            + self.predators.len() * PREDATOR_STRIDE;
        let mut data = vec![0.0f32; total];
        data[0] = self.boids.len() as f32;
        data[1] = self.predators.len() as f32;

        let stats = self.metrics.snapshot(
            &self.boids,
            &self.predators,
            compute_flock_center(&self.boids, self.width, self.height),
            self.width,
            self.height,
            &self.experiment,
        );
        self.write_stats(&mut data, stats);
        self.write_entities(&mut data);

        let output = js_sys::Float32Array::new_with_length(total as u32);
        output.copy_from(&data);
        output
    }

    fn write_stats(&self, data: &mut [f32], stats: StatsSnapshot) {
        let start = HEADER_COUNT;
        data[start] = stats.captures;
        data[start + 1] = stats.capture_rate;
        data[start + 2] = stats.avg_reaction;
        data[start + 3] = stats.first_alert_delay;
        data[start + 4] = stats.alert_coverage;
        data[start + 5] = stats.compactness;
        data[start + 6] = stats.edge_ratio;
        data[start + 7] = stats.switches;
        data[start + 8] = stats.success_rate;
        data[start + 9] = stats.avg_lock_duration;
        data[start + 10] = stats.mean_confusion;
        data[start + 11] = stats.alive_count;
        data[start + 12] = stats.exp_capture_rate;
        data[start + 13] = stats.exp_progress;
    }

    fn write_entities(&self, data: &mut [f32]) {
        let boid_start = HEADER_COUNT + STATS_COUNT;
        for (index, boid) in self.boids.iter().enumerate() {
            let offset = boid_start + index * BOID_STRIDE;
            data[offset] = boid.pos.x;
            data[offset + 1] = boid.pos.y;
            data[offset + 2] = boid.vel.x;
            data[offset + 3] = boid.vel.y;
            data[offset + 4] = boid.alert_level;
            data[offset + 5] = if boid.is_active() { 1.0 } else { 0.0 };
        }

        let predator_start = boid_start + self.boids.len() * BOID_STRIDE;
        for (index, predator) in self.predators.iter().enumerate() {
            let offset = predator_start + index * PREDATOR_STRIDE;
            data[offset] = predator.pos.x;
            data[offset + 1] = predator.pos.y;
            data[offset + 2] = predator.vel.x;
            data[offset + 3] = predator.vel.y;

            let (tx, ty) = if let Some(target_index) = predator.target_index {
                if target_index < self.boids.len() {
                    (self.boids[target_index].pos.x, self.boids[target_index].pos.y)
                } else {
                    (-1.0, -1.0)
                }
            } else {
                (-1.0, -1.0)
            };

            data[offset + 4] = tx;
            data[offset + 5] = ty;
            data[offset + 6] = predator.confusion_level;
            data[offset + 7] = predator.state as u32 as f32;
        }
    }
}
