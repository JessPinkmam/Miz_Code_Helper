import { describe, it, expect } from 'vitest'
import { checkAcceptance } from '../lib/acceptanceCheck'

describe('结果验收 (>=3)', () => {
  it('1) 只说成功没有落数 → 失败', () => {
    const r = checkAcceptance('任务执行成功，一切正常，已处理完毕。')
    expect(r.verdict).toBe('失败')
    expect(r.issues.some((i) => i.code === 'NO_DB_EVIDENCE')).toBe(true)
  })

  it('2) 完整范围+落数+审计 → 通过', () => {
    const text = `店铺：示例旗舰店A，日期：2026-07-01~2026-07-02，目标表 taobao.shop_daily。
    已 pg_dump 备份，唯一键 upsert（ON CONFLICT）写入 128 行，无断档、无重复、空值核验通过。审计通过。无代码改动。`
    const r = checkAcceptance(text)
    expect(r.verdict).toBe('通过')
    expect(r.positives).toContain('含数据库落数证据（行数/记录数）')
  })

  it('3) delivered=true 但无落数 → 失败', () => {
    const r = checkAcceptance('delivered=true，进程在线，日志成功。店铺 shop1 日期 2026-07-01 表 x_daily。')
    expect(r.verdict).toBe('失败')
    expect(r.issues.some((i) => i.code === 'FALSE_SIGNAL')).toBe(true)
  })

  it('4) 有 pending 却宣布完成 → 失败', () => {
    const r = checkAcceptance('店铺 shop1，日期 2026-07-01，表 x_daily，写入 10 行，全部完成；仍有 2 店 pending。')
    expect(r.verdict).toBe('失败')
    expect(r.issues.some((i) => i.code === 'PENDING_BUT_DONE')).toBe(true)
  })

  it('5) 待自然运行验证识别', () => {
    const text = `店铺 shop1，日期 2026-07-01~2026-07-02，表 taobao.shop_daily，写入 50 行，审计通过。
    Cron 已配置，等待自然运行验证稳定性。`
    const r = checkAcceptance(text)
    expect(r.verdict).toBe('待自然运行验证')
  })

  it('6) 空文本 → 失败', () => {
    expect(checkAcceptance('').verdict).toBe('失败')
  })
})
