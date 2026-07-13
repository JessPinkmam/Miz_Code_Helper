// types.ts — 共享领域类型

import type { PlatformId } from './config/platformContext'

export type TaskType =
  | 't1_verify' // 日常 T+1 核验
  | 'backfill' // 历史补数
  | 'gap_fix' // 单店/单日缺口修复
  | 'login_state' // 登录态检查或恢复
  | 'collect_debug' // 采集失败排障
  | 'integrity_audit' // 数据完整性审计
  | 'cron_accept' // Cron 自然运行验收
  | 'result_review' // Agent 返回结果复核

export type DataLevel = 'shop' | 'product'
export type Granularity = 'day' | 'week'
/** 执行模式 */
export type ExecMode = 'diagnose' | 'smoke' | 'formal'
export type Priority = 'P0' | 'P1' | 'P2'

/** 三态：未知 / 是 / 否 —— 风险校验区分「未确认」与「否」 */
export type Tri = 'unknown' | 'yes' | 'no'

export interface TaskInput {
  platform: PlatformId
  taskType: TaskType
  dataLevel: DataLevel
  shops: string[] // ShopEntry.name 列表
  startDay: string // YYYY-MM-DD
  endDay: string // YYYY-MM-DD
  granularity: Granularity
  execMode: ExecMode
  priority: Priority

  // 问题描述
  background: string
  symptom: string
  rawError: string
  expected: string

  // 证据
  lastSuccessDay: string
  targetTables: string
  dbRowStats: string
  statusStats: string
  logSummary: string

  // 风险
  loginState: Tri // 登录态是否已知有效
  underRiskControl: Tri // 是否处于风控/冷却
  hasBackup: Tri // 写库前是否已有备份
  hasConflictCron: Tri // 是否存在同范围 Cron/补数
  multishopIsolation: Tri // 多店是否独立 profile/端口

  // 留痕
  taskId: string
  owner: string
  escalateTo: string

  // 正式执行前的 CONFIRM 勾选（key = StrictRule.id）
  confirmedRuleIds: string[]
}

export const EMPTY_TASK_INPUT: TaskInput = {
  platform: 'taobao',
  taskType: 't1_verify',
  dataLevel: 'shop',
  shops: [],
  startDay: '',
  endDay: '',
  granularity: 'day',
  execMode: 'diagnose',
  priority: 'P1',
  background: '',
  symptom: '',
  rawError: '',
  expected: '',
  lastSuccessDay: '',
  targetTables: '',
  dbRowStats: '',
  statusStats: '',
  logSummary: '',
  loginState: 'unknown',
  underRiskControl: 'unknown',
  hasBackup: 'unknown',
  hasConflictCron: 'unknown',
  multishopIsolation: 'unknown',
  taskId: '',
  owner: '',
  escalateTo: '',
  confirmedRuleIds: [],
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  t1_verify: '日常 T+1 核验',
  backfill: '历史补数',
  gap_fix: '单店/单日缺口修复',
  login_state: '登录态检查或恢复',
  collect_debug: '采集失败排障',
  integrity_audit: '数据完整性审计',
  cron_accept: 'Cron 自然运行验收',
  result_review: 'Agent 返回结果复核',
}

export const EXEC_MODE_LABELS: Record<ExecMode, string> = {
  diagnose: '只诊断',
  smoke: '小批试跑（smoke）',
  formal: '正式执行',
}

export const DATA_LEVEL_LABELS: Record<DataLevel, string> = {
  shop: '店铺级',
  product: '商品级',
}
