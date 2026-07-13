// promptBuilder.ts
// 按优先级 strict > platform_current > task_input > historical 组装 Prompt。
// BLOCK 命中：只允许生成「只诊断」Prompt + 合规替代建议，禁止正式执行 Prompt。

import { PLATFORM_CONTEXTS } from '../config/platformContext'
import { FIXED_BACKGROUND, FIXED_BACKGROUND_VERSION } from '../config/fixedBackground'
import {
  STRICT_RULES_VERSION,
  STRICT_RULES_AS_OF,
  rulesForScopes,
} from '../config/strictRules'
import type { TaskInput } from '../types'
import {
  DATA_LEVEL_LABELS,
  EXEC_MODE_LABELS,
  TASK_TYPE_LABELS,
} from '../types'
import { deriveScopes, runRiskCheck, type RiskResult } from './riskCheck'

export interface BuildOutput {
  prompt: string
  /** 实际生成的模式：可能因 BLOCK 从 formal 降级为 diagnose */
  effectiveMode: 'diagnose' | 'smoke' | 'formal'
  downgraded: boolean
  risk: RiskResult
}

function line(label: string, value: string): string {
  return `${label}：${value.trim() || '（未填写）'}`
}

function header(input: TaskInput): string {
  const plat = PLATFORM_CONTEXTS[input.platform]
  return [
    `# 三平台采集任务 Prompt（助理版 · 生成器 v${FIXED_BACKGROUND_VERSION} · strict v${STRICT_RULES_VERSION} @ ${STRICT_RULES_AS_OF}）`,
    `> 本 Prompt 由静态工具生成，供助理复制给对应平台的采集 Agent。工具本身不执行采集、不写库、不存凭据；助理只发任务和验结果，不安排代码或采集能力修改。`,
    '',
    `- 平台：${plat.label}（平台口径 v${plat.version} @ ${plat.asOf}）`,
    `- 任务类型：${TASK_TYPE_LABELS[input.taskType]}`,
    `- 数据层级：${DATA_LEVEL_LABELS[input.dataLevel]}`,
    `- 执行模式：${EXEC_MODE_LABELS[input.execMode]}`,
    `- 优先级：${input.priority}`,
  ].join('\n')
}

function strictSection(input: TaskInput): string {
  const scopes = deriveScopes(input)
  const rules = rulesForScopes(scopes)
  const fmt = (lvl: string) =>
    rules
      .filter((r) => r.level === lvl)
      .map((r) => `- [${r.id}] ${r.title}：${r.message}`)
      .join('\n') || '- （本范围无）'
  return [
    '## Strict Context（最高优先级，不可被平台口径或任务输入覆盖）',
    '### BLOCK（违反即禁止正式执行）',
    fmt('BLOCK'),
    '### CONFIRM（正式执行前必须确认）',
    fmt('CONFIRM'),
    '### WARN（必须带入的提醒）',
    fmt('WARN'),
  ].join('\n')
}

function platformSection(input: TaskInput): string {
  const plat = PLATFORM_CONTEXTS[input.platform]
  const notes = plat.currentNotes.map((n) => `- ${n}`).join('\n')
  return [`## 平台现行 Background（${plat.label} · 仅现行口径，历史不入）`, notes].join('\n')
}

function taskInputSection(input: TaskInput): string {
  return [
    '## 本次任务输入',
    line('店铺', input.shops.join('、')),
    line('日期范围', `${input.startDay} ~ ${input.endDay}（${input.granularity === 'day' ? '按天' : '按周'}）`),
    line('任务背景', input.background),
    line('当前现象', input.symptom),
    line('原始报错', input.rawError),
    line('期望结果', input.expected),
    '',
    '### 证据',
    line('最近成功日期', input.lastSuccessDay),
    line('目标表', input.targetTables),
    line('数据库行数', input.dbRowStats),
    line('状态统计', input.statusStats),
    line('日志摘要', input.logSummary),
    '',
    '### 风险与联系',
    line('登录态', triLabel(input.loginState, '有效', '无效/未登录')),
    line('风控/冷却', triLabel(input.underRiskControl, '处于风控', '正常')),
    line('是否已有备份', triLabel(input.hasBackup, '已备份', '未备份')),
    line('同范围任务/补数', triLabel(input.hasConflictCron, '存在', '无')),
    line('多店隔离', triLabel(input.multishopIsolation, '已隔离', '未隔离')),
    line('任务编号', input.taskId),
    line('负责人', input.owner),
    line('需升级给', input.escalateTo),
  ].join('\n')
}

function triLabel(v: TaskInput['loginState'], yes: string, no: string): string {
  return v === 'yes' ? yes : v === 'no' ? no : '未知'
}

