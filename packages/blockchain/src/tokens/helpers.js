import { tokenRegistry } from "./registry.js";
import { initializeTokenRegistry } from "./init.js";
function findToken(chain, address) {
    const normalizedAddress = address.toLowerCase();
    const directMatch = tokenRegistry.getByAddress(chain, normalizedAddress);
    if (directMatch) {
        return directMatch;
    }
    initializeTokenRegistry();
    return tokenRegistry.getByAddress(chain, normalizedAddress);
}
export function getTokenDecimals(chain, address) {
    const token = findToken(chain, address);
    if (!token) {
        throw new Error(`Token not found: ${address}`);
    }
    return token.decimals;
}
function getTradeSize(symbol) {
    switch (symbol) {
        case "USDC":
        case "USDT":
        case "DAI":
            return 10;
        case "WETH":
        case "ETH":
            return 0.1;
        case "WBTC":
            return 0.001;
        default:
            return 1;
    }
}
export function buildAmountIn(chain, address) {
    const token = findToken(chain, address);
    if (!token) {
        throw new Error(`Token not found: ${address}`);
    }
    const size = getTradeSize(token.symbol);
    const decimals = token.decimals;
    return BigInt(Math.floor(size * (10 ** decimals)));
}
