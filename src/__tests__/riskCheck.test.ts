import { describe, it, expect } from 'vitest'
import { runRiskCheck } from '../lib/riskCheck'
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

describe('风险拦截 (>=3)', () => {
  it('1) 敏感信息命中 → BLOCK，禁止正式执行，且不回传原文', () => {
    const r = runRiskCheck(makeInput({ rawError: 'PGPASSWORD=supersecret123 postgresql://u:p@h/db' }))
    expect(r.hasBlock).toBe(true)
    expect(r.hasSensitive).toBe(true)
    expect(r.sensitiveCategories).toContain('PGPASSWORD')
    // 命中说明里不得包含原始密钥
    const joined = JSON.stringify(r.findings)
    expect(joined).not.toContain('supersecret123')
  })

  it('2) 正式执行 + 登录态未知 → BLOCK 降级为诊断', () => {
    const out = buildPrompt(makeInput({ execMode: 'formal', loginState: 'unknown' }))
    expect(out.risk.hasBlock).toBe(true)
    expect(out.effectiveMode).toBe('diagnose')
    expect(out.prompt).toContain('已自动降级为「只诊断」')
  })

  it('3) 风控/冷却期 → BLOCK', () => {
    const r = runRiskCheck(makeInput({ underRiskControl: 'yes' }))
    expect(r.findings.some((f) => f.code === 'UNDER_RISK_CONTROL' && f.severity === 'block')).toBe(true)
  })

  it('4) 写库任务未备份 + 正式执行 → BLOCK', () => {
    const r = runRiskCheck(makeInput({ taskType: 'backfill', execMode: 'formal', hasBackup: 'no', loginState: 'yes', hasConflictCron: 'no' }))
    expect(r.findings.some((f) => f.code === 'NO_BACKUP')).toBe(true)
    expect(r.hasBlock).toBe(true)
  })

  it('5) 缺必填（无店铺/日期）→ BLOCK', () => {
    const r = runRiskCheck(makeInput({ shops: [], startDay: '', endDay: '' }))
    expect(r.findings.some((f) => f.code === 'NO_SHOP')).toBe(true)
    expect(r.findings.some((f) => f.code === 'NO_DATE')).toBe(true)
    expect(r.hasBlock).toBe(true)
  })

  it('6) 日期>7天且正式 → CONFIRM 提醒 smoke', () => {
    const r = runRiskCheck(makeInput({ execMode: 'formal', startDay: '2026-07-01', endDay: '2026-07-20', loginState: 'yes', hasConflictCron: 'no' }))
    expect(r.findings.some((f) => f.code === 'RANGE_GT_7D')).toBe(true)
  })
})
