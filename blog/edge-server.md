# JavaScript 边缘服务：从原理到实战

## 什么是 JS 边缘服务

JS 边缘服务（Edge Computing）是一种将 JavaScript 代码部署在全球分布式 CDN 节点上的计算架构。与传统的"请求必须飞越半个地球到达某个固定数据中心"不同，边缘服务让代码在距离用户最近的节点上执行，从而实现极低的响应延迟。

它的底层核心技术是 **V8 Isolates（轻量级隔离槽）**——服务商在边缘节点上常驻一个用 C++/Rust 编写的高性能网关进程，当用户请求到达时，该进程在内存中为你的代码开辟一个极其微小的 V8 Isolate 隔离上下文，直接加载并执行 JS 代码。这个过程不需要启动操作系统，不需要分配虚拟内存，耗时通常在几微秒到几毫秒之间，用户完全感知不到。

这种架构也被称为"无服务器（Serverless）"，并非真的没有物理服务器，而是：

1. **开发者心智中无服务器**——不需要关心 Linux 版本、Nginx 配置、安全补丁，只需写一个 `export default { fetch(request) { ... } }` 的 JS 函数并部署。
2. **无需管理扩展性**——平台自动根据流量在瞬时并发扩展出成千上万个轻量实例，流量退去后自动缩减到零。
3. **完全按量计费**——没有请求时扣费为 0，只有当 HTTP 请求触发代码执行时，才按毫秒级 CPU 消耗收费。

## 边缘服务提供商

### 国际主流提供商

| 提供商 | 特点 |
|---|---|
| **Cloudflare Workers** | 全球最大的边缘网络之一，基于 V8 Isolates，零冷启动 |
| **Deno Deploy** | Deno 官方托管平台，原生支持 TypeScript |
| **Vercel Functions** | 紧密集成 Next.js 生态，支持 Edge Middleware |
| **Netlify Edge Functions** | 基于 Deno 运行时，主打前端全栈一站式部署 |
| **Supabase Edge Functions** | 基于 Deno 开发，天然集成 Supabase 数据库生态 |
| **AWS CloudFront Functions / Lambda@Edge** | 亚马逊云方案，CloudFront Functions 极其轻量 |
| **Fastly Compute** | 基于 WebAssembly (Wasm)，底层性能和安全性极高 |

### 中国国内边缘服务提供商

首先要明确一个关键认知：**边缘计算 ≠ CDN**。CDN 只做静态内容分发，而边缘计算是在边缘节点上**运行代码**，这是本质区别。国内厂商的边缘计算产品常常挂靠在 CDN 产品线下，容易被误认为只是 CDN 的附加功能，但实际上它们同样具备类似 Cloudflare Workers 的代码执行能力。

| 提供商 | 产品 | 类比 |
|---|---|---|
| 阿里云 | 边缘函数 Edge Routine | ≈ Cloudflare Workers |
| 腾讯云 | EdgeOne 边缘函数 | ≈ Cloudflare Workers |
| 火山引擎 | 边缘函数 | ≈ Cloudflare Workers |
| 网宿科技 | EdgeFunction | ≈ Cloudflare Workers |

不过，国内边缘计算生态与国际领先者仍有差距。Cloudflare 已经构建了 Workers + KV + D1 + R2 一整套边缘生态（计算、存储、数据库、缓存一应俱全），而国内厂商的配套存储、数据库、缓存方案相对薄弱，开发者用起来更像"在 CDN 上写点小脚本"，离真正的边缘全栈应用还有一段距离。

## 边缘服务与传统服务器的区别

| 特性 | JS 边缘 / 无服务器 | 传统 Linux 服务器 |
|---|---|---|
| **底层架构** | V8 引擎隔离（Isolates），数千个应用共享一个进程 | 虚拟机 / 容器（Docker），每个应用拥有独立 OS 内核 |
| **启动时间** | 零冷启动（0ms 级别），请求到达时瞬间创建 | 秒级或分钟级，需等待系统、容器和 Node.js 进程启动 |
| **部署位置** | 全球分布式（CDN 边缘节点），用户请求就近处理 | 单地域固定（Region），如只放在深圳或美西 |
| **运行 API** | Web 标准 API（Fetch, Crypto, Streams） | Node.js / OS 底层 API（fs, child_process, network） |
| **内存限制** | 非常严格（通常每请求 50MB - 128MB） | 几乎不限（取决于服务器配置） |
| **运行时间限制** | 极短（通常 CPU 时间限制在 10ms - 50ms 内） | 无限制（可跑长连接、长时轮询、复杂计算） |

> 一个形象的比喻：传统服务器就像长期租了一套完整的房子——即使你不住，电费和房租也要照交，进门还得自己开灯开锁。而 JS 边缘服务就像高级共享办公空间里的移动工位——你人到了，工位瞬间分配给你；你走了，工位立刻释放给别人，你只为坐下的那几分钟付钱。

## JS 边缘服务如何启动

在传统服务器上，启动意味着"启动 Linux → 运行 Node.js 进程 → 监听端口"。而在边缘服务上，没有"持续等待"的启动过程，而是**瞬间初始化**：

