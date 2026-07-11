// AcceptanceTab.tsx — 模块 B：Agent 结果验收器
import { useMemo, useState } from 'react'
import { checkAcceptance } from '../lib/acceptanceCheck'
import { scanSensitive } from '../lib/sensitiveScan'

export default function AcceptanceTab() {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')

  const sensitive = useMemo(() => scanSensitive(text), [text])
  const result = useMemo(() => checkAcceptance(text), [text])

  const copyBriefing = async () => {
    if (sensitive.length) return setMsg('⛔ 粘贴内容含敏感信息，已阻止复制早会文本。')
    await navigator.clipboard.writeText(result.briefing)
    setMsg('✅ 已复制早会汇报文本。')
  }

  return (
    <div className="layout">
      <div className="panel">
        <h2>粘贴 Agent 返回文本</h2>
        <div className="field">
          <textarea
            style={{ minHeight: 420 }}
            placeholder="把对应平台 OpenClaw Agent 的返回结果粘贴在此……（勿粘贴含凭据的原始日志）"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {sensitive.length > 0 && (
          <div className="callout block">
            检测到敏感信息类别：{sensitive.map((h) => h.category).join('、')}（原文不记录）。请脱敏后再验收。
          </div>
        )}
        <div className="btnrow">
          <button className="act" onClick={() => { setText(''); setMsg('已清空。') }}>清空</button>
        </div>
      </div>

      <div className="panel">
        <h2>验收结论</h2>
        <div className={`verdict ${result.verdict}`}>{result.verdict}</div>

        {result.positives.length > 0 && (
          <>
            <h3>正向信号</h3>
            <div className="callout ok">{result.positives.join(' · ')}</div>
          </>
        )}

        {result.issues.length > 0 && (
          <>
            <h3>问题项</h3>
            {result.issues.map((it, i) => (
              <div key={i} className={`callout ${it.fatal ? 'block' : 'warn'}`}>
                <span className="code">[{it.fatal ? '致命' : '扣分'} · {it.code}]</span> {it.message}
              </div>
            ))}
          </>
        )}

        <h3>早会汇报文本</h3>
        <div className="preview">{result.briefing}</div>
        <div className="btnrow">
          <button className="act primary" onClick={copyBriefing} disabled={sensitive.length > 0}>复制早会文本</button>
        </div>
        {msg && <div className="hint">{msg}</div>}
      </div>
    </div>
  )
}
