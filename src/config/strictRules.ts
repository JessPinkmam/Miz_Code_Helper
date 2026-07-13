// strictRules.ts
// ─────────────────────────────────────────────────────────────────────────────
// 唯一的 strict 规则来源（单一事实源）。不得在组件里散落硬编码。
// 每条规则：唯一 ID、级别（BLOCK/CONFIRM/WARN）、适用范围、用户提示。
// 组装优先级固定：strict > platform_current > task_input > historical。
// ─────────────────────────────────────────────────────────────────────────────

export type StrictLevel = 'BLOCK' | 'CONFIRM' | 'WARN'

/** 规则适用范围：平台 or 操作类别 */
export type RuleScope =
  | 'taobao'
  | 'dewu'
  | 'vip'
  | 'all'
  | 'write'
  | 'backfill'
  | 'product'
  | 'multishop'

export interface StrictRule {
  id: string
  level: StrictLevel
  title: string
  appliesTo: RuleScope[]
  message: string
}

export const STRICT_RULES_VERSION = '2.0.0'
export const STRICT_RULES_AS_OF = '2026-07-13'

/** 组装优先级：越靠前越不可覆盖 */
export const PRIORITY = ['strict', 'platform_current', 'task_input', 'historical'] as const
export type PriorityLayer = (typeof PRIORITY)[number]

// ── BLOCK：违反即禁止生成正式执行 Prompt ─────────────────────────────────────
const BLOCK_RULES: StrictRule[] = [
  {
    id: 'STRICT-NO-BYPASS-AGENT',
    level: 'BLOCK',
    title: '必须交给平台采集 Agent',
    appliesTo: ['all'],
    message: '业务采集、补数、缺口修复必须交给对应平台的采集 Agent 执行；助理不得自行采集或写库。',
  },
  {
    id: 'STRICT-NO-READONLY-COLLECT',
    level: 'BLOCK',
    title: '只读端不得直连采集/写库',
    appliesTo: ['all'],
    message: '不允许机器 B 或只读 Agent 直连平台采集、写库或修改采集逻辑。',
  },
  {
    id: 'STRICT-STOP-AND-ESCALATE',
    level: 'BLOCK',
    title: '能力缺失必须停止并升级',
    appliesTo: ['all'],
    message: '若现有采集能力不支持本次任务，立即停止执行，记录缺失能力、影响范围和相关证据，升级给技术负责人。助理不得要求 Agent 临时改代码、建脚本或变更正式采集能力。',
  },
  {
    id: 'STRICT-NO-HARDCODE-CRED',
    level: 'BLOCK',
    title: '禁止硬编码凭据',
    appliesTo: ['all'],
    message: '不允许把账号、密码、Cookie、Token、Authorization、数据库连接串写入前端、Prompt、日志或 repo。',
  },
  {
    id: 'STRICT-NO-BLIND-INSERT',
    level: 'BLOCK',
    title: '禁止重复写入/毁数据',
    appliesTo: ['write', 'backfill'],
    message: '不允许重复写入、删除既有业务数据或未备份的批量改写；确保不重复、不破坏已有数据。',
  },
  {
    id: 'STRICT-FAIL-CLOSED',
    level: 'BLOCK',
    title: '风控必须 fail-closed',
    appliesTo: ['all'],
    message: '风控、401、验证码、身份不一致、未知弹窗时必须 fail-closed，禁止继续放量。',
  },
  {
    id: 'STRICT-NO-FALSE-DONE',
    level: 'BLOCK',
    title: '审计未过不得宣布完成',
    appliesTo: ['all'],
    message: '审计未通过时不得宣布完成，也不得删除全部证据。',
  },
  {
    id: 'STRICT-NO-FAKE-STABLE',
    level: 'BLOCK',
    title: '假信号不等于稳定',
    appliesTo: ['all'],
    message: '不允许把 delivered=true、进程在线、日志成功或人工补齐当成自然运行稳定。',
  },
  {
    id: 'STRICT-CURRENT-OVER-HISTORY',
    level: 'BLOCK',
    title: '现行口径优先于历史',
    appliesTo: ['all'],
    message: '平台现行口径与历史记录冲突时，禁止按历史方案直接执行。',
  },
]

