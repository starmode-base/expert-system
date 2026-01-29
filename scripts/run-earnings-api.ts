import { fetchAlphaVantageEarningsTranscript } from "~/inngest/importers/scrapers/earnings-transcripts";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "V",
  year: 2026,
  quarter: 1,
});

console.log(result);
