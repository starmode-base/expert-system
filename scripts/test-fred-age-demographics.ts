import {
  fetchLatestFredObservations,
  fetchFredSeriesMetadata,
  fetchMultipleFredSeries,
} from "~/inngest/insights/tool-functions/tools-fred";

const AGE_DEMOGRAPHIC_SERIES = [
  "LNS12300060", // Employment-Population Ratio: 20-24 yrs
  "LNS12300089", // Employment-Population Ratio: 25-34 yrs
  "LNS12300091", // Employment-Population Ratio: 25-54 yrs
  "LNS14000036", // Unemployment Rate: 20-24 yrs
  "LNS14000089", // Unemployment Rate: 25-34 yrs
] as const;

// Fetch metadata for each series to verify they resolve correctly
console.log("=== Series Metadata ===\n");
for (const seriesId of AGE_DEMOGRAPHIC_SERIES) {
  const metadata = await fetchFredSeriesMetadata(seriesId);
  console.log(`${seriesId}: ${metadata.title}`);
  console.log(`  Frequency: ${metadata.frequency}`);
  console.log(`  Units: ${metadata.units}`);
  console.log(`  Last Updated: ${metadata.last_updated}\n`);
}

// Fetch the latest 3 observations for each series individually
console.log("=== Latest 3 Observations (per series) ===\n");
for (const seriesId of AGE_DEMOGRAPHIC_SERIES) {
  const result = await fetchLatestFredObservations(seriesId, 3);
  console.log(`${seriesId} – ${result.description}`);
  for (const obs of result.data) {
    console.log(`  ${obs.date}: ${obs.value}`);
  }
  console.log();
}

// Fetch all series at once via the batch helper
console.log("=== Batch Fetch (latest 1 observation each) ===\n");
const batch = await fetchMultipleFredSeries([...AGE_DEMOGRAPHIC_SERIES], 1);
for (const [seriesId, entry] of Object.entries(batch)) {
  const latest = entry.data[0];
  console.log(
    `${seriesId}: ${latest?.value ?? "N/A"} (${latest?.date ?? "—"}) – ${entry.description}`,
  );
}

console.log("\nDone.");
process.exit(0);
