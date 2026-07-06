use std::env;
use std::fs;
use std::io::{self, Write};

const INPUT_PATH: &str = "/data/input.txt";
const OUTPUT_PATH: &str = "/data/output.txt";

fn main() -> io::Result<()> {
    let demo = "wasi-p1-cli-demo";
    println!("=== {demo} (WASI P1 / wasm32-wasip1) ===\n");

    let args: Vec<String> = env::args().skip(1).collect();
    println!("args ({})", args.len());
    for (i, arg) in args.iter().enumerate() {
        println!("  [{i}] {arg}");
    }

    println!("\nenv (selected):");
    for key in ["WASI_DEMO", "RUST_LOG", "PATH"] {
        if let Ok(val) = env::var(key) {
            println!("  {key}={val}");
        }
    }

    let input = fs::read_to_string(INPUT_PATH)?;
    println!("\nread {INPUT_PATH}:");
    for line in input.lines() {
        println!("  {line}");
    }

    let mut out = fs::File::create(OUTPUT_PATH)?;
    writeln!(out, "Written by {demo}")?;
    writeln!(out, "---")?;
    write!(out, "{input}")?;
    println!("\nwrote {OUTPUT_PATH}");

    Ok(())
}
