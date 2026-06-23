#[path = "js-vars.rs"]
mod js_vars;
#[path = "rust-vars.rs"]
mod rust_vars;
mod utils;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn main() {
    utils::set_panic_hook();
}
#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, wasm-pack-demo!");
}
