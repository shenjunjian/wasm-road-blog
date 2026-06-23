// JS 侧传入变量 / 函数，Rust 侧接收并使用。

use js_sys::{
    Array, BigInt, Function, Int32Array, Object, Promise, Reflect, SharedArrayBuffer,
};
use serde::Deserialize;
use serde_wasm_bindgen::from_value;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

fn js_global_this() -> JsValue {
    js_sys::global().into()
}

// ── 1. 基本 JS 值：null / bool / number / string / array / object / symbol / bigint / promise ──

fn js_type_label(v: &JsValue) -> String {
    if v.is_null() {
        "null".into()
    } else if v.is_undefined() {
        "undefined".into()
    } else if v.is_string() {
        "string".into()
    } else if v.as_f64().is_some() {
        "number".into()
    } else if v.as_bool().is_some() {
        "boolean".into()
    } else if Array::is_array(v) {
        "array".into()
    } else if v.is_object() {
        "object".into()
    } else if v.is_symbol() {
        "symbol".into()
    } else if BigInt::instanceof(v) {
        "bigint".into()
    } else if v.dyn_ref::<Promise>().is_some() {
        "promise".into()
    } else {
        "unknown".into()
    }
}

#[wasm_bindgen]
pub fn receive_basic_js_values(payload: JsValue) -> Promise {
    wasm_bindgen_futures::future_to_promise(async move {
        let obj: Object = payload
            .dyn_into()
            .map_err(|_| JsValue::from_str("payload 必须是普通 object"))?;

        let summary = Object::new();

        let null_val = Reflect::get(&obj, &"nullVal".into()).unwrap();
        Reflect::set(
            &summary,
            &"nullVal".into(),
            &JsValue::from_str(&format!(
                "type={} is_null={}",
                js_type_label(&null_val),
                null_val.is_null()
            )),
        )
        .unwrap();

        let bool_val = Reflect::get(&obj, &"boolVal".into()).unwrap();
        Reflect::set(
            &summary,
            &"boolVal".into(),
            &JsValue::from_str(&format!(
                "type={} value={}",
                js_type_label(&bool_val),
                bool_val.as_bool().unwrap_or(false)
            )),
        )
        .unwrap();

        let num_val = Reflect::get(&obj, &"numVal".into()).unwrap();
        Reflect::set(
            &summary,
            &"numVal".into(),
            &JsValue::from_str(&format!(
                "type={} value={}",
                js_type_label(&num_val),
                num_val.as_f64().unwrap_or(f64::NAN)
            )),
        )
        .unwrap();

        let str_val = Reflect::get(&obj, &"strVal".into()).unwrap();
        Reflect::set(
            &summary,
            &"strVal".into(),
            &JsValue::from_str(&format!(
                "type={} value=\"{}\"",
                js_type_label(&str_val),
                str_val.as_string().unwrap_or_default()
            )),
        )
        .unwrap();

        let arr_val = Reflect::get(&obj, &"arrVal".into()).unwrap();
        let arr = Array::from(&arr_val);
        Reflect::set(
            &summary,
            &"arrVal".into(),
            &JsValue::from_str(&format!("type=array length={}", arr.length())),
        )
        .unwrap();

        let obj_val = Reflect::get(&obj, &"objVal".into()).unwrap();
        let nested: Object = obj_val.dyn_into().map_err(|_| JsValue::from_str("objVal 无效"))?;
        let nested_key = Reflect::get(&nested, &"key".into())
            .unwrap()
            .as_string()
            .unwrap_or_default();
        Reflect::set(
            &summary,
            &"objVal".into(),
            &JsValue::from_str(&format!("type=object key=\"{}\"", nested_key)),
        )
        .unwrap();

        let sym_val = Reflect::get(&obj, &"symVal".into()).unwrap();
        Reflect::set(
            &summary,
            &"symVal".into(),
            &JsValue::from_str(&format!(
                "type={} is_symbol={}",
                js_type_label(&sym_val),
                sym_val.is_symbol()
            )),
        )
        .unwrap();

        let bigint_val = Reflect::get(&obj, &"bigintVal".into()).unwrap();
        let bigint: BigInt = bigint_val
            .dyn_into()
            .map_err(|_| JsValue::from_str("bigintVal 无效"))?;
        Reflect::set(
            &summary,
            &"bigintVal".into(),
            &JsValue::from_str(&format!(
                "type=bigint toString={}",
                JsValue::from(bigint).as_string().unwrap_or_default()
            )),
        )
        .unwrap();

        let promise_val = Reflect::get(&obj, &"promiseVal".into()).unwrap();
        let promise: Promise = promise_val
            .dyn_into()
            .map_err(|_| JsValue::from_str("promiseVal 无效"))?;
        let resolved = JsFuture::from(promise).await?;
        Reflect::set(
            &summary,
            &"promiseVal".into(),
            &JsValue::from_str(&format!(
                "type=promise awaited=\"{}\"",
                resolved
                    .as_string()
                    .unwrap_or_else(|| "[non-string value]".into())
            )),
        )
        .unwrap();

        Ok(summary.into())
    })
}

