// Rust 侧与 JS 互操作示例：导出 JsValue / Promise / 二进制 buffer 等供 JS 调用。

use font8x8::{BASIC_FONTS, UnicodeFonts};
use js_sys::{
    Array, BigInt, Object, Promise, Reflect, Symbol, Uint8Array,
};
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::{from_value, to_value};
use tiny_skia::{Color, Paint, Pixmap, Rect, Transform};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{console, window};

// ── 1. 基本 JS 值：null / bool / number / string / array / object / symbol / bigint / promise ──

#[wasm_bindgen]
pub fn get_basic_js_values() -> JsValue {
    let obj = Object::new();

    Reflect::set(&obj, &"nullVal".into(), &JsValue::NULL).unwrap();
    Reflect::set(&obj, &"boolVal".into(), &JsValue::from(true)).unwrap();
    Reflect::set(&obj, &"numVal".into(), &JsValue::from(3.14)).unwrap();
    Reflect::set(
        &obj,
        &"strVal".into(),
        &JsValue::from_str("来自 Rust 的字符串"),
    )
    .unwrap();

    let arr = Array::new();
    arr.push(&JsValue::from(1));
    arr.push(&JsValue::from(2));
    arr.push(&JsValue::from_str("three"));
    Reflect::set(&obj, &"arrVal".into(), &arr).unwrap();

    let nested = Object::new();
    Reflect::set(&nested, &"key".into(), &JsValue::from_str("value")).unwrap();
    Reflect::set(&obj, &"objVal".into(), &nested).unwrap();

    let symbol = Symbol::for_("rust-demo");
    Reflect::set(&obj, &"symVal".into(), &symbol).unwrap();

    let bigint_js = JsValue::from_str("9007199254740991");
    let bigint = BigInt::new(&bigint_js).unwrap();
    Reflect::set(&obj, &"bigintVal".into(), &bigint).unwrap();

    let promise = Promise::resolve(&JsValue::from_str("already-resolved"));
    Reflect::set(&obj, &"promiseVal".into(), &promise).unwrap();

    obj.into()
}

// ── 2. web-sys：访问 document / window / body，并创建 DOM ──

#[wasm_bindgen]
pub fn create_rust_dom_panel() -> Result<(), JsValue> {
    let win = window().ok_or_else(|| JsValue::from_str("no window"))?;
    let doc = win.document().ok_or_else(|| JsValue::from_str("no document"))?;
    let body = doc.body().ok_or_else(|| JsValue::from_str("no body"))?;

    if doc.get_element_by_id("rust-dom-panel").is_some() {
        return Ok(());
    }

    let panel = doc.create_element("div")?;
    panel.set_attribute("id", "rust-dom-panel")?;
    panel.set_attribute("class", "rust-panel")?;

    let heading = doc.create_element("h3")?;
    heading.set_text_content(Some("Rust 创建的 DOM"));
    panel.append_child(&heading)?;

    let paragraph = doc.create_element("p")?;
    paragraph.set_text_content(Some(
        "此面板由 web-sys 在 Wasm 中通过 document / body 创建并插入页面。",
    ));
    panel.append_child(&paragraph)?;

    body.append_child(&panel)?;
    console::log_1(&"create_rust_dom_panel: DOM 插入完成".into());
    Ok(())
}

// ── 3. fetch 网络资源，返回 ArrayBuffer 二进制数据 ──

#[wasm_bindgen]
pub fn fetch_resource(url: String) -> Promise {
    wasm_bindgen_futures::future_to_promise(async move {
        let win = window().ok_or_else(|| JsValue::from_str("no window"))?;
        let resp_val =
            wasm_bindgen_futures::JsFuture::from(win.fetch_with_str(&url)).await?;
        let resp: web_sys::Response = resp_val.dyn_into()?;
        if !resp.ok() {
            return Err(JsValue::from_str(&format!(
                "fetch failed: {}",
                resp.status()
            )));
        }
        let buf_val = wasm_bindgen_futures::JsFuture::from(resp.array_buffer()?).await?;
        Ok(buf_val)
    })
}

// ── 4. serde-wasm-bindgen 序列化 / 反序列化 ──

