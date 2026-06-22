
#### 导出函数给 JS

```rust
use wasm_bindgen::prelude::*;

// 基本导出
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

// 导出结构体为 JS 类
#[wasm_bindgen]
pub struct Counter {
    value: i32,
}

#[wasm_bindgen]
impl Counter {
    #[wasm_bindgen(constructor)]
    pub fn new(start: i32) -> Counter {
        Counter { value: start }
    }

    pub fn increment(&mut self) -> i32 {
        self.value += 1;
        self.value
    }

    pub fn get(&self) -> i32 {
        self.value
    }
}
```

JS 侧：

```javascript
import init, { greet, Counter } from './pkg/my_wasm.js';

await init();

console.log(greet('World'));       // "Hello, World!"

const counter = new Counter(10);
console.log(counter.increment());  // 11
console.log(counter.get());        // 11
```

#### 从 JS 导入函数

```rust
use wasm_bindgen::prelude::*;

// 导入 JS 的 alert 函数
#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn run() {
    alert("Hello from Rust via JS alert!");
    log("Logged from Rust via console.log");
}
```

#### 接收 JS 回调（闭包）

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn call_callback(callback: &js_sys::Function, value: i32) {
    let this = JsValue::NULL;
    let arg = JsValue::from(value);
    callback.call1(&this, &arg).unwrap();
}
```

JS 侧：

```javascript
call_callback((v) => console.log('received:', v), 42);
```