// ── 2. 将 JS 侧的 setTimeout / fetch 等函数传入 Rust 侧使用 ──

#[wasm_bindgen]
pub fn rust_delay_via_js_set_timeout(set_timeout: &Function, delay_ms: u32) -> Promise {
    Promise::new(&mut |resolve, _reject| {
        let closure = Closure::wrap(Box::new(move || {
            resolve
                .call1(
                    &JsValue::UNDEFINED,
                    &JsValue::from_str(&format!(
                        "Rust 通过 JS 传入的 setTimeout 延迟 {delay_ms}ms 后 resolve"
                    )),
                )
                .unwrap();
        }) as Box<dyn FnMut()>);

        let args = Array::new();
        args.push(closure.as_ref());
        args.push(&JsValue::from(delay_ms));
        set_timeout
            .apply(&js_global_this(), &args)
            .expect("setTimeout 调用失败");
        closure.forget();
    })
}

#[wasm_bindgen]
pub fn rust_fetch_via_js(fetch_fn: &Function, url: &str) -> Promise {
    let fetch_fn = fetch_fn.clone();
    let url = url.to_string();
    wasm_bindgen_futures::future_to_promise(async move {
        let args = Array::new();
        args.push(&JsValue::from_str(&url));
        let resp_val = fetch_fn
            .apply(&js_global_this(), &args)
            .map_err(|e| JsValue::from_str(&format!("fetch 调用失败: {:?}", e)))?;
        let fetch_promise: Promise = resp_val
            .dyn_into()
            .map_err(|_| JsValue::from_str("fetch 应返回 Promise<Response>"))?;
        let resp_val = JsFuture::from(fetch_promise).await?;
        let resp: web_sys::Response = resp_val.dyn_into()?;
        if !resp.ok() {
            return Err(JsValue::from_str(&format!("HTTP {}", resp.status())));
        }
        let buf = JsFuture::from(resp.array_buffer()?).await?;
        let bytes = js_sys::Uint8Array::new(&buf);
        Ok(JsValue::from(bytes.byte_length()))
    })
}

// ── 3. JS 侧 function → js_sys::Function，Rust 侧 call1 / apply ──

const FN_VS_EXTERN_C: &str = "js_sys::Function：运行时传入任意 JS 回调，灵活但无编译期类型检查；\
#[wasm_bindgen] extern \"C\"：声明固定 JS 全局函数，编译期绑定、调用开销更低，\
但无法在运行时替换实现，也不适合接收用户自定义闭包。";

#[wasm_bindgen]
pub fn call_js_callback(callback: &Function, name: &str, age: u32) -> Result<JsValue, JsValue> {
    let args = Array::new();
    args.push(&JsValue::from_str(name));
    args.push(&JsValue::from(age));

    let result = callback.apply(&JsValue::NULL, &args)?;

    let out = Object::new();
    Reflect::set(
        &out,
        &"callbackResult".into(),
        &JsValue::from_str(&result.as_string().unwrap_or_default()),
    )?;
    Reflect::set(&out, &"vsExternC".into(), &JsValue::from_str(FN_VS_EXTERN_C))?;
    Ok(out.into())
}

// ── 4. JS object → serde_wasm_bindgen → Rust struct ──

#[derive(Debug, Deserialize)]
struct JsPerson {
    name: String,
    age: u32,
    hobbies: Vec<String>,
}

#[wasm_bindgen]
pub fn receive_person_from_js(obj: JsValue) -> Result<JsValue, JsValue> {
    let person: JsPerson = from_value(obj).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let summary = Object::new();
    Reflect::set(
        &summary,
        &"name".into(),
        &JsValue::from_str(&person.name),
    )?;
    Reflect::set(&summary, &"age".into(), &JsValue::from(person.age))?;
    Reflect::set(
        &summary,
        &"hobbies".into(),
        &JsValue::from_str(&person.hobbies.join(", ")),
    )?;
    Reflect::set(
        &summary,
        &"greeting".into(),
        &JsValue::from_str(&format!(
            "Rust struct 已就绪：{}（{} 岁），爱好 {}",
            person.name,
            person.age,
            person.hobbies.join(" / ")
        )),
    )?;
    Ok(summary.into())
}

// ── 5. SharedArrayBuffer：Rust 侧读取 JS 写入的共享内存 ──

#[wasm_bindgen]
pub fn sum_shared_int32_array(sab: SharedArrayBuffer) -> Result<JsValue, JsValue> {
    let arr = Int32Array::new(&sab);
    let mut sum: i32 = 0;
    for i in 0..arr.length() {
        sum = sum
            .checked_add(arr.get_index(i))
            .ok_or_else(|| JsValue::from_str("求和溢出"))?;
    }

    let out = Object::new();
    Reflect::set(&out, &"length".into(), &JsValue::from(arr.length()))?;
    Reflect::set(&out, &"sum".into(), &JsValue::from(sum))?;
    Reflect::set(
        &out,
        &"detail".into(),
        &JsValue::from_str(&format!(
            "Rust 通过 Int32Array 读取 SharedArrayBuffer，共 {} 个 i32，求和 = {}",
            arr.length(),
            sum
        )),
    )?;
    Ok(out.into())
}
