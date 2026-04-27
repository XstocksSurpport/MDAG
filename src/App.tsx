import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserProvider, Contract, formatUnits, getAddress } from 'ethers'
import './App.css'
import { type Lang, strings, marqueeLine } from './i18n'
import { BSC_CHAIN_ID, USDT_BSC, USDT_DECIMALS } from './config'
import { ERC20_abi } from './abi/erc20'
import { sanitizeAmountInput } from './amount'
import { getEvmProvidersForPicker, type Eip1193Provider } from './wallet/detectWallets'
import { getChainIdFromProvider } from './wallet/chain'
import { sendUsdtDonation } from './wallet/donateUsdt'
import {
  getDonationTotalPointsForWallet,
  recordDonation,
  subscribeDonationLedgerReload,
} from './donation/ledgerStorage'

function shortenAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function formatPoints(amt: string): string {
  const t = amt.trim()
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return '0'
  if (t.endsWith('.')) {
    const n = Number(t.slice(0, -1))
    return Number.isFinite(n) && n >= 0 ? String(n) : '0'
  }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return '0'
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e8) / 1e8)
}

export default function App() {
  const [amount, setAmount] = useState('1')
  const [eipProvider, setEipProvider] = useState<Eip1193Provider | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<bigint | null>(null)
  const [showPick, setShowPick] = useState(false)
  const [busy, setBusy] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [bscBlock, setBscBlock] = useState<string>('—')
  const [usdtPreview, setUsdtPreview] = useState('—')
  const [donationTotal, setDonationTotal] = useState('0')
  const resumeDonateAfterWallet = useRef(false)
  const addrRef = useRef<string | null>(null)
  const [lang, setLang] = useState<Lang>('en')

  const s = strings[lang]
  const points = useMemo(() => formatPoints(amount), [amount])
  const onBsc = chainId === BSC_CHAIN_ID
  const mq = [...marqueeLine[lang], ...marqueeLine[lang]]

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en'
  }, [lang])

  useEffect(() => {
    addrRef.current = address
  }, [address])

  useEffect(() => {
    if (!address) return
    setDonationTotal(getDonationTotalPointsForWallet(address))
  }, [address])

  useEffect(() => {
    return subscribeDonationLedgerReload(() => {
      const a = addrRef.current
      if (a) setDonationTotal(getDonationTotalPointsForWallet(a))
    })
  }, [])

  const connectWith = useCallback(
    async (p: Eip1193Provider): Promise<Eip1193Provider | null> => {
      setBusy(true)
      setTxHash(null)
      setActionErr(null)
      try {
        await p.request({ method: 'eth_requestAccounts' })
        const bp = new BrowserProvider(p as import('ethers').Eip1193Provider)
        const acc = (await p.request({ method: 'eth_accounts' })) as string[]
        const raw = acc[0] ?? (await (await bp.getSigner()).getAddress())
        setAddress(getAddress(raw))
        setEipProvider(p)
        setChainId(await getChainIdFromProvider(p))
        return p
      } catch {
        return null
      } finally {
        setBusy(false)
        setShowPick(false)
      }
    },
    []
  )

  const onConnectClick = useCallback(() => {
    if (eipProvider && address) return
    setTxHash(null)
    setActionErr(null)
    const list = getEvmProvidersForPicker()
    if (list.length === 0) {
      const w = (window as unknown as { ethereum?: Eip1193Provider }).ethereum
      if (w) void connectWith(w)
      return
    }
    if (list.length === 1) {
      void connectWith(list[0]!.provider)
    } else {
      setShowPick(true)
    }
  }, [eipProvider, address, connectWith])

  const disconnect = useCallback(() => {
    resumeDonateAfterWallet.current = false
    setEipProvider(null)
    setAddress(null)
    setChainId(null)
  }, [])

  useEffect(() => {
    if (!eipProvider) return
    const p = eipProvider
    const onAccounts = () => {
      void p.request({ method: 'eth_accounts' }).then((a) => {
        const addrs = a as string[]
        if (addrs[0]) setAddress(getAddress(addrs[0]!))
        else disconnect()
      })
    }
    const onChain = () => {
      void getChainIdFromProvider(p).then(setChainId)
    }
    p.on?.('accountsChanged', onAccounts)
    p.on?.('chainChanged', onChain)
    return () => {
      p.removeListener?.('accountsChanged', onAccounts)
      p.removeListener?.('chainChanged', onChain)
    }
  }, [eipProvider, disconnect])

  useEffect(() => {
    if (!eipProvider || !address || !onBsc) {
      setUsdtPreview('—')
      return
    }
    let cancel = false
    void (async () => {
      try {
        const bp = new BrowserProvider(eipProvider as import('ethers').Eip1193Provider)
        const t = new Contract(USDT_BSC, ERC20_abi, bp)
        const raw = (await t.balanceOf(address)) as bigint
        if (!cancel) setUsdtPreview(Number(formatUnits(raw, USDT_DECIMALS)).toFixed(4))
      } catch {
        if (!cancel) setUsdtPreview('—')
      }
    })()
    return () => {
      cancel = true
    }
  }, [eipProvider, address, onBsc, chainId])

  useEffect(() => {
    const rpc = 'https://bsc-dataseed.binance.org/'
    const q = () =>
      fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j?.result) setBscBlock(String(parseInt(String(j.result), 16)))
        })
        .catch(() => {})
    q()
    const t = setInterval(q, 15000)
    return () => clearInterval(t)
  }, [])

  const doSend = useCallback(
    async (p: Eip1193Provider) => {
      setActionErr(null)
      setTxHash(null)
      setBusy(true)
      try {
        const hash = await sendUsdtDonation(p, amount)
        setTxHash(hash)
        const bp = new BrowserProvider(p as import('ethers').Eip1193Provider)
        const from = await (await bp.getSigner()).getAddress()
        try {
          const { total } = recordDonation(from, amount, hash)
          setDonationTotal(total)
        } catch {
          setDonationTotal(getDonationTotalPointsForWallet(from))
        }
      } catch (e) {
        setTxHash(null)
        if (isUserRejected(e)) {
          setActionErr('rejected')
        } else {
          setActionErr('failed')
        }
      } finally {
        setBusy(false)
      }
    },
    [amount]
  )

  const onDonate = useCallback(async () => {
    setActionErr(null)
    let p: Eip1193Provider | null = eipProvider
    if (!p) {
      const list = getEvmProvidersForPicker()
      if (list.length === 0) {
        const w = (window as unknown as { ethereum?: Eip1193Provider }).ethereum
        if (w) p = await connectWith(w)
        else {
          setActionErr('no_wallet')
          return
        }
      } else if (list.length === 1) {
        p = await connectWith(list[0]!.provider)
      } else {
        resumeDonateAfterWallet.current = true
        setShowPick(true)
        return
      }
    }
    if (!p) {
      return
    }
    await doSend(p)
  }, [eipProvider, connectWith, doSend])

  useEffect(() => {
    if (!eipProvider || !address) return
    if (!resumeDonateAfterWallet.current) return
    resumeDonateAfterWallet.current = false
    void doSend(eipProvider)
  }, [eipProvider, address, doSend])

  return (
    <div className="app">
      <div className="orb orb-a" aria-hidden />
      <div className="orb orb-b" aria-hidden />
      <header className="topbar">
        <div className="topbar-start">
          <a
            className="site-logo-link"
            href="/"
            aria-label="MDAG — Make DeFi Great Again"
          >
            <img
              className="site-logo-img"
              src="/mdag-logo.png"
              width={48}
              height={48}
              alt=""
              decoding="async"
            />
            <span className="visually-hidden">MDAG</span>
          </a>
          <div className="lang-switch" role="group" aria-label={s.ariaLang}>
            <button
              type="button"
              className={lang === 'en' ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <span className="lang-sep" aria-hidden>
              |
            </span>
            <button
              type="button"
              className={lang === 'zh' ? 'lang-btn active' : 'lang-btn'}
              onClick={() => setLang('zh')}
            >
              中文
            </button>
          </div>
        </div>
        <div className="top-actions">
          {address ? (
            <>
              <div className="connect-btn" style={{ cursor: 'default' }}>
                {shortenAddr(address)}
              </div>
              <button
                type="button"
                className="unhook"
                onClick={disconnect}
                disabled={busy}
                aria-label={s.ariaDisconnect}
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`connect-btn${busy ? ' dim' : ''}`}
              onClick={onConnectClick}
              disabled={busy}
            >
              {s.connectWallet}
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {mq.map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </div>
        </div>

        <div className="pill">
          <span className="pill-dot" />
          {s.donationLive}
        </div>

        <div className="section wide donate-hero first">
          <h4 className="section-title">{s.donateTitle}</h4>
          <p className="section-blurb">
            {s.connectBlurbBefore} <strong>{s.donate}</strong> {s.connectBlurbAfter}
          </p>
        </div>

        <div className="donation-card first">
          <div className="field">
            <div className="field-labels">
              <span>USDT</span>
              <span>
                {s.points} <span className="pts">{points}</span>
              </span>
            </div>
            <div className="input-wrap">
              <input
                className="amount-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                placeholder="0"
                disabled={busy}
              />
              <span className="suffix">USDT</span>
            </div>
          </div>
          {address ? (
            <div className="donation-ledger">
              <div className="donation-ledger-row">
                <span className="donation-ledger-label">{s.statDonationPts}</span>
                <span className="donation-ledger-val">{donationTotal}</span>
              </div>
              <p className="donation-ledger-hint">{s.ledgerHint}</p>
            </div>
          ) : null}
          {actionErr ? (
            <p className="form-hint" data-kind={actionErr === 'rejected' ? 'muted' : 'err'}>
              {actionErr === 'rejected'
                ? s.errRejected
                : actionErr === 'no_wallet'
                  ? s.errNoWallet
                  : s.errFailed}
            </p>
          ) : null}
          <button type="button" className="donate-btn" onClick={() => void onDonate()} disabled={busy}>
            {s.donate}
          </button>
          <div className="tx">
            {txHash ? (
              <a href={`https://bscscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">
                {txHash}
              </a>
            ) : null}
          </div>
        </div>

        <div className="hero">
          <h2 className="hero-kicker">MDAG</h2>
          <h3 className="hero-h3">Make Defi Again Great</h3>
          <p className="hero-lead">{s.heroLead}</p>
        </div>

        <div className="stats stats-5">
          <div className="stat">
            <div className="stat-label">{s.statNetwork}</div>
            <div className="stat-value accent">{onBsc ? 'BSC' : '—'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{s.statChain}</div>
            <div className="stat-value">{chainId != null ? String(chainId) : '—'}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{s.statBlock}</div>
            <div className="stat-value">{bscBlock}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{s.statUsdt}</div>
            <div className="stat-value accent">{usdtPreview}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{s.statDonationPts}</div>
            <div className="stat-value accent">{address ? donationTotal : '—'}</div>
          </div>
        </div>

        <div className="section">
          <h4 className="section-title">{s.sectionCore}</h4>
          <div className="core-grid">
            <div className="core-card">
              <div className="core-icon">⛓</div>
              <div className="core-h">{s.core1h}</div>
              <p className="core-p">{s.core1p}</p>
            </div>
            <div className="core-card">
              <div className="core-icon">$</div>
              <div className="core-h">{s.core2h}</div>
              <p className="core-p">{s.core2p}</p>
            </div>
            <div className="core-card">
              <div className="core-icon">◈</div>
              <div className="core-h">{s.core3h}</div>
              <p className="core-p">{s.core3p}</p>
            </div>
            <div className="core-card">
              <div className="core-icon">◇</div>
              <div className="core-h">{s.core4h}</div>
              <p className="core-p">{s.core4p}</p>
            </div>
          </div>
        </div>

        <div className="section">
          <h4 className="section-title">{s.sectionFlow}</h4>
          <div className="flow-strip">
            <div className="flow">
              <span className="flow-badge">A</span>
              <div className="flow-body">
                <div className="flow-h">{s.flow1h}</div>
                <p>{s.flow1p}</p>
              </div>
            </div>
            <div className="flow">
              <span className="flow-badge">B</span>
              <div className="flow-body">
                <div className="flow-h">{s.flow2h}</div>
                <p>{s.flow2p}</p>
              </div>
            </div>
            <div className="flow">
              <span className="flow-badge">C</span>
              <div className="flow-body">
                <div className="flow-h">{s.flow3h}</div>
                <p>{s.flow3p}</p>
              </div>
            </div>
            <div className="flow">
              <span className="flow-badge">D</span>
              <div className="flow-body">
                <div className="flow-h">{s.flow4h}</div>
                <p>{s.flow4p}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="foot">
        <div className="foot-inner">
          <span>MDAG</span>
          <a href="https://bscscan.com" target="_blank" rel="noreferrer">
            BscScan
          </a>
          <span className="foot-muted">{s.footMuted}</span>
        </div>
      </footer>

      {showPick ? (
        <div
          className="backdrop"
          role="presentation"
          onClick={() => {
            resumeDonateAfterWallet.current = false
            setShowPick(false)
          }}
        >
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <p className="modal-h">{s.modalPick}</p>
            <div className="wlist">
              {getEvmProvidersForPicker().map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className="witem"
                  onClick={() => void connectWith(w.provider)}
                >
                  {w.icon ? (
                    <img src={w.icon} alt="" />
                  ) : (
                    <span
                      className="brand-mark"
                      style={{ width: 28, height: 28, fontSize: 12 }}
                    >
                      ◇
                    </span>
                  )}
                  {w.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="modal-x"
              onClick={() => {
                resumeDonateAfterWallet.current = false
                setShowPick(false)
              }}
              aria-label={s.ariaClose}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function isUserRejected(e: unknown): boolean {
  const x = e as { code?: number | string; message?: string }
  if (x?.code === 4001 || x?.code === 'ACTION_REJECTED') return true
  if (String(x?.message || '').toLowerCase().includes('user rejected')) return true
  return false
}
