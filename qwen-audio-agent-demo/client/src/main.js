import { GatewayClient } from "qwen-audio-agent/gateway-client-sdk";
import { GatewayClientCapability, GatewayClientProtocolEvent } from "qwen-audio-agent/gateway-client-protocol";
import { GatewayClientEvent, GatewayServerEvent, GatewayTaskEvent } from "qwen-audio-agent/realtime-events";

const statusEl = document.querySelector("#status");
const logEl = document.querySelector("#log");
const transcriptEl = document.querySelector("#transcript");
const connectionButton = document.querySelector("#connection");
const micButton = document.querySelector("#mic");
const taskButton = document.querySelector("#task");
const sendButton = document.querySelector("#send");
const textInput = document.querySelector("#text");

let inputSampleRate = 16000;
let audioContext = null;
let micStream = null;
let micSource = null;
let micProcessor = null;
let micRunning = false;
let nextPlayTime = 0;
const playback = new Map();
const transcriptLines = new Map();
const logLines = [];

function log(...values) {
  const text = values
    .map((value) => {
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(" ");
  logLines.push(`${new Date().toLocaleTimeString()}  ${text}`);
  if (logLines.length > 200) logLines.shift();
  logEl.textContent = logLines.join("\n");
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function transcriptLine(role) {
  const label = role === "user" ? "你" : "助手";
  let line = transcriptLines.get(role);
  if (!line) {
    line = document.createElement("p");
    line.className = role;
    line.textContent = `${label}: `;
    transcriptEl.append(line);
    transcriptLines.set(role, line);
  }
  return line;
}

function appendTranscript(role, content) {
  const line = transcriptLine(role);
  line.textContent += content;
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function finishTranscript(role, content) {
  const line = transcriptLine(role);
  const label = role === "user" ? "你" : "助手";
  if (content) line.textContent = `${label}: ${content}`;
  transcriptLines.delete(role);
}

function discardTranscript(role) {
  const line = transcriptLines.get(role);
  line?.remove();
  transcriptLines.delete(role);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pcm16Base64(samples, sourceRate, targetRate) {
  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const buffer = new ArrayBuffer(length * 2);
  const view = new DataView(buffer);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.min(Math.floor(position), samples.length - 1);
    const right = Math.min(left + 1, samples.length - 1);
    const fraction = position - left;
    const sample = samples[left] * (1 - fraction) + samples[right] * fraction;
    const clamped = Math.max(-1, Math.min(1, sample));
    const pcm = clamped < 0 ? clamped * 32768 : clamped * 32767;
    view.setInt16(index * 2, Math.round(pcm), true);
  }
  return bytesToBase64(new Uint8Array(buffer));
}

async function ensureAudioContext() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") await audioContext.resume();
  return audioContext;
}

function finishPlayback(responseId) {
  const record = playback.get(responseId);
  if (!record || record.ended) return;
  record.ended = true;
  clearTimeout(record.timer);
  playback.delete(responseId);
  if (client.ready) {
    client.send({
      type: GatewayClientEvent.PLAYBACK_ENDED,
      responseId,
    });
  }
  log("playback.ended", responseId);
}

async function playPcm16(base64, sampleRate, responseId) {
  const context = await ensureAudioContext();
  const bytes = base64ToBytes(base64);
  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const buffer = context.createBuffer(1, pcm.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < pcm.length; index += 1) {
    channel[index] = pcm[index] / 32768;
  }

  let record = playback.get(responseId);
  if (!record) {
    record = {
      sources: new Set(),
      audioDone: false,
      ended: false,
      endTime: 0,
      timer: null,
    };
    playback.set(responseId, record);
    if (client.ready) {
      client.send({
        type: GatewayClientEvent.PLAYBACK_STARTED,
        responseId,
      });
    }
    log("playback.started", responseId);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  const startAt = Math.max(context.currentTime + 0.02, nextPlayTime);
  source.start(startAt);
  record.sources.add(source);
  record.endTime = startAt + buffer.duration;
  nextPlayTime = record.endTime;

  source.onended = () => {
    record.sources.delete(source);
    if (record.audioDone && record.sources.size === 0) finishPlayback(responseId);
  };

  clearTimeout(record.timer);
  record.timer = setTimeout(
    () => {
      if (record.audioDone && record.sources.size === 0) finishPlayback(responseId);
    },
    Math.max(0, (record.endTime - context.currentTime) * 1000) + 200,
  );
}

function stopPlayback(responseId, reason) {
  const record = playback.get(responseId);
  if (!record) return;
  clearTimeout(record.timer);
  for (const source of record.sources) {
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
  }
  playback.delete(responseId);
  if (client.ready) {
    client.send({
      type: GatewayClientEvent.PLAYBACK_CANCELLED,
      responseId,
      reason,
    });
  }
  nextPlayTime = audioContext?.currentTime || 0;
  log("playback.cancelled", { responseId, reason });
}

function stopAllPlayback(reason) {
  for (const responseId of [...playback.keys()]) stopPlayback(responseId, reason);
}

function handleStatus(status) {
  const ready = status.state === "ready";
  const labels = {
    connecting: "正在连接…",
    connected: "已连接，等待会话就绪…",
    disconnected: "连接已断开，正在重连…",
    unavailable: "连接不可用，正在重试…",
    recovery_failed: "恢复会话失败，正在重试…",
    occupied: "连接被占用：已有活动客户端",
    replaced: "连接已被其他客户端接管",
    revoked: "连接凭证已失效",
  };

  setStatus(ready ? `已连接 · ${status.event.session_id}` : labels[status.state] || status.state);
  connectionButton.textContent = client.stopped ? "连接" : "断开连接";
  sendButton.disabled = !ready;
  taskButton.disabled = !ready;
  micButton.disabled = !ready;

  if (ready) log("session.ready", status.event.capabilities);
  if (status.error) log("status.error", status.error.message || status.error);
}

function handleEvent(event) {
  console.log(event.type, event);
  // 语音通道已就绪：记录服务端要求的输入采样率，后续麦克风数据按它转换。
  if (event.type === GatewayServerEvent.VOICE_READY) {
    inputSampleRate = event.inputSampleRate || inputSampleRate;
    log("voice.ready", {
      provider: event.provider,
      inputSampleRate,
    });
    return;
  }

  // 收到一段 Base64 PCM16 音频增量：按 responseId 排队播放。
  if (event.type === GatewayServerEvent.AUDIO_DELTA) {
    playPcm16(event.audio, event.sampleRate, event.responseId).catch((error) => log("playback.error", error.message));
    return;
  }

  // 当前回复的音频已全部下发：等已排队的音频播放完后结束这一轮播放。
  if (event.type === GatewayServerEvent.AUDIO_DONE) {
    const record = playback.get(event.responseId);
    if (record) {
      record.audioDone = true;
      if (record.sources.size === 0) finishPlayback(event.responseId);
    }
    return;
  }

  // 用户或助手转写的增量片段：追加到对应角色的当前文本行。
  if (event.type === GatewayServerEvent.TRANSCRIPT_DELTA) {
    appendTranscript(event.role, event.content);
    return;
  }

  // 转写最终结果：用最终文本替换当前角色的临时内容。
  if (event.type === GatewayServerEvent.TRANSCRIPT_FINAL) {
    finishTranscript(event.role, event.content);
    return;
  }

  // 丢弃未完成的转写：通常发生在插话或该轮被新回复取代时。
  if (event.type === GatewayServerEvent.TRANSCRIPT_DISCARD) {
    discardTranscript(event.role);
    return;
  }

  // 当前回复被用户打断：只停止这个 responseId 对应的音频。
  if (event.type === GatewayServerEvent.RESPONSE_INTERRUPTED) {
    stopPlayback(event.responseId, "response.interrupted");
    return;
  }

  // 服务端要求清空播放队列：停止所有正在播放或排队中的音频。
  if (event.type === GatewayServerEvent.PLAYBACK_CLEAR) {
    stopAllPlayback(event.reason || "playback.clear");
    return;
  }

  // 后台智能体的活动状态：最小示例只记录日志，可在这里展示执行进度。
  if (event.type === GatewayServerEvent.AGENT_ACTIVITY) {
    log("agent.activity", event.activity);
    return;
  }

  // 网关或底层运行时错误：记录错误，实际应用可在这里提示用户。
  if (event.type === GatewayServerEvent.ERROR) {
    log("gateway.error", event.message || event);
    return;
  }

  // 后端请求权限：演示用 stub 不实现授权流程，仅记录请求内容。
  if (event.type === GatewayTaskEvent.PERMISSION_REQUESTED) {
    log("task.permission.requested", event.permission);
    return;
  }

  // 后端请求补充输入：演示用 stub 不支持交互式追问，仅记录请求内容。
  if (event.type === GatewayTaskEvent.INPUT_REQUESTED) {
    log("task.input.requested", event.input);
    return;
  }

  // 任务生命周期或进度事件（task.accepted、task.running、task.completed 等）：提取关键字段记录。
  if (event.type.startsWith("task.")) {
    log(
      event.type,
      event.task
        ? {
            id: event.task.id,
            status: event.task.status,
            objective: event.task.objective,
          }
        : event,
    );
    return;
  }

  // 未识别的事件：原样记录，便于排查协议扩展或新增事件。
  log(event.type, event);
}

const client = new GatewayClient({
  url: `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/realtime?sessionId=demo`,
  createSocket: (url) => new WebSocket(url),
  clientType: "demo-web",
  clientVersion: "0.1.0",
  clientInstanceId: "demo-web-1",
  clientLabel: "Qwen Audio Agent Demo",
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
  onAction(action) {
    log("client.action.request", action);
    return {
      status: "unsupported",
      error: {
        code: "demo_unsupported",
        message: `Demo 未实现 Client Action: ${action.name || "unknown"}`,
      },
    };
  },
});

async function toggleMic() {
  if (micRunning) {
    stopMicrophone();
    return;
  }

  if (!client.ready) {
    log("microphone.not_ready");
    return;
  }

  try {
    const context = await ensureAudioContext();
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    micSource = context.createMediaStreamSource(micStream);
    micProcessor = context.createScriptProcessor(4096, 1, 1);
    micProcessor.onaudioprocess = (event) => {
      if (!micRunning || !client.ready) return;
      const samples = event.inputBuffer.getChannelData(0);
      client.send({
        type: GatewayClientProtocolEvent.INPUT_AUDIO_APPEND,
        audio: pcm16Base64(samples, context.sampleRate, inputSampleRate),
      });
    };
    micSource.connect(micProcessor);
    // ScriptProcessor 需要接到输出端才会持续触发；这里输出的是静音。
    micProcessor.connect(context.destination);
    micRunning = true;
    micButton.textContent = "停止麦克风";
    log("microphone.started", {
      contextSampleRate: context.sampleRate,
      inputSampleRate,
    });
  } catch (error) {
    log("microphone.error", error.message);
    micRunning = false;
  }
}

function stopMicrophone() {
  if (!micRunning) return;
  micRunning = false;
  micProcessor?.disconnect();
  micSource?.disconnect();
  for (const track of micStream?.getTracks() || []) track.stop();
  micProcessor = null;
  micSource = null;
  micStream = null;
  micButton.textContent = "开始麦克风";
  log("microphone.stopped");
}

function disconnect() {
  stopMicrophone();
  stopAllPlayback("client.disconnected");
  client.stop();
  setStatus("未连接");
  connectionButton.textContent = "连接";
  sendButton.disabled = true;
  taskButton.disabled = true;
  micButton.disabled = true;
  log("client.stopped");
}

function toggleConnection() {
  if (client.stopped) {
    client.start();
    return;
  }
  disconnect();
}

async function sendText() {
  const text = textInput.value.trim();
  if (!text || !client.ready) return;
  await ensureAudioContext();
  const sent = client.send({
    type: GatewayClientProtocolEvent.CONVERSATION_ITEM_CREATE,
    parts: [{ type: "text", text }],
  });
  if (sent) {
    textInput.value = "";
    log("conversation.item.create", text);
  }
}

async function createTask() {
  if (!client.ready) return;
  taskButton.disabled = true;
  try {
    const text = textInput.value.trim() || "这是来自 GatewayClient 的显式测试任务。请后台打印任务并返回模拟成功。";
    const result = await client.request(GatewayClientProtocolEvent.TASK_CREATE, {
      message: {
        parts: [{ type: "text", text }],
      },
    });
    log("task.create.result", {
      id: result.task.id,
      status: result.task.status,
    });
  } catch (error) {
    log("task.create.error", error.message);
  } finally {
    taskButton.disabled = false;
  }
}

micButton.addEventListener("click", toggleMic);
connectionButton.addEventListener("click", toggleConnection);
sendButton.addEventListener("click", sendText);
taskButton.addEventListener("click", createTask);
textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendText();
});