1. **编译与打包**——Next.js 编译时，把所有边缘路由和逻辑打包成一个符合 Web 标准（Fetch API）的单一 JavaScript 文件。
2. **分发到全球**——这个 JS 文件被同步到服务商全球成百上千个 CDN 节点的存储中。
3. **瞬间加载（0 毫秒冷启动）**——当第一个用户请求到达某个最近的边缘节点时，该节点宿主机上的常驻程序（如 Cloudflare 的开源运行时 workerd）直接在内存中为你的代码开辟一个 V8 Isolate 隔离上下文，并加载 JS 代码。

## 如何响应静态文件请求

当用户请求的是纯静态资源（如编译后的 `index.html`、`main.js`、`style.css`）时，边缘节点其实退化成了一个超级 CDN：

- 宿主机的网关进程直接从边缘节点的硬盘/内存缓存中读取这些静态文件返回
- **完全不需要启动 V8 Isolate**，响应速度极快

而当请求需要动态处理（如 SSR 渲染、API 路由）时，调用链路如下：

```
[用户浏览器]
    │
    ▼ (HTTP 请求)
[边缘节点机器的网关进程] (Rust/C++ 编写的常驻网络服务)
    │
    ▼ (将 HTTP 请求包装为标准的 Request 对象，分发给：)
[你的 V8 Isolate 实例] (执行服务端渲染逻辑，生成 HTML 字符串)
    │
    ▼ (返回标准的 Response 对象)
[边缘节点机器的网关进程] ──> (将 Response 转换为网络数据包) ──> [用户浏览器]
```

## 服务端与客户端 fetch 请求的区别

在边缘架构下，fetch 请求的发起上下文取决于代码运行的位置：

### 服务端 fetch（边缘节点发起）

当 `fetch()` 出现在 Next.js 的服务端组件、`getServerSideProps`、Middleware 或 API Routes 中时：

- **发起上下文**：运行在边缘节点机器上的 V8 Isolate
- **谁来执行**：V8 引擎本身没有网络功能。当 JS 代码调用 `fetch()` 时，实际上是调用了边缘运行时注入的底层 C++/Rust 宿主环境的网络绑定（Bindings），由宿主网络模块将 HTTP 请求发到互联网上，并将结果返回给 V8 上下文

### 客户端 fetch（浏览器发起）

当用户已经打开了页面，在浏览器中点击按钮触发客户端 JS 代码中的 `fetch()` 时：

- **发起上下文**：用户的手机或电脑浏览器（客户端 V8 上下文）
- **谁来执行**：由用户浏览器底层的网络进程执行，直接通过互联网发送到目标 API 接口

## 边缘服务与 SSR 的关系

边缘服务**不强制依赖** SSR，但只有 SSR（和 API Routes）才能最大化发挥边缘服务器的威力。

- **纯 SPA（无 SSR）**：Next.js 编译时生成纯静态文件，部署到边缘后节点退化为超级 CDN，所有路由跳转和数据请求都在浏览器端完成——普通 CDN 就能做到。
- **SSR + 边缘**：边缘服务器的核心价值在于允许你在距离用户最近的地方（延迟可能仅 5ms）动态运行 JS 代码。SSR、Middleware 中间件拦截和 API Routes 才是边缘计算的最佳拍档。

## 传统后台缓存 vs 边缘生态缓存

### 传统缓存在边缘架构下为何失效

1. **内存缓存失效**——V8 Isolate 是"转瞬即逝"的。一个请求进来，V8 创建并执行代码，请求结束，实例可能就被销毁。无法在内存中持久保存数据。
2. **传统 Redis 变慢**——边缘节点分布在全球数百个城市。如果 Redis 部署在北京，而用户在新加坡触发边缘节点，跨国读取 Redis 的网络延迟会让边缘的"低延迟"优势荡然无存。

### 边缘生态的缓存解决方案

| 方案 | 说明 |
|---|---|
| **HTTP 边缘缓存（Cache API）** | 直接在边缘代码中控制 CDN 缓存，利用 `stale-while-revalidate` 等 HTTP 头，让边缘节点拦截并缓存渲染好的 HTML |
| **全球分布式键值存储（KV）** | 如 Cloudflare KV，数据自动复制到全球所有边缘节点，读取时从当前服务器的本地内存/硬盘读取，延迟通常小于 1ms |
| **边缘原生数据库** | 如 Hyperdrive、Upstash Redis、Neon 等，通过连接池和全球路由优化，专门解决边缘端连接数据库的延迟问题 |

## 用户路由跳转的过程

以 Next.js 为例，它采用**混合（Hybrid）模式**——本质上更像 SPA 的前端跳转，但会向边缘服务器请求"数据"而非完整 HTML：

