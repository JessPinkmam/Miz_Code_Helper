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
  | 'migration'
  | 'product'
  | 'multishop'

export interface StrictRule {
  id: string
  level: StrictLevel
  title: string
  appliesTo: RuleScope[]
  message: string
}

export const STRICT_RULES_VERSION = '1.0.0'
export const STRICT_RULES_AS_OF = '2026-07-11'

/** 组装优先级：越靠前越不可覆盖 */
export const PRIORITY = ['strict', 'platform_current', 'task_input', 'historical'] as const
export type PriorityLayer = (typeof PRIORITY)[number]

// ── BLOCK：违反即禁止生成正式执行 Prompt ─────────────────────────────────────
const BLOCK_RULES: StrictRule[] = [
  {
    id: 'STRICT-NO-BYPASS-AGENT',
    level: 'BLOCK',
    title: '禁止绕过 OpenClaw Agent',
    appliesTo: ['all'],
    message: '业务采集、补数、写库和采集 skill 修改必须交给对应平台 OpenClaw Agent；Claude Code/Codex 不得代替执行。',
  },
  {
    id: 'STRICT-NO-READONLY-COLLECT',
    level: 'BLOCK',
    title: '只读端不得直连采集/写库',
    appliesTo: ['all'],
    message: '不允许机器 B 或只读 Agent 直连平台采集、写库或修改采集逻辑。',
  },
  {
    id: 'STRICT-NO-ADHOC-SCRIPT',
    level: 'BLOCK',
    title: '禁止临时脚本长期绕过正式 skill',
    appliesTo: ['all'],
    message: '不允许临时脚本、手敲业务 SQL、机器自带 Codex 长期绕过正式 skill；缺能力时升级现有 skill。',
  },
  {
    id: 'STRICT-NO-HARDCODE-CRED',
    level: 'BLOCK',
    title: '禁止硬编码凭据',
    appliesTo: ['all'],
    message: '不允许把账号、密码、Cookie、Token、Authorization、数据库连接串写入前端、Prompt、日志或 repo。',
  },
  {
    id: 'STRICT-NO-WORKSPACE-CHANGE',
    level: 'BLOCK',
    title: '禁止改动 workspace 配置路径',
    appliesTo: ['all'],
    message: '不允许修改、覆盖或临时切换 Agent workspace 配置路径。',
  },
  {
    id: 'STRICT-NO-BLIND-INSERT',
    level: 'BLOCK',
    title: '禁止盲目写库/毁数据',
    appliesTo: ['write', 'backfill', 'migration'],
    message: '不允许盲目 INSERT、无唯一键写入、删除既有业务数据或未备份批量改写。',
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
    title: '确认 Agent / skill / live 入口',
    appliesTo: ['all'],
    message: '已确认对应平台 Agent、正式 skill 和 live 入口。',
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
    appliesTo: ['write', 'backfill', 'migration'],
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
    message: '执行后会核验行数、断档、重复、空字段、异常值和 collect/sync 状态。',
  },
  {
    id: 'CONFIRM-GIT-TRAIL',
    level: 'CONFIRM',
    title: 'Git 留痕',
    appliesTo: ['all'],
    message: '有代码改动时会提交当前正式 repo，并记录 commit/push/回滚点。',
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
    id: 'WARN-DEVOPS-LABEL',
    level: 'WARN',
    title: 'DevOps 命令需标注',
    appliesTo: ['all'],
    message: 'DevOps 命令必须明确标为「人工执行 / 非业务采集替代」。',
  },
  {
    id: 'WARN-INTERMEDIATE-CLEANUP',
    level: 'WARN',
    title: '中间产物仅限 workspace',
    appliesTo: ['all'],
    message: '中间 JSON/CSV/截图仅允许在对应 workspace，审计通过后清理。',
  },
  {
    id: 'WARN-NO-JSON-IN-PLAIN-FIELD',
    level: 'WARN',
    title: '普通字段不塞 JSON',
    appliesTo: ['write'],
    message: '普通数据库字段不得随意塞入 JSON/数组/对象。',
  },
  {
    id: 'WARN-PARAMETERIZE-RANGE',
    level: 'WARN',
    title: '日期/店铺/范围参数化',
    appliesTo: ['all'],
    message: '任务日期、店铺和商品范围必须参数化，禁止写死单次范围。',
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
