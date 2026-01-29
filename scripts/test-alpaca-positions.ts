import { getBitcoinPrice } from "~/server/trading/market-data";
import { getOrders, getPositions } from "~/server/trading/trading";

const positions = await getPositions();
console.log(`Retrieved ${positions.length} positions`);
console.log(positions);

const orders = await getOrders();
console.log(`Retrieved ${orders.length} orders`);
console.log(orders);

const bitcoinPrice = await getBitcoinPrice();
console.log(`Bitcoin price:`, bitcoinPrice);