#[derive(Serialize, Deserialize, Debug)]
struct DemoPerson {
    name: String,
    age: u32,
    hobbies: Vec<String>,
}

#[wasm_bindgen]
pub fn serde_roundtrip(name: &str, age: u32) -> Result<JsValue, JsValue> {
    let person = DemoPerson {
        name: name.to_string(),
        age,
        hobbies: vec!["wasm".into(), "rust".into()],
    };

    let serialized = to_value(&person).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let deserialized: DemoPerson =
        from_value(serialized.clone()).map_err(|e| JsValue::from_str(&e.to_string()))?;

    let result = Object::new();
    Reflect::set(&result, &"serialized".into(), &serialized)?;
    Reflect::set(
        &result,
        &"deserializedName".into(),
        &JsValue::from_str(&deserialized.name),
    )?;
    Reflect::set(
        &result,
        &"deserializedAge".into(),
        &JsValue::from(deserialized.age),
    )?;
    Reflect::set(
        &result,
        &"hobbies".into(),
        &to_value(&deserialized.hobbies).map_err(|e| JsValue::from_str(&e.to_string()))?,
    )?;
    Ok(result.into())
}

// ── 5. js-sys Promise：延迟 resolve 后返回给 JS ──

#[wasm_bindgen]
pub fn create_delayed_promise(delay_ms: u32) -> Promise {
    Promise::new(&mut |resolve, _reject| {
        let closure = Closure::wrap(Box::new(move || {
            resolve
                .call1(
                    &JsValue::UNDEFINED,
                    &JsValue::from_str("Promise resolved from Rust via js-sys!"),
                )
                .unwrap();
        }) as Box<dyn FnMut()>);

        window()
            .unwrap()
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                delay_ms as i32,
            )
            .unwrap();
        closure.forget();
    })
}

// ── 6. 绘制正方形 + "helloworld" 文本，返回 PNG 二进制 buffer ──
// skia-canvas 面向 Node.js，浏览器 Wasm 使用纯 Rust 的 tiny-skia 实现同等效果。

fn blit_char(pixmap: &mut Pixmap, ch: char, x: i32, y: i32, color: Color) {
    if ch as u32 > 127 {
        return;
    }
    let glyph = BASIC_FONTS.get(ch);
    if glyph.is_none() {
        return;
    }
    let glyph = glyph.unwrap();
    let premul = color.premultiply();

    for (row, line) in glyph.iter().enumerate() {
        for col in 0..8 {
            if line & (1 << col) != 0 {
                let px = x + col;
                let py = y + row as i32;
                if px >= 0 && py >= 0 {
                    let idx = py as usize * pixmap.width() as usize + px as usize;
                    if let Some(pixel) = pixmap.pixels_mut().get_mut(idx) {
                        *pixel = premul.to_color_u8();
                    }
                }
            }
        }
    }
}

fn draw_text(pixmap: &mut Pixmap, text: &str, x: i32, y: i32, color: Color) {
    let mut cx = x;
    for ch in text.chars() {
        blit_char(pixmap, ch, cx, y, color);
        cx += 9;
    }
}

#[wasm_bindgen]
pub fn draw_canvas_buffer() -> Result<Vec<u8>, JsValue> {
    let mut pixmap = Pixmap::new(240, 100).ok_or_else(|| JsValue::from_str("pixmap alloc failed"))?;
    pixmap.fill(Color::from_rgba8(255, 255, 255, 255));

    let mut paint = Paint::default();
    paint.set_color_rgba8(0, 120, 215, 255);
    pixmap.fill_rect(
        Rect::from_xywh(16.0, 16.0, 56.0, 56.0).unwrap(),
        &paint,
        Transform::identity(),
        None,
    );

    draw_text(
        &mut pixmap,
        "helloworld",
        88,
        40,
        Color::from_rgba8(32, 32, 32, 255),
    );

    pixmap
        .encode_png()
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn draw_canvas_uint8_array() -> Result<Uint8Array, JsValue> {
    let png = draw_canvas_buffer()?;
    let array = Uint8Array::new_with_length(png.len() as u32);
    array.copy_from(&png);
    Ok(array)
}
