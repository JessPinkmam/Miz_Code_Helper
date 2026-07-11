// ShopsTab.tsx — 内置可编辑示例店铺清单（假名，无凭据）
import { useState } from 'react'
import type { PlatformId } from '../config/platformContext'
import { PLATFORM_LIST } from '../config/platformContext'
import type { ShopEntry } from '../config/shops.example'
import { scanRecord } from '../lib/sensitiveScan'

export default function ShopsTab({ shops, setShops }: { shops: ShopEntry[]; setShops: (s: ShopEntry[]) => void }) {
  const [msg, setMsg] = useState('')

  const update = (key: string, patch: Partial<ShopEntry>) =>
    setShops(shops.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const add = () =>
    setShops([
      ...shops,
      {
        key: `shop-${shops.length + 1}-${Math.max(1, shops.length)}`,
        platform: 'taobao',
        name: '新店铺（假名）',
        platformShopId: 'PLACEHOLDER',
        brand: '',
        enabled: true,
        allowShopLevel: true,
        allowProductLevel: true,
      },
    ])

  const remove = (key: string) => setShops(shops.filter((s) => s.key !== key))

  const exportJson = () => {
    if (scanRecord(shops as unknown as Record<string, unknown>).length) return setMsg('⛔ 清单含疑似敏感信息，已阻止导出。请仅填假名/占位符。')
    const blob = new Blob([JSON.stringify(shops, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'shops.desensitized.json'
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('✅ 已导出脱敏店铺清单。')
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
        setMsg('✅ 已导入店铺清单。')
      } catch {
        setMsg('⛔ JSON 解析失败。')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="panel">
      <h2>店铺清单（示例 · 假名，请勿填真实凭据）</h2>
      <p className="small">仅用于生成 Prompt 时的店铺选择。平台侧标识请填占位符，真实映射由平台 metashop 统一管理。</p>
      <div className="btnrow">
        <button className="act primary" onClick={add}>新增店铺</button>
        <button className="act" onClick={exportJson}>导出JSON</button>
        <label className="act" style={{ cursor: 'pointer' }}>导入JSON<input type="file" accept="application/json" hidden onChange={importJson} /></label>
      </div>
      {msg && <div className="hint">{msg}</div>}

      <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--muted)', textAlign: 'left' }}>
            <th>平台</th><th>店名(假名)</th><th>平台标识(占位)</th><th>品牌</th><th>启用</th><th>店铺级</th><th>商品级</th><th></th>
          </tr>
        </thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td>
                <select value={s.platform} onChange={(e) => update(s.key, { platform: e.target.value as PlatformId })}>
                  {PLATFORM_LIST.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </td>
              <td><input value={s.name} onChange={(e) => update(s.key, { name: e.target.value })} /></td>
              <td><input value={s.platformShopId} onChange={(e) => update(s.key, { platformShopId: e.target.value })} /></td>
              <td><input value={s.brand} onChange={(e) => update(s.key, { brand: e.target.value })} /></td>
              <td><input type="checkbox" checked={s.enabled} onChange={(e) => update(s.key, { enabled: e.target.checked })} /></td>
              <td><input type="checkbox" checked={s.allowShopLevel} onChange={(e) => update(s.key, { allowShopLevel: e.target.checked })} /></td>
              <td><input type="checkbox" checked={s.allowProductLevel} onChange={(e) => update(s.key, { allowProductLevel: e.target.checked })} /></td>
              <td><button className="act" onClick={() => remove(s.key)}>删除</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
