import type { Token } from "./types.js";

export class TokenRegistry {
  private readonly tokens = new Map<string, Token>();
  private readonly tokensByAddress = new Map<string, Token>();

  register(token: Token): void {
    const normalized = {
      ...token,
      address: token.address.toLowerCase() as `0x${string}`,
      wrapped: token.wrapped?.toLowerCase() as `0x${string}` | undefined,
    };
    this.tokens.set(`${normalized.chain}:${normalized.symbol}`, normalized);
    this.tokensByAddress.set(`${normalized.chain}:${normalized.address}`, normalized);
  }

  registerMany(tokens: Token[]): void {
    for (const token of tokens) {
      this.register(token);
    }
  }

  get(chain: string, symbol: string): Token | undefined {
    return this.tokens.get(`${chain}:${symbol}`);
  }

  getByAddress(chain: string, address: `0x${string}`): Token | undefined {
    return this.tokensByAddress.get(`${chain}:${address.toLowerCase()}`);
  }

  getAll(chain?: string): Token[] {
    const values = [...this.tokens.values()];

    if (!chain) return values;

    return values.filter((token) => token.chain === chain);
  }
}

export const tokenRegistry = new TokenRegistry();