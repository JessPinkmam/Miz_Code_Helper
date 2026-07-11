// BackgroundTab.tsx — 模块 C：Background 与规则
import { FIXED_BACKGROUND, FIXED_BACKGROUND_AS_OF, FIXED_BACKGROUND_VERSION } from '../config/fixedBackground'
import { PLATFORM_LIST } from '../config/platformContext'
import { STRICT_RULES, STRICT_RULES_AS_OF, STRICT_RULES_VERSION } from '../config/strictRules'

export default function BackgroundTab() {
  return (
    <div>
      <div className="panel">
        <h2>固定 Background（所有平台共用）· v{FIXED_BACKGROUND_VERSION} @ {FIXED_BACKGROUND_AS_OF}</h2>
        <div className="preview">{FIXED_BACKGROUND}</div>
      </div>

      <div className="panel">
        <h2>Strict 规则 · v{STRICT_RULES_VERSION} @ {STRICT_RULES_AS_OF}</h2>
        <p className="small">优先级固定：strict &gt; platform_current &gt; task_input &gt; historical。低优先级不得覆盖 strict。</p>
        <ul className="rule-list">
          {STRICT_RULES.map((r) => (
            <li key={r.id}>
              <span className={`pill ${r.level}`}>{r.level}</span>
              <span className="mono small">{r.id}</span> · <strong>{r.title}</strong>
              <div className="small">{r.message}</div>
              <div className="small">适用：{r.appliesTo.join(', ')}</div>
            </li>
          ))}
        </ul>
      </div>

      {PLATFORM_LIST.map((p) => (
        <div className="panel" key={p.id}>
          <h2>{p.label} 现行口径 · v{p.version} @ {p.asOf}</h2>
          <ul className="rule-list">
            {p.currentNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
