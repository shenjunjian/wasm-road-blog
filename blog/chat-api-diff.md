# 大模型接口演化：从 Chat Completions 到 Responses，再到 Open Responses

> 更新于 2026-07。梳理三条推理接口的脉络、能力差异、国内外支持现状，以及用转换网关把 Chat Completions「包装」成 Open Responses 的实践（以 LiteLLM 为例）。

---

## 1. 特性对比一览

| 特性 | Chat Completions API | Responses API（OpenAI） | Open Responses API |
| --- | --- | --- | --- |
| 出现时间 | 2023 年（GPT-3.5/4 生态标准） | 2025-03（OpenAI 正式推出） | 2026-01（开源规范，基于 Responses） |
| 端点 | `POST /v1/chat/completions` | `POST /v1/responses` | `POST /v1/responses`（同形，多厂商互通） |
| 输入模型 | `messages[]`（role + content） | `input`（字符串或 typed Items） | 同 Responses：Items 为原子单位 |
| 输出模型 | `choices[].message` | `output[]`（message / reasoning / function_call / …） | 同 Responses，流式为语义事件 |
| 会话状态 | 客户端自行拼全量 history | 服务端可 `store` + `previous_response_id` | 规范不强制服务端存状态；实现方可支持 `store` / 加密 reasoning 回传 |
| 自定义 Function Calling | ✅（嵌套 `tools[].function`） | ✅（扁平 `tools[]` + Item） | ✅（同 Responses） |
| **服务端 Agent 循环**（一轮内多工具并直接出终答） | ❌（工具结果需再发一轮） | ✅（内置工具可在同请求内执行完） | ✅（规范正式化 sub-agent loop） |
| 内置托管工具 | ❌ | web_search / file_search / code_interpreter / computer_use / image_generation / MCP / shell 等 | 分 **internal**（厂商托管）与 **external**（客户端/MCP） |
| Reasoning 体验 | 有限；部分模型在 Chat 上弱于 Responses | 原生更好（推理缓存、跨轮保留） | 规范化 `content` / `encrypted_content` / `summary` |
| Structured Outputs | `response_format` | `text.format` | 规范对齐 Responses |
| 并行 `n` 路采样 | ✅（`n`） | ❌（单次一条生成） | ❌ |
| 定位 | 对话时代的事实标准，生态最广 | OpenAI 新项目推荐默认；接棒 Assistants | 跨厂商开放标准，面向 Agent / 路由层 |
| **典型原生支持** | OpenAI、Azure、Gemini、DeepSeek、通义、智谱、Kimi、绝大多数国内 API；Anthropic 为 Messages API（非原生 Chat，经网关兼容） | **OpenAI / Azure OpenAI** 最完整；百度千帆等国内云已有兼容实现 | Hugging Face Inference Providers、Databricks Open Responses、部分网关/代理 |
| **经网关桥接后** | — | LiteLLM 等可将 Chat 上游映射为 `/v1/responses` | 同左；Open Responses Compliance 可验收 |

**术语速览（读表用）：**

