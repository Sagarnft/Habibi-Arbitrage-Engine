import {
  createWalletClient,
  http,
  type WalletClient,
} from "viem";

import { privateKeyToAccount } from "viem/accounts";

import { CHAINS, type ChainName } from "../chains.js";
import { rpcManager } from "../providers/rpcManager.js";

export function getWalletClient(
  chain: ChainName,
  privateKey: `0x${string}`,
): WalletClient {
  const account =
    privateKeyToAccount(privateKey);
  const rpcUrl = rpcManager.getSelectedUrl(chain);

  return createWalletClient({
    account,
    chain: CHAINS[chain],
    transport: http(rpcUrl, { retryCount: 0 }),
  }) as WalletClient;
}