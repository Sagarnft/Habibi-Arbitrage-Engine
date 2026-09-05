import "dotenv/config";
function collectUrls(...values) {
    const normalized = values
        .flatMap((value) => (value ? value.split(",") : []))
        .map((value) => value.trim())
        .filter(Boolean);
    return [...new Set(normalized)];
}
function fromEnv(...names) {
    return names.flatMap((name) => {
        const value = process.env[name];
        return value ? value.split(",") : [];
    });
}
function chainEnvAliases(chainName, ...extraNames) {
    const normalizedChain = chainName.toUpperCase();
    const extras = extraNames.flatMap((name) => {
        const uppercase = name.toUpperCase();
        return [
            uppercase,
            `${uppercase}_RPC`,
            `${uppercase}_RPC_URL`,
            `${uppercase}_PROVIDER_URL`,
            `${uppercase}_PRIVATE_RPC`,
            `${uppercase}_PRIVATE_RPC_URL`,
        ];
    });
    const aliases = new Set([
        `${normalizedChain}_RPC`,
        `${normalizedChain}_RPC_URL`,
        `${normalizedChain}_PROVIDER_URL`,
        `${normalizedChain}_PRIVATE_RPC`,
        `${normalizedChain}_PRIVATE_RPC_URL`,
        `RPC_${normalizedChain}`,
        `RPC_URL_${normalizedChain}`,
        `PROVIDER_${normalizedChain}_URL`,
        `PRIVATE_${normalizedChain}_RPC`,
        `PRIVATE_RPC_${normalizedChain}`,
        ...extras,
    ]);
    return [...aliases];
}
export const RPC = {
    ethereum: collectUrls(...fromEnv(...chainEnvAliases("ethereum", "ETH", "ETHEREUM", "ALCHEMY_ETH_RPC", "ALCHEMY_ETHEREUM_RPC", "INFURA_ETH_RPC", "QUICKNODE_ETH_RPC", "CHAINSTACK_ETH_RPC")), "https://ethereum-rpc.publicnode.com", "https://ethereum.publicnode.com", "https://eth.drpc.org", "https://eth-mainnet.public.blastapi.io"),
    bnb: collectUrls(...fromEnv(...chainEnvAliases("bnb", "BSC", "ALCHEMY_BNB_RPC", "ALCHEMY_BSC_RPC", "QUICKNODE_BSC_RPC", "ANKR_BSC_RPC")), "https://bsc-rpc.publicnode.com", "https://bsc.publicnode.com", "https://bsc.drpc.org", "https://bsc-dataseed.binance.org", "https://bsc-dataseed1.binance.org", "https://bsc-dataseed2.binance.org"),
    base: collectUrls(...fromEnv(...chainEnvAliases("base", "ALCHEMY_BASE_RPC", "QUICKNODE_BASE_RPC", "INFURA_BASE_RPC")), "https://base-rpc.publicnode.com", "https://base.publicnode.com", "https://base.drpc.org", "https://mainnet.base.org"),
    arbitrum: collectUrls(...fromEnv(...chainEnvAliases("arbitrum", "ALCHEMY_ARBITRUM_RPC", "QUICKNODE_ARBITRUM_RPC", "INFURA_ARBITRUM_RPC")), "https://arbitrum-one-rpc.publicnode.com", "https://arbitrum.publicnode.com", "https://arbitrum.drpc.org", "https://arb1.arbitrum.io/rpc", "https://arb1.publicnode.com"),
    polygon: collectUrls(...fromEnv(...chainEnvAliases("polygon", "ALCHEMY_POLYGON_RPC", "QUICKNODE_POLYGON_RPC", "INFURA_POLYGON_RPC")), "https://polygon-bor-rpc.publicnode.com", "https://polygon.publicnode.com", "https://polygon.drpc.org", "https://polygon-bor.publicnode.com"),
    linea: collectUrls(...fromEnv(...chainEnvAliases("linea", "ALCHEMY_LINEA_RPC", "QUICKNODE_LINEA_RPC")), "https://rpc.linea.build", "https://linea.drpc.org"),
    scroll: collectUrls(...fromEnv(...chainEnvAliases("scroll", "ALCHEMY_SCROLL_RPC", "QUICKNODE_SCROLL_RPC")), "https://rpc.scroll.io", "https://scroll.blockpi.network/v1/rpc/public", "https://scroll.drpc.org"),
    zksync: collectUrls(...fromEnv(...chainEnvAliases("zksync", "ALCHEMY_ZKSYNC_RPC", "QUICKNODE_ZKSYNC_RPC")), "https://mainnet.era.zksync.io", "https://zksync-era.publicnode.com", "https://zksync.drpc.org"),
    avalanche: collectUrls(...fromEnv(...chainEnvAliases("avalanche", "ALCHEMY_AVALANCHE_RPC", "QUICKNODE_AVALANCHE_RPC")), "https://api.avax.network/ext/bc/C/rpc", "https://avalanche-c-chain-rpc.publicnode.com", "https://avax.drpc.org"),
    optimism: collectUrls(...fromEnv(...chainEnvAliases("optimism", "ALCHEMY_OPTIMISM_RPC", "QUICKNODE_OPTIMISM_RPC", "INFURA_OPTIMISM_RPC")), "https://mainnet.optimism.io", "https://optimism.publicnode.com", "https://optimism.drpc.org"),
    fantom: collectUrls(...fromEnv(...chainEnvAliases("fantom", "ALCHEMY_FANTOM_RPC", "QUICKNODE_FANTOM_RPC")), "https://rpc.ftm.tools", "https://fantom.publicnode.com", "https://fantom.drpc.org"),
    celo: collectUrls(...fromEnv(...chainEnvAliases("celo", "ALCHEMY_CELO_RPC", "QUICKNODE_CELO_RPC")), "https://forno.celo.org", "https://rpc.ankr.com/celo", "https://celo.drpc.org"),
    mantle: collectUrls(...fromEnv(...chainEnvAliases("mantle", "ALCHEMY_MANTLE_RPC", "QUICKNODE_MANTLE_RPC")), "https://rpc.mantle.xyz", "https://mantle.publicnode.com", "https://mantle.drpc.org"),
    blast: collectUrls(...fromEnv(...chainEnvAliases("blast", "ALCHEMY_BLAST_RPC", "QUICKNODE_BLAST_RPC")), "https://rpc.blast.io", "https://blast.publicnode.com", "https://blast.drpc.org"),
    mode: collectUrls(...fromEnv(...chainEnvAliases("mode", "ALCHEMY_MODE_RPC", "QUICKNODE_MODE_RPC")), "https://mainnet.mode.network", "https://mode.publicnode.com", "https://mode.drpc.org"),
    sei: collectUrls(...fromEnv(...chainEnvAliases("sei", "ALCHEMY_SEI_RPC", "QUICKNODE_SEI_RPC")), "https://evm-rpc.sei.network", "https://sei.publicnode.com", "https://sei.drpc.org"),
    manta: collectUrls(...fromEnv(...chainEnvAliases("manta", "ALCHEMY_MANTA_RPC", "QUICKNODE_MANTA_RPC")), "https://pacific-rpc.manta.network/http", "https://manta.publicnode.com", "https://manta.drpc.org"),
    ronin: collectUrls(...fromEnv(...chainEnvAliases("ronin", "ALCHEMY_RONIN_RPC", "QUICKNODE_RONIN_RPC")), "https://api.roninchain.com/rpc", "https://ronin.publicnode.com", "https://ronin.drpc.org"),
    swell: collectUrls(...fromEnv(...chainEnvAliases("swell", "ALCHEMY_SWELL_RPC", "QUICKNODE_SWELL_RPC")), "https://swell-mainnet.alt.technology", "https://swell.publicnode.com", "https://swell.drpc.org"),
    taiko: collectUrls(...fromEnv(...chainEnvAliases("taiko", "ALCHEMY_TAIKO_RPC", "QUICKNODE_TAIKO_RPC")), "https://rpc.mainnet.taiko.xyz", "https://taiko.publicnode.com", "https://taiko.drpc.org"),
    worldchain: collectUrls(...fromEnv(...chainEnvAliases("worldchain", "ALCHEMY_WORLDCHAIN_RPC", "QUICKNODE_WORLDCHAIN_RPC")), "https://worldchain-mainnet.g.alchemy.com/public", "https://worldchain.publicnode.com", "https://worldchain.drpc.org"),
    berachain: collectUrls(...fromEnv(...chainEnvAliases("berachain", "ALCHEMY_BERACHAIN_RPC", "QUICKNODE_BERACHAIN_RPC")), "https://rpc.berachain.com", "https://berachain.publicnode.com", "https://berachain.drpc.org"),
    sonic: collectUrls(...fromEnv(...chainEnvAliases("sonic", "ALCHEMY_SONIC_RPC", "QUICKNODE_SONIC_RPC")), "https://rpc.soniclabs.com", "https://sonic.publicnode.com", "https://sonic.drpc.org"),
    coredao: collectUrls(...fromEnv(...chainEnvAliases("coredao", "ALCHEMY_COREDAO_RPC", "QUICKNODE_COREDAO_RPC")), "https://rpc.coredao.org", "https://core.publicnode.com", "https://core.drpc.org"),
};