/** 助理版固定回填结构 —— 要求 Agent 按此回填，不含 Git/代码提交/skill 升级内容 */
function outputContract(mode: 'diagnose' | 'smoke' | 'formal'): string {
  const execHint =
    mode === 'diagnose'
      ? '本次为「只诊断」：只查证与只读核验，不采集、不写库。'
      : mode === 'smoke'
        ? '本次为「小范围试跑」：仅单店/单日或 1–2 天验证落数是否正常，通过后再申请扩大范围。'
        : '本次为「正式执行」：先备份 → 小范围试跑 → 正式采集 → 数据核验 → 更新任务状态。'
  return [
    '## 要求 Agent 按以下固定结构回填',
    execHint,
    '',
    '### 1. 任务结论',
    '- 当前是否可以执行',
    '- 归属哪个平台采集 Agent',
    '- 如果不能执行，说明阻塞原因',
    '### 2. 执行范围',
    '- 平台 / 店铺 / 日期范围 / 数据层级 / 目标数据',
    '### 3. 前置检查',
    '- 登录态',
    '- 风控/验证码',
    '- 是否存在同范围任务',
    '- 是否需要先做小范围试跑',
    '### 4. 实际执行结果',
    '- 成功店铺 / 失败店铺 / 跳过店铺',
    '- 实际采集日期 / 数据行数',
    '- 缺失、重复、空值和异常情况',
    '### 5. 验收结论',
    '只允许：通过 / 部分通过 / 失败 / 等待自然运行验证。',
    '### 6. 阻塞与升级事项',
    '- 需要人工登录或验证码',
    '- 需要等待风控冷却',
    '- 现有采集能力不支持',
    '- 需要技术负责人处理的事项',
    '- 相关错误和证据',
    '### 7. 下一步',
    '- 是否需要重试 / 补数 / 继续观察',
    '- 需要谁处理',
  ].join('\n')
}

/** 当任务需要修改代码/采集能力时，助理版只输出「停止并升级」模板，不安排开发 */
const OUT_OF_SCOPE_TEMPLATE = [
  '## 🛑 超出助理操作范围',
  '当前任务超出助理操作范围，禁止继续执行。请输出：',
  '1. 缺失的采集能力；',
  '2. 受影响的平台、店铺、日期和数据层级；',
  '3. 当前错误与已有证据；',
  '4. 临时停止或规避建议；',
  '5. 需要升级给技术负责人的事项。',
  '不得临时创建脚本、修改正式采集能力、调整系统配置或继续批量采集。',
].join('\n')

function blockNotice(risk: RiskResult): string {
  const blocks = risk.findings.filter((f) => f.severity === 'block')
  const lines = blocks.map((b) => `- [${b.ruleId ?? b.code}] ${b.message}`).join('\n')
  return [
    '## ⛔ 命中 BLOCK：已自动降级为「只诊断」Prompt',
    '以下 strict / 风险项被触发，禁止生成正式执行指令：',
    lines,
    '',
    '### 助理处理路径',
    '1. 先让对应平台采集 Agent 做只读核验，输出所需证据，不采集、不写库。',
    '2. 补齐备份 / 登录态 / 同范围任务确认，并移除敏感信息后，再重新评估是否可执行。',
    '3. 若现有采集能力不支持本次任务，助理停止执行并升级给技术负责人，不安排开发、不临时创建脚本绕过。',
    '',
    OUT_OF_SCOPE_TEMPLATE,
  ].join('\n')
}

function pendingConfirmNotice(risk: RiskResult): string {
  if (risk.pendingConfirmIds.length === 0) return ''
  const rules = risk.applicableRules.filter((r) => risk.pendingConfirmIds.includes(r.id))
  const lines = rules.map((r) => `- [${r.id}] ${r.title}：${r.message}`).join('\n')
  return ['## ⚠️ 正式执行尚缺以下确认（已降级为 smoke/diagnose）', lines].join('\n')
}

/**
 * 组装最终 Prompt。若命中 BLOCK，则强制降级为 diagnose，
 * 若为 formal 但仍有未确认 CONFIRM，则降级为 smoke。
 */
export function buildPrompt(input: TaskInput): BuildOutput {
  const risk = runRiskCheck(input)

  let effectiveMode = input.execMode
  let downgraded = false
  if (risk.hasBlock) {
    effectiveMode = 'diagnose'
    downgraded = input.execMode !== 'diagnose'
  } else if (input.execMode === 'formal' && risk.pendingConfirmIds.length > 0) {
    effectiveMode = 'smoke'
    downgraded = true
  }

  const parts = [
    header(input),
    '',
    strictSection(input),
    '',
    '## 固定 Background（所有平台共用）',
    FIXED_BACKGROUND,
    '',
    platformSection(input),
    '',
    taskInputSection(input),
    '',
    outputContract(effectiveMode),
  ]

  if (risk.hasBlock) parts.push('', blockNotice(risk))
  const pending = pendingConfirmNotice(risk)
  if (!risk.hasBlock && pending) parts.push('', pending)

  return {
    prompt: parts.join('\n'),
    effectiveMode,
    downgraded,
    risk,
  }
}