- **Items**：Responses 把 message、reasoning、function_call 等拆成独立类型的原子单位，流式与可观测更清晰，不再全塞进一条 `message`。
- **服务端 Agent 循环 / sub-agent loop**：托管工具由服务端在**同一请求**内反复「调工具 → 拿结果 → 再推理」，直到出终答；Chat 则每步工具结果都要客户端再发一轮 HTTP。
- **Internal vs external 工具**：internal = 厂商托管（如 web_search），客户端看不到中间往返；external = 客户端函数或外部 MCP，需回填 `function_call_output`。
- **Reasoning 体验**：推理模型（如 o 系列）的中间思考链如何暴露、缓存、跨轮复用。Responses 可保留 reasoning Item、支持加密回传；Chat 上往往能力更弱或字段更散。
- **Structured Outputs**：强制模型输出符合 JSON Schema 的结构（工具参数或最终 JSON），减少「看起来像 JSON、实际解析失败」。
- **`strict`**：Function Calling / Structured Outputs 的严格模式。开启后参数必须**精确匹配** schema（类型、必填字段等）。Chat 默认非 strict；Responses / Open Responses 省略 `strict` 时会**尝试**规范化成 strict，若 schema 无法兼容则回退 best-effort 并在响应中返回 `strict: false`；要显式非 strict 需设 `strict: false`。
- **并行 `n` 路采样（Best-of-N）**：同一输入并行跑 N 条独立生成，再投票/打分选最优。Chat 用参数 `n`；Responses 已移除，需客户端自行并发多次请求。注意与引擎内部「并行预测下一 token」（vLLM/Medusa 加速）不是一回事——后者只加速，不产出多条完整答案。
- **加密 reasoning 回传**：`store: false`（零数据留存 / ZDR）时，服务端不存会话；客户端把上一轮 `encrypted_content` **原样**塞回下一轮 `input`，后端临时解密续写思考。详见 5.2.4。

**Function Calling 格式差异：**

| | Chat Completions | Responses / Open Responses |
| --- | --- | --- |
| 工具定义 | 嵌套：`{"type":"function","function":{…}}` | 扁平：`{"type":"function","name",…}` |
| 模型调用 | `message.tool_calls[]` | `output` 中的 `function_call` Item |
| 回传结果 | `role:"tool"` + `tool_call_id` | `function_call_output` + `call_id` |
| strict | 默认非 strict | 省略时尝试 strict，无法兼容则回退；非 strict 需 `strict:false` |

能力都支持自定义函数；差别在**字段形状与回传载体**，不是「能不能调工具」。

**选型：**

- 「发消息 → 拿文本」、生态兼容优先 → **Chat Completions**
- Agent、内置工具、推理模型、服务端状态 → **Responses**（或兼容实现）
- 跨厂商、可移植、统一客户端 → **Open Responses** 为契约，上游原生或网关桥接

---

## 2. 历史：三条接口如何走到今天

### 2.1 Chat Completions：对话时代的「事实标准」（2023–）

OpenAI 在 ChatGPT 走红后推出 `/v1/chat/completions`，用 `system / user / assistant` 消息列表替代更早的 Completions（续写）。随后几乎所有厂商都提供「OpenAI 兼容」Chat 接口：请求简单、文档多、SDK / LangChain / IDE 插件默认对接；Function Calling、Vision、Structured Outputs 都叠在这条协议上。

核心假设：**无状态、客户端管上下文**。每轮发完整 `messages`；若返回 `tool_calls`，客户端执行工具后再塞进 `messages` **再请求一次**。多工具、多步 Agent 循环全在应用侧。

### 2.2 Responses API：面向 Agent 的「新一等公民」（2025-03）

2025-03 OpenAI 发布 Responses，定位为 Chat Completions 的演进，并逐步承接 Assistants（Assistants API 于 2025-08-26 宣布弃用，2026-08-26 正式关停）。要点：

1. **Items 而非臃肿 Message**：`function_call`、`reasoning` 等独立，便于流式与可观测；
2. **服务端状态**：`store` + `previous_response_id`，减轻拼历史负担，提升 prompt cache 命中；
3. **Agentic by default**：内置 web search、file search、code interpreter、computer use、image generation、远程 MCP 等；**同一请求内**可完成「调工具 → 拿结果 → 继续推理 → 出终答」；
4. 新能力优先落在 Responses；Chat 仍维护，但不再是创新主战场。

官方建议：新项目默认用 Responses；存量 Chat 可渐进迁移。

### 2.3 Open Responses：把 Responses「开放成标准」（2026-01）

Chat Completions 难被取代，主因是**互操作性**，不是最适合 Agent。Responses 能力更强，却一度偏 OpenAI 专有。

