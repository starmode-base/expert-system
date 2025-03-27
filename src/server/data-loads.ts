import { createServerFn } from "@tanstack/react-start";
import fetch from "node-fetch";

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

// Define the URL for the NASDAQ listings CSV
const NASDAQ_LISTINGS_URL = "https://datahub.io/core/nasdaq-listings/r/0.csv";

// Define the structure of the NASDAQ listing
interface NasdaqListing {
  Symbol: string;
  "Security Name": string;
}

/**
 * Fetches and parses the NASDAQ listings from DataHub.io.
 * @returns A promise that resolves to an array of NasdaqListing objects.
 */
async function fetchNasdaqListings() {
  try {
    // Fetch the CSV data from the URL
    const response = await fetch(NASDAQ_LISTINGS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    // Read the response body as text
    const csvData = await response.text();

    // Parse the CSV data into JSON
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const records: NasdaqListing[] = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    });

    const recordsInsert = records.map((record) => {
      return {
        symbol: record.Symbol,
        name: record["Security Name"],
      };
    });

    return recordsInsert;
  } catch (error) {
    console.error("Error fetching NASDAQ listings:", error);
    throw error;
  }
}

export const uploadStockDataSF = createServerFn({ method: "POST" }).handler(
  async () => {
    const records = await fetchNasdaqListings();

    // Output the result as a TypeScript object
    console.log("const constituents: Constituent[] = ", records.length);

    const result = await db
      .insert(schema.stockSymbols)
      .values(records)
      .returning({
        id: schema.stockSymbols.id,
        symbol: schema.stockSymbols.symbol,
      });

    return result;
  },
);
