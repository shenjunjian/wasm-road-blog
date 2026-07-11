# 大模型接口演化：从 Chat Completions 到 Responses，再到 Open Responses

> 更新于 2026-07。本文梳理三条推理接口的历史脉络、能力差异、国内外支持现状，以及用转换网关把 Chat Completions「包装」成 Open Responses 的实践（以 LiteLLM 为例）。

---

## 1. 特性对比一览

| 特性 | Chat Completions API | Responses API（OpenAI） | Open Responses API |
| --- | --- | --- | --- |
| 出现时间 | 2023 年（GPT-3.5/4 生态标准） | 2025-03（OpenAI 正式推出） | 2026-01（开源规范，基于 Responses） |
| 端点 | `POST /v1/chat/completions` | `POST /v1/responses` | `POST /v1/responses`（同形，多厂商互通） |
| 输入模型 | `messages[]`（role + content） | `input`（字符串或 typed Items） | 同 Responses：Items 为原子单位 |
| 输出模型 | `choices[].message` | `output[]`（message / reasoning / function_call / …） | 同 Responses，流式为语义事件 |
| 会话状态 | 客户端自行拼全量 history | 服务端可 `store` + `previous_response_id` | 默认可无状态；支持加密 reasoning 回传 |
| 自定义 Function Calling | ✅ | ✅ | ✅ |
| **服务端 Agent 循环**（一轮内多工具并直接出终答） | ❌（工具结果需再发一轮） | ✅（内置工具可在同请求内执行完） | ✅（规范正式化 sub-agent loop） |
| 内置托管工具 | ❌ | web_search / file_search / code_interpreter / computer_use / image_generation / MCP / shell 等 | 分 **internal**（厂商托管）与 **external**（客户端/MCP） |
| Reasoning 体验 | 有限；部分模型在 Chat 上能力弱于 Responses | 原生更好（推理缓存、跨轮保留） | 规范化 `content` / `encrypted_content` / `summary` |
| Structured Outputs | `response_format` | `text.format` | 规范对齐 Responses |
| 并行 `n` 路采样 | ✅（`n`） | ❌（单次一条生成） | ❌ |
| 定位 | 对话时代的事实标准，生态最广 | OpenAI 新项目推荐默认；接棒 Assistants | 跨厂商开放标准，面向 Agent / 路由层 |
| **典型原生支持** | OpenAI、Azure、Anthropic（兼容层）、Gemini、DeepSeek、通义、智谱、Kimi、绝大多数国内 API | **OpenAI / Azure OpenAI** 原生最完整；百度千帆等国内云已提供兼容实现 | Hugging Face Inference Providers、Databricks Open Responses、部分网关/代理；厂商原生逐步跟进 |
| **经网关桥接后** | — | LiteLLM、各类聚合网关可将 Chat 上游映射为 `/v1/responses` | 同左；Open Responses Compliance 可验收 |

**一句话选型：**

- 只要「发消息 → 拿文本」且生态兼容优先 → **Chat Completions** 仍最稳。
- 做 Agent、内置工具、推理模型、服务端状态 → 优先 **Responses**（OpenAI）或兼容实现。
- 要跨厂商、可移植、统一客户端 → 以 **Open Responses** 为契约，上游用原生或网关桥接。

---

## 2. 历史：三条接口如何走到今天

### 2.1 Chat Completions：对话时代的「事实标准」（2023–）

OpenAI 在 ChatGPT 走红后推出 `/v1/chat/completions`，用 `system / user / assistant` 消息列表替代更早的 Completions（续写）范式。随后几乎所有厂商都提供了「OpenAI 兼容」的 Chat 接口：

- 请求简单、文档多、SDK 与 LangChain / LlamaIndex / 各类 IDE 插件默认对接它；
- Function Calling、Vision、Structured Outputs 都在这条协议上叠出来。

它的核心假设是：**无状态、客户端管上下文**。每一轮都把完整 `messages` 发上去；若模型返回 `tool_calls`，客户端执行工具后，必须把 tool 结果再塞进 `messages`，**再发起一次** Chat Completions 请求。多工具、多步 Agent 的循环逻辑全部在应用侧。

### 2.2 Responses API：面向 Agent 的「新一等公民」（2025-03）

