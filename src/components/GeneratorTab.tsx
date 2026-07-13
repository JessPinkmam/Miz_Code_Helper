// GeneratorTab.tsx — 模块 A：Prompt 生成器
import { useMemo, useState } from 'react'
import type { PlatformId } from '../config/platformContext'
import { PLATFORM_LIST } from '../config/platformContext'
import { EXAMPLE_SHOPS, type ShopEntry } from '../config/shops.example'
import {
  DATA_LEVEL_LABELS,
  EMPTY_TASK_INPUT,
  EXEC_MODE_LABELS,
  TASK_TYPE_LABELS,
  type DataLevel,
  type ExecMode,
  type Granularity,
  type TaskInput,
  type TaskType,
  type Tri,
} from '../types'
import { buildPrompt } from '../lib/promptBuilder'
import { clearDraft, loadDraft, saveDraft } from './useDraft'

const TRI_OPTS: { v: Tri; label: string }[] = [
  { v: 'unknown', label: '未知' },
  { v: 'yes', label: '是' },
  { v: 'no', label: '否' },
]

function TriField({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value as Tri)}>
        {TRI_OPTS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function GeneratorTab({ shops }: { shops: ShopEntry[] }) {
  const [input, setInput] = useState<TaskInput>(() => loadDraft<TaskInput>() ?? EMPTY_TASK_INPUT)
  const [msg, setMsg] = useState<string>('')

  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setInput((s) => ({ ...s, [k]: v }))

  const platformShops = useMemo(
    () => (shops.length ? shops : EXAMPLE_SHOPS).filter((s) => s.platform === input.platform && s.enabled),
    [shops, input.platform],
  )

  const out = useMemo(() => buildPrompt(input), [input])
  const { risk } = out

  const confirmRules = risk.applicableRules.filter((r) => r.level === 'CONFIRM')

  const toggleShop = (name: string) =>
    set('shops', input.shops.includes(name) ? input.shops.filter((s) => s !== name) : [...input.shops, name])

  const toggleConfirm = (id: string) =>
    set(
      'confirmedRuleIds',
      input.confirmedRuleIds.includes(id)
        ? input.confirmedRuleIds.filter((x) => x !== id)
        : [...input.confirmedRuleIds, id],
    )

  const copyPrompt = async () => {
    if (risk.hasSensitive) return setMsg('⛔ 检测到敏感信息，已阻止复制。请先移除。')
    await navigator.clipboard.writeText(out.prompt)
    setMsg('✅ 已复制 Prompt。')
  }

  const downloadTxt = () => {
    if (risk.hasSensitive) return setMsg('⛔ 检测到敏感信息，已阻止下载。')
    const blob = new Blob([out.prompt], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `prompt-${input.platform}-${input.startDay || 'draft'}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('✅ 已下载 TXT。')
  }

  const doSave = () => setMsg(saveDraft(input as unknown as Record<string, unknown>) ? '✅ 草稿已存本地。' : '⛔ 含敏感信息，未保存。')
  const doClearDraft = () => {
    clearDraft()
    setMsg('🗑️ 已清除本地草稿。')
  }
  const doReset = () => {
    setInput(EMPTY_TASK_INPUT)
    setMsg('已清空表单。')
  }

  const exportJson = () => {
    if (risk.hasSensitive) return setMsg('⛔ 含敏感信息，已阻止导出。')
    const blob = new Blob([JSON.stringify(input, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'task-input.desensitized.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('✅ 已导出脱敏 JSON。')
  }

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as TaskInput
        setInput({ ...EMPTY_TASK_INPUT, ...data })
        setMsg('✅ 已导入配置。')
      } catch {
        setMsg('⛔ JSON 解析失败。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="layout">
      {/* 左：表单 */}
      <div>
        <div className="panel">
          <h2>① 基础</h2>
          <div className="grid2">
            <div className="field">
              <label>平台</label>
              <select value={input.platform} onChange={(e) => { set('platform', e.target.value as PlatformId); set('shops', []) }}>
                {PLATFORM_LIST.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>任务类型</label>
              <select value={input.taskType} onChange={(e) => set('taskType', e.target.value as TaskType)}>
                {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((k) => (
                  <option key={k} value={k}>{TASK_TYPE_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>数据层级</label>
              <select value={input.dataLevel} onChange={(e) => set('dataLevel', e.target.value as DataLevel)}>
                {(Object.keys(DATA_LEVEL_LABELS) as DataLevel[]).map((k) => (
                  <option key={k} value={k}>{DATA_LEVEL_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>执行模式</label>
              <select value={input.execMode} onChange={(e) => set('execMode', e.target.value as ExecMode)}>
                {(Object.keys(EXEC_MODE_LABELS) as ExecMode[]).map((k) => (
                  <option key={k} value={k}>{EXEC_MODE_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          <h3>店铺（多选）</h3>
          <div className="chips">
            {platformShops.length === 0 && <span className="small">该平台无可选店铺，请在「店铺清单」页添加。</span>}
            {platformShops.map((s) => {
              const disabled = input.dataLevel === 'product' && !s.allowProductLevel
              const on = input.shops.includes(s.name)
              return (
                <span
                  key={s.key}
                  className={`chip ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
                  title={disabled ? '该店未通过商品级覆盖验收' : s.brand}
                  onClick={() => !disabled && toggleShop(s.name)}
                >
                  {s.name}
                </span>
              )
            })}
          </div>

          <div className="grid3" style={{ marginTop: 12 }}>
            <div className="field">
              <label>开始日期</label>
              <input type="date" value={input.startDay} onChange={(e) => set('startDay', e.target.value)} />
            </div>
            <div className="field">
              <label>结束日期</label>
              <input type="date" value={input.endDay} onChange={(e) => set('endDay', e.target.value)} />
            </div>
            <div className="field">
              <label>粒度</label>
              <select value={input.granularity} onChange={(e) => set('granularity', e.target.value as Granularity)}>
                <option value="day">按天</option>
                <option value="week">按周</option>
              </select>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>② 问题与证据</h2>
          <div className="field"><label>任务背景</label><textarea value={input.background} onChange={(e) => set('background', e.target.value)} /></div>
          <div className="field"><label>当前现象</label><textarea value={input.symptom} onChange={(e) => set('symptom', e.target.value)} /></div>
          <div className="field"><label>原始报错（勿粘贴含凭据的日志）</label><textarea value={input.rawError} onChange={(e) => set('rawError', e.target.value)} /></div>
          <div className="field"><label>期望结果</label><textarea value={input.expected} onChange={(e) => set('expected', e.target.value)} /></div>
          <div className="grid2">
            <div className="field"><label>最近成功日期</label><input value={input.lastSuccessDay} onChange={(e) => set('lastSuccessDay', e.target.value)} /></div>
            <div className="field"><label>目标表</label><input value={input.targetTables} onChange={(e) => set('targetTables', e.target.value)} /></div>
            <div className="field"><label>数据库行数</label><input value={input.dbRowStats} onChange={(e) => set('dbRowStats', e.target.value)} /></div>
            <div className="field"><label>状态统计</label><input value={input.statusStats} onChange={(e) => set('statusStats', e.target.value)} /></div>
          </div>
          <div className="field"><label>日志摘要</label><textarea value={input.logSummary} onChange={(e) => set('logSummary', e.target.value)} /></div>
        </div>

        <div className="panel">
          <h2>③ 风险与联系</h2>
          <div className="grid2">
            <TriField label="登录态是否已知有效" value={input.loginState} onChange={(v) => set('loginState', v)} />
            <TriField label="是否处于风控/冷却" value={input.underRiskControl} onChange={(v) => set('underRiskControl', v)} />
            <TriField label="写库前是否已备份" value={input.hasBackup} onChange={(v) => set('hasBackup', v)} />
            <TriField label="是否有同范围任务/补数" value={input.hasConflictCron} onChange={(v) => set('hasConflictCron', v)} />
            <TriField label="多店是否独立 profile/端口" value={input.multishopIsolation} onChange={(v) => set('multishopIsolation', v)} />
          </div>
          <div className="grid2">
            <div className="field"><label>任务编号</label><input value={input.taskId} onChange={(e) => set('taskId', e.target.value)} /></div>
            <div className="field"><label>负责人</label><input value={input.owner} onChange={(e) => set('owner', e.target.value)} /></div>
            <div className="field"><label>需升级给</label><input value={input.escalateTo} onChange={(e) => set('escalateTo', e.target.value)} /></div>
          </div>
        </div>

        {input.execMode === 'formal' && confirmRules.length > 0 && (
          <div className="panel">
            <h2>④ 正式执行确认项（全部勾选才允许生成正式 Prompt）</h2>
            {confirmRules.map((r) => (
              <label className="confirm-item" key={r.id}>
                <input type="checkbox" checked={input.confirmedRuleIds.includes(r.id)} onChange={() => toggleConfirm(r.id)} />
                <span><span className="pill CONFIRM">{r.id}</span>{r.message}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 右：风险 + 预览 */}
      <div>
        <div className="panel">
          <h2>风险校验</h2>
          {risk.findings.length === 0 && <div className="callout ok">未发现拦截项。</div>}
          {risk.findings.map((f, i) => (
            <div key={i} className={`callout ${f.severity === 'block' ? 'block' : f.severity === 'confirm' ? 'confirm' : 'warn'}`}>
              <span className="code">[{f.ruleId ?? f.code}]</span> {f.message}
            </div>
          ))}
          {out.downgraded && (
            <div className="callout warn">已从「{EXEC_MODE_LABELS[input.execMode]}」降级为「{EXEC_MODE_LABELS[out.effectiveMode]}」。</div>
          )}
          {risk.hasSensitive && (
            <div className="callout block">检测到敏感信息类别：{risk.sensitiveCategories.join('、')}（原文不记录）。复制/下载/导出已阻止。</div>
          )}
        </div>

        <div className="panel">
          <h2>Prompt 预览（实时 · 模式：{EXEC_MODE_LABELS[out.effectiveMode]}）</h2>
          <div className="btnrow">
            <button className="act primary" onClick={copyPrompt} disabled={risk.hasSensitive}>复制</button>
            <button className="act" onClick={downloadTxt} disabled={risk.hasSensitive}>下载 TXT</button>
            <button className="act" onClick={doSave}>保存草稿</button>
            <button className="act" onClick={doClearDraft}>清除草稿</button>
            <button className="act" onClick={doReset}>清空表单</button>
            <button className="act" onClick={exportJson} disabled={risk.hasSensitive}>导出JSON</button>
            <label className="act" style={{ cursor: 'pointer' }}>
              导入JSON<input type="file" accept="application/json" hidden onChange={importJson} />
            </label>
          </div>
          {msg && <div className="hint">{msg}</div>}
          <div className="preview" style={{ marginTop: 12 }}>{out.prompt}</div>
        </div>
      </div>
    </div>
  )
}
