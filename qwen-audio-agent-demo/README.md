# Qwen Audio Agent 最小实时智能体示例

这个示例只使用 `qwen-audio-agent` 的公开运行时与网关能力，搭一个可以独立运行的实时语音智能体：

```text
浏览器页面 (client/src/main.js)
  │  GatewayClient / WebSocket
  ▼
Vite 开发代理  /api  ──────────────►  Gateway :3101
                                        │
                                        ├─ Qwen Realtime 前台 Agent
                                        ├─ 任务运行时 / 会话 / 事件路由
                                        └─ BackendPort ──► backend-stub.mjs
                                                            （打印任务，1.2 秒后返回模拟成功）
```

- 前台 Agent：负责实时语音/文本对话，配置来自 `server.mjs` 的环境变量与 `ASSISTANT.md`。
- Gateway：负责 WebSocket 协议、会话、任务、权限和后台适配。
- 客户端：浏览器里的 `GatewayClient`，只连接 Gateway，不接触 API Key。
- 后台：`backend-stub.mjs` 实现完整的 `BackendPort`，但 `submit` 只打印任务并返回模拟结果，方便先验证整条链路。

## 快速开始

要求 Node.js `^22.22.2 || ^24.15.0 || >=26`。

```bash
npm install
```

提供 Qwen / DashScope API Key。可以用当前 shell：

```powershell
# PowerShell
Set-Item Env:MY_QWEN "sk-..."
npm run dev
```

```bat
:: cmd.exe
set MY_QWEN=sk-...
npm run dev
```

也可以复制配置文件，把示例 Key 改成自己的：

```bash
cp .env.example .env
# 编辑 .env 中的 MY_QWEN
npm run dev
```

`npm run dev` 会同时启动：

- Gateway：`http://127.0.0.1:3101`
- 浏览器客户端：`http://127.0.0.1:5173`

打开 `http://127.0.0.1:5173`，先点击“连接”，再允许麦克风权限即可开始说话；也可以直接输入文本，或点击“创建测试任务”。页面刚打开时不会自动连接，点击“断开连接”会停止麦克风和播放。

> 麦克风只在 `localhost` / `127.0.0.1` 或 HTTPS 页面可用。
> 同一个 Gateway 的同一个 owner 只允许一个活动客户端；同时开两个页面可能看到 `client_occupied`。

## 环境变量与前端配置

`server.mjs` 通过最前面的 `bootstrap-env.mjs` 完成环境准备，因为 `qwen-audio-agent` 会在模块加载时读取配置。

```dotenv
# 用户要求的入口；server.mjs 会把它映射为 DashScope 使用的变量
MY_QWEN=sk-...

# 可选：优先级最高，等价于直接配置 DashScope
# DASHSCOPE_API_KEY=sk-...

# 可选：默认值如下
# QWEN_AUDIO_REALTIME_PROVIDER=dashscope
# QWEN_AUDIO_REALTIME_MODEL=qwen-audio-3.0-realtime-flash
# QWEN_AUDIO_REALTIME_VOICE=
# GATEWAY_PORT=3101
```

Key 的优先级是 `DASHSCOPE_API_KEY` > `QWEN_AUDIO_REALTIME_API_KEY` > `MY_QWEN`。浏览器永远拿不到 Key；Key 只进入 Gateway 进程。

`client/src/main.js` 中的客户端配置：

```js
const client = new GatewayClient({
  url: (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/realtime?sessionId=demo',
  createSocket: url => new WebSocket(url),
  clientType: 'demo-web',
  clientVersion: '0.1.0',
  clientInstanceId: 'demo-web-1',
  clientLabel: 'Qwen Audio Agent Demo',
  capabilities: [
    GatewayClientCapability.INPUT_AUDIO,
    GatewayClientCapability.INPUT_TEXT,
    GatewayClientCapability.PLAYBACK_RECEIPTS,
    GatewayClientCapability.TASK_COMMANDS,
  ],
  locale: navigator.language,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  configure: () => ({
    voiceEnabled: true,
    inputEnabled: true,
    outputEnabled: true,
    textOnly: false,
  }),
  onEvent: handleEvent,
  onStatus: handleStatus,
  onAction: () => ({ status: 'unsupported', error: { code: 'demo_unsupported', message: 'demo' } }),
})
// 页面加载后保持未连接，用户点击“连接”时再调用 client.start()
```

这里没有 API Key 参数。浏览器只配置 Gateway 地址和自身能力；如果 Gateway 与页面不同源，需要通过 Gateway 的允许来源/远程访问配置开放，而不是把 Key 放进前端。

## 导入路径

所有导入都来自 npm 包 `qwen-audio-agent` 的公开子路径：

```js
// 浏览器客户端
import { GatewayClient } from 'qwen-audio-agent/gateway-client-sdk'
import {
  GatewayClientCapability,
  GatewayClientProtocolEvent,
} from 'qwen-audio-agent/gateway-client-protocol'
import {
  GatewayClientEvent,
  GatewayServerEvent,
  GatewayTaskEvent,
} from 'qwen-audio-agent/realtime-events'

// Gateway 宿主
import { createGatewayApplication } from 'qwen-audio-agent/gateway-application'
import {
  BackendEventType,
  backendEvent,
  createBackendAgentHost,
  defineBackendAdapter,
} from 'qwen-audio-agent/backend-adapter-sdk'
```

