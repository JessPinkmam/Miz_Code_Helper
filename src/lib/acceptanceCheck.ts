// acceptanceCheck.ts
// 结果验收器（spec 第七节）：粘贴 Agent 返回文本，规则检查是否真正完成。
// 输出：通过 / 部分通过 / 失败 / 待自然运行验证 + 早会汇报文本。

export type Verdict = '通过' | '部分通过' | '失败' | '待自然运行验证'

export interface AcceptanceIssue {
  code: string
  message: string
  fatal: boolean // fatal=true 直接判失败
}

export interface AcceptanceResult {
  verdict: Verdict
  issues: AcceptanceIssue[]
  /** 命中的正向信号 */
  positives: string[]
  /** 早会汇报文本 */
  briefing: string
}

const has = (t: string, re: RegExp) => re.test(t)

/** 是否出现「有数据库落数证据」（行数 / rows / count / upsert 数字） */
function hasDbEvidence(t: string): boolean {
  return (
    /(行数|rows?|记录数|count)\s*[:：]?\s*\d/i.test(t) ||
    /\bupsert\b[^\n]*\d/i.test(t) ||
    /\d+\s*(行|条)/.test(t)
  )
}

function hasScope(t: string): boolean {
  const shop = /(店铺|shop|店)/i.test(t)
  const date = /(\d{4}-\d{2}-\d{2}|日期|start_day|end_day)/i.test(t)
  const table = /(目标表|schema|表名|\.\w+_daily|orders?_detail|customer_daily)/i.test(t)
  return shop && date && table
}

function hasAudit(t: string): boolean {
  return /(审计|核验|勾稽|无断档|无重复|空值|异常值)/.test(t)
}

const FALSE_STABLE = /(delivered\s*=\s*true|进程在线|日志成功|人工补齐)/i
const CLAIM_DONE = /(全部完成|已完成|采集成功|执行成功|正常|已处理)/
const HAS_PENDING_FAILED = /(pending|failed|失败|待处理|未完成|跳过)/i
const RISK_HIT = /(风控|401|验证码|滑块|未知弹窗)/i
const CONTINUED_AFTER_RISK = /(继续放量|继续采集|继续全量|忽略.*(风控|验证码))/i

/**
 * 对 Agent 返回文本运行验收规则。
 */
