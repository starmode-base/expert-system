import { fetchAlphaVantageEarningsTranscript } from "~/backend/importers/scrapers/earnings-transcripts";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "META",
  year: 2025,
  quarter: 3,
});

console.log(result);