2026-01 社区发布 **Open Responses**（[openresponses.org](https://www.openresponses.org/)）：OpenAI 发起方向、开源社区共建、Hugging Face 等背书。以 Responses 为蓝本，定义跨厂商请求/响应、语义流式、工具与 agent loop；区分 Model Providers 与 Routers；正式化 internal vs external tools 与 sub-agent loop；提供 Compliance 测试。目标：用一套开放契约，替代「各家各说一套 Chat 方言」。

---

## 3. 优劣势对比

### 3.1 Chat Completions

| 优势 | 劣势 |
| --- | --- |
| 生态最成熟，几乎所有模型都有兼容端点 | 无服务端 Agent 循环：多工具需多轮 HTTP |
| 学习成本低，调试材料多 | 客户端维护全量 history，长对话成本高 |
| 适合简单对话、批处理、既有系统 | 内置工具、跨轮 reasoning 弱于 Responses |
| 本地推理（vLLM / Ollama / LM Studio）对接易 | 新特性往往后置甚至缺失 |

### 3.2 Responses API（OpenAI）

| 优势 | 劣势 |
| --- | --- |
| 一轮内多工具 + 终答，Agent 延迟与代码量下降 | 原生完整能力主要在 OpenAI / Azure；他厂参差 |
| 服务端状态与更好 cache（官方称约 40%–80% cache 相关改善） | 默认 `store` 有数据驻留/合规考量，需显式 `store: false` |
| 内置工具与 MCP，少写胶水 | 与 Chat 字段不兼容，迁移有成本 |
| 推理模型体验更好 | `n` 多候选采样已移除 |

### 3.3 Open Responses

| 优势 | 劣势 |
| --- | --- |
| 跨厂商统一契约，利于路由、评测、多模型切换 | 规范仍在演进，厂商原生达标度不一 |
| 继承 Responses 的 Agent / Items / 语义流式 | 许多「兼容」靠网关翻译，上限受上游 Chat 限制 |
| Compliance 降低接入成本 | 客户端生态仍不如 Chat 庞大 |
| 适合平台层/网关层目标协议 | 与 OpenAI 专有超集可能有细微差异 |

---

## 4. 国内外支持程度（截至 2026 中）

### 4.1 国际

| 厂商 / 平台 | Chat Completions | Responses（OpenAI 形） | Open Responses |
| --- | --- | --- | --- |
| OpenAI | ✅ 完整 | ✅ 原生最完整 | 规范发起方；专有能力为超集 |
| Azure OpenAI | ✅ | ✅ | 经兼容层 / Databricks 等 |
| Anthropic | 自身 Messages；生态多用 Chat 兼容或桥接 | 经 LiteLLM 等桥到 `/responses` | Databricks 等提供适配 |
| Google Gemini | ✅ 兼容或原生 GenerateContent | 经网关桥接 | 有 Open Responses 适配 |
| Hugging Face Inference Providers | ✅ | 早期接入 | ✅ 早期支持与演示 Space |
| Databricks Model Serving | ✅ | OpenAI 直通 / Open Responses 路径 | ✅ `/serving-endpoints/open-responses` |
| 本地 vLLM / llama.cpp / LM Studio | ✅ 主流 | 多数仅 Chat；需网关 | 依赖网关 |

### 4.2 国内

> 国内文档「支持 Responses」几乎都是 **OpenAI Responses 兼容**，**不是** Open Responses 开源规范，也鲜少宣称 Compliance。

| 厂商 / 平台 | Chat Completions | Responses（OpenAI 形）兼容 | Open Responses |
| --- | --- | --- | --- |
| DeepSeek 官方 | ✅ 主力 | 官方偏 Chat；经千帆/聚合网关可走 | 多为网关层 |
| 通义 / 阿里云百炼 | ✅ | ✅ 官方兼容（如 `/compatible-mode/v1/responses`）；未文档参数常被忽略（子集） | ❌ |
| 火山引擎 / 方舟（豆包） | ✅ | ✅ 官方 Responses（如 `/api/v3/responses`） | ❌ |
| 腾讯混元 / TokenHub | ✅ | ✅ 部分模型（如 `hy3`）；旧型号多仅 Chat | ❌ |
| 百度千帆 | ✅ | ✅ `/v2/responses`；`previous_response_id`、MCP 等 | 未明确 Compliance |
| 智谱 GLM / 月之暗面 Kimi | ✅ | 聚合网关常见 | 靠网关 / HF 路由偶见 |
| 各类 API 聚合网关 | ✅ | 常同时暴露 Chat 与 `/responses` | 少数宣称对齐 |

**结论：** Chat 仍是国内与本地部署的最大公约数；通义、火山、混元、千帆等已有 OpenAI Responses 兼容（多为子集）；Open Responses 仍主要在国际路由层 / 开源网关——「支持 Responses」≠ 宣称 Open Responses。

---

## 5. 三种接口调用示例

以下均用 **JavaScript + 官方 `openai` npm 包**（Responses / Open Responses 可共用 SDK，改 `baseURL` 即可）。含 tools 往返形状，以及多轮两种续接：`previous_response_id`（有状态）与 `encrypted_content` 回传（无状态）。

```bash
npm install openai
```

### 5.1 Chat Completions API

#### 5.1.1 基础对话

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-xxx",
  // baseURL: "https://api.deepseek.com", // 国内兼容端点示例
});

