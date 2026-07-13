// shopVault.ts
// 店铺凭据（账号/密码）本地保险箱 —— 只存浏览器 localStorage。
//
// 安全边界（务必保持）：
//   - 凭据只存在本机浏览器，独立于任务草稿的 key。
//   - 绝不进 git、绝不打进部署包、绝不参与任何导出 JSON。
//   - 绝不写入生成的 Prompt 文本（promptBuilder 只引用「本地已留存」这一事实）。
// 该文件不做加密，仅做隔离存储；请勿在公共/共享电脑上保存真实凭据。

import type { PlatformId } from '../config/platformContext'

const VAULT_KEY = 'miz-code-helper:shop-creds:v1'

export interface ShopCred {
  account: string
  password: string
}

/** shopKey -> 凭据 */
export type CredMap = Record<string, ShopCred>

export function loadVault(): CredMap {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as CredMap
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function persist(map: CredMap): boolean {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

/** 覆盖写入整份凭据表 */
export function saveVault(map: CredMap): boolean {
  return persist(map)
}

/** 设置单个店铺凭据；account/password 都为空则视为清除 */
export function setCred(map: CredMap, shopKey: string, cred: ShopCred): CredMap {
  const next = { ...map }
  if (!cred.account && !cred.password) {
    delete next[shopKey]
  } else {
    next[shopKey] = { account: cred.account, password: cred.password }
  }
  persist(next)
  return next
}

/** 清除单个店铺凭据 */
export function clearCred(map: CredMap, shopKey: string): CredMap {
  const next = { ...map }
  delete next[shopKey]
  persist(next)
  return next
}

/** 清空整份凭据表 */
export function clearVault(): void {
  try {
    localStorage.removeItem(VAULT_KEY)
  } catch {
    /* ignore */
  }
}

/** 该店是否已在本地留存凭据（account 或 password 任一非空） */
export function hasCred(map: CredMap, shopKey: string): boolean {
  const c = map[shopKey]
  return !!c && (!!c.account || !!c.password)
}

// ── CSV 批量导入 ───────────────────────────────────────────────────────────
// 每行一个店铺：平台,名称,账号,密码
// 平台支持中英文别名；账号/密码可留空。分隔符支持英文逗号、中文逗号或制表符。

const PLATFORM_ALIAS: Record<string, PlatformId> = {
  taobao: 'taobao',
  淘宝: 'taobao',
  天猫: 'taobao',
  tmall: 'taobao',
  dewu: 'dewu',
  得物: 'dewu',
  poison: 'dewu',
  vip: 'vip',
  vipshop: 'vip',
  唯品会: 'vip',
}

export interface ParsedShopRow {
  platform: PlatformId
  name: string
  account: string
  password: string
}

export interface CsvParseResult {
  rows: ParsedShopRow[]
  /** 无法解析的行号（从 1 起）与原因 */
  errors: { line: number; reason: string }[]
}

/** 解析 CSV 文本：平台,名称,账号,密码。跳过空行与 # 注释行。 */
export function parseShopCsv(text: string): CsvParseResult {
  const rows: ParsedShopRow[] = []
  const errors: CsvParseResult['errors'] = []
  const lines = (text || '').split(/\r?\n/)
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const cols = line.split(/[\t,，]/).map((c) => c.trim())
    const [platRaw, name, account = '', password = ''] = cols
    const platform = PLATFORM_ALIAS[(platRaw || '').toLowerCase()] ?? PLATFORM_ALIAS[platRaw || '']
    if (!platform) {
      errors.push({ line: i + 1, reason: `未知平台「${platRaw ?? ''}」（支持 淘宝/taobao、得物/dewu、唯品会/vip）` })
      return
    }
    if (!name) {
      errors.push({ line: i + 1, reason: '缺少店铺名称' })
      return
    }
    rows.push({ platform, name, account, password })
  })
  return { rows, errors }
}

