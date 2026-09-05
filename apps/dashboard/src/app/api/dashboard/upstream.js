"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUpstreamBaseUrl = resolveUpstreamBaseUrl;
function resolveUpstreamBaseUrl() {
    // Support environment variables
    const envUrl = process.env.BLOCKCHAIN_API_URL ?? process.env.NEXT_PUBLIC_BLOCKCHAIN_API_URL;
    if (envUrl) {
        return envUrl;
    }
    // Server-side: use direct localhost
    if (typeof window === 'undefined') {
        return "http://localhost:4000";
    }
    // Client-side: use proxy endpoint
    return "/api/blockchain";
}
