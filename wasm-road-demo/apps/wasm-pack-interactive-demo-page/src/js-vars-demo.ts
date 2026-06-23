import init, {
  call_js_callback,
  receive_basic_js_values,
  receive_person_from_js,
  rust_delay_via_js_set_timeout,
  rust_fetch_via_js,
  sum_shared_int32_array,
} from "wasm-pack-interaction-demo";
import heroUrl from "./assets/hero.png?url";

export async function runJsVarsDemo() {
  await init();

  const output = document.getElementById("js-vars-output");
  if (!output) return;

  const lines: string[] = [];

  try {
    // 1. 基本 JS 值 → Rust
    const basicPayload = {
      nullVal: null,
      boolVal: true,
      numVal: 42.5,
      strVal: "来自 JS 的字符串",
      arrVal: [1, 2, "three"],
      objVal: { key: "value" },
      symVal: Symbol.for("js-demo"),
      bigintVal: 9007199254740991n,
      promiseVal: Promise.resolve("already-resolved-from-js"),
    };
    const basic = (await receive_basic_js_values(basicPayload)) as Record<
      string,
      string
    >;
    console.log("js-var basic====", basic);
    lines.push("【1】基本 JS 值（传入 Rust 后）");
    for (const [key, val] of Object.entries(basic)) {
      lines.push(`  ${key}: ${val}`);
    }

    // 2. 将 setTimeout / fetch 传入 Rust 使用
    const delayMsg = await rust_delay_via_js_set_timeout(setTimeout, 400);
    lines.push(`【2a】JS setTimeout → Rust：${delayMsg}`);

    const byteLength = (await rust_fetch_via_js(fetch, heroUrl)) as number;
    lines.push(`【2b】JS fetch → Rust：${byteLength} bytes`);

    // 3. JS function → js_sys::Function
    const greet = (name: string, age: number) =>
      `Hello ${name}, you are ${age}`;
    const fnResult = call_js_callback(greet, "Bob", 25) as Record<
      string,
      string
    >;
    lines.push("【3】JS function → Rust 调用");
    lines.push(`  回调返回值: ${fnResult.callbackResult}`);
    lines.push(`  对比说明: ${fnResult.vsExternC}`);

    // 4. JS object → serde_wasm_bindgen → Rust struct
    const personPayload = {
      name: "Charlie",
      age: 28,
      hobbies: ["rust", "wasm", "vite"],
    };
    const person = receive_person_from_js(personPayload) as Record<
      string,
      unknown
    >;
    lines.push("【4】JS object → serde → Rust struct");
    lines.push(`  name: ${person.name}, age: ${person.age}`);
    lines.push(`  hobbies: ${person.hobbies}`);
    lines.push(`  ${person.greeting}`);

    // 5. SharedArrayBuffer（需页面处于 cross-origin isolated 环境）
    lines.push("【5】SharedArrayBuffer");
    if (typeof SharedArrayBuffer === "undefined") {
      lines.push(
        "  跳过：SharedArrayBuffer 不可用（需 COOP/COEP 响应头，重启 dev server 后生效）",
      );
    } else {
      const sab = new SharedArrayBuffer(4 * 5);
      const shared = new Int32Array(sab);
      shared.set([10, 20, 30, 40, 50]);
      const sabResult = sum_shared_int32_array(sab) as Record<string, unknown>;
      lines.push(`  ${sabResult.detail}`);
    }
  } catch (err) {
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    lines.push(`\n运行失败: ${message}`);
    throw err;
  } finally {
    output.textContent = lines.join("\n");
  }
}