// ── CONFIRM：正式执行前必须确认 ─────────────────────────────────────────────
const CONFIRM_RULES: StrictRule[] = [
  {
    id: 'CONFIRM-AGENT-SKILL-ENTRY',
    level: 'CONFIRM',
    title: '确认对应平台采集 Agent',
    appliesTo: ['all'],
    message: '已确认本次任务归属哪个平台的采集 Agent，并从正式入口下发。',
  },
  {
    id: 'CONFIRM-SCOPE',
    level: 'CONFIRM',
    title: '确认店铺/日期/层级/目标表',
    appliesTo: ['all'],
    message: '已确认店铺、日期、数据层级和目标表。',
  },
  {
    id: 'CONFIRM-NO-DOUBLE-RUN',
    level: 'CONFIRM',
    title: '确认无同范围双跑',
    appliesTo: ['all'],
    message: '已确认没有同范围 Cron、补数任务或采集进程双跑。',
  },
  {
    id: 'CONFIRM-BACKUP',
    level: 'CONFIRM',
    title: '写库前备份与回滚点',
    appliesTo: ['write', 'backfill'],
    message: '写库前已有备份和回滚点。',
  },
  {
    id: 'CONFIRM-SMOKE-FIRST',
    level: 'CONFIRM',
    title: '先安排 smoke',
    appliesTo: ['backfill', 'product'],
    message: '已先安排单店、单日或 1–2 天 smoke。',
  },
  {
    id: 'CONFIRM-PRODUCT-THROTTLE',
    level: 'CONFIRM',
    title: '商品级分片/抖动/限流',
    appliesTo: ['product'],
    message: '商品级任务已确认分片、抖动、限流和同店不并发。',
  },
  {
    id: 'CONFIRM-MULTISHOP-ISOLATION',
    level: 'CONFIRM',
    title: '多店独立 profile/端口',
    appliesTo: ['multishop'],
    message: '多店并发已确认独立 profile/端口及账号隔离。',
  },
  {
    id: 'CONFIRM-POST-VERIFY',
    level: 'CONFIRM',
    title: '执行后核验',
    appliesTo: ['all'],
    message: '执行后会核验行数、断档、重复、空字段、异常值和任务状态。',
  },
]

// ── WARN：必须进入输出的提醒 ────────────────────────────────────────────────
const WARN_RULES: StrictRule[] = [
  {
    id: 'WARN-EVIDENCE-FIRST',
    level: 'WARN',
    title: '信息不足先要证据',
    appliesTo: ['all'],
    message: '信息不足时先输出所需证据，不得猜根因后直接全量执行。',
  },
  {
    id: 'WARN-CLEAR-RANGE',
    level: 'WARN',
    title: '日期/店铺/范围要明确',
    appliesTo: ['all'],
    message: '任务的日期、店铺和数据范围必须写清楚，不含糊、不一次给过大范围。',
  },
]

export const STRICT_RULES: StrictRule[] = [...BLOCK_RULES, ...CONFIRM_RULES, ...WARN_RULES]

/** 按适用范围过滤：'all' 恒命中，其余按精确匹配 */
export function rulesForScopes(scopes: RuleScope[]): StrictRule[] {
  const set = new Set<RuleScope>([...scopes, 'all'])
  return STRICT_RULES.filter((r) => r.appliesTo.some((s) => set.has(s)))
}

export function rulesByLevel(level: StrictLevel, scopes?: RuleScope[]): StrictRule[] {
  const base = scopes ? rulesForScopes(scopes) : STRICT_RULES
  return base.filter((r) => r.level === level)
}
