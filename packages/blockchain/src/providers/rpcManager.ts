import {
  createPublicClient,
  http,
  type PublicClient,
} from "viem";

import { CHAINS, type ChainName } from "../chains.js";
import { RPC } from "../config.js";

type EndpointHealth = {
  failures: number;
  successes: number;
  cooldownUntil: number;
  lastLatency?: number;
  lastUsedAt?: number;
};

export type RpcEndpointSnapshot = EndpointHealth & {
  url: string;
  selected: boolean;
  inCooldown: boolean;
};

export type RpcChainHealthSnapshot = {
  chain: ChainName;
  selectedUrl?: string;
  total: number;
  healthy: number;
  offline: number;
  overall: "healthy" | "degraded" | "offline";
  endpoints: RpcEndpointSnapshot[];
};

const FAILURE_LIMIT = Number(process.env.RPC_FAILURE_LIMIT ?? 3);
const FAILURE_COOLDOWN_MS = Number(process.env.RPC_FAILURE_COOLDOWN_MS ?? 120_000);

export class RpcManager {
  private readonly rotation = new Map<ChainName, number>();
  private readonly clientCache = new Map<string, PublicClient>();
  private readonly endpointHealth = new Map<string, EndpointHealth>();
  private readonly lastSelected = new Map<ChainName, string>();

  private getEndpoints(chain: ChainName): string[] {
    const urls = RPC[chain];
    return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  }

  public getCandidateUrls(chain: ChainName): readonly string[] {
    return this.getEndpoints(chain);
  }

  private getHealthKey(chain: ChainName, url: string): string {
    return `${chain}:${url}`;
  }

  private getEndpointHealth(chain: ChainName, url: string): EndpointHealth {
    return this.endpointHealth.get(this.getHealthKey(chain, url)) ?? {
      failures: 0,
      successes: 0,
      cooldownUntil: 0,
    };
  }

  private scoreEndpoint(chain: ChainName, url: string): number {
    const health = this.getEndpointHealth(chain, url);
    let score = health.successes * 10 - health.failures * 20;

    if (health.cooldownUntil > Date.now()) {
      score -= 1_000;
    }

    if (health.lastLatency && health.lastLatency > 0) {
      score -= Math.min(health.lastLatency, 2_000) / 25;
    }

    return score;
  }

  private rememberSelection(chain: ChainName, url: string) {
    this.lastSelected.set(chain, url);
  }

  public getSelectedUrl(chain: ChainName): string {
    const urls = this.getEndpoints(chain);
    if (!urls.length) {
      throw new Error(`RPC missing for ${chain}`);
    }

    const healthyUrls = urls.filter((url) => this.getEndpointHealth(chain, url).cooldownUntil <= Date.now());
    const pool = healthyUrls.length ? healthyUrls : urls;
    const currentIndex = this.rotation.get(chain) ?? 0;

    const ranked = pool
      .slice()
      .sort((left, right) => this.scoreEndpoint(chain, right) - this.scoreEndpoint(chain, left));
    const selected = ranked[currentIndex % ranked.length] ?? ranked[0];
    if (!selected) {
      throw new Error(`RPC missing for ${chain}`);
    }

    this.rotation.set(chain, (currentIndex + 1) % Math.max(ranked.length, 1));
    this.rememberSelection(chain, selected);
    return selected;
  }

  public getLastSelectedUrl(chain: ChainName): string | undefined {
    return this.lastSelected.get(chain);
  }

  public getChainHealthSnapshot(chain: ChainName): RpcChainHealthSnapshot {
    const urls = this.getEndpoints(chain);
    const selectedUrl = this.getLastSelectedUrl(chain);
    const endpoints = urls.map((url) => {
      const health = this.getEndpointHealth(chain, url);
      const inCooldown = health.cooldownUntil > Date.now();
      return {
        url,
        selected: selectedUrl === url,
        inCooldown,
        ...health,
      };
    });
    const healthy = endpoints.filter((endpoint) => !endpoint.inCooldown && endpoint.successes > 0).length;
    const offline = endpoints.length - healthy;
    const overall = endpoints.length === 0
      ? "offline"
      : healthy === endpoints.length
        ? "healthy"
        : healthy > 0
          ? "degraded"
          : "offline";

    return {
      chain,
      selectedUrl,
      total: endpoints.length,
      healthy,
      offline,
      overall,
      endpoints,
    };
  }

  public async getLatestBlockNumber(chain: ChainName): Promise<number> {
    const client = this.getClient(chain);
    const blockNumber = await client.getBlockNumber();
    return Number(blockNumber);
  }

  public getAllChainHealthSnapshots(chains: ChainName[]): RpcChainHealthSnapshot[] {
    return chains.map((chain) => this.getChainHealthSnapshot(chain));
  }

  public getHealthyChainNames(chains: ChainName[]): ChainName[] {
    return this.getAllChainHealthSnapshots(chains)
      .filter((snapshot) => snapshot.healthy > 0)
      .map((snapshot) => snapshot.chain);
  }

  public getClient(chain: ChainName): PublicClient {
    const url = this.getSelectedUrl(chain);
    return this.getClientForUrl(chain, url);
  }

  public getClientForUrl(chain: ChainName, url: string): PublicClient {
    const cacheKey = `${chain}:${url}`;
    const cached = this.clientCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = createPublicClient({
      chain: CHAINS[chain],
      transport: http(url, { retryCount: 0 }),
    }) as PublicClient;
    this.clientCache.set(cacheKey, client);
    return client;
  }

  public markHealthy(chain: ChainName, url: string, latency: number) {
    const key = this.getHealthKey(chain, url);
    const current = this.getEndpointHealth(chain, url);
    this.endpointHealth.set(key, {
      failures: 0,
      successes: current.successes + 1,
      cooldownUntil: 0,
      lastLatency: latency,
      lastUsedAt: Date.now(),
    });
  }

  public markFailure(chain: ChainName, url: string) {
    const key = this.getHealthKey(chain, url);
    const current = this.getEndpointHealth(chain, url);
    const failures = current.failures + 1;
    this.endpointHealth.set(key, {
      failures,
      successes: current.successes,
      cooldownUntil: failures >= FAILURE_LIMIT
        ? Date.now() + FAILURE_COOLDOWN_MS
        : current.cooldownUntil,
      lastLatency: current.lastLatency,
      lastUsedAt: Date.now(),
    });
  }
}

export const rpcManager = new RpcManager();
