/**
 * 占位文件：尚未在本地注入真实飞书配置。
 * 运行 `npm run encrypt:feishu` 后，本文件会被生成的密文覆盖（configured=true）。
 * 该占位不含任何明文，可安全提交 GitHub。
 */
export const ENCRYPTED_FEISHU_CONFIG = {
  configured: false,
  version: 1,
  algorithm: 'AES-GCM',
  keyDerivation: 'PBKDF2-SHA-256',
  iterations: 600000,
  salt: '',
  iv: '',
  ciphertext: '',
} as const
