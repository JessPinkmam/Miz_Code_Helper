import { describe, it, expect } from 'vitest'
import { scanSensitive, hasSensitive } from '../lib/sensitiveScan'

describe('敏感信息检测', () => {
  it('检出 GitHub PAT / 连接串 / cookie / bearer', () => {
    expect(scanSensitive('ghp_' + 'A'.repeat(30)).some((h) => h.category === 'github_pat')).toBe(true)
    expect(scanSensitive('postgresql://u:p@host:5432/db').some((h) => h.category === 'postgres_uri')).toBe(true)
    expect(scanSensitive('Cookie: _tb_token_=abc123').some((h) => h.category === 'cookie')).toBe(true)
    expect(scanSensitive('Authorization: Bearer abcdef1234567890').some((h) => h.category === 'authorization')).toBe(true)
  })

  it('干净文本不误报', () => {
    expect(hasSensitive('店铺 shop1，日期 2026-07-01，写入 128 行。')).toBe(false)
  })

  it('返回值不含原始密钥片段', () => {
    const hits = scanSensitive('password=Hunter2SuperSecret')
    expect(JSON.stringify(hits)).not.toContain('Hunter2SuperSecret')
    expect(hits.some((h) => h.category === 'password')).toBe(true)
  })
})
