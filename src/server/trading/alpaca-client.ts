import Alpaca from "@alpacahq/alpaca-trade-api";
import { ensureEnv } from "~/lib/env";

export const alpacaClient = new Alpaca({
  baseUrl: "https://paper-api.alpaca.markets",
  keyId: ensureEnv("ALPACA_API_KEY"),
  secretKey: ensureEnv("ALPACA_SECRET_KEY"),
});
