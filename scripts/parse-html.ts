import {
  // fetchMacroVoicesTranscript,
  parseMacroVoicesList,
} from "~/inngest/importers/scheduled/macrovoices/macrovoices-helpers";

// import { fetchDwarkeshPodcastTranscript } from "~/inngest/importers/scrapers/dwarkesh-podcast";
const url = process.argv[2];

if (!url) {
  console.error("Usage: pnpm tsx scripts/parse-html.ts <url>");
  process.exit(1);
}

try {
  //   const text = await fetchDwarkeshPodcastTranscript(url);
  // const text = await fetchMacroVoicesTranscript(url);

  const baseUrl = "https://www.macrovoices.com";
  const listUrl = `${baseUrl}/podcast-transcripts`;

  // Pull the transcript listing page for the latest episodes
  const res = await fetch(listUrl);
  const listHtml = await res.text();

  const text = parseMacroVoicesList(listHtml, baseUrl);

  console.log(text);
} catch (error) {
  console.error("Failed to extract body text", error);
  process.exit(1);
}
