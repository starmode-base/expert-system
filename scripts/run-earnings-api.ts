import { fetchAlphaVantageEarningsTranscript } from "~/inngest/earnings";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "V",
  year: 2026,
  quarter: 1,
});

console.log(result);
