import {
  fetchFredObservations,
  fetchFredSeriesInfo,
} from "~/server/fred-data-api/fred-api";

const args = process.argv.slice(2);
const seriesArg = args.find((arg) => arg.startsWith("--series="));
const seriesId = seriesArg?.split("=")[1] ?? "SIPOVGINIUSA";

console.log(`\n── Series metadata: ${seriesId} ──\n`);
const info = await fetchFredSeriesInfo(seriesId);
console.log("Title:", info.title);
console.log("Frequency:", info.frequency);
console.log("Units:", info.units);
console.log("Seasonal adjustment:", info.seasonal_adjustment);
console.log("Last updated:", info.last_updated);
if (info.notes) {
  console.log("Notes:", info.notes.slice(0, 200));
}

console.log(`\n── Latest observations: ${seriesId} ──\n`);
const observations = await fetchFredObservations(seriesId, {
  sortOrder: "desc",
  limit: 10,
});
console.log(`Returned ${String(observations.count)} total observations\n`);

for (const obs of observations.observations) {
  console.log(`  ${obs.date}  ${obs.value}`);
}

console.log();
