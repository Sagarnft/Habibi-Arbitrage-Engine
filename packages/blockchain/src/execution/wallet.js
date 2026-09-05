import { createWalletClient, http, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAINS } from "../chains.js";
import { rpcManager } from "../providers/rpcManager.js";
export function getWalletClient(chain, privateKey) {
    const account = privateKeyToAccount(privateKey);
    const rpcUrl = rpcManager.getSelectedUrl(chain);
    return createWalletClient({
        account,
        chain: CHAINS[chain],
        transport: http(rpcUrl, { retryCount: 0 }),
    });
}
