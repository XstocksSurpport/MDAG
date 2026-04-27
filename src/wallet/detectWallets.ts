export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (ev: string, fn: (...a: unknown[]) => void) => void
  removeListener?: (ev: string, fn: (...a: unknown[]) => void) => void
}

export type Announced = {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: Eip1193Provider
}

const ANNOUNCE = 'eip6963:announceProvider' as const
const REQ = 'eip6963:requestProvider' as const

const collected: Map<string, Announced> = new Map()
let requestSent = false
let listenInstalled = false

function installListener(): void {
  if (typeof window === 'undefined' || listenInstalled) return
  listenInstalled = true
  window.addEventListener(ANNOUNCE, ((e: Event) => {
    const d = (e as CustomEvent<Announced>).detail
    if (d?.info?.uuid && d?.provider) collected.set(d.info.uuid, d)
  }) as EventListener)
}

export function getAnnouncedWallets(): Announced[] {
  if (typeof window === 'undefined') return []
  installListener()
  if (!requestSent) {
    requestSent = true
    window.dispatchEvent(new Event(REQ))
  }
  return [...collected.values()]
}

export function getEvmProvidersForPicker(): {
  key: string
  name: string
  icon?: string
  provider: Eip1193Provider
}[] {
  if (typeof window === 'undefined') return []
  getAnnouncedWallets()
  const byProv = new Map<Eip1193Provider, { key: string; name: string; icon?: string; provider: Eip1193Provider }>()
  for (const a of collected.values()) {
    byProv.set(a.provider, {
      key: a.info.uuid,
      name: a.info.name,
      icon: a.info.icon,
      provider: a.provider,
    })
  }
  const w = window as unknown as { ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] } }
  const eth = w.ethereum
  if (eth) {
    if (eth.providers?.length) {
      eth.providers.forEach((p, i) => {
        if (!byProv.has(p)) {
          byProv.set(p, { key: `m-${i}`, name: `Browser wallet ${i + 1}`, provider: p })
        }
      })
    } else if (!byProv.has(eth)) {
      byProv.set(eth, { key: 'injected', name: 'Browser wallet', provider: eth })
    }
  }
  return [...byProv.values()]
}
