import { getAddress, formatUnits } from 'ethers'
import { USDT_DECIMALS } from '../config'
import { parseUsdtToWei } from '../amount'

const KEY = 'mdag.donationLedger.v1' as const
const BC = 'mdag-ledger' as const

type Entry = { hash: string; amount: string; at: number }
type Root = { wallets: Record<string, Entry[]> }

function saveRaw(r: Root, emit: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // ignore
  }
  if (!emit) return
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

/** Merge all stored keys to EIP-55 checksummed form (fixes legacy mixed-case keys). */
function normalizeRootKeysInPlace(r: Root): void {
  const out: Record<string, Entry[]> = {}
  for (const [k, v] of Object.entries(r.wallets)) {
    if (!v?.length) continue
    let canon: string
    try {
      canon = getAddress(k)
    } catch {
      continue
    }
    if (!out[canon]) {
      out[canon] = [...v]
      continue
    }
    const seen = new Set(out[canon]!.map((e) => e.hash.toLowerCase()))
    for (const e of v) {
      const h = e.hash.toLowerCase()
      if (!seen.has(h)) {
        out[canon]!.push(e)
        seen.add(h)
      }
    }
  }
  r.wallets = out
}

function load(): Root {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { wallets: {} }
    const p = JSON.parse(raw) as unknown
    if (p && typeof p === 'object' && p !== null && 'wallets' in p) {
      const w = (p as Root).wallets
      if (w && typeof w === 'object') {
        const r: Root = { wallets: { ...w } as Record<string, Entry[]> }
        const before = JSON.stringify(r)
        normalizeRootKeysInPlace(r)
        if (JSON.stringify(r) !== before) {
          saveRaw(r, false)
        }
        return r
      }
    }
  } catch {
    // ignore
  }
  return { wallets: {} }
}

function save(r: Root): void {
  saveRaw(r, true)
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

export function normalizeWalletAddress(addr: string): string {
  return getAddress(addr)
}

function resolveWalletEntries(r: Root, addr: string): Entry[] {
  const a = getAddress(addr)
  const direct = r.wallets[a]
  if (direct?.length) return direct
  const al = a.toLowerCase()
  for (const k of Object.keys(r.wallets)) {
    if (k.toLowerCase() === al) {
      const v = r.wallets[k]!
      r.wallets[a] = v
      delete r.wallets[k]
      save(r)
      return v
    }
  }
  return r.wallets[a] ?? []
}

export function getDonationTotalPointsForWallet(addr: string | null | undefined): string {
  if (!addr) return '—'
  let a: string
  try {
    a = getAddress(addr)
  } catch {
    return '—'
  }
  const r = load()
  const ent = resolveWalletEntries(r, a)
  if (ent.length === 0) return '0'
  return formatPts(sumEntriesWei(ent))
}

export function recordDonation(
  addr: string,
  amountText: string,
  txHash: string
): { total: string; duplicate: boolean } {
  const a = getAddress(addr)
  const prepared = parseUsdtToWei(amountText.trim())
  if (!prepared) {
    return { total: getDonationTotalPointsForWallet(a), duplicate: true }
  }
  const h = txHash.toLowerCase()
  const r = load()
  resolveWalletEntries(r, a)
  if (r.wallets[a] === undefined) {
    r.wallets[a] = []
  }
  const listRef = r.wallets[a]!
  if (listRef.some((e) => e.hash.toLowerCase() === h)) {
    return { total: formatPts(sumEntriesWei(listRef)), duplicate: true }
  }
  const amountStored = formatUnits(prepared.wei, USDT_DECIMALS)
  const next: Entry = { hash: txHash, amount: amountStored, at: Date.now() }
  r.wallets[a] = [...listRef, next]
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
