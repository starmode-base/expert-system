import { fetchEarningsTranscript } from "~/lib/earnings-transcripts";

const result = await fetchEarningsTranscript({
  ticker: "AAPL",
  year: 2024,
  quarter: 1,
});

console.log(result);