const completion = await client.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [
    { role: "system", content: "你是简洁的助手。" },
    { role: "user", content: "用一句话解释 REST。" },
  ],
});

console.log(completion.choices[0].message.content);
```

#### 5.1.2 自定义 Function Calling

工具定义**嵌套**在 `function` 里；调用挂在 `message.tool_calls[]`；回传用 `role: "tool"`，**必须再发一次**请求。

**`tools` 定义：**

```json
[
  {
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "查询指定城市的当前天气",
      "parameters": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "城市名，如 北京" }
        },
        "required": ["city"]
      }
    }
  }
]
```

**第一轮响应（模型调工具）：**

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "get_weather",
          "arguments": "{\"city\":\"北京\"}"
        }
      }]
    }
  }]
}
```

**第二轮：把工具结果塞回 `messages` 后再请求：**

```json
{
  "messages": [
    { "role": "system", "content": "你是简洁的助手。" },
    { "role": "user", "content": "北京今天天气怎么样？" },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [{ "id": "call_abc123", "type": "function", "function": { "name": "get_weather", "arguments": "{\"city\":\"北京\"}" } }]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "{\"temp\":28,\"condition\":\"晴\",\"humidity\":45}"
    }
  ],
  "tools": [ "...同上..." ]
}
```

**完整循环：**

```javascript
import OpenAI from "openai";

const client = new OpenAI({ apiKey: "sk-xxx" });

const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "查询指定城市的当前天气",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "城市名，如 北京" },
        },
        required: ["city"],
      },
    },
  },
];

const messages = [
  { role: "system", content: "你是简洁的助手。" },
  { role: "user", content: "北京今天天气怎么样？" },
];

let completion = await client.chat.completions.create({
  model: "gpt-4.1-mini",
  messages,
  tools,
});

const assistantMessage = completion.choices[0].message;
messages.push(assistantMessage);

for (const toolCall of assistantMessage.tool_calls ?? []) {
  const args = JSON.parse(toolCall.function.arguments);
  const weather = { temp: 28, condition: "晴", humidity: 45 }; // 模拟 get_weather(args.city)
  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: JSON.stringify(weather),
  });
}

completion = await client.chat.completions.create({
  model: "gpt-4.1-mini",
  messages,
  tools,
});

console.log(completion.choices[0].message.content);
```

> Chat **没有** `previous_response_id`；多轮需客户端维护完整 `messages[]`。

### 5.2 Responses API（OpenAI）

#### 5.2.1 基础对话

