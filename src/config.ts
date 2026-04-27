export const BSC_CHAIN_ID = 56n
export const BSC_CHAIN_ID_HEX = '0x38'

export const BSC = {
  chainId: BSC_CHAIN_ID_HEX,
  chainName: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
} as const

export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955'
export const USDT_DECIMALS = 18
export const DONATION_RECIPIENT =
  '0x8EcA7f76E1B9D9BE65195818cf64283C9F92D7D8' as const
