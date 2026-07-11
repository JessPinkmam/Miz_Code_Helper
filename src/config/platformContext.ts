// platformContext.ts
// 平台现行 Background（带 version / asOf）。仅现行口径进入执行 Prompt；
// 历史记录不在此文件，避免污染生成结果。

export type PlatformId = 'taobao' | 'dewu' | 'vip'

export interface PlatformContext {
  id: PlatformId
  label: string
  version: string
  asOf: string
  /** 现行口径要点，逐条进入 Prompt 的平台 Background 段 */
  currentNotes: string[]
}

export const PLATFORM_CONTEXTS: Record<PlatformId, PlatformContext> = {
  taobao: {
    id: 'taobao',
    label: '淘宝',
    version: '1.0.0',
    asOf: '2026-07-11',
    currentNotes: [
      '现网以 live 路径 + Git 提交为生效依据，不以 pending Workshop proposal 判断是否上线。',
      '当前正式能力为 taobao-cookie、taobao-product-collector、taobao-store-collector。',
      '商品级 API 已验证可回溯至 2026-01-01；flow 和 promo 的历史边界必须分别验证。',
      'shop7 为 C 店特殊范围：promo 可用，API/flow 尚未通过常规覆盖验收，不能默认并入普通批量任务。',
      'T+1 告警闭环已具备，但自然运行稳定性尚未验收；人工补齐不能证明 Cron 稳定。',
      'isolated Cron 工具注入问题尚未根治；官方任务与 root fallback/临时兜底不得双跑。',
      '遇风控页面或未知弹窗必须 fail-closed。',
      'shop_id / account_unb 的现行使用必须以最新页面口径和物理表真实键为准，生成器不能自行猜测或转换。',
    ],
  },
  dewu: {
    id: 'dewu',
    label: '得物',
    version: '1.0.0',
    asOf: '2026-07-11',
    currentNotes: [
      '店铺级历史范围已基本补齐，默认不要重新全量跑店铺级。',
      '当前重点是商品级 wrapper：单店 no_data 不应让整个批次 fail-fast，应记录并继续下一店。',
      'pending-review 锚点必须按 shop_id + stat_date + 本批 product_id 的 batch scope 复核。',
      '关键登录态不能通过心跳续命；以 API 200/401 判断能否采集，到期前主动轮换重登。',
      'sk 的字面到期时间不等于登录态有效期。',
      '得物属于国内平台请求，应使用现行国内直连规则，不套用 OpenAI 韩国代理。',
      '验证码或人工登录升级给指定负责人，不允许反复自动撞验证。',
    ],
  },
  vip: {
    id: 'vip',
    label: '唯品会',
    version: '1.0.0',
    asOf: '2026-07-11',
    currentNotes: [
      '主要四店的店铺级、商品级主表置信度较高；航天早期空区间仍需证明是未运营/平台无数据还是缺采。',
      '售后、促销、流量来源等扩展表覆盖不均，不能用主表完整替代扩展表验收。',
      'VIP 是小时级滑动会话，keepalive 有续期价值；不得套用得物「心跳无效」的结论。',
      'VIP 可能仍存在更远的绝对过期边界，需要自然运行验证。',
      'brandStoreSn、vip_shop_id、vendorCode、vendorId 和全局店铺 ID 是不同身份，必须走统一解析层。',
      'platform_user_id 中历史复合 JSON 仅作兼容，不作为长期结构设计。',
      'promo/traffic 的 osn 为空时，应按 product_id → product_detail 兜底；不能直接用空值覆盖 spu_id。',
    ],
  },
}

export const PLATFORM_LIST = Object.values(PLATFORM_CONTEXTS)
