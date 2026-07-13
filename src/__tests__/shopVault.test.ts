import { describe, it, expect } from 'vitest'
import { parseShopCsv, setCred, clearCred, hasCred, type CredMap } from '../lib/shopVault'
import { buildPrompt } from '../lib/promptBuilder'
import { EMPTY_TASK_INPUT, type TaskInput } from '../types'

describe('shopVault CSV 解析', () => {
  it('解析 平台,名称,账号,密码，支持中英文平台别名', () => {
    const { rows, errors } = parseShopCsv(
      ['taobao,旗舰店A,acct01,pass123', '得物,得物店A,acct02,pass456', 'vip,唯品店A,,'].join('\n'),
    )
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ platform: 'taobao', name: '旗舰店A', account: 'acct01', password: 'pass123' })
    expect(rows[1].platform).toBe('dewu')
    expect(rows[2]).toEqual({ platform: 'vip', name: '唯品店A', account: '', password: '' })
  })

  it('未知平台/缺名称记为错误，不进 rows', () => {
    const { rows, errors } = parseShopCsv(['jd,京东店,a,b', 'taobao,,a,b', '# 注释', ''].join('\n'))
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(2)
  })
})

describe('凭据保险箱纯函数', () => {
  it('setCred/hasCred/clearCred', () => {
    let map: CredMap = {}
    map = setCred(map, 'k1', { account: 'a', password: 'p' })
    expect(hasCred(map, 'k1')).toBe(true)
    map = clearCred(map, 'k1')
    expect(hasCred(map, 'k1')).toBe(false)
  })

  it('账号密码都为空视为清除', () => {
    let map: CredMap = { k1: { account: 'a', password: 'p' } }
    map = setCred(map, 'k1', { account: '', password: '' })
    expect(hasCred(map, 'k1')).toBe(false)
  })
})

describe('Prompt 绝不含明文凭据', () => {
  const make = (over: Partial<TaskInput> = {}): TaskInput => ({
    ...EMPTY_TASK_INPUT,
    shops: ['旗舰店A'],
    startDay: '2026-07-01',
    endDay: '2026-07-02',
    ...over,
  })

  it('传入有凭据的店铺，只标注「本地已留存」，不含账号密码明文', () => {
    const out = buildPrompt(make({ platform: 'taobao' }), ['旗舰店A'])
    expect(out.prompt).toContain('本地已留存凭据的店铺：旗舰店A')
    expect(out.prompt).not.toContain('pass123')
    expect(out.prompt).not.toContain('acct01')
    expect(out.prompt).toContain('本 Prompt 不含明文')
  })

  it('无凭据时给出默认零凭据说明', () => {
    const out = buildPrompt(make(), [])
    expect(out.prompt).toContain('本 Prompt 不含任何账号/密码')
  })
})
