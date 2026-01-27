import { alpacaClient } from "./alpaca-client";
import { AlpacaAsset, AlpacaOrder, AlpacaPosition } from "./alpaca-types";

// const result = await alpacaClient.createOrder({
//   symbol: "AAPL",
//   qty: "1",
//   side: "buy",
//   type: "market",
//   time_in_force: "day",
// }) as AlpacaOrder;

// console.log(result);

// // Submit a limit order to attempt to sell 1 share of AMD at a
// // particular price ($20.50) when the market opens
// const sellOrder = await alpacaClient.createOrder({
//   symbol: "AMD",
//   qty: "1",
//   side: "sell",
//   type: "limit",
//   time_in_force: "opg",
//   limit_price: "20.5",
// }) as AlpacaOrder;
// console.log(sellOrder);

// const orders = (await alpacaClient.getOrders({
//   status: "all",
//   limit: 100,
//   nested: null,
//   until: null,
//   after: null,
//   direction: "asc",
//   symbols: null,
// })) as AlpacaOrder[];

// console.log(orders);

// const assests = (await alpacaClient.getAssets({
//   status: "active",
// })) as AlpacaAsset[];

// const asset = (await alpacaClient.getAsset("AAPL")) as AlpacaAsset;

// console.log(asset);

//get positions
// The current price reflected will be based on the following:
// 4:00 am ET - 9:30 am ET - Last trade based on the premarket
// 9:30 am ET - 4pm ET - Last trade
// 4:00 pm ET - 10:00 pm ET - Last trade based on after-hours trading
// 10 pm ET - 4:00 am ET next trading day - Official closing price from the primary exchange at 4 pm ET.
const positions = (await alpacaClient.getPositions()) as AlpacaPosition[];

console.log(positions);
