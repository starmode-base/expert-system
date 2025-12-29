import { fetchAlphaVantageEarningsTranscript } from "~/lib/earnings-transcripts";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "META",
  year: 2025,
  quarter: 3,
});

console.log(result);
