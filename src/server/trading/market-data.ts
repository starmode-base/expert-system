import { alpacaClient } from "./alpaca-client";

interface AlpacaLatestTrade {
  Price?: number;
}

/**
 * Get current stock price for a ticker
 *
 * Uses the latest trade price from Alpaca market data
 */
export async function getCurrentStockPriceByTicker(
  ticker: string,
): Promise<number> {
  const trade = (await alpacaClient.getLatestTrade(ticker)) as
    | AlpacaLatestTrade
    | null
    | undefined;

  if (!trade || typeof trade.Price !== "number") {
    throw new Error(`No latest trade price available for ${ticker}`);
  }

  return trade.Price;
}

/**
 * Get the latest Bitcoin price
 */
export async function getBitcoinPrice(): Promise<number> {
  const symbol = "BTC/USD";
  const trades = (await alpacaClient.getLatestCryptoTrades([symbol])) as Map<
    string,
    AlpacaLatestTrade
  >;
  const trade = trades.get(symbol);

  if (!trade || typeof trade.Price !== "number") {
    throw new Error("No latest Bitcoin price available");
  }

  return trade.Price;
}
