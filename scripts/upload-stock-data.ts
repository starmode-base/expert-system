import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { db, schema } from "~/postgres/db";

interface Constituent {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
  HQLocation: string;
  dateAdded: string; // or `Date` if you plan to parse it
  cik: string;
  founded: string; // or `number` if you parse it
}

// Read the CSV file
const csvFilePath = path.resolve(__dirname, "../data/constituents.csv");
const csvContent = fs.readFileSync(csvFilePath, "utf-8");

// Parse the CSV content
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const records: Constituent[] = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
});

// Output the result as a TypeScript object
console.log(
  "const constituents: Constituent[] = ",
  JSON.stringify(records, null, 2),
);

const result = await db.insert(schema.stocks).values(records).returning({
  id: schema.stocks.id,
  symbol: schema.stocks.symbol,
});

console.log(result);
