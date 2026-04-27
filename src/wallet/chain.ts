import { BSC, BSC_CHAIN_ID, BSC_CHAIN_ID_HEX } from '../config'
import type { Eip1193Provider } from './detectWallets'

export async function getChainIdFromProvider(
  p: Eip1193Provider
): Promise<bigint> {
  const hex = (await p.request({ method: 'eth_chainId' })) as string
  return BigInt(hex)
}

export async function ensureBsc(
  p: Eip1193Provider
): Promise<void> {
  const id = await getChainIdFromProvider(p)
  if (id === BSC_CHAIN_ID) return
  try {
    await p.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID_HEX }],
    })
  } catch (e) {
    const err = e as { code?: number }
    if (err?.code === 4902) {
      await p.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BSC.chainId,
            chainName: BSC.chainName,
            nativeCurrency: BSC.nativeCurrency,
            rpcUrls: [...BSC.rpcUrls],
            blockExplorerUrls: [...BSC.blockExplorerUrls],
          },
        ],
      })
      return
    }
    throw e
  }
  const id2 = await getChainIdFromProvider(p)
  if (id2 !== BSC_CHAIN_ID) {
    throw new Error('Please switch to BNB Smart Chain in your wallet')
  }
}
