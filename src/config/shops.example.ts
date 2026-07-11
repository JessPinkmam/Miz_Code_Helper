// shops.example.ts
// 内置可编辑的示例店铺清单 —— 全部为假名占位，无任何真实凭据/真实店铺 ID。
// 用户可在页面里增删改，或通过导入脱敏 JSON 覆盖。请勿把真实凭据写进本文件。

import type { PlatformId } from './platformContext'

export interface ShopEntry {
  /** 页面内部用的稳定 key */
  key: string
  platform: PlatformId
  /** 店铺展示名（假名） */
  name: string
  /** 平台侧店铺标识占位符 —— 不是真实 ID */
  platformShopId: string
  brand: string
  enabled: boolean
  allowShopLevel: boolean
  allowProductLevel: boolean
}

export const EXAMPLE_SHOPS: ShopEntry[] = [
  {
    key: 'tb-demo-1',
    platform: 'taobao',
    name: '示例旗舰店A（假名）',
    platformShopId: 'TB_SHOP_PLACEHOLDER_1',
    brand: '品牌X',
    enabled: true,
    allowShopLevel: true,
    allowProductLevel: true,
  },
  {
    key: 'tb-demo-7',
    platform: 'taobao',
    name: '示例C店shop7（假名）',
    platformShopId: 'TB_SHOP_PLACEHOLDER_7',
    brand: '品牌X',
    enabled: true,
    allowShopLevel: true,
    allowProductLevel: false, // 对应 shop7 未通过 API/flow 覆盖验收
  },
  {
    key: 'dw-demo-1',
    platform: 'dewu',
    name: '示例得物店A（假名）',
    platformShopId: 'DW_SHOP_PLACEHOLDER_1',
    brand: '品牌Y',
    enabled: true,
    allowShopLevel: true,
    allowProductLevel: true,
  },
  {
    key: 'vip-demo-1',
    platform: 'vip',
    name: '示例唯品会店A（假名）',
    platformShopId: 'VIP_SHOP_PLACEHOLDER_1',
    brand: '品牌Z',
    enabled: true,
    allowShopLevel: true,
    allowProductLevel: true,
  },
]
