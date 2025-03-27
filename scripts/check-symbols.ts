// Import the necessary modules
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

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
        securityName: record["Security Name"],
      };
    });

    return recordsInsert;
  } catch (error) {
    console.error("Error fetching NASDAQ listings:", error);
    throw error;
  }
}

// Example usage:
fetchNasdaqListings()
  .then((listings) => {
    console.log("NASDAQ Listings:", listings);
  })
  .catch((error) => {
    console.error("Failed to fetch NASDAQ listings:", error);
  });
