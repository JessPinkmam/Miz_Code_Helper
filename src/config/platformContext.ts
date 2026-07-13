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
    version: '2.0.0',
    asOf: '2026-07-13',
    currentNotes: [
      '淘宝当前支持店铺级采集、商品级采集和登录态管理。',
      '商品级数据已验证可回溯至 2026-01-01；更早的历史范围需先确认再补。',
      'shop7 为 C 店特殊范围：促销数据可用，但商品级尚未通过常规覆盖验收，不能默认并入普通批量任务。',
      'T+1 告警闭环已具备，但自然运行稳定性尚未验收；人工补齐不能证明定时任务已稳定。',
      '同一范围的定时任务与临时补数不得同时运行，避免双跑。',
      '遇风控页面或未知弹窗必须立即停止（fail-closed）。',
      '店铺身份（shop_id / 账号）以最新平台口径为准，不要自行猜测或转换。',
    ],
  },
  dewu: {
    id: 'dewu',
    label: '得物',
    version: '2.0.0',
    asOf: '2026-07-13',
    currentNotes: [
      '店铺级历史范围已基本补齐，默认不要重新全量跑店铺级。',
      '当前重点是商品级采集：单店无数据不应让整批任务失败，应记录该店并继续下一店。',
      '得物登录态到期前需主动重新登录，不能只靠保活续命；能否采集以实际请求是否成功为准。',
      '验证码或需要人工登录时，升级给指定负责人，不要反复自动重试撞验证。',
    ],
  },
  vip: {
    id: 'vip',
    label: '唯品会',
    version: '2.0.0',
    asOf: '2026-07-13',
    currentNotes: [
      '主要四店的店铺级、商品级主表数据置信度较高；航天早期的空区间仍需确认是未运营/平台无数据还是缺采。',
      '售后、促销、流量来源等扩展表覆盖不均，不能只看主表就判定扩展表也完整。',
      '唯品会登录态是小时级滑动会话，保活有续期价值；但仍可能有更远的绝对过期边界，需自然运行验证。',
      '同一店铺在不同平台标识下是同一家店，核对时以平台最新口径为准，不要自行换算。',
    ],
  },
}

export const PLATFORM_LIST = Object.values(PLATFORM_CONTEXTS)