2025 年 3 月，OpenAI 发布 Responses API，明确将其定位为 Chat Completions 的演进，并逐步承接 Assistants API（Assistants 计划在 2026-08-26 日落）。设计目标包括：

1. **Items 而非臃肿 Message**：`function_call`、`reasoning`、`function_call_output` 等各自独立，便于流式与可观测；
2. **服务端状态**：`store` + `previous_response_id`（或 Conversations API），减轻客户端拼历史的负担，并提升 prompt cache 命中率；
3. **Agentic by default**：内置 web search、file search、code interpreter、computer use、image generation、远程 MCP 等；**同一请求内**可完成「调工具 → 拿结果 → 继续推理 → 出终答」；
4. 新能力优先落在 Responses（推理摘要、compaction、shell tool 等），Chat Completions 仍会维护，但不再是创新主战场。

OpenAI 官方建议：**新项目默认用 Responses**；存量 Chat 可渐进迁移。

### 2.3 Open Responses：把 Responses「开放成标准」（2026-01）

Chat Completions 之所以难被取代，不是因为最适合 Agent，而是因为**互操作性**。Responses 能力更强，却一度偏「OpenAI 专有」。

2026 年 1 月，社区发布 **Open Responses**（[openresponses.org](https://www.openresponses.org/)）：由 OpenAI 发起方向、开源社区共建、Hugging Face 等生态背书。它：

- 以 Responses 为蓝本，定义跨厂商的请求/响应、语义流式事件、工具与 agent loop；
- 区分 **Model Providers**（真正推理）与 **Routers**（路由/编排）；
- 正式化 **internal vs external tools**，以及一轮推理中的 sub-agent loop；
- 提供 Compliance 测试，方便厂商与网关宣称「兼容」。

目标很明确：在 Agent 时代用一套开放契约，替代「各家各说一套 Chat Completions 方言」。

---

## 3. 优劣势对比

### 3.1 Chat Completions

| 优势 | 劣势 |
| --- | --- |
| 生态最成熟，几乎所有模型都暴露兼容端点 | 无服务端 Agent 循环：多工具需多轮 HTTP |
| 学习成本低，调试材料多 | 客户端必须维护全量 history，长对话成本与复杂度高 |
| 适合简单对话、批处理、既有系统 | 内置工具、跨轮 reasoning 体验弱于 Responses |
| 与本地推理（vLLM / Ollama / LM Studio）对接容易 | 新特性往往后置甚至缺失 |

### 3.2 Responses API（OpenAI）

| 优势 | 劣势 |
| --- | --- |
| 一轮请求内多工具 + 终答，Agent 延迟与代码量显著下降 | 原生完整能力主要在 OpenAI / Azure；其他厂商参差不齐 |
| 服务端状态与更好的 cache，成本可降（官方称约 40%–80% cache 相关改善） | 默认 `store` 带来数据驻留/合规考量，需显式 `store: false` |
| 内置工具与 MCP，少写胶水代码 | 与 Chat 的字段不兼容（`messages`→`input`，`response_format`→`text.format` 等），迁移有成本 |
| 推理模型体验更好 | `n` 多候选采样已移除；部分旧习惯要改 |

### 3.3 Open Responses

| 优势 | 劣势 |
| --- | --- |
| 跨厂商统一契约，利于路由、评测、多模型切换 | 规范仍在演进，厂商原生达标度不一 |
| 继承 Responses 的 Agent / Items / 语义流式设计 | 许多「兼容」实际靠网关翻译，能力上限受上游 Chat 限制 |
| Compliance 与社区工具降低接入成本 | 客户端生态仍不如 Chat Completions 庞大 |
| 适合作为平台层/网关层的目标协议 | 与 OpenAI 专有超集功能可能有细微差异 |

---

## 4. 国内外支持程度（截至 2026 中）

### 4.1 国际

| 厂商 / 平台 | Chat Completions | Responses（OpenAI 形） | Open Responses |
| --- | --- | --- | --- |
| OpenAI | ✅ 完整 | ✅ 原生最完整 | 规范发起方；专有能力为超集 |
| Azure OpenAI | ✅ | ✅ | 经兼容层 / Databricks 等 |
| Anthropic | 自身为 Messages API；生态多用 Chat 兼容或桥接 | 经 LiteLLM 等桥到 `/responses` | Databricks 等提供 Open Responses 适配 |
| Google Gemini | ✅ 兼容或原生 GenerateContent | 经网关桥接 | 有 Open Responses 适配实现 |
| Hugging Face Inference Providers | ✅ | 早期接入 | ✅ 早期支持与演示 Space |
| Databricks Model Serving | ✅ | OpenAI 直通 / Open Responses 路径 | ✅ `/serving-endpoints/open-responses` |
| 本地 vLLM / llama.cpp / LM Studio | ✅ 主流 | 多数仅 Chat；需网关桥 | 依赖网关 |

### 4.2 国内

| 厂商 / 平台 | Chat Completions | Responses 兼容 | Open Responses |
| --- | --- | --- | --- |
| DeepSeek 官方 | ✅ 主力 | 官方偏 Chat；经千帆/聚合网关可走 Responses | 多为网关层 |
| 通义千问 / 阿里云百炼 | ✅ | 部分云与聚合网关兼容 `/v1/responses` | 少见原生，靠网关 |
| 智谱 GLM | ✅ | 聚合网关常见 | 靠网关 |
| 月之暗面 Kimi | ✅ | 聚合网关常见 | HF 演示曾用 Kimi 走 Open Responses 路由 |
| 百度智能云千帆 | ✅ Chat API | ✅ **官方 Responses API**（`/v2/responses`），支持 `previous_response_id`、MCP、内置知识检索等 | 接近 Responses 能力，是否标 Open Responses Compliance 需看版本 |
| 各类 API 聚合网关 | ✅ | 常同时暴露 `/v1/chat/completions` 与 `/v1/responses` | 少数宣称对齐 |

**现状结论：**

1. **Chat Completions** 仍是国内模型与本地部署的「最大公约数」。
2. **Responses** 在 OpenAI 最完整；国内以**百度千帆**等云厂商与聚合网关跟进较快。
3. **Open Responses** 更多出现在**国际路由层 / 云平台 / 开源网关**；国内应用侧常见路径是：客户端说 Open Responses / Responses，网关翻译成上游 Chat Completions。

---

## 5. 三种接口调用示例

以下示例均用 Python + 官方 `openai` SDK 风格（Responses / Open Responses 客户端可共用同一 SDK，改 `base_url` 即可）。

### 5.1 Chat Completions API

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxx",
    # 国内模型示例：DeepSeek / 通义等兼容端点
    # base_url="https://api.deepseek.com",
)

