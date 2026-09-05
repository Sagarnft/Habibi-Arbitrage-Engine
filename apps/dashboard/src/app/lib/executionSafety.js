"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateExecutionSafety = validateExecutionSafety;
function resolveTradeLimits({ minimumNotionalUsd, maxNotionalUsd, walletUsdtBalance, }) {
    const effectiveMinimum = Math.max(minimumNotionalUsd, 10);
    const effectiveMaximum = Math.max(maxNotionalUsd ?? 100, effectiveMinimum);
    if (walletUsdtBalance === null || walletUsdtBalance === undefined || !Number.isFinite(walletUsdtBalance)) {
        return { minimumNotionalUsd: effectiveMinimum, maximumNotionalUsd: effectiveMaximum };
    }
    return {
        minimumNotionalUsd: Math.min(effectiveMinimum, walletUsdtBalance),
        maximumNotionalUsd: Math.min(effectiveMaximum, walletUsdtBalance),
    };
}
function validateExecutionSafety({ amountUsd, minimumNotionalUsd, maxNotionalUsd, walletUsdtBalance, allowFlashloan, slippageBps, protectionScore, liveExecutionReady, walletConnected, readyRoutes, }) {
    const { minimumNotionalUsd: effectiveMinimum, maximumNotionalUsd: effectiveMaximum } = resolveTradeLimits({
        minimumNotionalUsd,
        maxNotionalUsd,
        walletUsdtBalance,
    });
    const flashloanEnabled = Boolean(allowFlashloan);
    if (!walletConnected) {
        return {
            allowed: false,
            reason: "Connect a wallet before executing.",
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (readyRoutes <= 0) {
        return {
            allowed: false,
            reason: "No execution-ready routes are available right now.",
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (!flashloanEnabled && walletUsdtBalance !== null && walletUsdtBalance !== undefined && Number.isFinite(walletUsdtBalance) && walletUsdtBalance < effectiveMinimum) {
        return {
            allowed: false,
            reason: `Wallet USDT balance ${walletUsdtBalance.toFixed(2)} is below the ${effectiveMinimum.toFixed(2)} USD minimum notional.`,
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (amountUsd < effectiveMinimum) {
        return {
            allowed: false,
            reason: `Trade size ${amountUsd.toFixed(0)} USD is below the ${effectiveMinimum.toFixed(2)} USD minimum notional.`,
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (!flashloanEnabled && walletUsdtBalance !== null && walletUsdtBalance !== undefined && Number.isFinite(walletUsdtBalance) && amountUsd > effectiveMaximum) {
        return {
            allowed: false,
            reason: `Trade size ${amountUsd.toFixed(2)} USD exceeds the wallet-capped maximum of ${effectiveMaximum.toFixed(2)} USDT.`,
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (slippageBps > 50) {
        return {
            allowed: false,
            reason: `Slippage tolerance ${slippageBps} bps exceeds the 50 bps safety cap.`,
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (protectionScore < 70) {
        return {
            allowed: false,
            reason: `Protection score ${protectionScore} is below the 70 threshold.`,
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    if (!liveExecutionReady) {
        return {
            allowed: false,
            reason: "Scanner is live, but no profitable route has been found yet.",
            minimumNotionalUsd: effectiveMinimum,
            maximumNotionalUsd: effectiveMaximum,
            slippageBps,
        };
    }
    return {
        allowed: true,
        reason: "Execution meets the configured safety thresholds.",
        minimumNotionalUsd: effectiveMinimum,
        maximumNotionalUsd: effectiveMaximum,
        slippageBps,
    };
}
