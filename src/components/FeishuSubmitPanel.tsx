// FeishuSubmitPanel.tsx
// 生成 Prompt 后，点「提交到飞书任务表」把 Prompt + 任务元数据写入飞书多维表格。
//
// 安全边界：
//   - 需先用口令解锁；解密结果只放 useRef 内存，刷新即失效，绝不落盘。
//   - 提交前再跑一次敏感扫描；命中即拒绝提交。
//   - 不打印 config / webhook / token；错误只显示状态码或统一提示。
import { useRef, useState } from 'react'
import {
  decryptFeishuConfig,
  isFeishuConfigured,
  type FeishuSecretConfig,
} from '../lib/feishuSecretVault'
import { buildFeishuPayload, submitTaskToFeishu } from '../lib/feishuSubmit'
import type { BuildOutput } from '../lib/promptBuilder'
import type { TaskInput } from '../types'

export default function FeishuSubmitPanel({ input, out }: { input: TaskInput; out: BuildOutput }) {
  const secretConfigRef = useRef<FeishuSecretConfig | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const configured = isFeishuConfigured()

  const handleUnlock = async () => {
    setUnlocking(true)
    setMsg('')
    try {
      const config = await decryptFeishuConfig(passphrase)
      secretConfigRef.current = config // 只放内存
      setUnlocked(true)
      setPassphrase('')
      setMsg('✅ 飞书提交已解锁（口令仅存本次会话内存，刷新即失效）。')
    } catch (error) {
      secretConfigRef.current = null
      setUnlocked(false)
      setMsg(error instanceof Error ? `⛔ ${error.message}` : '⛔ 解锁失败')
    } finally {
      setUnlocking(false)
    }
  }

  const handleLock = () => {
    secretConfigRef.current = null
    setUnlocked(false)
    setPassphrase('')
    setMsg('🔒 已锁定。')
  }

  const handleSubmit = async () => {
    const config = secretConfigRef.current
    if (!config) {
      setMsg('⛔ 请先输入口令解锁。')
      return
    }
    // 提交前二次敏感扫描：命中即拒绝
    if (out.risk.hasSensitive) {
      setMsg(`⛔ 检测到敏感信息类别：${out.risk.sensitiveCategories.join('、')}，已阻止提交。`)
      return
    }
    if (out.risk.findings.some((f) => f.severity === 'block')) {
      setMsg('⛔ 存在 BLOCK 拦截项，请先处理后再提交。')
      return
    }
    setSubmitting(true)
    setMsg('')
    try {
      const payload = buildFeishuPayload(input, out, new Date().toISOString())
      await submitTaskToFeishu(config, payload)
      setMsg('✅ 已提交到飞书任务表。')
    } catch (error) {
      setMsg(error instanceof Error ? `⛔ 提交失败：${error.message}` : '⛔ 提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="panel">
      <h2>提交到飞书任务表</h2>
      {!configured ? (
        <div className="callout warn">
          尚未注入飞书配置。请在本机运行 <code>npm run encrypt:feishu</code> 输入 Webhook/Token/口令后再部署；
          源码只保存密文，不含明文。
        </div>
      ) : !unlocked ? (
        <div className="btnrow">
          <input
            type="password"
            value={passphrase}
            autoComplete="current-password"
            placeholder="输入飞书提交口令"
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleUnlock()
            }}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="act primary" disabled={unlocking || !passphrase} onClick={() => void handleUnlock()}>
            {unlocking ? '正在验证…' : '解锁飞书提交'}
          </button>
        </div>
      ) : (
        <div className="btnrow">
          <button
            className="act primary"
            disabled={submitting || out.risk.hasSensitive}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '正在提交…' : '提交到飞书任务表'}
          </button>
          <button className="act" disabled={submitting} onClick={handleLock}>
            锁定
          </button>
        </div>
      )}
      {msg && <div className="hint">{msg}</div>}
    </div>
  )
}
