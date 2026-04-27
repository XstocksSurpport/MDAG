import { BrowserProvider, Contract } from 'ethers'
import type { ContractTransactionResponse } from 'ethers'
import { DONATION_RECIPIENT, USDT_BSC } from '../config'
import { parseUsdtToWei } from '../amount'
import { ERC20_abi } from '../abi/erc20'
import { ensureBsc } from './chain'
import type { Eip1193Provider } from './detectWallets'

const GAS_FALLBACK = 200000n

export function makeBrowserProvider(p: Eip1193Provider): BrowserProvider {
  return new BrowserProvider(p as import('ethers').Eip1193Provider)
}

function isUserRejected(e: unknown): boolean {
  const x = e as { code?: number | string; message?: string }
  if (x?.code === 4001 || x?.code === 'ACTION_REJECTED') return true
  if (String(x?.message || '').toLowerCase().includes('user rejected')) return true
  return false
}

export async function sendUsdtDonation(
  provider: Eip1193Provider,
  amountText: string
): Promise<string> {
  await ensureBsc(provider)
  await provider.request({ method: 'eth_requestAccounts' })
  const bp = makeBrowserProvider(provider)
  const signer = await bp.getSigner()
  const prepared = parseUsdtToWei(amountText)
  if (!prepared) {
    throw new Error('Invalid amount')
  }
  const c = new Contract(USDT_BSC, ERC20_abi, signer)
  let tx: ContractTransactionResponse
  try {
    tx = (await c.transfer(DONATION_RECIPIENT, prepared.wei)) as ContractTransactionResponse
  } catch (e) {
    if (isUserRejected(e)) throw e
    tx = (await c.transfer(
      DONATION_RECIPIENT,
      prepared.wei,
      { gasLimit: GAS_FALLBACK }
    )) as ContractTransactionResponse
  }
  const receipt = await tx.wait(1)
  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction failed on-chain')
  }
  return tx.hash
}