```javascript
import OpenAI from "openai";

const client = new OpenAI({ apiKey: "sk-xxx" });

const response = await client.responses.create({
  model: "gpt-5.2",
  instructions: "你是简洁的助手。",
  input: "用一句话解释 REST。",
  // tools: [{ type: "web_search" }], // 内置工具：服务端执行，一轮内终答
});

console.log(response.output_text);
```

**响应 `output`（简化）：**

```json
{
  "id": "resp_abc123",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [{ "type": "output_text", "text": "REST 是一种基于 HTTP 的资源操作风格……" }]
    }
  ]
}
```

#### 5.2.2 自定义 Function Calling

工具定义**扁平**（无外层 `function`）；调用为 `function_call` Item；回传 `function_call_output`。

**`tools` 定义：**

```json
[
  {
    "type": "function",
    "name": "get_weather",
    "description": "查询指定城市的当前天气",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string", "description": "城市名，如 北京" }
      },
      "required": ["city"]
    }
  }
]
```

**第一轮 `output`：**

```json
{
  "id": "resp_xyz789",
  "output": [
    {
      "type": "function_call",
      "call_id": "call_weather_001",
      "name": "get_weather",
      "arguments": "{\"city\":\"北京\"}"
    }
  ]
}
```

**第二轮（回传工具结果，有状态）：**

使用 `previous_response_id` 时，服务端已存上一轮上下文，通常**只传** `function_call_output` 即可：

```json
{
  "model": "gpt-5.2",
  "previous_response_id": "resp_xyz789",
  "input": [
    {
      "type": "function_call_output",
      "call_id": "call_weather_001",
      "output": "{\"temp\":28,\"condition\":\"晴\",\"humidity\":45}"
    }
  ]
}
```

**无 `previous_response_id`（如 `store: false`）时**，须把 `function_call` 与其 `function_call_output` **按序相邻**放入 `input`（`call_id` 对应）；若同轮还有 `reasoning` Item，也要一并带回。

**完整循环：**

```javascript
import OpenAI from "openai";

const client = new OpenAI({ apiKey: "sk-xxx" });

const tools = [
  {
    type: "function",
    name: "get_weather",
    description: "查询指定城市的当前天气",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名，如 北京" },
      },
      required: ["city"],
    },
  },
];

let response = await client.responses.create({
  model: "gpt-5.2",
  instructions: "你是简洁的助手。",
  input: [{ type: "message", role: "user", content: "北京今天天气怎么样？" }],
  tools,
});

const toolOutputs = [];
for (const item of response.output) {
  if (item.type === "function_call") {
    const args = JSON.parse(item.arguments);
    const weather = { temp: 28, condition: "晴", humidity: 45 };
    toolOutputs.push({
      type: "function_call_output",
      call_id: item.call_id,
      output: JSON.stringify(weather),
    });
  }
}

if (toolOutputs.length > 0) {
  response = await client.responses.create({
    model: "gpt-5.2",
    previous_response_id: response.id,
    input: toolOutputs,
  });
}

console.log(response.output_text);
```

> 使用**推理模型**（o 系列 / 带 reasoning 的 gpt-5.x）做工具回调时，除 `function_call_output` 外，还须把同轮返回的 `reasoning` Item 一并带回（有状态时 `previous_response_id` 可代劳；无状态须手动 replay 完整 `output`）。

#### 5.2.3 多轮：有状态（`previous_response_id`）

默认 `store: true`，服务端保存会话；后续只传 `previous_response_id` + 新消息，不必重发全量历史。

```javascript
import OpenAI from "openai";

const client = new OpenAI({ apiKey: "sk-xxx" });

const first = await client.responses.create({
  model: "gpt-5.2",
  instructions: "你是简洁的助手。",
  input: [{ type: "message", role: "user", content: "我叫小明，记住我的名字。" }],
  store: true, // 默认，可省略
});

const second = await client.responses.create({
  model: "gpt-5.2",
  previous_response_id: first.id,
  input: [{ type: "message", role: "user", content: "我刚才说我叫什么？" }],
});

console.log(second.output_text);
```

