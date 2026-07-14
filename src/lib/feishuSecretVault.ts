// feishuSecretVault.ts
// 浏览器端解密飞书配置：口令 → PBKDF2-SHA256 → AES-256-GCM 解密。
//
// 安全边界（务必保持）：
//   - 口令只由使用者当场输入；源码只含密文、salt、iv、迭代次数。
//   - 解密结果只放调用方内存（useRef），绝不写 localStorage/sessionStorage。
//   - 错误口令 / 损坏密文统一报同一句话，不区分具体原因、不泄露配置。
//   - 本模块不打印 config、webhookUrl、bearerToken。
import { ENCRYPTED_FEISHU_CONFIG } from '../config/encryptedFeishuConfig'

export interface FeishuSecretConfig {
  webhookUrl: string
  bearerToken: string
}

/** 是否已在本地注入真实飞书配置（占位文件为 false）。 */
export function isFeishuConfigured(): boolean {
  const cfg = ENCRYPTED_FEISHU_CONFIG as {
    configured: boolean
    salt: string
    iv: string
    ciphertext: string
  }
  return cfg.configured === true && !!cfg.salt && !!cfg.iv && !!cfg.ciphertext
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = window.atob(value)
  const result = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index)
  }
  return result.buffer
}

function isValidConfig(value: unknown): value is FeishuSecretConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  return (
    typeof config.webhookUrl === 'string' &&
    config.webhookUrl.startsWith('https://') &&
    typeof config.bearerToken === 'string'
  )
}

export async function decryptFeishuConfig(passphrase: string): Promise<FeishuSecretConfig> {
  if (!passphrase) {
    throw new Error('请输入解密口令')
  }
  if (!isFeishuConfigured()) {
    throw new Error('尚未在本地注入飞书配置，请先运行 npm run encrypt:feishu')
  }

  try {
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToBytes(ENCRYPTED_FEISHU_CONFIG.salt),
        iterations: ENCRYPTED_FEISHU_CONFIG.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    )
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(ENCRYPTED_FEISHU_CONFIG.iv),
        tagLength: 128,
      },
      key,
      base64ToBytes(ENCRYPTED_FEISHU_CONFIG.ciphertext),
    )
    const plaintext = new TextDecoder().decode(decrypted)
    const config: unknown = JSON.parse(plaintext)
    if (!isValidConfig(config)) {
      throw new Error('解密后的配置格式错误')
    }
    return config
  } catch {
    // 不暴露究竟是口令、密文还是配置格式错误
    throw new Error('口令错误或加密配置已损坏')
  }
}
