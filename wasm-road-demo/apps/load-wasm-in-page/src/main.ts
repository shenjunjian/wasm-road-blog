import wasmUrl from './simple_wasm.wasm?url'

async function loadWasm() {
  const imports = {
    env: {
      // 如果 wasm 模块 import 了 "env"."abort"，需要提供此函数
      abort: () => console.error('Wasm abort called'),
      host_double: (x) => x * 2,
    },
  };

  let instance: WebAssembly.Instance;
  try {
    // 优先使用流式加载
    instance = (await WebAssembly.instantiateStreaming(
      fetch(wasmUrl),
      imports
    )).instance;
  } catch (e) {
    // Content-Type 不正确或浏览器不支持时回退
    console.warn('instantiateStreaming 失败，回退到 arrayBuffer 方式:', e);
    const response = await fetch(wasmUrl);
    const bytes = await response.arrayBuffer();
    instance = (await WebAssembly.instantiate(bytes, imports)).instance;
  }

  let result = `add(3, 4) = ${instance.exports.add(3, 4)} <br>
  add_then_double(3, 4) = ${instance.exports.add_then_double(3, 4)} <br>
  add_and_store(10, 32, 0) = ${instance.exports.add_and_store(10, 32, 0)} <br>
  load_i32(0) = ${instance.exports.load_i32(0)} <br>
  call_via_table(0, 5, 3) = ${instance.exports.call_via_table(0, 5, 3)} <br>
  call_via_table(1, 5, 3) = ${instance.exports.call_via_table(1, 5, 3)} <br>`;
  document.getElementById('output').innerHTML = result;
}

loadWasm();