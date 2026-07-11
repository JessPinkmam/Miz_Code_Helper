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
    `# 三平台采集任务 Prompt（生成器 v${FIXED_BACKGROUND_VERSION} · strict v${STRICT_RULES_VERSION} @ ${STRICT_RULES_AS_OF}）`,
    `> 本 Prompt 由静态工具生成，仅供复制给对应平台 OpenClaw Agent。工具本身不执行采集、不写库、不存凭据。`,
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
    '### 风险与留痕',
    line('登录态', triLabel(input.loginState, '有效', '无效/未登录')),
    line('风控/冷却', triLabel(input.underRiskControl, '处于风控', '正常')),
    line('是否已有备份', triLabel(input.hasBackup, '已备份', '未备份')),
    line('同范围 Cron/补数', triLabel(input.hasConflictCron, '存在', '无')),
    line('多店隔离', triLabel(input.multishopIsolation, '已隔离', '未隔离')),
    line('Git 状态', input.gitStatus),
    line('任务编号', input.taskId),
    line('负责人', input.owner),
    line('需升级给', input.escalateTo),
  ].join('\n')
}

function triLabel(v: TaskInput['loginState'], yes: string, no: string): string {
  return v === 'yes' ? yes : v === 'no' ? no : '未知'
}

/** 固定输出结构（spec 第五节）——要求 Agent 按此回填 */
function outputContract(mode: 'diagnose' | 'smoke' | 'formal'): string {
  const execHint =
    mode === 'diagnose'
      ? '本次为「只诊断」：只允许查证与只读核验，不得采集、不得写库。'
      : mode === 'smoke'
        ? '本次为「小批 smoke」：仅单店/单日或 1–2 天验证落库、字段对齐、幂等，通过后再申请扩大范围。'
        : '本次为「正式执行」：严格按执行闭环，先备份→smoke→正式→审计→清理→Git 留痕。'
  return [
    '## 要求 Agent 按以下固定结构回填',
    execHint,
    '',
    '### 1. 结论',
    '问题归属哪个平台 Agent / skill，当前是否允许执行。',
    '### 2. 已确认事实、判断和待验证项',
    '不得把猜测当事实。',
    '### 3. 执行计划',
    '前置检查 → 备份 → smoke → 正式执行 → 审计 → 清理 → Git。',
    '### 4. 实际执行结果',
    '店铺、日期、目标表、成功/失败/跳过、数据库行数、缺口、重复、空值、异常值。',
    '### 5. 验收结论',
    '只允许：通过 / 部分通过 / 失败 / 等待自然运行验证。',
    '### 6. 阻塞与人工事项',
    '验证码、VNC、管理员权限、业务口径、冷却期等。',
    '### 7. Git 与交接',
    '修改文件、commit、push、回滚点、下一步。',
  ].join('\n')
}

function blockNotice(risk: RiskResult): string {
  const blocks = risk.findings.filter((f) => f.severity === 'block')
  const lines = blocks.map((b) => `- [${b.ruleId ?? b.code}] ${b.message}`).join('\n')
  return [
    '## ⛔ 命中 BLOCK：已自动降级为「只诊断」Prompt',
    '以下 strict / 风险项被触发，禁止生成正式执行指令：',
    lines,
    '',
    '### 合规替代路径',
    '1. 先由对应平台 OpenClaw Agent 用正式 skill 做只读核验，输出所需证据。',
    '2. 移除敏感信息、补齐备份/登录态/Cron 确认后，再重新评估是否可正式执行。',
    '3. 若能力缺失，升级对应平台的管理/店铺级/商品级 skill，不要用临时脚本绕过。',
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
