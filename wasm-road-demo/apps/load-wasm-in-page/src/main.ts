async function loadWasm() {
  const imports = {
    env: {
      // 如果 wasm 模块 import 了 "env"."abort"，需要提供此函数
      abort: () => console.error('Wasm abort called'),
    },
  };

  let result;

  try {
    // 优先使用流式加载
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch('/add.wasm'),
      imports
    );
    result = instance.exports.add(3, 4);
  } catch (e) {
    // Content-Type 不正确或浏览器不支持时回退
    console.warn('instantiateStreaming 失败，回退到 arrayBuffer 方式:', e);
    const response = await fetch('/add.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    result = instance.exports.add(3, 4);
  }

  document.getElementById('output').textContent = `3 + 4 = ${result}`;
}

loadWasm();