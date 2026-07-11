import { useState } from 'react'
import GeneratorTab from './components/GeneratorTab'
import AcceptanceTab from './components/AcceptanceTab'
import BackgroundTab from './components/BackgroundTab'
import ShopsTab from './components/ShopsTab'
import { EXAMPLE_SHOPS, type ShopEntry } from './config/shops.example'
import { STRICT_RULES_VERSION, STRICT_RULES_AS_OF } from './config/strictRules'
import { PLATFORM_LIST } from './config/platformContext'

type Tab = 'gen' | 'accept' | 'bg' | 'shops'

const TABS: { id: Tab; label: string }[] = [
  { id: 'gen', label: 'A · Prompt 生成器' },
  { id: 'accept', label: 'B · 结果验收器' },
  { id: 'bg', label: 'C · Background 与规则' },
  { id: 'shops', label: '店铺清单' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('gen')
  const [shops, setShops] = useState<ShopEntry[]>(EXAMPLE_SHOPS)

  const platVersions = PLATFORM_LIST.map((p) => `${p.label} v${p.version}`).join(' / ')

  return (
    <div className="app">
      <div className="topbar">
        <h1>三平台采集任务 Prompt 生成器</h1>
        <span className="badge">仅生成指令，不执行采集</span>
        <div className="versions">
          strict v{STRICT_RULES_VERSION} @ {STRICT_RULES_AS_OF}
          <br />
          平台口径：{platVersions}
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'gen' && <GeneratorTab shops={shops} />}
      {tab === 'accept' && <AcceptanceTab />}
      {tab === 'bg' && <BackgroundTab />}
      {tab === 'shops' && <ShopsTab shops={shops} setShops={setShops} />}
    </div>
  )
}
