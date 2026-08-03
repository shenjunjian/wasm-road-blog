//! SWC demo: TypeScript → JavaScript（GLOBALS 闭包）
//! 对应 blog/rust-tools/02-swc.md

use swc_common::{
    comments::SingleThreadedComments,
    sync::Lrc,
    FileName, Globals, Mark, SourceMap, GLOBALS,
};
use swc_ecma_codegen::to_code_default;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};
use swc_ecma_transforms_base::{fixer::fixer, hygiene::hygiene, resolver};
use swc_ecma_transforms_typescript::strip;

fn main() {
    let cm: Lrc<SourceMap> = Default::default();

    let source = r#"const greeting: string = "hello swc";"#;
    let fm = cm.new_source_file(
        Lrc::new(FileName::Custom("input.ts".into())),
        source,
    );

    let comments = SingleThreadedComments::default();
    let lexer = Lexer::new(
        Syntax::Typescript(TsSyntax {
            tsx: false,
            ..Default::default()
        }),
        Default::default(),
        StringInput::from(&*fm),
        Some(&comments),
    );
    let mut parser = Parser::new_from(lexer);
    let program = parser.parse_program().expect("parse failed");

    let globals = Globals::default();
    GLOBALS.set(&globals, || {
        let unresolved_mark = Mark::new();
        let top_level_mark = Mark::new();

        let program = program.apply(resolver(unresolved_mark, top_level_mark, true));
        let program = program.apply(strip(unresolved_mark, top_level_mark));
        let program = program.apply(hygiene());
        let program = program.apply(fixer(Some(&comments)));

        let code = to_code_default(cm.clone(), Some(&comments), &program);
        println!("{code}");
    });
}
