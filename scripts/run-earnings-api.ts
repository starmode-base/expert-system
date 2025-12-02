import { fetchAlphaVantageEarningsTranscript } from "~/lib/earnings-transcripts";

const result = await fetchAlphaVantageEarningsTranscript({
  symbol: "IBM",
  year: 2024,
  quarter: 1,
});

console.log(result);
