import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const envFile = resolve(root, ".env");
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_AUDIO_REALTIME_API_KEY || process.env.MY_QWEN;
if (!apiKey) {
  console.error("缺少 API Key：请设置 MY_QWEN，或复制 .env.example 为 .env。");
  process.exit(1);
}

// qwen-audio-agent 在模块加载时读取环境变量，所以必须在动态 import 之前设置。
process.env.DASHSCOPE_API_KEY = apiKey;
process.env.QWEN_AUDIO_REALTIME_PROVIDER ||= "dashscope";
process.env.QWEN_AUDIO_REALTIME_MODEL ||= "qwen-audio-3.0-realtime-flash";
process.env.AGENT_PROTOCOL ||= "none";
process.env.QWAUDIO_CONFIG_DIR ||= resolve(root, ".qwaudio");
process.env.QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH ||= resolve(root, "ASSISTANT.md");
process.env.QWEN_AUDIO_LOG_LEVEL ||= "info";

const [{ createGatewayApplication }, { createBackendAgentHost }, { stubBackendAdapter }] = await Promise.all([
  import("qwen-audio-agent/gateway-application"),
  import("qwen-audio-agent/backend-adapter-sdk"),
  import("./backend-stub.mjs"),
]);

const agent = createBackendAgentHost(stubBackendAdapter, {
  name: "Demo Stub Backend",
});

const gateway = createGatewayApplication({
  agent,
  autoStart: false,
  spawnThinkingDescription: "把需要多步执行的工作交给 Demo 后台；后台只打印任务并返回模拟成功。",
});

const host = "127.0.0.1";
const port = Number(process.env.GATEWAY_PORT || 3101);
const server = gateway.start({ host, port });

server.once("listening", () => {
  console.log(`[gateway] listening on http://${host}:${port}`);
  console.log(`[gateway] websocket  ws://${host}:${port}/api/realtime`);
  console.log("[client]  npm run dev 后打开 http://127.0.0.1:5173");
});

server.on("error", (error) => {
  console.error("[gateway] failed to start:", error);
  process.exitCode = 1;
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`[gateway] shutting down (${signal})`);
  await gateway.close();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => shutdown(signal));
}
