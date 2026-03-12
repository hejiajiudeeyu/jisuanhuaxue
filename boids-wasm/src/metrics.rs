use crate::boid::Boid;
use crate::experiment::ExperimentState;
use crate::predator::{Predator, PredatorState};
use crate::vec2::{wrap_distance_sq, Vec2};

const CAPTURE_WINDOW: usize = 300;

#[derive(Clone, Debug)]
pub struct MetricsState {
    captures_total: u32,
    recent_captures: Vec<u32>,
    first_alert_frame: Option<u32>,
    first_alert_observed: Option<u32>,
    all_alert_frame: Option<u32>,
    reaction_times: Vec<u32>,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct StatsSnapshot {
    pub captures: f32,
    pub capture_rate: f32,
    pub avg_reaction: f32,
    pub first_alert_delay: f32,
    pub alert_coverage: f32,
    pub compactness: f32,
    pub edge_ratio: f32,
    pub switches: f32,
    pub success_rate: f32,
    pub avg_lock_duration: f32,
    pub mean_confusion: f32,
    pub alive_count: f32,
    pub exp_capture_rate: f32,
    pub exp_progress: f32,
}

impl MetricsState {
    pub fn new() -> Self {
        Self {
            captures_total: 0,
            recent_captures: vec![0; CAPTURE_WINDOW],
            first_alert_frame: None,
            first_alert_observed: None,
            all_alert_frame: None,
            reaction_times: Vec::new(),
        }
    }

    pub fn reset(&mut self, predators: &mut [Predator]) {
        self.captures_total = 0;
        self.recent_captures.fill(0);
        self.reaction_times.clear();
        self.first_alert_frame = None;
        self.first_alert_observed = None;
        self.all_alert_frame = None;

        for predator in predators {
            predator.target_index = None;
            predator.attack_cooldown = 0;
            predator.target_switch_cooldown = 0;
            predator.confusion_level = 0.0;
            predator.state = PredatorState::Search;
            predator.state_timer = 0;
            predator.target_switches = 0;
            predator.attack_attempts = 0;
            predator.attack_successes = 0;
            predator.completed_locks = 0;
            predator.accumulated_lock_frames = 0;
            predator.current_lock_frames = 0;
        }
    }

    pub fn record_capture(&mut self) {
        self.captures_total += 1;
    }

    pub fn track_reaction_time(&mut self, frame: u32, boids: &[Boid], predators: &[Predator]) {
        if predators.is_empty() {
            return;
        }

        let any_alert = boids.iter().any(|b| b.is_active() && b.alert_level > 0.5);
        let all_active = boids.iter().filter(|b| b.is_active()).count();
        let alert_count = boids
            .iter()
            .filter(|b| b.is_active() && b.alert_level > 0.3)
            .count();

        if any_alert && self.first_alert_frame.is_none() {
            self.first_alert_frame = Some(frame);
            if self.first_alert_observed.is_none() {
                self.first_alert_observed = Some(frame);
            }
        }

        if all_active > 0 && alert_count * 2 >= all_active && self.all_alert_frame.is_none() {
            if let Some(first) = self.first_alert_frame {
                self.all_alert_frame = Some(frame);
                self.reaction_times.push(frame - first);
            }
        }

        if !any_alert {
            self.first_alert_frame = None;
            self.all_alert_frame = None;
        }
    }

    pub fn record_frame(&mut self, frame: u32) {
        let frame_idx = (frame as usize) % self.recent_captures.len();
        self.recent_captures[frame_idx] = self.captures_total;
    }