服务端读取 `resp_…` 关联历史（含明文 reasoning，若有）。适合不要求零数据留存的场景。

#### 5.2.4 多轮：无状态（加密 reasoning 回传）

**问题：** 合规要求零数据留存（ZDR）时必须 `store: false`，服务端不存任何会话/推理中间态。但多轮推理、工具调用往往需要复用上一轮思考链，否则质量会断崖。

**方案：加密 reasoning 回传。** 中间思考链不以明文返回，而是返回 `encrypted_content`；客户端本地保存后，下一轮**原样**塞进 `input`。后端内存临时解密、用完即毁，明文不落盘。仅 Responses / Open Responses 支持，Chat Completions 无此能力。

约束要点：

1. 密文绑定组织 API Key；换 Key / 跨租户会报 `invalid_encrypted_content`；
2. 客户端只能看 `summary` 摘要，无法还原完整 CoT；
3. 不可篡改、截断密文，必须完整回传；
4. 带工具的无状态多轮：除 `reasoning` 外，`function_call` / `function_call_output` 也要按序原样带回。

```javascript
import OpenAI from "openai";

const client = new OpenAI({ apiKey: "sk-xxx" });

const first = await client.responses.create({
  model: "o4-mini", // 须为支持 reasoning + encrypted_content 的模型
  store: false,
  include: ["reasoning.encrypted_content"],
  reasoning: { effort: "high" },
  input: [{ type: "message", role: "user", content: "解方程 2x + 5 = 17，展示步骤。" }],
});

// 官方推荐：完整 replay 上一轮 output（含 reasoning、message、function_call 等），不可截断或改写
const history = [
  { type: "message", role: "user", content: "解方程 2x + 5 = 17，展示步骤。" },
  ...first.output,
];

const second = await client.responses.create({
  model: "o4-mini",
  store: false,
  include: ["reasoning.encrypted_content"],
  reasoning: { effort: "high" },
  input: [
    ...history,
    { type: "message", role: "user", content: "如果 x 再减 3，结果是多少？" },
  ],
});

console.log(second.output_text);
```

**`reasoning` Item 形状：**

```json
{
  "type": "reasoning",
  "id": "rs_xxxx",
  "encrypted_content": "gAAAAABlxxxxxx加密字符串",
  "summary": [{ "type": "summary_text", "text": "设方程 2x+5=17，移项得 2x=12，x=6" }]
}
```

`summary` 给人看；连续思考依赖的是 `encrypted_content`，不是摘要。

**两种多轮对比：**

| | 有状态 `previous_response_id` | 无状态 `encrypted_content` 回传 |
| --- | --- | --- |
| `store` | `true`（默认） | `false` |
| 客户端存什么 | `response.id` | 完整上一轮 `output[]`（含 reasoning 密文等） |
| 下一轮传什么 | ID + 新消息 | 完整 replay `output` + 新消息 |
| 数据驻留 | OpenAI 服务端 | 零留存（ZDR） |
| 适用 | 一般 Agent / 对话 | 金融、医疗等强合规 |

若还需 Best-of-N：客户端对同一题并发 N 次无状态请求，每路各有独立 `encrypted_content`，本地投票/打分后**只回传最优那一路**的密文。费用约 ×N，时延因并行通常接近单次。

### 5.3 Open Responses API

协议形状与 Responses 高度一致；差异主要在多厂商路由头、reasoning 可见性、Compliance。多轮与 tools 用法同 5.2。

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "hf_xxx",
  baseURL: "https://your-open-responses-gateway/v1",
  defaultHeaders: { "OpenResponses-Version": "latest" },
});

const response = await client.responses.create({
  model: "moonshotai/Kimi-K2-Thinking:nebius",
  input: [{ type: "message", role: "user", content: "用一句话解释 REST。" }],
});