## 文本与音频消息格式

### 文本

发送一条文本输入：

```js
client.send({
  type: GatewayClientProtocolEvent.CONVERSATION_ITEM_CREATE,
  parts: [{ type: 'text', text: '你好，介绍一下你自己' }],
})
```

`GatewayClient.send()` 会自动补上 `event_id` 等协议信封。`conversation.item.create` 进入实时前台对话；如果要显式创建后台任务，使用下一节的 `task.create`。

### 音频输入

麦克风采集后发送 PCM16 单声道数据，采样率使用 `voice.ready` 事件里的 `inputSampleRate`（DashScope 通常是 16000）：

```js
client.send({
  type: GatewayClientProtocolEvent.INPUT_AUDIO_APPEND,
  audio: base64OfPcm16LittleEndian,
})
```

- `audio` 是 Base64 字符串。
- 解码后是 16-bit signed little-endian PCM，单声道。
- 示例用 `ScriptProcessorNode` 采集，线性插值降采样到 `inputSampleRate`；生产环境建议换 `AudioWorklet`。
- 服务端返回 `audio.delta` 时同样带 Base64 PCM16 和 `sampleRate`；播放开始/结束分别发送 `playback.started`、`playback.ended` 回执。

### 后台任务

```js
const result = await client.request(GatewayClientProtocolEvent.TASK_CREATE, {
  message: {
    parts: [{ type: 'text', text: '请后台执行这个任务' }],
  },
})
console.log(result.task)
```

`client.request()` 会等待对应的 `task.create.result`；任务真正执行是异步的，随后会收到 `task.accepted`、`task.running`、`task.completed` 等任务事件。

## 后台 BackendPort 接入点

`server.mjs` 只做组装：

```js
const agent = createBackendAgentHost(stubBackendAdapter, {
  name: 'Demo Stub Backend',
})

const gateway = createGatewayApplication({
  agent,
  autoStart: false,
  spawnThinkingDescription: '把需要多步执行的工作交给 Demo 后台；后台只打印任务并返回模拟成功。',
})

const server = gateway.start({ host: '127.0.0.1', port: 3101 })
```

`backend-stub.mjs` 用 `defineBackendAdapter` 实现了 `BackendPort` 的十个必需方法：

```text
describe  start  health  submit  status  cancel
respondAuthorization  respondInput  subscribe  close
```

要接自己的后台，替换 `backend-stub.mjs` 中的 `submit(work, { signal, onEvent })` 即可。`work` 至少包含：

```js
{
  id: 'task_...',            // Gateway 任务 ID
  ownerId: 'user_personal',
  instruction: '用户任务文本',
  inputParts: [],            // 文件等结构化输入
  conversation: [...],       // 可选的对话快照
}
```

最终返回：

```js
return {
  content: '给用户/前台的事实结果',
  artifacts: [],
  // 可选：continuation: { adapter, token, ...你的私有恢复字段 }
}
```

如果后台要报告进度，调用 `onEvent(backendEvent(BackendEventType.ACTIVITY, { activity }))`。示例在收到任务后打印 ID、指令和 `inputParts`，然后返回模拟成功。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | 读取环境变量、创建后台 Agent、启动 Gateway |
| `bootstrap-env.mjs` | 在 qwen-audio-agent 加载前读取 .env 并准备环境变量 |
| `backend-stub.mjs` | 实现 `BackendPort` 的假后台 |
| `ASSISTANT.md` | 前台 Agent 的人设/行为约束 |
| `client/src/main.js` | `GatewayClient`、文本输入、麦克风 PCM、音频播放、任务按钮 |
| `client/src/style.css` | 页面样式 |
| `vite.config.js` | 把 `/api`（含 WebSocket）代理到 Gateway |
| `.env.example` | 配置模板 |

## 常见问题

- `voiceConfigured: false`：没有读到 Key。检查 `MY_QWEN`，或直接在 `.env` 中配置。
- `不支持的 Realtime 模型`：当前 `qwen-audio-agent@2.0.1` 可用模型包括 `qwen-audio-3.0-realtime-plus`、`qwen-audio-3.0-realtime-flash`、`qwen3.5-omni-flash-realtime` 等；不要填写不在模型目录里的 ID。
- `client_occupied`：同一 owner 已有活动客户端，关闭多余页面或使用新的 Gateway 身份。
- 想清空本地任务/会话：停止 Gateway 后删除 `.qwaudio/`；它只是本示例的本地运行时目录，已被 `.gitignore` 忽略。

## 构建

```bash
npm run build
```

产物输出到 `dist/`。生产部署时，静态文件与 Gateway 可以不同源，但 WebSocket 地址、TLS 和允许来源需要按实际部署调整。
