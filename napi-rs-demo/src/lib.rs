#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Mutex;
use std::time::Duration;

// .node 首次加载时执行一次，注册自定义 tokio runtime（Wasm target 不可用 module_init）
#[cfg(not(target_family = "wasm"))]
#[napi_derive::module_init]
fn init() {
  let rt = tokio::runtime::Builder::new_multi_thread()
    .enable_all()
    .thread_name("napi-rs-demo")
    .build()
    .unwrap();
  create_custom_tokio_runtime(rt);
}

#[napi]
pub fn plus_100(input: u32) -> u32 {
  input + 100
}

// async fn → JS 侧 asyncTask() 返回 Promise
#[napi]
pub async fn async_task(input: String) -> Result<String> {
  tokio::time::sleep(Duration::from_millis(10)).await;
  Ok(format!("processed: {input}"))
}

// 导出 JS 类
#[napi]
pub struct Calculator {
    acc: Mutex<f64>,
}

#[napi]
impl Calculator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Calculator { acc: Mutex::new(0.0) }
    }

    #[napi]
    pub fn add(&self, v: f64) -> f64 {
        let mut acc = self.acc.lock().unwrap();
        *acc += v;
        *acc
    }
}

// 错误处理
#[napi]
pub fn divide(a: f64, b: f64) -> Result<f64> {
    if b == 0.0 {
        return Err(Error::from_reason("division by zero"));
    }
    Ok(a / b)
}