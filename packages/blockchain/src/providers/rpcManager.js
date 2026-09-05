import { createPublicClient, http, } from "viem";
import { CHAINS } from "../chains.js";
import { RPC } from "../config.js";
const FAILURE_LIMIT = Number(process.env.RPC_FAILURE_LIMIT ?? 3);
const FAILURE_COOLDOWN_MS = Number(process.env.RPC_FAILURE_COOLDOWN_MS ?? 120_000);
export class RpcManager {
    rotation = new Map();
    clientCache = new Map();
    endpointHealth = new Map();
    lastSelected = new Map();
    getEndpoints(chain) {
        const urls = RPC[chain];
        return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
    }
    getCandidateUrls(chain) {
        return this.getEndpoints(chain);
    }
    getHealthKey(chain, url) {
        return `${chain}:${url}`;
    }
    getEndpointHealth(chain, url) {
        return this.endpointHealth.get(this.getHealthKey(chain, url)) ?? {
            failures: 0,
            successes: 0,
            cooldownUntil: 0,
        };
    }
    scoreEndpoint(chain, url) {
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
    rememberSelection(chain, url) {
        this.lastSelected.set(chain, url);
    }
    getSelectedUrl(chain) {
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
    getLastSelectedUrl(chain) {
        return this.lastSelected.get(chain);
    }
    getChainHealthSnapshot(chain) {
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
    async getLatestBlockNumber(chain) {
        const client = this.getClient(chain);
        const blockNumber = await client.getBlockNumber();
        return Number(blockNumber);
    }
    getAllChainHealthSnapshots(chains) {
        return chains.map((chain) => this.getChainHealthSnapshot(chain));
    }
    getHealthyChainNames(chains) {
        return this.getAllChainHealthSnapshots(chains)
            .filter((snapshot) => snapshot.healthy > 0)
            .map((snapshot) => snapshot.chain);
    }
    getClient(chain) {
        const url = this.getSelectedUrl(chain);
        return this.getClientForUrl(chain, url);
    }
    getClientForUrl(chain, url) {
        const cacheKey = `${chain}:${url}`;
        const cached = this.clientCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const client = createPublicClient({
            chain: CHAINS[chain],
            transport: http(url, { retryCount: 0 }),
        });
        this.clientCache.set(cacheKey, client);
        return client;
    }
    markHealthy(chain, url, latency) {
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
    markFailure(chain, url) {
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
