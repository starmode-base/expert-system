import { fetchAlphaVantageEarningsTranscript } from "~/inngest/importers/scrapers/earnings-transcripts";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "META",
  year: 2025,
  quarter: 4,
});

console.log(result);
