//! Oxc demo: parse → semantic → transform → codegen
//! 对应 blog/rust-tools/01-oxc.md

use std::path::Path;

use oxc::{
    allocator::Allocator,
    codegen::{Codegen, CodegenOptions},
    parser::Parser,
    semantic::SemanticBuilder,
    span::SourceType,
    transformer::{TransformOptions, Transformer},
};

fn main() {
    let source_text = r#"
        const greeting: string = "hello oxc";
        console.log(greeting);
    "#;
    let filename = Path::new("input.ts");
    let source_type = SourceType::ts();

    let allocator = Allocator::default();

    let ret = Parser::new(&allocator, source_text, source_type).parse();
    let mut program = ret.program;

    let scoping = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&program)
        .semantic
        .into_scoping();

    let options = TransformOptions::enable_all();
    Transformer::new(&allocator, filename, &options).build_with_scoping(scoping, &mut program);

    let code = Codegen::new()
        .with_options(CodegenOptions::default())
        .build(&program)
        .code;

    println!("{code}");
}
