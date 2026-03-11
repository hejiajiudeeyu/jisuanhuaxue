use wasm_bindgen::prelude::*;

mod vec2;
mod boid;
mod predator;
mod simulation;

pub use simulation::Simulation;

#[wasm_bindgen(start)]
pub fn init() {
    // intentional no-op; placeholder for future panic hook
}
