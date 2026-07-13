// riskCheck.ts
// 自动风险校验（spec 第六节）+ strict 优先级判定。
// 决定：能否生成「正式执行」Prompt；命中哪些 BLOCK/CONFIRM/WARN。

import type { RuleScope, StrictRule } from '../config/strictRules'
import { rulesForScopes } from '../config/strictRules'
import { scanRecord } from './sensitiveScan'
import type { TaskInput } from '../types'

export type Severity = 'block' | 'warn' | 'confirm'

export interface RiskFinding {
  severity: Severity
  code: string
  message: string
  /** 关联的 strict rule id（如有） */
  ruleId?: string
}

export interface RiskResult {
  findings: RiskFinding[]
  /** 命中的 strict 规则（按范围过滤后） */
  applicableRules: StrictRule[]
  /** 尚未确认的 CONFIRM 规则 id */
  pendingConfirmIds: string[]
  /** 是否存在敏感信息命中 */
  hasSensitive: boolean
  sensitiveCategories: string[]
  /** 是否允许生成「正式执行」Prompt */
  allowFormal: boolean
  /** 是否命中任何 BLOCK（禁止正式执行、禁止复制/下载正式 Prompt） */
  hasBlock: boolean
}

/** 由任务输入推导 strict 适用范围 */
export function deriveScopes(input: TaskInput): RuleScope[] {
  const scopes = new Set<RuleScope>(['all', input.platform])
  if (input.dataLevel === 'product') scopes.add('product')

  const writeTypes = new Set(['backfill', 'gap_fix'])
  if (writeTypes.has(input.taskType)) {
    scopes.add('write')
    scopes.add('backfill')
  }
  if (input.shops.length > 1) scopes.add('multishop')
  return [...scopes]
}

function daySpan(start: string, end: string): number | null {
  if (!start || !end) return null
  const s = Date.parse(start)
  const e = Date.parse(end)
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  return Math.round((e - s) / 86_400_000) + 1
}

const isWriteTask = (t: TaskInput['taskType']) => t === 'backfill' || t === 'gap_fix'

/**
 * 运行完整风险校验。formal 相关拦截仅在 execMode==='formal' 时阻断生成，
 * 但风险项在任何模式都会列出（诊断模式也提示）。
 */
export function runRiskCheck(input: TaskInput): RiskResult {
  const findings: RiskFinding[] = []
  const scopes = deriveScopes(input)
  const applicableRules = rulesForScopes(scopes)
  const formal = input.execMode === 'formal'

  // ── 敏感信息检测（任何模式都拦截复制/导出，见调用方） ──
  const sensitive = scanRecord(input as unknown as Record<string, unknown>)
  const sensitiveCategories = sensitive.map((h) => h.category)
  for (const h of sensitive) {
    findings.push({
      severity: 'block',
      code: `SENSITIVE_${h.category.toUpperCase()}`,
      message: `检测到${h.note}；请移除后再生成/复制/导出。命中类别不会被记录原文。`,
      ruleId: 'STRICT-NO-HARDCODE-CRED',
    })
  }

  // ── 必填项缺失 ──
  if (!input.platform) findings.push({ severity: 'block', code: 'NO_PLATFORM', message: '未选择平台。' })
  if (input.shops.length === 0)
    findings.push({ severity: 'block', code: 'NO_SHOP', message: '未选择店铺。' })
  if (!input.startDay || !input.endDay)
    findings.push({ severity: 'block', code: 'NO_DATE', message: '未填写起止日期。' })
  if (!input.dataLevel)
    findings.push({ severity: 'block', code: 'NO_LEVEL', message: '未选择数据层级。' })

  // ── 日期区间 > 7 天但未先 smoke ──
  const span = daySpan(input.startDay, input.endDay)
  if (span !== null && span > 7 && input.execMode === 'formal') {
    findings.push({
      severity: 'confirm',
      code: 'RANGE_GT_7D',
      message: `日期范围约 ${span} 天（>7 天）：建议先拆成 1–2 天 smoke，再分周滚动。正式执行需确认。`,
      ruleId: 'CONFIRM-SMOKE-FIRST',
    })
  }

  // ── 写库任务未确认备份 ──
  if (isWriteTask(input.taskType) && input.hasBackup !== 'yes') {
    findings.push({
      severity: formal ? 'block' : 'warn',
      code: 'NO_BACKUP',
      message: '写库/补数任务未确认备份与回滚点。',
      ruleId: 'CONFIRM-BACKUP',
    })
  }

  // ── 未确认是否与现有 Cron/补数撞车 ──
  if (input.hasConflictCron === 'unknown' && (formal || input.execMode === 'smoke')) {
    findings.push({
      severity: formal ? 'block' : 'warn',
      code: 'CRON_UNKNOWN',
      message: '未确认是否与现有 Cron / 补数任务撞车。',
      ruleId: 'CONFIRM-NO-DOUBLE-RUN',
    })
  } else if (input.hasConflictCron === 'yes') {
    findings.push({
      severity: 'block',
      code: 'CRON_CONFLICT',
      message: '存在同范围 Cron / 补数任务，禁止双跑。',
      ruleId: 'CONFIRM-NO-DOUBLE-RUN',
    })
  }

  // ── 登录态未知却要正式批量 ──
  if (formal && input.loginState === 'unknown') {
    findings.push({
      severity: 'block',
      code: 'LOGIN_UNKNOWN',
      message: '登录态未知却要求正式批量执行。',
      ruleId: 'STRICT-FAIL-CLOSED',
    })
  }

  // ── 风控/冷却期 ──
  if (input.underRiskControl === 'yes') {
    findings.push({
      severity: 'block',
      code: 'UNDER_RISK_CONTROL',
      message: '店铺处于风控/冷却期，必须 fail-closed，禁止放量。',
      ruleId: 'STRICT-FAIL-CLOSED',
    })
  }

  // ── 多店并发未确认隔离 ──
  if (input.shops.length > 1 && input.multishopIsolation !== 'yes' && (formal || input.execMode === 'smoke')) {
    findings.push({
      severity: formal ? 'block' : 'warn',
      code: 'MULTISHOP_NO_ISOLATION',
      message: '多店并发未确认独立 profile/端口与账号隔离。',
      ruleId: 'CONFIRM-MULTISHOP-ISOLATION',
    })
  }

  // ── 商品级正式执行提醒分片/限流 ──
  if (input.dataLevel === 'product' && formal) {
    findings.push({
      severity: 'confirm',
      code: 'PRODUCT_THROTTLE',
      message: '商品级正式执行：必须确认分片、抖动、限流、同店不并发。',
      ruleId: 'CONFIRM-PRODUCT-THROTTLE',
    })
  }

  // ── 待确认的 CONFIRM 规则（按范围）──
  const confirmRules = applicableRules.filter((r) => r.level === 'CONFIRM')
  const confirmedSet = new Set(input.confirmedRuleIds)
  const pendingConfirmIds = confirmRules.filter((r) => !confirmedSet.has(r.id)).map((r) => r.id)

  const hasBlock = findings.some((f) => f.severity === 'block')
  // 正式执行需：无 BLOCK + 全部 CONFIRM 勾选
  const allowFormal = formal ? !hasBlock && pendingConfirmIds.length === 0 : !hasBlock

  return {
    findings,
    applicableRules,
    pendingConfirmIds,
    hasSensitive: sensitive.length > 0,
    sensitiveCategories,
    allowFormal,
    hasBlock,
  }
}
