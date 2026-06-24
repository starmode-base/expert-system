import { fetchLatestCall, fetchTranscript } from "~/inngest/earnings";

const latest = await fetchLatestCall(process.argv[2] ?? "NVDA");
const transcript = await fetchTranscript(latest.providerCallId);

console.log({
  latest,
  transcriptLength: transcript.text.length,
});
