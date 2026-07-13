// ShopsTab.tsx — 店铺清单：元数据可导出，凭据（账号/密码）只存本地保险箱。
import { useState } from 'react'
import type { PlatformId } from '../config/platformContext'
import { PLATFORM_LIST } from '../config/platformContext'
import type { ShopEntry } from '../config/shops.example'
import { scanRecord } from '../lib/sensitiveScan'
import {
  clearCred,
  hasCred,
  parseShopCsv,
  saveVault,
  setCred,
  type CredMap,
} from '../lib/shopVault'

interface Props {
  shops: ShopEntry[]
  setShops: (s: ShopEntry[]) => void
  creds: CredMap
  setCreds: (c: CredMap) => void
}

/** 由平台+名称生成稳定 key（导入去重用） */
const shopKeyOf = (platform: string, name: string) => `${platform}::${name}`

export default function ShopsTab({ shops, setShops, creds, setCreds }: Props) {
  const [msg, setMsg] = useState('')
  const [csv, setCsv] = useState('')
  const [showPw, setShowPw] = useState(false)

  const update = (key: string, patch: Partial<ShopEntry>) =>
    setShops(shops.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const add = () =>
    setShops([
      ...shops,
      {
        key: shopKeyOf('taobao', `新店铺-${shops.length + 1}`),
        platform: 'taobao',
        name: `新店铺-${shops.length + 1}`,
        platformShopId: 'PLACEHOLDER',
        brand: '',
        enabled: true,
        allowShopLevel: true,
        allowProductLevel: true,
      },
    ])

  const remove = (key: string) => {
    setShops(shops.filter((s) => s.key !== key))
    setCreds(clearCred(creds, key))
  }

  // ── 凭据编辑（只写本地保险箱，不进导出/不进 Prompt）──
  const editCred = (key: string, patch: Partial<{ account: string; password: string }>) => {
    const cur = creds[key] ?? { account: '', password: '' }
    setCreds(setCred(creds, key, { ...cur, ...patch }))
  }

  // ── CSV 批量导入：平台,名称,账号,密码 ──
  const importCsv = () => {
    const { rows, errors } = parseShopCsv(csv)
    if (rows.length === 0) {
      setMsg(errors.length ? `⛔ 未导入任何店铺：${errors.map((e) => `第${e.line}行 ${e.reason}`).join('；')}` : '⛔ 没有可导入的行。')
      return
    }
    const nextShops = [...shops]
    let nextCreds = { ...creds }
    let added = 0
    let credCount = 0
    for (const r of rows) {
      const key = shopKeyOf(r.platform, r.name)
      const existing = nextShops.find((s) => s.key === key)
      if (!existing) {
        nextShops.push({
          key,
          platform: r.platform,
          name: r.name,
          platformShopId: 'PLACEHOLDER',
          brand: '',
          enabled: true,
          allowShopLevel: true,
          allowProductLevel: true,
        })
        added++
      }
      if (r.account || r.password) {
        nextCreds = setCred(nextCreds, key, { account: r.account, password: r.password })
        credCount++
      }
    }
    setShops(nextShops)
    saveVault(nextCreds)
    setCreds(nextCreds)
    setCsv('')
    const errNote = errors.length ? `；跳过 ${errors.length} 行（${errors.map((e) => `第${e.line}行`).join('、')}）` : ''
    setMsg(`✅ 已导入 ${added} 个新店铺，写入 ${credCount} 份本地凭据（凭据只存本机，不进导出/不进 Prompt）${errNote}`)
  }

  // ── 导出：只含元数据，凭据被剔除，并做敏感信息扫描 ──
  const exportJson = () => {
    const meta = shops.map(({ key, platform, name, platformShopId, brand, enabled, allowShopLevel, allowProductLevel }) => ({
      key, platform, name, platformShopId, brand, enabled, allowShopLevel, allowProductLevel,
    }))
    if (scanRecord(meta as unknown as Record<string, unknown>).length) {
      return setMsg('⛔ 店铺元数据含疑似敏感信息，已阻止导出。请仅在名称/标识里用假名或占位符。')
    }
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'shops.meta.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('✅ 已导出店铺元数据（不含任何账号/密码）。')
  }

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as ShopEntry[]
        if (scanRecord(data as unknown as Record<string, unknown>).length) { setMsg('⛔ 导入文件含疑似敏感信息，已拒绝。'); return }
        setShops(data)
        setMsg('✅ 已导入店铺元数据。')
      } catch {
        setMsg('⛔ JSON 解析失败。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div>
      <div className="panel">
        <h2>批量导入店铺（CSV：平台,名称,账号,密码）</h2>
        <p className="small">
          每行一个店铺，用逗号分隔。平台支持 <code>淘宝/taobao</code>、<code>得物/dewu</code>、<code>唯品会/vip</code>；账号、密码可留空。
          <br />
          🔒 <b>账号和密码只保存在你本机浏览器（localStorage），不会上传、不进 Git、不进导出文件、也不会写进生成的 Prompt。</b>
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={5}
          placeholder={'taobao,示例旗舰店A,acct01,pass123\n得物,示例得物店A,acct02,pass456\nvip,示例唯品会店A,,'}
          style={{ width: '100%', fontFamily: 'monospace' }}
        />
        <div className="btnrow" style={{ marginTop: 8 }}>
          <button className="act primary" onClick={importCsv}>导入 CSV</button>
        </div>
      </div>

      <div className="panel">
        <h2>店铺清单</h2>
        <p className="small">名称/平台标识请勿写入密码等敏感串。凭据在下方单独一列管理，仅存本地。</p>
        <div className="btnrow">
          <button className="act" onClick={add}>新增店铺</button>
          <button className="act" onClick={exportJson}>导出元数据JSON</button>
          <label className="act" style={{ cursor: 'pointer' }}>导入元数据JSON<input type="file" accept="application/json" hidden onChange={importJson} /></label>
          <button className="act" onClick={() => setShowPw((v) => !v)}>{showPw ? '隐藏密码' : '显示密码'}</button>
        </div>
        {msg && <div className="hint">{msg}</div>}

        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
              <th>平台</th><th>店名</th><th>平台标识(占位)</th><th>启用</th><th>店铺级</th><th>商品级</th>
              <th>账号(本地)</th><th>密码(本地)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => {
              const c = creds[s.key] ?? { account: '', password: '' }
              return (
                <tr key={s.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td>
                    <select value={s.platform} onChange={(e) => update(s.key, { platform: e.target.value as PlatformId })}>
                      {PLATFORM_LIST.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </td>
                  <td><input value={s.name} onChange={(e) => update(s.key, { name: e.target.value })} /></td>
                  <td><input value={s.platformShopId} onChange={(e) => update(s.key, { platformShopId: e.target.value })} /></td>
                  <td><input type="checkbox" checked={s.enabled} onChange={(e) => update(s.key, { enabled: e.target.checked })} /></td>
                  <td><input type="checkbox" checked={s.allowShopLevel} onChange={(e) => update(s.key, { allowShopLevel: e.target.checked })} /></td>
                  <td><input type="checkbox" checked={s.allowProductLevel} onChange={(e) => update(s.key, { allowProductLevel: e.target.checked })} /></td>
                  <td><input value={c.account} placeholder="—" onChange={(e) => editCred(s.key, { account: e.target.value })} style={{ width: 90 }} /></td>
                  <td>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={c.password}
                      placeholder="—"
                      onChange={(e) => editCred(s.key, { password: e.target.value })}
                      style={{ width: 90 }}
                    />
                    {hasCred(creds, s.key) && <span title="本地已留存凭据" style={{ marginLeft: 4 }}>🔒</span>}
                  </td>
                  <td>
                    <button className="act" onClick={() => setCreds(clearCred(creds, s.key))} title="清除该店本地凭据">清凭据</button>
                    <button className="act" onClick={() => remove(s.key)}>删除</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
