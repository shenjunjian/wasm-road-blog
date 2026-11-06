// 必须最先执行：qwen-audio-agent 在模块加载时读取环境变量。
import './bootstrap-env.mjs'
import { createGatewayApplication } from 'qwen-audio-agent/gateway-application'
import { createBackendAgentHost } from 'qwen-audio-agent/backend-adapter-sdk'
import { stubBackendAdapter } from './backend-stub.mjs'

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
