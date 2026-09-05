import { defineChain } from "viem";
import { mainnet, bsc, base, arbitrum, polygon, linea, scroll, zkSync, avalanche, optimism, } from "viem/chains";
const fantom = defineChain({
    id: 250,
    name: "Fantom Opera",
    nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.ftm.tools", "https://fantom.publicnode.com", "https://fantom.drpc.org"] },
    },
    blockExplorers: { default: { name: "FTMScan", url: "https://ftmscan.com" } },
});
const celo = defineChain({
    id: 42220,
    name: "Celo",
    nativeCurrency: { name: "Celo", symbol: "CELO", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://forno.celo.org", "https://rpc.ankr.com/celo", "https://celo.drpc.org"] },
    },
    blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});
const mantle = defineChain({
    id: 5000,
    name: "Mantle",
    nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.mantle.xyz", "https://mantle.publicnode.com", "https://mantle.drpc.org"] },
    },
    blockExplorers: { default: { name: "Mantlescan", url: "https://mantlescan.xyz" } },
});
const blast = defineChain({
    id: 81457,
    name: "Blast",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.blast.io", "https://blast.publicnode.com", "https://blast.drpc.org"] },
    },
    blockExplorers: { default: { name: "Blastscan", url: "https://blastscan.io" } },
});
const mode = defineChain({
    id: 34443,
    name: "Mode",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://mainnet.mode.network", "https://mode.publicnode.com", "https://mode.drpc.org"] },
    },
    blockExplorers: { default: { name: "Mode Explorer", url: "https://explorer.mode.network" } },
});
const sei = defineChain({
    id: 1329,
    name: "Sei",
    nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://evm-rpc.sei.network", "https://sei.publicnode.com", "https://sei.drpc.org"] },
    },
    blockExplorers: { default: { name: "Sei Explorer", url: "https://seiscan.io" } },
});
const manta = defineChain({
    id: 169,
    name: "Manta Pacific",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://pacific-rpc.manta.network/http", "https://manta.publicnode.com", "https://manta.drpc.org"] },
    },
    blockExplorers: { default: { name: "Manta Explorer", url: "https://pacific-explorer.manta.network" } },
});
const ronin = defineChain({
    id: 2020,
    name: "Ronin",
    nativeCurrency: { name: "RON", symbol: "RON", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://api.roninchain.com/rpc", "https://ronin.publicnode.com", "https://ronin.drpc.org"] },
    },
    blockExplorers: { default: { name: "Ronin Explorer", url: "https://app.roninchain.com" } },
});
const swell = defineChain({
    id: 1923,
    name: "Swell",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://swell-mainnet.alt.technology", "https://swell.publicnode.com", "https://swell.drpc.org"] },
    },
    blockExplorers: { default: { name: "Swell Explorer", url: "https://explorer.swellnetwork.io" } },
});
const taiko = defineChain({
    id: 167000,
    name: "Taiko",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.mainnet.taiko.xyz", "https://taiko.publicnode.com", "https://taiko.drpc.org"] },
    },
    blockExplorers: { default: { name: "Taiko Explorer", url: "https://taikoscan.io" } },
});
const worldchain = defineChain({
    id: 480,
    name: "World Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://worldchain-mainnet.g.alchemy.com/public", "https://worldchain.publicnode.com", "https://worldchain.drpc.org"] },
    },
    blockExplorers: { default: { name: "World Chain Explorer", url: "https://worldchain-mainnet.explorer.alchemy.com" } },
});
const berachain = defineChain({
    id: 80094,
    name: "Berachain",
    nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.berachain.com", "https://berachain.publicnode.com", "https://berachain.drpc.org"] },
    },
    blockExplorers: { default: { name: "Berachain Explorer", url: "https://berascan.com" } },
});
const sonic = defineChain({
    id: 146,
    name: "Sonic",
    nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.soniclabs.com", "https://sonic.publicnode.com", "https://sonic.drpc.org"] },
    },
    blockExplorers: { default: { name: "Sonic Explorer", url: "https://sonicscan.org" } },
});
const coredao = defineChain({
    id: 1116,
    name: "Core",
    nativeCurrency: { name: "Core", symbol: "CORE", decimals: 18 },
    rpcUrls: {
        default: { http: ["https://rpc.coredao.org", "https://core.publicnode.com", "https://core.drpc.org"] },
    },
    blockExplorers: { default: { name: "CoreScan", url: "https://scan.coredao.org" } },
});
export const CHAINS = {
    ethereum: mainnet,
    bnb: bsc,
    base,
    arbitrum,
    polygon,
    optimism,
    avalanche,
    fantom,
    celo,
    mantle,
    blast,
    linea,
    scroll,
    zksync: zkSync,
    mode,
    sei,
    manta,
    ronin,
    swell,
    taiko,
    worldchain,
    berachain,
    sonic,
    coredao,
};
export const CHAIN_LIST = Object.keys(CHAINS);
