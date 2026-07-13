# 三平台采集任务 Prompt 生成器（助理版）

一个 **纯前端静态单页应用**，帮助电商数据采集团队助理：

1. **生成** 给对应平台采集 Agent 的规范化任务 Prompt（淘宝 / 得物 / 唯品会）；
2. **验收** Agent 返回结果是否真正完成（通过 / 部分通过 / 失败 / 待自然运行验证）。

> ⚠️ **本工具仅生成与检查文本。** 不连接任何采集系统、数据库或 Cron，不执行采集或写库。
>
> 🧭 **助理版职责边界**：助理只负责**发任务**和**验结果**；日常采集由平台采集 Agent 执行；开发与采集能力升级由**技术负责人**负责。当任务需要改脚本 / 改采集能力 / 动系统配置时，助理**停止并升级技术负责人**，不安排开发、不临时造脚本。

---

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 本地开发（http://localhost:5173）
npm test         # 运行单元测试（25 个）
npm run build    # 类型检查 + 生产构建到 dist/
npm run preview  # 预览生产构建
npm run scan     # 提交前敏感信息扫描（命中即非零退出）
```

要求 Node ≥ 18（CI 用 22）。

---

## 页面模块

| Tab | 说明 |
| --- | --- |
| **A · Prompt 生成器** | 选平台/任务类型/数据层级/店铺/日期/粒度/执行模式 → 填现象/报错/证据/风险 → 实时预览 Prompt。切换平台只加载对应平台 Background。 |
| **B · 结果验收器** | 粘贴 Agent 返回文本 → 规则检查执行范围、数据库落数、审计、阻塞 → 输出验收结论 + 早会汇报文本。若返回涉及代码/skill 改动，直接判「超出助理范围，应停止并升级」。 |
| **C · Background 与规则** | 展示固定 Background、strict 规则（含版本/更新时间）、各平台现行口径。 |
| **店铺清单** | 管理平台/店名/标识等元数据，支持 **CSV 批量导入**（`平台,名称,账号,密码`）。账号密码存**本地保险箱**，详见下方「店铺凭据」。 |

---

## 店铺凭据（本地保险箱）

「店铺清单」页支持批量导入店铺，CSV 每行一个：

```
平台,名称,账号,密码
taobao,示例旗舰店A,acct01,pass123
得物,示例得物店A,acct02,pass456
vip,示例唯品会店A,,
```

- 平台支持中英文别名：`淘宝/taobao`、`得物/dewu`、`唯品会/vip`；账号、密码可留空。
- 🔒 **账号和密码只保存在你本机浏览器的 localStorage**（独立 key `miz-code-helper:shop-creds:v1`），**不上传、不进 Git、不打进部署包、不参与任何导出 JSON、也绝不写入生成的 Prompt**。
- 生成 Prompt 时，只会标注「本地已留存凭据的店铺：…（本 Prompt 不含明文）」，由采集 Agent 用其登录态执行、需要时人工登录。
- 「导出元数据JSON」只导出平台/名称/标识等**非凭据**字段，并在导出前跑敏感信息扫描。
- 每行可单独「清凭据」，删除店铺会一并清除其本地凭据。

> 因为这是公开的静态站点，凭据只留在本机可最大限度避免上网泄露；请勿在公共/共享电脑上保存真实凭据。

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
│  ├─ shopVault.ts         # 店铺凭据本地保险箱 + CSV 解析（只存 localStorage，不进导出/Prompt）
│  ├─ promptBuilder.ts     # 优先级组装：strict > platform_current > task_input > historical
│  ├─ riskCheck.ts         # 自动风险校验 + 正式执行可否判定
│  └─ acceptanceCheck.ts   # 结果验收规则
├─ components/             # A/B/C + 店铺清单 UI
├─ __tests__/              # Vitest：生成/风险/验收/敏感信息/凭据保险箱
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
- `npm run scan` 在提交前扫 `src/`（跳过 `__tests__` 中刻意的假密钥）；源码扫描只在密码/密钥被写成**带引号的硬编码字面量**时报错，`password: string` 这类类型/标识符引用不误报；命中即非零退出。
- ⚠️ **店铺凭据是有意的例外**：账号/密码由用户在「店铺清单」页录入并只存本机 localStorage，既不写进源码、也不进导出与 Prompt，因此不受上述源码扫描约束，但同样绝不外泄。

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
- **v2.0 · 2026-07-13**：改为**助理版**——移除全部开发/Git/Skill 升级内容，缺采集能力时停止并升级技术负责人；Prompt 采用助理版 7 段回填结构（任务结论 / 执行范围 / 前置检查 / 实际执行结果 / 验收结论 / 阻塞与升级事项 / 下一步）+「超出助理范围」停止模板。
- **v2.1 · 2026-07-13**：店铺清单支持 **CSV 批量导入 + 本地凭据保险箱**（账号/密码只存本机，不进 Git/导出/Prompt）。
