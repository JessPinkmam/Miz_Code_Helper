import { describe, it, expect } from 'vitest'
import { buildFeishuPayload } from '../lib/feishuSubmit'
import { isFeishuConfigured } from '../lib/feishuSecretVault'
import { buildPrompt } from '../lib/promptBuilder'
import { EMPTY_TASK_INPUT, type TaskInput } from '../types'

function makeInput(over: Partial<TaskInput> = {}): TaskInput {
  return {
    ...EMPTY_TASK_INPUT,
    shops: ['示例旗舰店A（假名）'],
    startDay: '2026-07-01',
    endDay: '2026-07-02',
    taskId: 'T-001',
    ...over,
  }
}

const AT = '2026-07-14T00:00:00.000Z'

describe('feishu 提交 payload', () => {
  it('1) payload 含任务元数据与 Prompt，来源固定', () => {
    const input = makeInput({ platform: 'dewu', execMode: 'diagnose' })
    const out = buildPrompt(input)
    const p = buildFeishuPayload(input, out, AT)
    expect(p.source).toBe('Miz Code Helper')
    expect(p.taskId).toBe('T-001')
    expect(p.platform).toBe('dewu')
    expect(p.submittedAt).toBe(AT)
    expect(p.prompt).toContain('Strict Context')
    expect(p.strictVersion).toMatch(/^v\d/)
  })

  it('2) payload 绝不含账号/密码/凭据明文', () => {
    const input = makeInput()
    const out = buildPrompt(input, ['示例旗舰店A（假名）'])
    const p = buildFeishuPayload(input, out, AT)
    const json = JSON.stringify(p)
    expect(json).not.toMatch(/password/i)
    expect(json).not.toMatch(/bearer/i)
    expect(json).not.toContain('account')
    // payload 结构里没有任何凭据字段
    expect(Object.keys(p)).not.toContain('bearerToken')
    expect(Object.keys(p)).not.toContain('webhookUrl')
  })

  it('3) 有 BLOCK 时 riskLevel 反映为 BLOCK', () => {
    // 未选店铺 → NO_SHOP block
    const input = makeInput({ shops: [] })
    const out = buildPrompt(input)
    const p = buildFeishuPayload(input, out, AT)
    expect(p.riskLevel).toBe('BLOCK')
  })

  it('4) 占位配置视为「未配置」，不可解锁提交', () => {
    // 仓库内为占位 encryptedFeishuConfig（configured=false）
    expect(isFeishuConfigured()).toBe(false)
  })
})
