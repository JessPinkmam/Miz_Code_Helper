# 三平台采集任务 Prompt 生成器

一个 **纯前端静态单页应用**，帮助电商数据采集团队助理：

1. **生成** 给对应平台 OpenClaw Agent 的规范化任务 Prompt（淘宝 / 得物 / 唯品会）；
2. **验收** Agent 返回结果是否真正完成（通过 / 部分通过 / 失败 / 待自然运行验证）。

> ⚠️ **本工具仅生成与检查文本。** 不连接 SSH / VNC / Postgres / Cron / OpenClaw Gateway / Git，不执行采集或写库，**不保存账号、密码、Cookie、Token、数据库连接串**。Claude Code 只开发此前端，不替代平台 Agent 做业务采集。

---

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 本地开发（http://localhost:5173）
npm test         # 运行单元测试（19 个）
npm run build    # 类型检查 + 生产构建到 dist/
npm run preview  # 预览生产构建
npm run scan     # 提交前敏感信息扫描（命中即非零退出）
```

要求 Node ≥ 18（建议 20）。

---

## 页面模块

| Tab | 说明 |
| --- | --- |
| **A · Prompt 生成器** | 选平台/任务类型/数据层级/店铺/日期/粒度/执行模式 → 填现象/报错/证据/风险 → 实时预览 Prompt。切换平台只加载对应平台 Background。 |
| **B · 结果验收器** | 粘贴 Agent 返回文本 → 规则检查执行范围、数据库落数、审计、阻塞、Git → 输出验收结论 + 早会汇报文本。 |
| **C · Background 与规则** | 展示固定 Background、strict 规则（含版本/更新时间）、各平台现行口径。 |
| **店铺清单** | 内置**假名**示例店铺，可增删改、导入/导出脱敏 JSON。**请勿填真实凭据。** |

---

## 架构

```
src/
├─ config/
│  ├─ strictRules.ts       # 唯一 strict 规则源（带版本号，BLOCK/CONFIRM/WARN + 唯一 ID + 适用范围 + 提示）
│  ├─ platformContext.ts   # 三平台现行 Background（带 version/asOf，历史口径不入）
│  ├─ fixedBackground.ts   # 所有平台共用固定 Background
│  └─ shops.example.ts     # 可编辑示例店铺清单（假名，无凭据）
├─ lib/
│  ├─ sensitiveScan.ts     # 敏感信息检测（只回类别，绝不回传原文）
│  ├─ promptBuilder.ts     # 优先级组装：strict > platform_current > task_input > historical
│  ├─ riskCheck.ts         # 自动风险校验 + 正式执行可否判定
│  └─ acceptanceCheck.ts   # 结果验收规则
├─ components/             # A/B/C + 店铺清单 UI
├─ __tests__/              # Vitest：生成/风险/验收/敏感信息
└─ types.ts                # 领域类型
```

### 优先级引擎（不可覆盖）

```
strict_rules > platform_context.current > task_input > historical_notes
```

- 低优先级内容 **不得** 覆盖 strict。
- 命中任何 **BLOCK** → 禁止生成/复制/下载「正式执行」Prompt，自动降级为「只诊断」并附合规替代建议。
- 「正式执行」模式必须勾选全部 **CONFIRM** 项，否则降级为 smoke。

### Strict 规则分级

| 级别 | 行为 |
| --- | --- |
| `BLOCK` | 违反即禁止生成正式执行 Prompt（红色拦截，不可绕过） |
| `CONFIRM` | 正式执行前必须逐项确认 |
| `WARN` | 允许生成，但提醒进入输出 |

规则集中在 `src/config/strictRules.ts`，带 `STRICT_RULES_VERSION` / `STRICT_RULES_AS_OF`，页面顶部展示版本与更新时间，便于追溯。**不得** 把规则散落硬编码在组件里。

---

## 敏感信息规则

`src/lib/sensitiveScan.ts` 检测：`password`、`PGPASSWORD`、`postgres(ql)://` 及其它数据库连接串、`cookie`、`authorization` / `Bearer`、`token` / `api_key` / `secret`、GitHub PAT（`ghp_…`）、JWT、PEM 私钥、连续长密钥等。

- 命中即 **阻止保存 / 导出 / 复制 / 下载**。
- 只显示 **命中类别**，**绝不** 把疑似密钥原文写入返回值、界面或日志。
- `npm run scan` 在提交前扫 `src/`（跳过 `__tests__` 中刻意的假密钥）；命中即非零退出。

---

## GitHub Pages 部署

本仓库为 `Miz_Code_Helper`，`vite.config.ts` 中构建 `base` 已设为 `/Miz_Code_Helper/`。

**自动部署**：`.github/workflows/deploy.yml` 在 push 到 `main` 时执行 `scan → test → build → 发布 dist`。首次需在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

**手动部署**：`npm run build` 后把 `dist/` 发布到 Pages 分支即可。

> 若仓库名或部署路径改变，请同步更新 `vite.config.ts` 的 `base`。

---

## 配置更新

- **strict 规则**：改 `src/config/strictRules.ts`，同时更新 `STRICT_RULES_VERSION` / `STRICT_RULES_AS_OF`。
- **平台口径**：改 `src/config/platformContext.ts` 对应平台的 `currentNotes` 与 `version` / `asOf`；历史口径不要写入（避免污染生成 Prompt）。
- **店铺清单**：改 `src/config/shops.example.ts` 或在页面里导入脱敏 JSON。**只填假名 / 占位符**。

---

## 安全与边界

- 页面顶部常驻「仅生成指令，不执行采集」标识。
- 不使用 `git add .`；提交前先 `npm run scan`，分批列出改动文件再提交。
- 示例配置不含任何真实凭据。
- 提交本仓库前请确认**没有**把任何 token / cookie / 连接串写进源码或文档。

---

## 版本

- **v0.1 · 2026-07-11**：Prompt 生成器 + 结果验收器 + Background/规则展示 + 敏感信息检测 + 优先级引擎。