completion = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[
        {"role": "system", "content": "你是简洁的助手。"},
        {"role": "user", "content": "用一句话解释 REST。"},
    ],
)

print(completion.choices[0].message.content)
```

### 5.2 Responses API（OpenAI）

```python
from openai import OpenAI

client = OpenAI(api_key="sk-xxx")

response = client.responses.create(
    model="gpt-5.2",
    instructions="你是简洁的助手。",
    input="用一句话解释 REST。",
    # 可选：开启联网等内置工具（服务端执行，一轮内返回终答）
    # tools=[{"type": "web_search"}],
)

print(response.output_text)
# 多轮时可：previous_response_id=response.id
```

### 5.3 Open Responses API

协议形状与 Responses 高度一致；差异主要在**多厂商路由头、reasoning 字段可见性、Compliance**。示例对接 Hugging Face / 自建 Open Responses 网关：

```python
from openai import OpenAI

client = OpenAI(
    api_key="hf_xxx",  # 或网关发放的 key
    base_url="https://your-open-responses-gateway/v1",
)

response = client.responses.create(
    model="moonshotai/Kimi-K2-Thinking:nebius",  # 路由层模型名
    input="用一句话解释 REST。",
    # 部分实现要求版本头（可用 httpx 默认 headers 注入）
    # extra_headers={"OpenResponses-Version": "latest"},
)

print(response.output_text)
```

等价的 curl：

```bash
curl https://your-open-responses-gateway/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "OpenResponses-Version: latest" \
  -d '{
    "model": "zai-org/GLM-4.7",
    "input": "用一句话解释 REST。"
  }'
