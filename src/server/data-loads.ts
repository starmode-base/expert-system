import { createServerFn } from "@tanstack/react-start";
import { readFileSync } from "fs";
import { join } from "path";

import { parse } from "csv-parse/sync";
import { db, schema } from "~/postgres/db";

import { invariant } from "@tanstack/react-router";

// ##################
// ##################
// Category Data
// ##################
// ##################

const taxonomyData = [
  {
    category: "Business, Finance & Industries",
    tags: [
      "Corporate Financials",
      "Market Trends",
      "Mergers & Acquisitions",
      "Stock Market",
      "Economic Indicators",
      "Inflation",
      "Cryptocurrency & Blockchain",
      "Corporate Strategy",
      "Startups",
      "Venture Capital",
      "Retail",
      "Automotive",
      "Real Estate",
      "Agriculture",
      "Telecommunications",
      "Media & Entertainment",
      "Manufacturing",
      "Logistics & Supply Chain",
      "Financial Services",
      "Energy Sector",
    ],
  },
  {
    category: "Science, Technology & Innovation",
    tags: [
      "Artificial Intelligence",
      "Machine Learning",
      "Quantum Computing",
      "Space Exploration",
      "Robotics",
      "Biotechnology",
      "Cybersecurity",
      "Internet of Things (IoT)",
      "Cloud Computing",
      "AR/VR",
      "Wearable Tech",
      "Developer Tools",
      "SaaS",
      "Tech Startups",
      "Scientific Research",
      "Product Innovations",
    ],
  },
  {
    category: "Health & Medicine",
    tags: [
      "Medical Research",
      "Public Health",
      "Pharmaceuticals",
      "Clinical Trials",
      "Mental Health",
      "Nutrition",
      "Disease Outbreaks",
      "Healthcare Policy",
      "Fitness & Wellness",
      "Genomics",
    ],
  },
  {
    category: "Politics & Government",
    tags: [
      "Legislation",
      "Elections",
      "International Relations",
      "Public Policy",
      "Political Parties",
      "Government Spending",
      "Regulation",
      "Civil Rights",
      "National Security",
      "Judicial Decisions",
    ],
  },
  {
    category: "Environment & Energy",
    tags: [
      "Renewable Energy",
      "Fossil Fuels",
      "Environmental Policy",
      "Carbon Emissions",
      "Climate Change",
      "Conservation",
      "Natural Disasters",
      "Water Resources",
      "Pollution",
      "Sustainability",
      "Climate Science",
    ],
  },
  {
    category: "Education & Research",
    tags: [
      "Higher Education",
      "K-12 Education",
      "Online Learning",
      "Education Policy",
      "Curriculum Development",
      "Scientific Studies",
      "Scholarships & Funding",
      "EdTech",
      "Literacy",
      "Academic Collaboration",
    ],
  },
  {
    category: "Culture & Society",
    tags: [
      "Media & Journalism",
      "Religion",
      "Ethics",
      "Language & Communication",
      "Gender & Identity",
      "Demographics",
      "Social Movements",
      "Art & Literature",
      "History",
      "Philosophy",
    ],
  },
  {
    category: "Law & Regulation",
    tags: [
      "Judicial Rulings",
      "Antitrust",
      "Intellectual Property",
      "Data Privacy",
      "Criminal Justice",
      "Legal Reform",
      "Corporate Law",
      "International Law",
      "Human Rights Law",
      "Regulatory Compliance",
    ],
  },
];

// #####################

export const uploadCategoriesSF = createServerFn({ method: "POST" }).handler(
  async () => {
    for (const entry of taxonomyData) {
      // Insert category
      const [insertedCategory] = await db
        .insert(schema.categories)
        .values({ name: entry.category })
        .returning({ id: schema.categories.id, name: schema.categories.name });

      invariant(insertedCategory, "Failed to create category");

      // Insert each tag (linked to the newly inserted category)
      for (const tagName of entry.tags) {
        await db.insert(schema.tags).values({
          categoryId: insertedCategory.id,
          name: tagName,
        });
      }
    }

    console.log("Seeded categories and tags successfully.");
  },
);

//  ####################
// ####################

// Define the structure of the S&P 500 constituents CSV
interface SP500ConstituentRecord {
  Symbol: string;
  Security: string;
  "GICS Sector"?: string;
  "GICS Sub-Industry"?: string;
  "Headquarters Location"?: string;
  "Date added"?: string;
  CIK?: string;
  Founded?: string;
}

export const uploadStockDataSF = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      // Prefer fetching the canonical S&P 500 CSV; fallback to local file in dev
      const remoteUrl =
        "https://datahub.io/core/s-and-p-500-companies/_r/-/data/constituents.csv";
      let csvData: string;
      try {
        const res = await fetch(remoteUrl, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        csvData = await res.text();
      } catch {
        const csvPath = join(
          process.cwd(),
          "public",
          "data",
          "constituents.csv",
        );
        csvData = readFileSync(csvPath, "utf-8");
      }

      // Parse the CSV data into JSON
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as SP500ConstituentRecord[];

      // Filter out invalid records and transform to database format
      const validRecords = records
        .filter((record) => record.Symbol && record.Security)
        .map((record) => ({
          symbol: record.Symbol.trim(),
          name: record.Security.trim(),
        }));

      console.log(`Processing ${validRecords.length} S&P 500 symbols`);

      // Fetch existing symbols to avoid duplicates
      const existing = await db
        .select({ symbol: schema.stockSymbols.symbol })
        .from(schema.stockSymbols);
      const existingSymbols = new Set(existing.map((r) => r.symbol));

      // Deduplicate incoming and filter to new symbols only
      const dedupedBySymbol = new Map<
        string,
        { symbol: string; name: string }
      >();
      for (const rec of validRecords) {
        if (!dedupedBySymbol.has(rec.symbol)) {
          dedupedBySymbol.set(rec.symbol, rec);
        }
      }
      const newRecords = Array.from(dedupedBySymbol.values()).filter(
        (rec) => !existingSymbols.has(rec.symbol),
      );

      if (newRecords.length === 0) {
        console.log("No new stock symbols to insert");
        return [];
      }

      // Insert only new records into the database
      const result = await db
        .insert(schema.stockSymbols)
        .values(newRecords)
        .returning({
          id: schema.stockSymbols.id,
          symbol: schema.stockSymbols.symbol,
        });

      console.log(`Successfully inserted ${result.length} new stock symbols`);
      return result;
    } catch (error) {
      console.error("Error uploading stock data:", error);
      throw error;
    }
  },
);
