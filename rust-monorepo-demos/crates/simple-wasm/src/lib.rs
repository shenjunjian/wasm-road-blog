//! 最小 WebAssembly 示例：演示 exports / imports / memory / table
//!
//! 构建：
//!   cargo build -p simple-wasm --target wasm32-unknown-unknown --release
//!
//! 构建（含 DWARF 调试信息）：
//!   cargo build -p simple-wasm --target wasm32-unknown-unknown
//!
//! 产物：
//!   target/wasm32-unknown-unknown/release/simple_wasm.wasm
//!    

#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    unsafe { abort() }
}

// ---------------------------------------------------------------------------
// imports — 从宿主（JS / 其他 Wasm 模块）导入能力
// ---------------------------------------------------------------------------

#[link(wasm_import_module = "env")]
extern "C" {
    fn abort() -> !;
    /// 宿主提供的函数：将 i32 加倍（演示 import 函数）
    fn host_double(value: i32) -> i32;
}

// ---------------------------------------------------------------------------
// exports — 导出给宿主调用的函数与资源
// ---------------------------------------------------------------------------

/// 导出：基础加法 `(i32, i32) -> i32`
#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}

/// 导出：先 add，再调用 import 的 host_double
#[no_mangle]
pub extern "C" fn add_then_double(a: i32, b: i32) -> i32 {
    let sum = add(a, b);
    // SAFETY: host 在实例化时必须提供 env.host_double
    unsafe { host_double(sum) }
}

// ---------------------------------------------------------------------------
// memory — 线性内存读写， 通过--export-memory 导出了
// Wasm 模块只有一块 WebAssembly.Memory：一段从 0 开始的连续字节数组。
// Rust 的栈、静态数据、堆（若有）都在这块内存里。 详见 【simple-wasm\.cargo\config.toml】
// ---------------------------------------------------------------------------

/// 导出：将 a + b 的结果写入线性内存的 offset 处（4 字节 i32）
#[no_mangle]
pub extern "C" fn add_and_store(a: i32, b: i32, offset: i32) -> i32 {
    let result = add(a, b);
    // SAFETY: offset 由宿主保证在有效内存范围内,  生成指令为：  i32.store offset=0  ; 
    unsafe {
        (offset as *mut i32).write_volatile(result);
    }
    result
}

/// 导出：从线性内存 offset 处读取 i32
#[no_mangle]
pub extern "C" fn load_i32(offset: i32) -> i32 {
    // SAFETY: offset 由宿主保证在有效内存范围内
    unsafe { (offset as *const i32).read_volatile() }
}

// ---------------------------------------------------------------------------
// table — 函数引用表 + call_indirect
// ---------------------------------------------------------------------------

#[inline(never)]
fn table_add(a: i32, b: i32) -> i32 {
    a + b
}

#[inline(never)]
fn table_sub(a: i32, b: i32) -> i32 {
    a - b
}

/// 函数表：索引 0 = add，索引 1 = sub
/// 配合 link-arg=--export-table 导出为 "table"
static OPS: [fn(i32, i32) -> i32; 2] = [table_add, table_sub];

/// 导出：通过函数表间接调用（编译为 call_indirect）
#[no_mangle]
pub extern "C" fn call_via_table(index: i32, a: i32, b: i32) -> i32 {
    match index {
        0 | 1 => OPS[index as usize](a, b),
        _ => 0,
    }
}
