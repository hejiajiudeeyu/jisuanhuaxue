use wasm_bindgen::prelude::*;

mod config;
mod vec2;
mod boid;
mod predator;
mod experiment;
mod metrics;
mod simulation;
mod systems;

pub use simulation::Simulation;

#[wasm_bindgen(start)]
pub fn init() {
    // intentional no-op; placeholder for future panic hook
}
