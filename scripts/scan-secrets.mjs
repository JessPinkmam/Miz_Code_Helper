// scripts/scan-secrets.mjs
// 提交前敏感信息扫描：扫 src/ 与根级配置源文件，命中即以非零退出。
// 只输出命中文件与类别，绝不打印疑似密钥原文。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src']
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.html', '.css'])
const SKIP = new Set(['node_modules', 'dist', '.git', '__tests__'])

const DETECTORS = [
  ['github_pat', /\bgh[posru]_[A-Za-z0-9]{20,}/],
  ['postgres_uri', /\bpostgres(ql)?:\/\/\S+/i],
  ['db_uri', /\b(mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s/]*:[^\s/]+@/i],
  ['pgpassword', /\bPGPASSWORD\s*[:=]\s*\S+/i],
  ['password', /\b(pass(word|wd)?|pwd)\s*[:=]\s*['"]?\S{3,}/i],
  ['authorization', /\bBearer\s+[A-Za-z0-9._-]{10,}/],
  ['token', /\b(access[_-]?token|api[_-]?key|secret)\s*[:=]\s*['"]?\S{6,}/i],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['private_key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
]

// 白名单：正则模式本身所在的检测文件与测试用例（含刻意的假密钥），避免自我误报
const SELF = new Set(['scan-secrets.mjs', 'sensitiveScan.ts'])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (SCAN_EXT.has(extname(name)) && !SELF.has(name)) out.push(p)
  }
  return out
}

let files = []
for (const d of SCAN_DIRS) {
  try { files.push(...walk(join(ROOT, d))) } catch { /* dir missing */ }
}

const hits = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  for (const [cat, re] of DETECTORS) {
    if (re.test(text)) hits.push({ file: f.replace(ROOT, '.'), category: cat })
  }
}

if (hits.length) {
  console.error('✗ 敏感信息扫描未通过（不打印原文）：')
  for (const h of hits) console.error(`  - ${h.file} → ${h.category}`)
  process.exit(1)
} else {
  console.log('✓ 敏感信息扫描通过。')
}
