在 Vite 里，`fetch('/simple_wasm.wasm')` 这种写法**不会自动找到** `src/` 下的 wasm 文件。你当前工程里实际文件是 `src/simple_wasm.wasm`，而 `/simple_wasm.wasm` 只会去 `public/simple_wasm.wasm` 找——`public/` 里并没有这个文件，所以会 404。

Vite 里加载 wasm 主要有三种方式，按场景选择：

---

## 方式一：`public/` + 绝对路径（最简单，但不参与打包）

把 wasm 放到 `public/` 目录，开发时 Vite 会原样挂在站点根路径：

```
public/simple_wasm.wasm
```

```ts
fetch('/simple_wasm.wasm')
```

- 开发、生产都能用
- 不参与 hash、不参与依赖分析
- 适合演示或固定路径的静态资源

---

## 方式二：`?url` 导入（推荐，保留你现在的 `instantiateStreaming` 写法）

wasm 放在 `src/` 里，用 Vite 的 `?url` 拿到**构建后的真实 URL**：

```ts
import wasmUrl from './simple_wasm.wasm?url'

async function loadWasm() {
  const imports = { env: { /* ... */ } }

  let instance: WebAssembly.Instance
  try {
    instance = (await WebAssembly.instantiateStreaming(
      fetch(wasmUrl),  // 用导入的 URL，不是硬编码 '/add.wasm'
      imports
    )).instance
  } catch (e) {
    const bytes = await (await fetch(wasmUrl)).arrayBuffer()
    instance = (await WebAssembly.instantiate(bytes, imports)).instance
  }
  // ...
}
```

优点：

- 开发、生产路径都正确
- 构建时会复制到 `dist/assets/` 并带 hash
- 适合你这种**手动写 imports、演示流式加载**的场景

---

## 方式三：`?init` 导入（Vite 内置封装）

Vite 内置了 wasm 初始化 helper，会自动处理 `fetch` + `instantiateStreaming` 回退：

```ts
import initWasm from './simple_wasm.wasm?init'

const instance = await initWasm({
  env: {
    abort: () => console.error('Wasm abort called'),
    host_double: (x: number) => x * 2,
  },
})

instance.exports.add(3, 4)
```

- 最省事
- 但封装掉了 `instantiateStreaming` 的细节，不太适合你现在「演示流式加载」的教学目的

---

## 对比

| 方式 | 文件位置 | 写法 | 适用场景 |
|------|----------|------|----------|
| `public/` | `public/xxx.wasm` | `fetch('/xxx.wasm')` | 固定路径、不参与打包 |
| `?url` | `src/xxx.wasm` | `import url from './xxx.wasm?url'` | 手动 `instantiateStreaming` |
| `?init` | `src/xxx.wasm` | `import init from './xxx.wasm?init'` | 快速集成，不关心底层细节 |

---

另外，Vite 开发服务器会给 `.wasm` 设置正确的 `Content-Type: application/wasm`，所以 `instantiateStreaming` 在 dev 下通常能正常工作；生产环境用 Nginx 等静态服务器时，需要同样配置 MIME 类型（你博客第 4 章里已有说明）。
