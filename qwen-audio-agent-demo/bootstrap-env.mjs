import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const envFile = resolve(root, '.env')
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile)
}

const apiKey = process.env.DASHSCOPE_API_KEY
  || process.env.QWEN_AUDIO_REALTIME_API_KEY
  || process.env.MY_QWEN
if (!apiKey) {
  console.error('缺少 API Key：请设置 MY_QWEN，或复制 .env.example 为 .env。')
  process.exit(1)
}

// qwen-audio-agent 在模块加载时读取这些变量。
process.env.DASHSCOPE_API_KEY = apiKey
process.env.QWEN_AUDIO_REALTIME_PROVIDER ||= 'dashscope'
process.env.QWEN_AUDIO_REALTIME_MODEL ||= 'qwen-audio-3.0-realtime-flash'
process.env.AGENT_PROTOCOL ||= 'none'
process.env.QWAUDIO_CONFIG_DIR ||= resolve(root, '.qwaudio')
process.env.QWEN_AUDIO_AGENT_ASSISTANT_PROFILE_PATH ||= resolve(root, 'ASSISTANT.md')
process.env.QWEN_AUDIO_LOG_LEVEL ||= 'info'