console.log(response.output_text);
```

**自定义工具请求（形状同 OpenAI Responses）：**

```json
{
  "model": "zai-org/GLM-4.7",
  "input": [{ "type": "message", "role": "user", "content": "查一下上海天气" }],
  "tools": [
    {
      "type": "function",
      "name": "get_weather",
      "description": "查询城市天气",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  ]
}
```

> 经网关桥接且上游只有 Chat 时，tools / 多轮可能受限；见第 7 节。

---

## 6. 内置工具，以及「一轮多工具」与 Chat 的差别

### 6.1 常见内置（托管）工具

| 工具类型 | 作用 |
| --- | --- |
| `web_search` / `web_search_preview` | 联网检索 |
| `file_search` | 向量库文件检索 |
| `code_interpreter` | 沙箱跑代码、处理文件 |
| `computer_use` | 操控计算机环境 |
| `image_generation` | 文生图 |
| `mcp`（远程 MCP） | 对接外部 MCP Server |
| `shell` | 托管容器/本地 runtime 执行命令 |

Open Responses：internal = 厂商托管，客户端看不到中间往返；external = 客户端函数或外部 MCP，需回填 `function_call_output`。可用 `max_tool_calls`、`tool_choice` 约束。

> 混用**内置工具**与自定义 function 时，OpenAI 侧不支持 parallel function calling（内置工具路径下模型不会并行调多个自定义 function）。

### 6.2 同一轮：Responses 可调完多工具再返回；Chat 必须再开一轮

**Responses（托管工具）——一次 HTTP，服务端完成循环：**

```text
Client                         Provider
  |  POST /v1/responses          |
  |  tools=[web_search, ...]     |
  |----------------------------->|
  |                              |  model → tool #1 → exec
  |                              |  model → tool #2 → exec
  |                              |  model → final answer
  |<-----------------------------|
  |  output: [...tools..., msg]  |
```

**Chat——工具结果必须再打一次接口：**

```text
Client                         Provider
  |  POST /chat/completions #1   |
  |----------------------------->|
  |<--- assistant + tool_calls --|
  |  (本地执行 tools)             |
  |  POST /chat/completions #2   |
  |  messages + tool results     |
  |----------------------------->|
  |<--- final assistant message -|
```

即便第一轮并行给出多个 `tool_calls`，执行结果也无法在同一轮响应里被模型消费。Responses 把这段循环上移到服务端（**托管工具 / 远程 MCP** 路径如此）。

> **注意：** **自定义 function** 的执行仍在客户端，须额外 HTTP 往返回传 `function_call_output`（或用 SDK / Agents 框架代跑 loop）。OpenAI 文档里「一轮内多工具」主要指托管工具与远程 MCP，而非客户端自定义函数。Item 模型更适合多步状态；Open Responses 把 sub-agent loop 写进规范，并用 `max_tool_calls` 等统一控制。

---

## 7. 转换网关：把 Chat 包装成 Open Responses / Responses

现实里大量上游（国内模型、本地 vLLM、聚合商）只有 Chat；新客户端（如 Codex CLI 默认 `wire_api = "responses"`）只要 Responses。中间需要**协议转换网关**。

### 7.1 网关在做什么

```text
┌─────────────┐   /v1/responses    ┌──────────────┐   /v1/chat/completions   ┌─────────────┐
│ Agent / CLI │ ─────────────────► │  转换网关     │ ───────────────────────► │ 上游模型 API │
│ Codex / App │ ◄───────────────── │ LiteLLM 等   │ ◄─────────────────────── │ Chat only   │
└─────────────┘  Responses 形态    └──────────────┘   Chat 形态               └─────────────┘
```

典型职责：`input`/Items ↔ `messages`；Chat `choices` ↔ Responses `output`；流式 delta ↔ 语义事件；可选模拟 `previous_response_id`；可选有限 tool loop——但**无法凭空获得**上游没有的托管 web_search / computer_use。

### 7.2 用 LiteLLM 实现

[LiteLLM](https://docs.litellm.ai/docs/response_api) 提供与 OpenAI `/responses` 同形端点：上游原生 Responses → 直通；只有 Chat → `/responses` → `/chat/completions` Bridge。

**Proxy 强制走 Chat 桥接**（适合 vLLM、LM Studio、国产兼容端点）：

```yaml
# config.yaml
model_list:
  - model_name: local-qwen
    litellm_params:
      model: openai/my-qwen
      api_base: http://127.0.0.1:8000/v1
      api_key: fake-key
      use_chat_completions_api: true   # /responses → Chat
      # 或：model: openai/chat_completions/my-qwen
```

```bash
litellm --config config.yaml
# Proxy 默认暴露 http://0.0.0.0:4000/v1/responses，无需额外开关
```

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000", api_key="sk-1234")
r = client.responses.create(model="local-qwen", input="你好，介绍一下你自己。")
print(r.output_text)
```

SDK 直连：

```python
import litellm

response = litellm.responses(
    model="openai/chat_completions/my-qwen",
    input="Hello!",
    api_base="http://127.0.0.1:8000",
    api_key="fake-key",
)
```

**反向：Chat 客户端走 Responses 上游**（如 GPT-5 推理更优）：

```python
litellm.completion(model="openai/responses/gpt-5-mini", messages=[...])
# 或 LITELLM_ROUTE_ALL_CHAT_OPENAI_TO_RESPONSES=true
```

LiteLLM Proxy 还可在网关侧做 `previous_response_id` 会话、负载均衡、对 Anthropic/Gemini 做 Responses 外形包装。

### 7.3 优点与不足

**优点：** 客户端统一；存量 Chat 上游无需等新接口；鉴权/限流/日志/fallback 集中；适配 Codex、HF、Agent 框架。

**不足：**

1. 上游没有托管工具，网关变不出同等能力；纯 Chat 上游的「一轮多工具」最多本地代跑有限 loop；
2. Items、加密 reasoning、语义流式、compaction 常简化或模拟，Compliance 难 100%；
3. 网关模拟的 `previous_response_id` 吃不到厂商侧 prompt cache / 推理状态红利；
4. 多一跳延迟与排错面；双协议都要跟进。

**实践：** 对外契约选 Open Responses / Responses；对内有原生则直通、只有 Chat 则桥接，并标明桥接不支持哪些托管工具。强 Agent 托管工具优先选真正实现 Responses 的云（OpenAI、千帆等），而非只做 JSON 外形兼容的网关。

---

## 8. 小结与演进判断

```text
2023          2025-03              2026-01                未来
 │               │                    │                     │
 Chat Completions → Responses (OpenAI) → Open Responses     多厂商原生对齐
 (对话事实标准)      (Agent 一等公民)      (开放互操作标准)     + 网关长期并存
```

| 你的场景 | 更合适的选择 |
| --- | --- |
| 简单对话、最大兼容、本地模型 | Chat Completions |
| OpenAI 上做 Agent / 推理 / 内置工具 | Responses API |
| 多厂商平台、统一客户端、可移植 | Open Responses（原生或 LiteLLM 等网关） |
| 上游只有 Chat，客户端只要 Responses | 转换网关（接受能力有损） |

主线不是「废除 Chat」，而是：**对话协议保留兼容，Agent 协议成为新默认；Open Responses 试图把后者从一家之私变成行业公共层。** 国内生态完全跟上之前，**Chat + 转换网关 + 少数云原生 Responses** 会是最常见过渡架构。

---

## 参考

- [OpenAI: Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Open Responses 规范](https://www.openresponses.org/specification) / [Hugging Face: Open Responses](https://huggingface.co/blog/open-responses)
- [LiteLLM `/responses`](https://docs.litellm.ai/docs/response_api)
- [百度千帆 Responses API 使用指南](https://cloud.baidu.com/doc/qianfan-docs/s/4mi400l1m)
