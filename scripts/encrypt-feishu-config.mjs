// scripts/encrypt-feishu-config.mjs
// 本地加密脚本：把飞书 Webhook URL + Bearer Token 用口令加密，
// 生成 src/config/encryptedFeishuConfig.ts（只含 salt/iv/ciphertext，可安全提交）。
//
// 用法：npm run encrypt:feishu
// 安全边界：
//   - 口令、明文 URL、明文 Token 只在本机内存里出现，绝不写入文件或日志。
//   - 生成文件不含任何明文，仅含密文与 KDF 参数。
//   - 请勿把口令写进任何源文件 / README / 群公告。
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import process from 'node:process'

const ITERATIONS = 600_000
const KEY_LENGTH = 32
const DIGEST = 'sha256'
const OUT_PATH = path.join('src', 'config', 'encryptedFeishuConfig.ts')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function ask(question) {
  return rl.question(question)
}

try {
  const webhookUrl = (await ask('请输入飞书 Webhook URL：')).trim()
  const bearerToken = (await ask('请输入 Bearer Token（没有可留空）：')).trim()
  const passphrase = await ask('请输入解密口令（≥12 位，建议 16+ 位随机口令）：')
  const confirmPassphrase = await ask('请再次输入解密口令：')

  if (!webhookUrl.startsWith('https://')) {
    throw new Error('Webhook URL 必须使用 HTTPS')
  }
  if (passphrase.length < 12) {
    throw new Error('口令长度至少需要 12 位')
  }
  if (passphrase !== confirmPassphrase) {
    throw new Error('两次输入的口令不一致')
  }

  const plaintext = JSON.stringify({ webhookUrl, bearerToken })

  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, DIGEST)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Web Crypto API 的 AES-GCM 解密要求 ciphertext + authTag 拼接
  const ciphertextWithTag = Buffer.concat([encrypted, authTag])

  const output = `/**
 * 自动生成文件（scripts/encrypt-feishu-config.mjs）。
 * 只包含加密后的飞书配置，不包含明文 Webhook 或 Token。
 * configured=true 表示已在本地加密注入真实配置；false 为占位。
 */
export const ENCRYPTED_FEISHU_CONFIG = {
  configured: true,
  version: 1,
  algorithm: 'AES-GCM',
  keyDerivation: 'PBKDF2-SHA-256',
  iterations: ${ITERATIONS},
  salt: '${salt.toString('base64')}',
  iv: '${iv.toString('base64')}',
  ciphertext: '${ciphertextWithTag.toString('base64')}',
} as const
`

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, output, 'utf8')

  console.log(`\n已生成：${OUT_PATH}`)
  console.log('该文件只含密文，可提交 GitHub。请勿提交口令、明文 Webhook 或明文 Token。')
} finally {
  rl.close()
}
