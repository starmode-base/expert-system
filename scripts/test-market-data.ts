import { alpacaClient } from "~/server/trading/alpaca-client";
import {
  getBitcoinPrice,
  getCurrentStockPriceByTicker,
} from "~/server/trading/market-data";

const args = process.argv.slice(2);
const tickerArg = args.find((arg) => arg.startsWith("--ticker="));

const ticker = tickerArg ?? "AAPL";

const stockPrice = await getCurrentStockPriceByTicker(ticker);
console.log(`Stock ${ticker} price:`, stockPrice);

const bitcoinPrice = await getBitcoinPrice();
console.log("Bitcoin price:", bitcoinPrice);

const trade = await alpacaClient.getLatestTrade(ticker);
console.log("Trade:", trade);