export function checkAcceptance(text: string): AcceptanceResult {
  const issues: AcceptanceIssue[] = []
  const positives: string[] = []
  const t = (text || '').trim()

  if (!t) {
    return {
      verdict: '失败',
      issues: [{ code: 'EMPTY', message: '没有可验收的返回文本。', fatal: true }],
      positives: [],
      briefing: buildBriefing('失败', [], [{ code: 'EMPTY', message: '没有可验收的返回文本。', fatal: true }]),
    }
  }

  const dbEvidence = hasDbEvidence(t)
  const scope = hasScope(t)
  const audit = hasAudit(t)

  // ── 自动判为不通过（fatal）──
  if (has(t, CLAIM_DONE) && !dbEvidence) {
    issues.push({
      code: 'NO_DB_EVIDENCE',
      message: '只有「已处理/正常/执行成功」，缺少数据库落数证据（行数/记录数）。',
      fatal: true,
    })
  }
  if (FALSE_STABLE.test(t) && !dbEvidence) {
    issues.push({
      code: 'FALSE_SIGNAL',
      message: '以 delivered=true/进程在线/日志成功/人工补齐当作完成，缺少数据库落数。',
      fatal: true,
    })
  }
  if (!scope) {
    issues.push({
      code: 'NO_SCOPE',
      message: '缺少店铺、日期、目标表与实际行数的完整范围说明。',
      fatal: true,
    })
  }
  if (has(t, CLAIM_DONE) && has(t, HAS_PENDING_FAILED)) {
    issues.push({
      code: 'PENDING_BUT_DONE',
      message: '存在 pending/failed/跳过，却宣布全部完成。',
      fatal: true,
    })
  }
  if (/(cron|自然运行|稳定)/i.test(t) && /人工补齐/.test(t)) {
    issues.push({
      code: 'MANUAL_AS_STABLE',
      message: '人工补齐后宣布 Cron 已稳定。',
      fatal: true,
    })
  }
  if (RISK_HIT.test(t) && CONTINUED_AFTER_RISK.test(t)) {
    issues.push({
      code: 'CONTINUE_AFTER_RISK',
      message: '风控/401/验证码后仍继续放量，违反 fail-closed。',
      fatal: true,
    })
  }

  // ── 非致命扣分项（导致「部分通过」）──
  const writeMentioned = /(写库|upsert|入库|insert|补数)/i.test(t)
  if (writeMentioned && !/(备份|pg_dump|回滚|幂等|on conflict|唯一键)/i.test(t)) {
    issues.push({
      code: 'NO_BACKUP_IDEMPOTENT',
      message: '涉及写库但未说明备份或幂等（唯一键/ON CONFLICT）。',
      fatal: false,
    })
  }
  const batchMentioned = /(批量|全量|补数|历史)/.test(t)
  if (batchMentioned && !/(smoke|试跑|小批|1-2\s*天|单店|单日)/i.test(t)) {
    issues.push({
      code: 'NO_SMOKE',
      message: '批量任务未见 smoke / 小批试跑说明。',
      fatal: false,
    })
  }
  const codeChanged = /(修改|新增|改写).*(脚本|skill|代码|script)/.test(t)
  if (codeChanged) {
    issues.push({
      code: 'OUT_OF_SCOPE',
      message: '返回内容涉及脚本/skill/代码改动，超出助理范围，应停止并升级技术负责人。',
      fatal: true,
    })
  }
  if (/审计.*(失败|不通过|未通过)/.test(t) && /删除.*(证据|全部|日志)/.test(t)) {
    issues.push({
      code: 'DELETED_EVIDENCE',
      message: '审计失败却已删除全部证据。',
      fatal: true,
    })
  }

  // ── 正向信号 ──
  if (dbEvidence) positives.push('含数据库落数证据（行数/记录数）')
  if (scope) positives.push('含店铺+日期+目标表范围')
  if (audit) positives.push('含审计/核验说明')

  // ── 判定 ──
  const waitNatural = /(等待自然运行|待自然运行|尚未验收稳定|观察.*cron)/i.test(t)
  let verdict: Verdict
  const fatal = issues.some((i) => i.fatal)
  if (fatal) {
    verdict = '失败'
  } else if (waitNatural && dbEvidence && scope) {
    verdict = '待自然运行验证'
  } else if (issues.length > 0) {
    verdict = '部分通过'
  } else if (dbEvidence && scope && audit) {
    verdict = '通过'
  } else {
    verdict = '部分通过'
  }

  return { verdict, issues, positives, briefing: buildBriefing(verdict, positives, issues) }
}

function buildBriefing(verdict: Verdict, positives: string[], issues: AcceptanceIssue[]): string {
  const done = positives.length ? positives.map((p) => `  - ${p}`).join('\n') : '  - （无明确证据）'
  const undone = issues.length
    ? issues.map((i) => `  - [${i.fatal ? '致命' : '扣分'}] ${i.message}`).join('\n')
    : '  - （无）'
  return [
    '【早会汇报】',
    `验收：${verdict}`,
    '已完成：',
    done,
    '未完成 / 问题：',
    undone,
    '下一步：',
    verdict === '通过'
      ? '  - 进入自然运行观察或推进下一批。'
      : verdict === '待自然运行验证'
        ? '  - 保持观察 Cron 自然运行，勿以人工补齐当稳定。'
        : '  - 补齐缺失证据/备份/范围后重新提交验收。',
  ].join('\n')
}
