import { parseUnits } from 'ethers'
import { USDT_DECIMALS } from './config'

export function sanitizeAmountInput(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, '')
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) +
      s
        .slice(firstDot + 1)
        .replace(/\./g, '')
  }
  if (s.startsWith('.')) s = '0' + s
  return s
}

export function parseUsdtToWei(s: string): { wei: bigint } | null {
  let t = s.trim()
  if (!t) return null
  if (t === '.') return null
  if (t.endsWith('.')) t = t.slice(0, -1)
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const wei = parseUnits(t, USDT_DECIMALS)
  if (wei === 0n) return null
  return { wei }
}
