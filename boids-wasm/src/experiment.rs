pub const DEFAULT_RESPAWN_DELAY: u32 = 30;

#[derive(Clone, Debug)]
pub struct RandomSource {
    state: u32,
    seed: u32,
}

impl RandomSource {
    pub fn new_random() -> Self {
        Self::from_seed((js_sys::Math::random() * 1_000_000.0) as u32)
    }

    pub fn from_seed(seed: u32) -> Self {
        let seed = sanitize_seed(seed);
        Self { state: seed, seed }
    }

    pub fn reseed(&mut self, seed: u32) {
        let seed = sanitize_seed(seed);
        self.state = seed;
        self.seed = seed;
    }

    pub fn seed(&self) -> u32 {
        self.seed
    }

    pub fn next_f32(&mut self) -> f32 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 17;
        self.state ^= self.state << 5;
        (self.state as f32) / (u32::MAX as f32)
    }
}

#[derive(Clone, Debug)]
pub struct ExperimentState {
    pub frame: u32,
    pub duration: u32,
    pub active: bool,
    pub respawn_delay: u32,
    rng: RandomSource,
}

impl ExperimentState {
    pub fn new() -> Self {
        Self {
            frame: 0,
            duration: 0,
            active: false,
            respawn_delay: DEFAULT_RESPAWN_DELAY,
            rng: RandomSource::new_random(),
        }
    }

    pub fn set_duration(&mut self, frames: u32) {
        self.duration = frames;
        self.active = frames > 0;
    }

    pub fn is_done(&self) -> bool {
        self.active && self.frame >= self.duration
    }

    pub fn reset_progress(&mut self) {
        self.frame = 0;
    }

    pub fn advance_frame(&mut self) {
        self.frame += 1;
    }

    pub fn set_seed(&mut self, seed: u32) {
        self.rng.reseed(seed);
    }

    pub fn seed(&self) -> u32 {
        self.rng.seed()
    }

    pub fn next_f32(&mut self) -> f32 {
        self.rng.next_f32()
    }
}

fn sanitize_seed(seed: u32) -> u32 {
    if seed == 0 { 0xA341_316C } else { seed }
}
