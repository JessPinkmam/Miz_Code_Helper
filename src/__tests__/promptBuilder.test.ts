import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../lib/promptBuilder'
import { EMPTY_TASK_INPUT, type TaskInput } from '../types'

function makeInput(over: Partial<TaskInput> = {}): TaskInput {
  return {
    ...EMPTY_TASK_INPUT,
    shops: ['示例旗舰店A（假名）'],
    startDay: '2026-07-01',
    endDay: '2026-07-02',
    ...over,
  }
}

describe('promptBuilder 生成 (>=3)', () => {
  it('1) 诊断模式生成完整结构 + strict/平台段', () => {
    const out = buildPrompt(makeInput({ execMode: 'diagnose', platform: 'taobao' }))
    expect(out.prompt).toContain('Strict Context')
    expect(out.prompt).toContain('固定 Background')
    expect(out.prompt).toContain('平台现行 Background（淘宝')
    expect(out.prompt).toContain('要求 Agent 按以下固定结构回填')
    expect(out.effectiveMode).toBe('diagnose')
    expect(out.downgraded).toBe(false)
  })

  it('2) 切换平台只带入对应平台口径', () => {
    const dewu = buildPrompt(makeInput({ platform: 'dewu' }))
    expect(dewu.prompt).toContain('平台现行 Background（得物')
    expect(dewu.prompt).not.toContain('taobao-product-collector')
    const vip = buildPrompt(makeInput({ platform: 'vip' }))
    expect(vip.prompt).toContain('brandStoreSn')
  })

  it('3) 正式执行且全部确认 → 生成 formal，不降级', () => {
    const base = makeInput({ execMode: 'formal', platform: 'taobao', loginState: 'yes', hasConflictCron: 'no' })
    const risk = buildPrompt(base).risk
    const out = buildPrompt({ ...base, confirmedRuleIds: risk.applicableRules.filter((r) => r.level === 'CONFIRM').map((r) => r.id) })
    expect(out.effectiveMode).toBe('formal')
    expect(out.downgraded).toBe(false)
    expect(out.risk.allowFormal).toBe(true)
  })

  it('4) 正式执行缺确认 → 降级为 smoke', () => {
    const out = buildPrompt(makeInput({ execMode: 'formal', loginState: 'yes', hasConflictCron: 'no', confirmedRuleIds: [] }))
    expect(out.effectiveMode).toBe('smoke')
    expect(out.downgraded).toBe(true)
    expect(out.prompt).toContain('正式执行尚缺以下确认')
  })
})
