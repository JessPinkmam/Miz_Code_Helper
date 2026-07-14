// feishuSubmit.ts
// 把「当前生成的 Prompt + 任务元数据」提交到飞书多维表格 Webhook。
//
// 安全边界：
//   - payload 只含任务元数据与已通过敏感扫描的 Prompt，绝不含账号/密码/凭据。
//   - 不打印 config / webhookUrl / bearerToken，不把 config 写入任何存储。
import type { FeishuSecretConfig } from './feishuSecretVault'
import type { BuildOutput } from './promptBuilder'
import { EXEC_MODE_LABELS, TASK_TYPE_LABELS, DATA_LEVEL_LABELS, type TaskInput } from '../types'
import { STRICT_RULES_VERSION } from '../config/strictRules'

export interface FeishuTaskPayload {
  taskId: string
  submittedAt: string
  platform: string
  taskType: string
  dataLevel: string
  shops: string
  startDate: string
  endDate: string
  granularity: string
  executionMode: string
  riskLevel: 'BLOCK' | 'CONFIRM' | 'WARN' | 'PASS'
  strictVersion: string
  prompt: string
  source: 'Miz Code Helper'
}

/** 由风险结果推导一个粗粒度风险标签（不含任何原文）。 */
function riskLevelOf(out: BuildOutput): FeishuTaskPayload['riskLevel'] {
  const levels = out.risk.findings.map((f) => f.severity)
  if (levels.includes('block')) return 'BLOCK'
  if (levels.includes('confirm')) return 'CONFIRM'
  if (levels.includes('warn')) return 'WARN'
  return 'PASS'
}

/**
 * 用当前表单与生成结果构建提交 payload。
 * submittedAt 由调用方传入（便于测试与避免隐式时钟依赖）。
 * 注意：此函数只读取任务元数据与已生成 Prompt，绝不接触凭据保险箱。
 */
export function buildFeishuPayload(
  input: TaskInput,
  out: BuildOutput,
  submittedAt: string,
): FeishuTaskPayload {
  return {
    taskId: input.taskId || '(未填写)',
    submittedAt,
    platform: input.platform,
    taskType: TASK_TYPE_LABELS[input.taskType],
    dataLevel: DATA_LEVEL_LABELS[input.dataLevel],
    shops: input.shops.join('、'),
    startDate: input.startDay,
    endDate: input.endDay,
    granularity: input.granularity === 'day' ? '按天' : '按周',
    executionMode: EXEC_MODE_LABELS[out.effectiveMode],
    riskLevel: riskLevelOf(out),
    strictVersion: `v${STRICT_RULES_VERSION}`,
    prompt: out.prompt,
    source: 'Miz Code Helper',
  }
}

export async function submitTaskToFeishu(
  config: FeishuSecretConfig,
  payload: FeishuTaskPayload,
  timeoutMs = 15000,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.bearerToken) {
    headers.Authorization = `Bearer ${config.bearerToken}`
  }

  // 超时/中断保护：Webhook 挂起时不至于让 UI 永久卡在「提交中」
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`提交超时（>${Math.round(timeoutMs / 1000)}s），请检查网络或飞书 Webhook`)
    }
    // 可能是 CORS / 网络错误：不回显底层细节，给出可操作提示
    throw new Error('提交失败：网络或跨域（CORS）被拦截，请确认飞书 Webhook 已放通跨域')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // 只暴露状态码，不回显飞书完整响应（可能带调试信息）
    throw new Error(`飞书返回 HTTP ${response.status}`)
  }
  // 不打印请求头 / Webhook / Token，也不把 config 写入 localStorage。
}
