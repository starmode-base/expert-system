// -------------------------------------------------------
// Account
// -------------------------------------------------------

export interface AlpacaAccountSummary {
  id: string;
  admin_configurations: Record<string, unknown>;
  user_configurations: Record<string, unknown> | null;
  account_number: string;
  status: string;
  crypto_status: string;
  options_approved_level: number;
  options_trading_level: number;
  currency: string;
  buying_power: string;
  regt_buying_power: string;
  daytrading_buying_power: string;
  effective_buying_power: string;
  non_marginable_buying_power: string;
  options_buying_power: string;
  bod_dtbp: string;
  cash: string;
  accrued_fees: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  position_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  last_maintenance_margin: string;
  sma: string;
  daytrade_count: number;
  balance_asof: string;
  crypto_tier: number;
  intraday_adjustments: string;
  pending_reg_taf_fees: string;
}

// -------------------------------------------------------
// Orders
// -------------------------------------------------------

export type OrderSide = "buy" | "sell";

export type OrderType =
  | "market"
  | "limit"
  | "stop"
  | "stop_limit"
  | "trailing_stop";

export type TimeInForce = "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";

export type OrderClass = "simple" | "bracket" | "oco" | "oto" | "mleg";

export type OrderStatus =
  | "new"
  | "partially_filled"
  | "filled"
  | "done_for_day"
  | "canceled"
  | "expired"
  | "replaced"
  | "pending_cancel"
  | "pending_replace"
  | "accepted"
  | "pending_new"
  | "accepted_for_bidding"
  | "stopped"
  | "rejected"
  | "suspended"
  | "calculated";

export type PositionIntent =
  | "buy_to_open"
  | "buy_to_close"
  | "sell_to_open"
  | "sell_to_close";

export type AssetClass = "us_equity" | "us_option" | "crypto";

export interface TakeProfitRequest {
  limit_price: string;
}

export interface StopLossRequest {
  stop_price: string;
  limit_price?: string;
}

export interface SubmitOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  time_in_force: TimeInForce;
  qty?: string;
  notional?: string;
  limit_price?: string;
  stop_price?: string;
  trail_price?: string;
  trail_percent?: string;
  client_order_id?: string;
  order_class?: OrderClass;
  extended_hours?: boolean;
  position_intent?: PositionIntent;
  take_profit?: TakeProfitRequest;
  stop_loss?: StopLossRequest;
}

export interface ReplaceOrderRequest {
  qty?: string;
  time_in_force?: TimeInForce;
  limit_price?: string;
  stop_price?: string;
  trail?: string;
  client_order_id?: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string | null;
  submitted_at: string | null;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
  replaced_by: string | null;
  replaces: string | null;
  asset_id: string;
  symbol: string;
  asset_class: AssetClass;
  notional: string | null;
  qty: string | null;
  filled_qty: string;
  filled_avg_price: string | null;
  order_class: OrderClass | "";
  order_type: OrderType;
  type: OrderType;
  side: OrderSide;
  time_in_force: TimeInForce;
  limit_price: string | null;
  stop_price: string | null;
  status: OrderStatus;
  extended_hours: boolean;
  legs: AlpacaOrder[] | null;
  trail_percent: string | null;
  trail_price: string | null;
  hwm: string | null;
  position_intent: PositionIntent | null;
}

export type GetOrdersStatus = "open" | "closed" | "all";

export type GetOrdersDirection = "asc" | "desc";

export interface GetOrdersParams {
  status?: GetOrdersStatus;
  limit?: number;
  after?: string;
  until?: string;
  direction?: GetOrdersDirection;
  nested?: boolean;
  symbols?: string;
  side?: OrderSide;
}

// -------------------------------------------------------
// Assets
// -------------------------------------------------------

export type AssetStatus = "active" | "inactive";

export interface GetAssetsParams {
  status?: AssetStatus;
  asset_class?: AssetClass;
  exchange?: string;
}

export interface AlpacaAsset {
  id: string;
  class: AssetClass;
  exchange: string;
  symbol: string;
  name: string;
  status: AssetStatus;
  tradable: boolean;
  marginable: boolean;
  maintenance_margin_requirement: number;
  margin_requirement_long: string;
  margin_requirement_short: string;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
  attributes: string[];
}

// -------------------------------------------------------
// Positions
// -------------------------------------------------------

export type PositionSide = "long" | "short";

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: AssetClass;
  qty: string;
  qty_available?: string;
  avg_entry_price: string;
  side: PositionSide;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}
