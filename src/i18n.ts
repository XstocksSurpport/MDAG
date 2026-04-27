export type Lang = 'en' | 'zh'

const en = {
  connectWallet: 'Connect wallet',
  donationLive: 'Donation live on BSC',
  donateTitle: 'Donate (USDT)',
  connectBlurbBefore: 'Connect your wallet, enter an amount, and tap',
  connectBlurbAfter: 'to open your wallet.',
  donate: 'Donate',
  points: 'Points',
  errRejected: 'Cancelled in wallet',
  errNoWallet: 'No wallet extension detected',
  errFailed: 'Transaction not sent or invalid amount. Try again.',
  heroLead:
    'Community-driven, on-chain transparency: donate with USDT on BSC. Points match USDT 1:1, supporting the MDAG ecosystem and open collaboration.',
  statNetwork: 'Network',
  statChain: 'Chain',
  statBlock: 'Block (BSC)',
  statUsdt: 'USDT',
  statDonationPts: 'Donation Pts',
  ledgerHint: 'This browser · 1 USDT = 1 pt',
  sectionCore: 'Core',
  core1h: 'BSC',
  core1p: 'Settled on BNB Smart Chain: familiar gas, everyday DeFi, clear execution.',
  core2h: 'USDT (BEP-20)',
  core2p: 'A stable, auditable BEP-20 token; every transfer is visible on a block explorer.',
  core3h: '1:1 points',
  core3p: '1 USDT maps to 1 point in the UI, updated live as you type your amount.',
  core4h: 'EVM wallets',
  core4p: 'EIP-6963 for multiple injected wallets, plus a classic injected provider.',
  sectionFlow: 'Flow (A—D)',
  flow1h: 'Connect',
  flow1p: 'Use Connect wallet (top right), pick your provider, and approve site access the first time.',
  flow2h: 'BSC & USDT',
  flow2p: 'Switch to BSC in your wallet. Hold BEP-20 USDT to send your donation on-chain.',
  flow3h: 'Amount & points',
  flow3p: 'Enter the amount; points update in lockstep, then sign the USDT transfer in your wallet.',
  flow4h: 'Receipt',
  flow4p: 'Copy the transaction hash from this page and verify it on BscScan whenever you need.',
  modalPick: 'Select wallet',
  footMuted: 'BEP-20 · BNB Smart Chain',
  ariaLang: 'Language',
  ariaDisconnect: 'Disconnect',
  ariaClose: 'Close',
} as const

const zh: { [K in keyof typeof en]: string } = {
  connectWallet: '连接钱包',
  donationLive: 'BSC 链上捐赠进行中',
  donateTitle: '捐赠 (USDT)',
  connectBlurbBefore: '连接钱包、填写金额、点击',
  connectBlurbAfter: '即可唤起钱包。',
  donate: '捐款',
  points: '积分',
  errRejected: '钱包已取消',
  errNoWallet: '未检测到钱包扩展',
  errFailed: '交易未发送或金额不合法，请重试或检查网络',
  heroLead:
    '社区驱动、链上透明：在 BSC 以 USDT 完成捐赠，积分与金额 1:1 对应，为 MDAG 生态与公开协作提供可持续支持。',
  statNetwork: '网络',
  statChain: '链',
  statBlock: '区块 (BSC)',
  statUsdt: 'USDT',
  statDonationPts: '捐款积分',
  ledgerHint: '本浏览器 · 1 USDT = 1 分',
  sectionCore: '要点',
  core1h: 'BSC 结算',
  core1p: '目标网络为 BNB Smart Chain，降低 Gas 与日常交互成本，贴近链上生活。',
  core2h: 'USDT (BEP-20)',
  core2p: '资产类型稳定、跟踪清晰；捐赠在区块浏览器中可审且可复验。',
  core3h: '1:1 积分',
  core3p: '输入与展示同步：1 USDT 记 1 分，随金额同屏变化。',
  core4h: '钱包原生',
  core4p: '支持常用 EVM 注入钱包与多钱包共存的 EIP-6963 发现。',
  sectionFlow: '流程 (A—D)',
  flow1h: '链上连接',
  flow1p: '右上角使用「连接钱包」，在列表中选择注入钱包，并在首次授权中允许站点访问地址。',
  flow2h: 'BSC 与 USDT',
  flow2p: '在钱包内切换到 BSC；准备链上 BEP-20 形式的 USDT 资产用于转账。',
  flow3h: '确认金额与积分',
  flow3p: '中央输入捐赠金额，积分会同步；随后发起链上 USDT 转账并在钱包中签署。',
  flow4h: '交易完成',
  flow4p: '在下方查看返回的交易哈希，并在 BscScan 打开对应回执，便于对账与公开复核。',
  modalPick: '选择钱包',
  footMuted: 'BEP-20 · BNB 智能链',
  ariaLang: '语言',
  ariaDisconnect: '断开连接',
  ariaClose: '关闭',
}

export type TKey = keyof typeof en

export const strings = { en, zh } as const

export function tr(lang: Lang, key: TKey): string {
  return strings[lang][key]
}

export const marqueeLine: Record<Lang, [string, string, string, string]> = {
  en: [
    'BSC · USDT (BEP-20) · 1:1 points',
    'MDAG',
    'BNB Smart Chain',
    'Make DeFi Great Again',
  ],
  zh: [
    'BSC · USDT (BEP-20) · 1:1 积分',
    'MDAG',
    'BNB 智能链',
    '让 DeFi 再次伟大',
  ],
}
