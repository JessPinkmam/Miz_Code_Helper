// sensitiveScan.ts
// 敏感信息检测：命中即阻止保存/导出/复制。
// 只返回「命中类别」，绝不把疑似密钥原文写入返回值或日志。

export interface SensitiveHit {
  category: string
  /** 命中说明（不含原文片段） */
  note: string
}

interface Detector {
  category: string
  note: string
  test: (text: string) => boolean
}

// 说明：这些 detector 只做布尔判断，不回传匹配文本，防止密钥二次泄露。
const DETECTORS: Detector[] = [
  {
    category: 'password',
    note: '疑似密码字段（password/passwd/pwd=…）',
    test: (t) => /\b(pass(word|wd)?|pwd)\s*[:=]\s*\S+/i.test(t),
  },
  {
    category: 'PGPASSWORD',
    note: '疑似 PGPASSWORD 环境变量',
    test: (t) => /\bPGPASSWORD\s*[:=]\s*\S+/i.test(t),
  },
  {
    category: 'postgres_uri',
    note: '疑似数据库连接串（postgres(ql)://…）',
    test: (t) => /\bpostgres(ql)?:\/\/\S+/i.test(t),
  },
  {
    category: 'db_uri_generic',
    note: '疑似数据库连接串（mysql/mongodb/redis://…）',
    test: (t) => /\b(mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s/]*:[^\s/]+@/i.test(t),
  },
  {
    category: 'cookie',
    note: '疑似 Cookie / Set-Cookie',
    test: (t) => /\b(set-)?cookie\s*[:=]/i.test(t) || /\b(_tb_token_|cookie2|sgcookie|unb)=/.test(t),
  },
  {
    category: 'authorization',
    note: '疑似 Authorization 头 / Bearer token',
    test: (t) => /\bauthorization\s*[:=]/i.test(t) || /\bBearer\s+[A-Za-z0-9._-]{10,}/.test(t),
  },
  {
    category: 'token_field',
    note: '疑似 token / access_token / secret 字段',
    test: (t) => /\b(access[_-]?token|api[_-]?key|secret|token)\s*[:=]\s*\S{6,}/i.test(t),
  },
  {
    category: 'github_pat',
    note: '疑似 GitHub Personal Access Token（ghp_/gho_/ghs_…）',
    test: (t) => /\bgh[posru]_[A-Za-z0-9]{20,}/.test(t),
  },
  {
    category: 'jwt',
    note: '疑似 JWT（三段 base64）',
    test: (t) => /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(t),
  },
  {
    category: 'private_key',
    note: '疑似私钥 PEM 块',
    test: (t) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t),
  },
  {
    category: 'long_secret',
    note: '疑似长密钥（连续 32+ 位高熵字符串）',
    test: (t) => /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=_-]{40,}(?![A-Za-z0-9/+=])/.test(t),
  },
]

/**
 * 扫描文本，返回命中的敏感类别（去重）。
 * 注意：只返回类别与说明，绝不返回命中的原始片段。
 */
export function scanSensitive(text: string): SensitiveHit[] {
  if (!text) return []
  const hits: SensitiveHit[] = []
  const seen = new Set<string>()
  for (const d of DETECTORS) {
    if (d.test(text) && !seen.has(d.category)) {
      seen.add(d.category)
      hits.push({ category: d.category, note: d.note })
    }
  }
  return hits
}

/** 便捷布尔判断 */
export function hasSensitive(text: string): boolean {
  return scanSensitive(text).length > 0
}

/** 扫描一个对象里所有字符串字段（用于保存/导出前整表检查） */
export function scanRecord(record: Record<string, unknown>): SensitiveHit[] {
  const merged: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') merged.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk)
  }
  walk(record)
  return scanSensitive(merged.join('\n'))
}