```

---

## 6. Responses 的内置工具，以及「一轮多工具」与 Chat 的本质差别

### 6.1 Responses / Open Responses 常见内置（托管）工具

OpenAI Responses 侧常见类型包括（随产品迭代增减）：

| 工具类型 | 作用 |
| --- | --- |
| `web_search` / `web_search_preview` | 联网检索 |
| `file_search` | 基于向量库的文件检索 |
| `code_interpreter` | 沙箱内跑代码、处理文件 |
| `computer_use` | 操控计算机环境（Agent 桌面场景） |
| `image_generation` | 文生图 |
| `mcp`（远程 MCP） | 对接外部 MCP Server |
| `shell` | 在托管容器/本地 runtime 执行命令 |

Open Responses 把它归纳为两类：

- **Internal（托管工具）**：在厂商基础设施内执行，客户端看不到中间 HTTP 往返；
- **External（外部工具）**：客户端函数或外部 MCP，需由客户端/网关回填 `function_call_output`。

可用 `max_tool_calls`、`tool_choice` 约束循环次数与可选工具。

### 6.2 同一轮：Responses 可「调完多个工具再返回」；Chat 必须再开一轮

这是两者在 Agent 场景最关键的产品差异。

**Responses（内置/托管工具）——一次 HTTP，服务端完成循环：**

```text
Client                         Provider
  |  POST /v1/responses          |
  |  tools=[web_search, ...]     |
  |----------------------------->|
  |                              |  model → tool_call #1
  |                              |  execute tool #1
  |                              |  model → tool_call #2
  |                              |  execute tool #2
  |                              |  model → final answer
  |<-----------------------------|
  |  output: [...tools..., msg]  |
