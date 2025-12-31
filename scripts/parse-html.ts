import { fetchDwarkeshPodcastTranscript } from "~/inngest/importers/scrapers/dwarkesh-podcast";

const url = process.argv[2];

if (!url) {
  console.error("Usage: pnpm tsx scripts/parse-html.ts <url>");
  process.exit(1);
}

try {
  const text = await fetchDwarkeshPodcastTranscript(url);
  console.log(text);
} catch (error) {
  console.error("Failed to extract body text", error);
  process.exit(1);
}
