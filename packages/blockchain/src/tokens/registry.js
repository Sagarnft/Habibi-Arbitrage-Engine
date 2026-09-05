export class TokenRegistry {
    tokens = new Map();
    tokensByAddress = new Map();
    register(token) {
        const normalized = {
            ...token,
            address: token.address.toLowerCase(),
            wrapped: token.wrapped?.toLowerCase(),
        };
        this.tokens.set(`${normalized.chain}:${normalized.symbol}`, normalized);
        this.tokensByAddress.set(`${normalized.chain}:${normalized.address}`, normalized);
    }
    registerMany(tokens) {
        for (const token of tokens) {
            this.register(token);
        }
    }
    get(chain, symbol) {
        return this.tokens.get(`${chain}:${symbol}`);
    }
    getByAddress(chain, address) {
        return this.tokensByAddress.get(`${chain}:${address.toLowerCase()}`);
    }
    getAll(chain) {
        const values = [...this.tokens.values()];
        if (!chain)
            return values;
        return values.filter((token) => token.chain === chain);
    }
}
export const tokenRegistry = new TokenRegistry();
