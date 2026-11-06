import { BackendEventType, backendEvent, defineBackendAdapter } from "qwen-audio-agent/backend-adapter-sdk";

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("cancelled"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("cancelled"));
      },
      { once: true },
    );
  });
}

export const stubBackendAdapter = defineBackendAdapter({
  describe: () => ({
    configured: true,
    enabled: true,
    protocol: "demo-stub",
    label: "Demo Stub Backend",
    capabilities: {
      cancel: true,
      workUpdates: false,
      authorization: false,
      inputRequests: false,
    },
  }),

  async start() {
    console.log("[stub-backend] started");
  },

  async health() {
    return { ok: true, status: "ready" };
  },

  async submit(work, { signal, onEvent } = {}) {
    console.log("[stub-backend] task accepted");
    console.log(`[stub-backend] task id: ${work.id}`);
    console.log(`[stub-backend] instruction: ${work.instruction}`);
    console.log(`[stub-backend] input parts: ${JSON.stringify(work.inputParts || [])}`);

    onEvent?.(
      backendEvent(BackendEventType.ACTIVITY, {
        activity: {
          id: `stub-${work.id}`,
          kind: "status",
          status: "running",
          label: "Demo 后台正在模拟执行",
          detail: work.instruction,
        },
      }),
    );

    await delay(1200, signal);

    const content = `后台已收到任务并模拟完成。原始要求：${work.instruction}`;
    console.log(`[stub-backend] completed: ${content}`);
    return {
      content,
      artifacts: [],
    };
  },

  async status() {
    return { ok: true };
  },

  async cancel() {
    return { ok: true };
  },

  async respondAuthorization() {
    throw new Error("demo stub does not support authorization requests");
  },

  async respondInput() {
    throw new Error("demo stub does not support input requests");
  },

  subscribe() {
    return () => {};
  },

  async close() {
    console.log("[stub-backend] closed");
  },
});
