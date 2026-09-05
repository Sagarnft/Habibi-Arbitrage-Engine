import type { PublicClient } from "viem";
import { rpcManager } from "./rpcManager.js";
import { ChainName } from "../chains.js";

type RpcHealth = {
  latency: number;
  healthy: boolean;
  lastChecked: number;
  failureCount?: number;
  cooldownUntil?: number;
};

export type HealthSummary = {
  total: number;
  healthy: number;
  offline: number;
  overall: "healthy" | "degraded" | "offline";
};

class HealthMonitor {
  private status = new Map<string, RpcHealth>();
  private readonly failureLimit = Number(process.env.RPC_FAILURE_LIMIT ?? 3);
  private readonly cooldownMs = Number(process.env.RPC_FAILURE_COOLDOWN_MS ?? 120_000);

  public async check(chain: ChainName) {
    const urls = [...rpcManager.getCandidateUrls(chain)];
    const previous = this.status.get(chain);

    for (const url of urls) {
      const client: PublicClient = rpcManager.getClientForUrl(chain, url);
      const start = Date.now();

      try {
        await client.getBlockNumber();

        rpcManager.markHealthy(chain, url, Date.now() - start);
        this.status.set(chain, {
          latency: Date.now() - start,
          healthy: true,
          lastChecked: Date.now(),
          failureCount: 0,
          cooldownUntil: 0,
        });
        return;
      } catch {
        rpcManager.markFailure(chain, url);
      }
    }

    const failureCount = (previous?.failureCount ?? 0) + 1;
    const shouldStayHealthy = previous?.healthy === true && failureCount < this.failureLimit;
    this.status.set(chain, {
      latency: shouldStayHealthy ? (previous?.latency ?? -1) : -1,
      healthy: shouldStayHealthy,
      lastChecked: Date.now(),
      failureCount,
      cooldownUntil: shouldStayHealthy
        ? 0
        : failureCount >= this.failureLimit
        ? Date.now() + this.cooldownMs
        : previous?.cooldownUntil ?? 0,
    });
  }

  public async checkAll(chains: ChainName[]) {
    await Promise.all(chains.map((chain) => this.check(chain)));
  }

  public getStatus() {
    return Object.fromEntries(this.status);
  }

  public setStatus(chain: ChainName, health: RpcHealth) {
    const previous = this.status.get(chain);
    if (health.healthy) {
      this.status.set(chain, {
        ...health,
        failureCount: 0,
        cooldownUntil: 0,
      });
      return;
    }

    const failureCount = (health.failureCount ?? previous?.failureCount ?? 0) + 1;
    this.status.set(chain, {
      ...health,
      failureCount,
      cooldownUntil: health.cooldownUntil ?? (
        failureCount >= this.failureLimit
          ? Date.now() + this.cooldownMs
          : previous?.cooldownUntil ?? 0
      ),
    });
  }

  public reset() {
    this.status.clear();
  }

  public getSummary(): HealthSummary {
    const entries = Array.from(this.status.values());
    const healthy = entries.filter((entry) => entry.healthy).length;
    const offline = entries.length - healthy;

    let overall: HealthSummary["overall"] = "offline";
    if (entries.length === 0) {
      overall = "offline";
    } else if (healthy === entries.length) {
      overall = "healthy";
    } else {
      overall = "degraded";
    }

    return {
      total: entries.length,
      healthy,
      offline,
      overall,
    };
  }

  public isTemporarilyDisabled(chain: string): boolean {
    const status = this.status.get(chain);
    return Boolean(status && !status.healthy && (status.cooldownUntil ?? 0) > Date.now());
  }
}

export const healthMonitor = new HealthMonitor();