    pub fn snapshot(
        &self,
        boids: &[Boid],
        predators: &[Predator],
        center: Vec2,
        width: f32,
        height: f32,
        experiment: &ExperimentState,
    ) -> StatsSnapshot {
        let total_switches: u32 = predators.iter().map(|p| p.target_switches).sum();
        let total_attempts: u32 = predators.iter().map(|p| p.attack_attempts).sum();
        let total_successes: u32 = predators.iter().map(|p| p.attack_successes).sum();
        let total_completed_locks: u32 = predators.iter().map(|p| p.completed_locks).sum();
        let total_lock_frames: u32 = predators
            .iter()
            .map(|p| p.accumulated_lock_frames + p.current_lock_frames)
            .sum();
        let mean_confusion = if predators.is_empty() {
            0.0
        } else {
            predators.iter().map(|p| p.confusion_level).sum::<f32>() / predators.len() as f32
        };
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

        let exp_capture_rate = if experiment.active && experiment.frame > 0 {
            self.captures_total as f32 / experiment.frame as f32 * 60.0
        } else {
            0.0
        };

        let exp_progress = if experiment.active && experiment.duration > 0 {
            (experiment.frame as f32 / experiment.duration as f32).min(1.0)
        } else {
            0.0
        };

        StatsSnapshot {
            captures: self.captures_total as f32,
            capture_rate: self.capture_rate(experiment.frame),
            avg_reaction,
            first_alert_delay: self.first_alert_observed.unwrap_or(0) as f32,
            alert_coverage: compute_alert_coverage(boids),
            compactness: compute_compactness(boids, center, width, height),
            edge_ratio: compute_edge_capture_ratio(boids, center, width, height),
            switches: total_switches as f32,
            success_rate,
            avg_lock_duration: if total_completed_locks > 0 {
                total_lock_frames as f32 / total_completed_locks as f32
            } else {
                total_lock_frames as f32
            },
            mean_confusion,
            alive_count: boids.iter().filter(|b| b.is_active()).count() as f32,
            exp_capture_rate,
            exp_progress,
        }
    }

    fn capture_rate(&self, frame: u32) -> f32 {
        let window = self.recent_captures.len();
        if frame < window as u32 {
            return 0.0;
        }

        let oldest_idx = ((frame as usize) + 1) % window;
        let oldest = self.recent_captures[oldest_idx];
        let current = self.captures_total;

        if current >= oldest {
            (current - oldest) as f32 / window as f32 * 60.0
        } else {
            0.0
        }
    }
}

fn compute_alert_coverage(boids: &[Boid]) -> f32 {
    let active = boids.iter().filter(|b| b.is_active()).count();
    if active == 0 {
        return 0.0;
    }
    let alerted = boids
        .iter()
        .filter(|b| b.is_active() && b.alert_level > 0.35)
        .count();
    alerted as f32 / active as f32
}

fn compute_compactness(boids: &[Boid], center: Vec2, width: f32, height: f32) -> f32 {
    let active: Vec<&Boid> = boids.iter().filter(|b| b.is_active()).collect();
    if active.is_empty() {
        return 0.0;
    }

    let sum: f32 = active
        .iter()
        .map(|b| wrap_distance_sq(b.pos, center, width, height).sqrt())
        .sum();

    sum / active.len() as f32
}

fn compute_edge_capture_ratio(boids: &[Boid], center: Vec2, width: f32, height: f32) -> f32 {
    let active: Vec<&Boid> = boids.iter().filter(|b| b.is_active()).collect();
    if active.is_empty() {
        return 0.0;
    }

    let mut distances: Vec<f32> = active
        .iter()
        .map(|b| wrap_distance_sq(b.pos, center, width, height).sqrt())
        .collect();
    distances.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let median = distances[distances.len() / 2];
    let edge_captured = boids
        .iter()
        .filter(|b| !b.is_active() && wrap_distance_sq(b.pos, center, width, height).sqrt() > median)
        .count();
    let inner_captured = boids
        .iter()
        .filter(|b| !b.is_active() && wrap_distance_sq(b.pos, center, width, height).sqrt() <= median)
        .count();
    let total = edge_captured + inner_captured;

    if total == 0 {
        0.5
    } else {
        edge_captured as f32 / total as f32
    }
}
