// fixedBackground.ts
// 所有平台共用的固定 Background（spec 第二节原文收敛）。

export const FIXED_BACKGROUND_VERSION = '1.0.0'
export const FIXED_BACKGROUND_AS_OF = '2026-07-11'

export const FIXED_BACKGROUND = `这是一个淘宝、得物、唯品会电商数据采集系统。

主机 A 是采集和写库端：对应平台 OpenClaw Agent 通过正式 skill 采集，并写入 Postgres ecommerce 对应 schema。
主机 B 是只读分析端：只读取同步数据，不采集、不写库、不修改采集逻辑。

业务采集、补数、写库、采集逻辑修改和 skill 升级，必须交给主机 A 的对应平台 OpenClaw Agent。
Claude Code/Codex 只负责产品开发、诊断、审查和生成 Agent 指令，不能替代平台 Agent 做业务采集。

统一执行闭环：
参数确认 → 查配置和登录态 → 小批 smoke → 采集 → 标准化 → 幂等 upsert → 审计 → 清理中间产物 → 更新状态与 Git 留痕。

统一红线：
- 不绕过 Agent 和正式 skill。
- 不硬编码凭据，不在 Prompt 或前端存储敏感信息。
- 不修改 Agent workspace 配置路径。
- 写库前备份，只补不毁。
- 唯一键 upsert，禁止盲目 INSERT。
- 先单店、单日或 1–2 天 smoke，再扩大范围。
- 商品级任务分片、抖动、限流；同店不并发。
- 风控、401、验证码、身份异常、未知弹窗必须 fail-closed。
- 日志成功、delivered=true、进程在线都不等于数据成功。
- 最终必须核验行数、断档、重复、空字段、异常值和任务状态。
- skill 修改必须进入当前 live 路径并提交 Git。
- 审计通过后才清理非必要 JSON/CSV/截图/临时文件。`
