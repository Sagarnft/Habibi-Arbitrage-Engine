const DEFAULT_ACTIVE_DEXES_BY_CHAIN: Record<string, string[]> = {
  ethereum: ["uniswap-v2", "uniswap-v3", "sushiswap", "curve", "balancer", "kyberswap", "odos", "openocean", "oneinch", "paraswap"],
  arbitrum: ["camelot", "sushiswap-arbitrum", "ramses", "zyberswap", "chronos", "uniswap-v3", "balancer"],
  bnb: ["pancakeswap-v2", "pancakeswap-v3", "biswap", "thena", "bakeryswap", "wombat", "mdex"],
  base: ["aerodrome", "baseswap", "sushiswap-base", "uniswap-base"],
  polygon: ["quickswap", "dfyn", "apeswap", "balancer-polygon", "uniswap-v3"],
  optimism: ["velodrome", "beethoven-x", "uniswap-optimism"],
  avalanche: ["trader-joe", "trader-joe-lb", "pangolin", "lydia"],
  zksync: ["syncswap", "mute", "velocore"],
  linea: ["syncswap-linea", "lynex"],
  scroll: ["ambient", "syncswap-scroll"],
};

const activeDexesByChain = new Map<string, Set<string>>();

export function normalizeDexKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getDefaultActiveDexes(chain: string): readonly string[] {
  const normalizedChain = normalizeDexKey(chain);
  return DEFAULT_ACTIVE_DEXES_BY_CHAIN[normalizedChain] ?? [];
}

export function recordActiveDexes(chain: string, dexes: Iterable<string>): void {
  const normalizedChain = normalizeDexKey(chain);
  const current = activeDexesByChain.get(normalizedChain) ?? new Set<string>();

  for (const dex of dexes) {
    const normalizedDex = normalizeDexKey(dex);
    if (normalizedDex) {
      current.add(normalizedDex);
    }
  }

  activeDexesByChain.set(normalizedChain, current);
}

export function getActiveDexes(chain: string): readonly string[] {
  const normalizedChain = normalizeDexKey(chain);
  const merged = new Set<string>(getDefaultActiveDexes(normalizedChain));

  for (const dex of activeDexesByChain.get(normalizedChain) ?? new Set<string>()) {
    merged.add(dex);
  }

  return Array.from(merged);
}

export function getAllActiveDexes(): readonly string[] {
  const allDexes = new Set<string>();

  for (const [chain, dexes] of activeDexesByChain.entries()) {
    for (const dex of getDefaultActiveDexes(chain)) {
      allDexes.add(dex);
    }
    for (const dex of dexes) {
      allDexes.add(dex);
    }
  }

  return [...allDexes];
}
