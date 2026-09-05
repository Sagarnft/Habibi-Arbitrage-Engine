import { tokenRegistry } from "./registry.js";
import { initializeTokenRegistry } from "./init.js";

function findToken(chain: string, address: `0x${string}`) {
  const normalizedAddress = address.toLowerCase();
  const directMatch = tokenRegistry.getByAddress(chain, normalizedAddress as `0x${string}`);

  if (directMatch) {
    return directMatch;
  }

  initializeTokenRegistry();

  return tokenRegistry.getByAddress(chain, normalizedAddress as `0x${string}`);
}


export function getTokenDecimals(
  chain: string,
  address: `0x${string}`,
): number {

  const token = findToken(chain, address);


  if (!token) {
    throw new Error(
      `Token not found: ${address}`,
    );
  }


  return token.decimals;
}



function getTradeSize(
  symbol: string,
): number {

  switch (symbol) {

    case "USDC":
    case "USDT":
    case "DAI":
      return 10;


    case "WETH":
    case "ETH":
      return 0.1;


    case "WBTC":
      return 0.001;


    default:
      return 1;
  }
}



export function buildAmountIn(
  chain: string,
  address: `0x${string}`,
): bigint {


  const token = findToken(chain, address);


  if (!token) {
    throw new Error(
      `Token not found: ${address}`,
    );
  }



  const size =
    getTradeSize(
      token.symbol,
    );



  const decimals =
    token.decimals;



  return BigInt(
    Math.floor(
      size * (10 ** decimals),
    ),
  );
}