1. **首次访问**：边缘服务器进行完整的 SSR，返回带有完整内容的 HTML，用户瞬间看到首屏。
2. **Hydration 激活**：页面加载完毕后，Next.js 的客户端应用接管浏览器，此时表现得像一个 SPA。
3. **点击新路由链接**（如 `<Link href="/dashboard">`）：
   - **前端拦截**：浏览器不会刷新，页面不会白屏，Next.js 客户端路由拦截这次点击。
   - **精准请求数据**：Next.js 不会让边缘服务器重新渲染完整的 HTML，而是发起一个特殊的 fetch 请求，只请求新路由所需的 **RSC Data**（React Server Component 数据，一种轻量级 JSON 格式）。
   - **边缘局部渲染**：边缘服务器收到请求后，只运行新路由对应的组件逻辑，生成这部分动态数据并返回。
   - **前端组装**：浏览器拿到轻量数据后，通过 React 运行时动态渲染新内容进当前页面，并更新地址栏。

这种设计结合了双方的优点：既有 SPA 的流畅无刷新体验，又利用了边缘服务器帮前端分担数据处理和组件渲染的压力。

## 全栈无服务器架构的核心组件

传统网站需要服务器存文件、跑后台、连数据库，在边缘架构下这些功能被拆分并托管给不同的 Serverless 服务商：

1. **前端与业务逻辑**：Cloudflare Workers/Pages（免费额度高、全球性能佳）或 Vercel/Netlify（对 Next.js 支持完美，零配置部署）。
2. **静态文件存储**：Cloudflare R2（免收外网流量费）、Supabase Storage 或 Vercel Blob，通过 API 读写用户上传的图片、视频等。
3. **数据库**：关系型选 Neon（Serverless PostgreSQL）或 Supabase；NoSQL/缓存选 Upstash（Serverless Redis）或 Cloudflare KV/D1。
4. **域名解析**：使用 Cloudflare 作为 DNS 解析商，无缝开启全球 CDN 加速和 DDoS 防护。

### 致命限制

- **无法运行持久进程**：不支持 7x24 小时脚本、WebSocket 长连接、大型视频转码等。
- **冷启动与执行限制**：边缘函数 CPU 时间通常限制在 10ms - 50ms，复杂 CPU 密集型计算会报错。

### 国内外合规避坑

- **中国大陆用户**：国内边缘节点强制要求 ICP 备案；Vercel/Cloudflare 免费版在国内无节点，访问需绕行海外，延迟较高。
- **海外用户**：直接选 Vercel 或 Cloudflare，无需备案，全球毫秒级响应。

## 后台框架选型：Express vs Hono.js

腾讯云 EdgeOne 原生支持 Express.js 部署，但底层将架构拆分为**边缘函数**和**云函数**两种无服务器环境。Express 项目部署时，静态资源被自动剥离至边缘 CDN，路由逻辑转为 Serverless API 端点按需拉起。

Express 在边缘服务上有三大限制：

1. **不支持 `app.listen()`**：必须改为 `export default app` 导出实例，端口监听由平台网关接管。
2. **文件系统只读或临时**：只有 `/tmp` 可写且请求结束即丢失，文件上传必须改用对象存储（如 COS、R2）。
3. **不支持 WebSocket 长连接**：函数执行有严格时间限制，实时通信需改用专门的 Serverless WebSocket 服务。

**推荐替代方案：Hono.js**——专为边缘环境设计的现代 Web 框架，语法与 Express 几乎一致，体积极小，原生兼容 V8 边缘运行时，可实现 0 毫秒冷启动。旧 Express 项目可改造后部署到云函数环境，新项目建议直接使用 Hono.js。

```js
import { Hono } from 'hono'
const app = new Hono()
app.get('/', (c) => c.text('Hello Hono!'))
app.get('/api/blog/:id', (c) => {
  const id = c.req.param('id')
  return c.json({ blogId: id, content: "文字内容..." })
})
export default app
```

## 前端框架选型：VitePress

对于文字为主的静态博客，VitePress 是顶级选择：

- **极致写作体验**：用 Markdown 写文章，编译时自动转换为高性能、SEO 友好的纯 HTML/CSS/JS。
- **边缘零算力消耗**：纯静态文件在边缘节点直接返回，不启动 V8 Isolate，TTFB 仅几毫秒，费用近乎为零。
- **SSG + SPA 双重体验**：首次加载为纯 HTML（瞬间渲染），进入后自动变为 SPA，页面切换丝滑无刷新。

### VitePress 与 Hono.js 的分工

| 维度 | VitePress | Hono.js |
|---|---|---|
| 主要产出 | 纯静态资源（HTML/CSS/JS） | 动态 JSON 数据、API 响应 |
| 适用场景 | 博客、文档、官网 | API 网关、鉴权、数据库读写 |
| 边缘消耗 | 0 算力（仅 CDN 分发） | 消耗 V8 算力 |

若博客需要评论区、阅读量等动态功能，可嵌入第三方服务（如 Giscus、Waline），或用 Hono.js 编写轻量 API 供前端调用。

### 部署流程

1. 本地用 Markdown 写文章，`npm run dev` 预览。
2. 推送代码到 GitHub/Gitee 仓库。
3. 在 EdgeOne 或 Cloudflare Pages 关联仓库，配置构建命令 `npm run build`，输出目录 `docs/.vitepress/dist`。
4. 此后每次 `git push`，平台自动拉取、编译并分发到全球边缘节点。
