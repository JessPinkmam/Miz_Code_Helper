// useDraft.ts — 把非敏感草稿存 localStorage；保存前扫描，命中敏感信息则拒绝。
import { useEffect, useState } from 'react'
import { scanRecord } from '../lib/sensitiveScan'

const KEY = 'miz-code-helper:draft:v1'

export function loadDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 保存前扫描；命中敏感信息返回 false 且不写入 */
export function saveDraft(data: Record<string, unknown>): boolean {
  if (scanRecord(data).length > 0) return false
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** 简易受控状态 + 手动保存/清除 */
export function useLocalState<T extends Record<string, unknown>>(initial: T) {
  const [state, setState] = useState<T>(() => loadDraft<T>() ?? initial)
  useEffect(() => {
    // 不自动保存，避免把还没脱敏的内容写盘；保存由用户显式触发。
  }, [state])
  return [state, setState] as const
}
