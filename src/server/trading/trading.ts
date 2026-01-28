import { alpacaClient } from "./alpaca-client";
import type {
  AlpacaAsset,
  AlpacaOrder,
  AlpacaPosition,
  GetAssetsParams,
  GetOrdersParams,
  SubmitOrderRequest,
} from "./trading-types";

/**
 * Create a new order for the trading account
 *
 * Params
 * - symbol - Symbol, asset id, or currency pair. Required for all order classes except mleg
 * - qty - Number of shares to trade. Fractional only for market + day. Required for mleg
 * - notional - Dollar amount to trade. Cannot be used with qty. Market + day only
 * - side - Order side. buy or sell. Required for all order classes except mleg
 * - type - Order type. market, limit, stop, stop_limit, or trailing_stop
 * - time_in_force - Time in force. day, gtc, opg, cls, ioc, or fok
 * - limit_price - Limit price for limit or stop_limit orders
 * - stop_price - Stop price for stop or stop_limit orders
 * - trail_price - Trailing stop price
 * - trail_percent - Trailing stop percent
 * - client_order_id - Client supplied order id
 * - order_class - Order class. simple, bracket, oco, oto, or mleg
 * - extended_hours - Whether the order is allowed in extended hours
 * - position_intent - Options position intent. buy_to_open, buy_to_close, sell_to_open, or sell_to_close
 * - take_profit - Bracket take profit configuration
 * - stop_loss - Bracket stop loss configuration
 *
 * Docs: https://docs.alpaca.markets/reference/postorder
 */
export async function createOrder(
  request: SubmitOrderRequest,
): Promise<AlpacaOrder> {
  const order = (await alpacaClient.createOrder(request)) as AlpacaOrder;

  return order;
}

/**
 * Retrieve orders for the trading account
 *
 * Params
 * - status - Order status to be queried. open, closed, or all. Defaults to open.
 * - limit - Max number of orders to return. Defaults to 50.
 * - after - Filter by orders after the given timestamp
 * - until - Filter by orders until the given timestamp
 * - direction - Sort direction. asc or desc. Defaults to desc.
 * - nested - If true, include multi-leg orders nested under the parent order
 * - symbols - Filter by comma separated symbols
 * - side - Filter by order side. buy or sell
 *
 * Docs: https://docs.alpaca.markets/reference/getallorders-1
 */
export async function getOrders(
  params: GetOrdersParams = {},
): Promise<AlpacaOrder[]> {
  const request = {
    status: params.status ?? "open",
    until: params.until ?? null,
    after: params.after ?? null,
    limit: params.limit ?? 50,
    direction: params.direction ?? "desc",
    nested: params.nested ?? null,
    symbols: params.symbols ?? null,
    side: params.side ?? null,
  } as Parameters<typeof alpacaClient.getOrders>[0];

  const orders = (await alpacaClient.getOrders(request)) as AlpacaOrder[];

  return orders;
}

/**
 * Retrieve the list of tradable assets
 *
 * Params
 * - status - Asset status. active or inactive.
 * - asset_class - Asset class. us_equity, us_option, or crypto.
 * - exchange - Filter by exchange code
 *
 * Docs: https://docs.alpaca.markets/reference/get-v2-assets-1
 */
export async function getAssets(
  params?: GetAssetsParams,
): Promise<AlpacaAsset[]> {
  return (await alpacaClient.getAssets(params)) as AlpacaAsset[];
}

/**
 * Retrieve an asset by symbol or asset id
 *
 * Params
 * - symbolOrAssetId - Asset symbol or asset id
 *
 * Docs: https://docs.alpaca.markets/reference/get-v2-assets-symbol_or_asset_id
 */
export async function getAsset(symbolOrAssetId: string): Promise<AlpacaAsset> {
  return (await alpacaClient.getAsset(symbolOrAssetId)) as AlpacaAsset;
}

/**
 * Retrieve all open positions for the account

 *
 * Docs: https://docs.alpaca.markets/docs/working-with-positions
 */
export async function getPositions(): Promise<AlpacaPosition[]> {
  return (await alpacaClient.getPositions()) as AlpacaPosition[];
}
