import { fetchAlphaVantageEarningsTranscript } from "~/lib/earnings-transcripts";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "OPTT",
  year: 2025,
  quarter: 1,
});

console.log(result);
