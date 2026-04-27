import { getAddress, formatUnits } from 'ethers'
import { USDT_DECIMALS } from '../config'
import { parseUsdtToWei } from '../amount'

const KEY = 'mdag.donationLedger.v1' as const
const BC = 'mdag-ledger' as const

type Entry = { hash: string; amount: string; at: number }
type Root = { wallets: Record<string, Entry[]> }

function load(): Root {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { wallets: {} }
    const p = JSON.parse(raw) as unknown
    if (p && typeof p === 'object' && p !== null && 'wallets' in p) {
      const w = (p as Root).wallets
      if (w && typeof w === 'object') return { wallets: w as Record<string, Entry[]> }
    }
  } catch {
    // ignore
  }
  return { wallets: {} }
}

function save(r: Root): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // quota / private mode
  }
  try {
    window.dispatchEvent(new CustomEvent('mdag-ledger-updated'))
  } catch {
    // ignore
  }
  try {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(BC)
    ch.postMessage({ t: 'ledger' })
    ch.close()
  } catch {
    // ignore
  }
}

function sumEntriesWei(entries: Entry[]): bigint {
  let s = 0n
  for (const e of entries) {
    const p = parseUsdtToWei(e.amount)
    if (p) s += p.wei
  }
  return s
}

function formatPts(wei: bigint): string {
  if (wei === 0n) return '0'
  const s = formatUnits(wei, USDT_DECIMALS)
  const n = Number(s)
  if (Number.isFinite(n) && Math.abs(n) < 1e15) {
    if (n === 0) return '0'
    if (Number.isInteger(n)) return String(n)
    const r = Math.round(n * 1e8) / 1e8
    return String(r).replace(/\.?0+$/, '')
  }
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function normalizeAddr(addr: string): string {
  return getAddress(addr)
}

export function getDonationTotalPointsForWallet(addr: string | null | undefined): string {
  if (!addr) return '—'
  let a: string
  try {
    a = normalizeAddr(addr)
  } catch {
    return '—'
  }
  const r = load()
  const ent = r.wallets[a] ?? []
  if (ent.length === 0) return '0'
  return formatPts(sumEntriesWei(ent))
}

export function recordDonation(
  addr: string,
  amountText: string,
  txHash: string
): { total: string; duplicate: boolean } {
  const a = normalizeAddr(addr)
  const prepared = parseUsdtToWei(amountText.trim())
  if (!prepared) {
    return { total: getDonationTotalPointsForWallet(a), duplicate: true }
  }
  const h = txHash.toLowerCase()
  const r = load()
  const list = r.wallets[a] ?? []
  if (list.some((e) => e.hash.toLowerCase() === h)) {
    return { total: formatPts(sumEntriesWei(list)), duplicate: true }
  }
  const amountStored = formatUnits(prepared.wei, USDT_DECIMALS)
  const next: Entry = { hash: txHash, amount: amountStored, at: Date.now() }
  r.wallets[a] = [...list, next]
  save(r)
  return { total: formatPts(sumEntriesWei(r.wallets[a]!)), duplicate: false }
}

export function subscribeDonationLedgerReload(onReload: () => void): () => void {
  const fn = () => onReload()
  window.addEventListener('mdag-ledger-updated', fn)
  let ch: BroadcastChannel | null = null
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel(BC)
      ch.onmessage = () => onReload()
    }
  } catch {
    ch = null
  }
  return () => {
    window.removeEventListener('mdag-ledger-updated', fn)
    ch?.close()
  }
}