```

客户端只发一次请求，响应的 `output` 里可以包含多段 tool 相关 Item 与最终 `message`。

**Chat Completions——每一轮工具调用都要再打一次接口：**

```text
Client                         Provider
  |  POST /chat/completions #1   |
  |----------------------------->|
  |<--- assistant + tool_calls --|
  |  (本地执行 tool #1, #2...)   |
  |  POST /chat/completions #2   |
  |  messages + tool results     |
  |----------------------------->|
  |<--- final assistant message -|
```

即便模型在第一轮并行给出多个 `tool_calls`，**执行结果也无法在同一轮响应里被模型消费**；必须把结果写回 `messages`，再请求一次，模型才能基于工具结果生成最终回答。复杂 Agent 往往是「多轮 Chat Completions」循环；Responses 则把这段循环上移到服务端（至少对托管工具如此）。

> **注意：** 对**纯自定义 function**（非托管），Responses 仍可能需要客户端回传 `function_call_output` 再继续；但协议与 Item 模型更适合表达多步状态，且托管工具路径显著减少往返。Open Responses 进一步把「sub-agent loop」写进规范，并用 `max_tool_calls` 等参数统一控制。

---

## 7. 转换网关：把 Chat Completions 包装成 Open Responses / Responses

现实里大量上游（国内模型、本地 vLLM、很多聚合商）只有 Chat Completions。而新客户端（如 Codex CLI 默认 `wire_api = "responses"`、HF Open Responses 客户端）只说 Responses。中间需要 **协议转换网关**。

### 7.1 网关在做什么

```text
┌─────────────┐   /v1/responses    ┌──────────────┐   /v1/chat/completions   ┌─────────────┐
│ Agent / CLI │ ─────────────────► │  转换网关     │ ───────────────────────► │ 上游模型 API │
│ Codex / App │ ◄───────────────── │ LiteLLM 等   │ ◄─────────────────────── │ Chat only   │
└─────────────┘  Responses 形态    └──────────────┘   Chat 形态               └─────────────┘
```

典型职责：

1. 把 `input` / Items 映射为 `messages`；
2. 把 Chat 的 `choices[0].message` 映射为 Responses 的 `output` Items；
3. 流式时把 token delta 翻译成 `response.output_text.delta` 等语义事件，并以 `[DONE]` 结束；
4. （可选）用网关侧存储模拟 `previous_response_id` 会话；
5. （可选）在网关内实现有限的 tool loop——但**无法凭空获得**上游没有的托管 web_search / computer_use。

同类思路还见于各类「Codex ↔ 国产模型」本地路由、OpenResponses 社区适配器等。

### 7.2 用 LiteLLM 实现转换网关

[LiteLLM](https://docs.litellm.ai/docs/response_api) 提供与 OpenAI `/responses` 同形的端点，并支持：

- **上游原生 Responses** → 直通；
- **上游只有 Chat** → **`/responses` → `/chat/completions` Bridge**。

#### （1）Proxy 配置：强制走 Chat 桥接

适合 vLLM、LM Studio、只暴露 Chat 的国产兼容端点：

```yaml
# config.yaml
model_list:
  - model_name: local-qwen
    litellm_params:
      model: openai/my-qwen
      api_base: http://127.0.0.1:8000/v1
      api_key: fake-key
      use_chat_completions_api: true   # 关键：/responses → Chat

  # 或写成模型名前缀：
  # model: openai/chat_completions/my-qwen
```

启动：

```bash
litellm --config config.yaml
# http://0.0.0.0:4000
```

客户端仍按 Responses / Open Responses 调用：

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:4000", api_key="sk-1234")

r = client.responses.create(
    model="local-qwen",
    input="你好，介绍一下你自己。",
)
print(r.output_text)
```

SDK 直连同样可以：

```python
import litellm

response = litellm.responses(
    model="openai/chat_completions/my-qwen",
    input="Hello!",
    api_base="http://127.0.0.1:8000",
    api_key="fake-key",
)
print(response)
```

#### （2）反向：Chat 客户端走 Responses 上游

若上游是 OpenAI Responses 更优（如 GPT-5 推理），可把 Chat 流量桥到 Responses：

```python
# 模型前缀
litellm.completion(model="openai/responses/gpt-5-mini", messages=[...])

# 或全局
# litellm.route_all_chat_openai_to_responses = True
# 环境变量：LITELLM_ROUTE_ALL_CHAT_OPENAI_TO_RESPONSES=true
```

#### （3）会话与多厂商

LiteLLM Proxy 还可在网关侧做 `previous_response_id` 会话连续、负载均衡、对 Anthropic/Gemini 等做 Responses 外形包装。这对「统一对外暴露 Open Responses，对内对接各家原生 API」很有用。

### 7.3 转换网关方式的优点与不足

**优点**

1. **客户端统一**：一套 Responses / Open Responses SDK 打通国内外与本地模型；
2. **迁移成本低**：存量 Chat 上游不用等厂商发新接口；
3. **运维集中**：鉴权、限流、日志、fallback、虚拟 key 可放在网关；
4. **适配新工具链**：Codex、HF 客户端、Agent 框架可硬编码 `/v1/responses`。

**不足**

1. **能力不是翻译出来的**：上游没有托管 `web_search` / `computer_use`，网关无法变出同等服务端工具；「一轮内多工具终答」若上游是纯 Chat，网关最多在本地代跑有限 loop，延迟与计费模型和原生 Responses 不同；
2. **语义有损**：Items、reasoning 加密字段、语义流式事件、compaction 等，桥接层常简化或模拟，Compliance 可能无法 100% 通过；
3. **状态与缓存**：`previous_response_id` 若只在网关模拟，吃不到厂商侧 prompt cache 与推理状态红利；
4. **额外跳数**：多一跳延迟、可用性与排错面增加；
5. **双协议维护**：网关要同时跟进 Chat 方言差异与 Open Responses 规范演进。

**实践建议：** 对外契约选 Open Responses / Responses；对内按上游能力分级——有原生 Responses 的直通，只有 Chat 的走桥接，并在文档中标明「桥接模型不支持哪些托管工具」。需要强 Agent 托管工具时，优先选真正实现 Responses 的云（OpenAI、千帆 Responses 等），而不是只做 JSON 外形兼容的网关。

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

接口演进的主线，不是「废除 Chat」，而是：**对话协议保留兼容，Agent 协议成为新默认；Open Responses 试图把后者从一家之私变成行业公共层。** 在国内生态完全跟上之前，**Chat + 转换网关 + 少数云原生 Responses** 会是最常见的过渡架构。

---

## 参考

- [OpenAI: Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
- [Open Responses 规范](https://www.openresponses.org/specification) / [Hugging Face: Open Responses](https://huggingface.co/blog/open-responses)
- [LiteLLM `/responses`](https://docs.litellm.ai/docs/response_api)
- [百度千帆 Responses API 使用指南](https://cloud.baidu.com/doc/qianfan-docs/s/4mi400l1m)
