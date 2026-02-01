import "dotenv/config";
import { db, schema } from "../src/postgres/db";
import {
  createXClient,
  refreshAccessToken,
  isTokenExpired,
  calculateExpiresAt,
} from "../src/inngest/importers/scheduled/x-bookmarks/x-client";
import {
  mapBookmarksToCandidates,
  mapCandidateToDocument,
} from "../src/inngest/importers/scheduled/x-bookmarks/x-bookmarks-helpers";
import { getDocumentSummary } from "../src/inngest/importers/helpers/get-document-summary";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Fetching X Bookmarks auth record...\n");

  // Get the first auth record
  const auth = await db.query.xBookmarksAuth.findFirst();

  if (!auth) {
    console.error(
      "No X Bookmarks auth record found. Complete OAuth flow first.",
    );
    process.exit(1);
  }

  console.log("Auth record found:");
  console.log(`  User ID: ${auth.userId}`);
  console.log(`  X User ID: ${auth.xUserId}`);
  console.log(`  Token expires: ${auth.expiresAt.toISOString()}`);
  console.log(`  Expired: ${isTokenExpired(auth.expiresAt) ? "Yes" : "No"}\n`);

  let accessToken = auth.accessToken;

  // Refresh token if expired
  if (isTokenExpired(auth.expiresAt)) {
    console.log("Token expired, refreshing...\n");
    try {
      const tokens = await refreshAccessToken(auth.refreshToken);
      accessToken = tokens.access_token;

      // Update stored tokens
      await db
        .update(schema.xBookmarksAuth)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? auth.refreshToken,
          expiresAt: calculateExpiresAt(tokens.expires_in),
        })
        .where(eq(schema.xBookmarksAuth.id, auth.id));

      console.log("Token refreshed successfully!\n");
    } catch (err) {
      console.error("Failed to refresh token:", err);
      process.exit(1);
    }
  }

  // Fetch bookmarks
  console.log("Fetching bookmarks...\n");
  const client = createXClient(accessToken);

  try {
    const response = await client.getBookmarks(auth.xUserId, {
      maxResults: 10,
    });

    if (!response.data || response.data.length === 0) {
      console.log("No bookmarks found.");
      process.exit(0);
    }

    const candidates = mapBookmarksToCandidates(response);

    if (candidates.length === 0) {
      console.log("No bookmark candidates found.");
      process.exit(0);
    }

    console.log(`Found ${candidates.length} bookmark candidates:\n`);
    console.log("=".repeat(80));

    for (const candidate of candidates) {
      const summary = await getDocumentSummary(
        candidate.text,
        candidate.title,
      );
      const document = mapCandidateToDocument(candidate, summary);

      console.log(`\n@${candidate.authorUsername ?? "unknown"}`);
      console.log(`ID: ${candidate.tweetId}`);
      console.log(`URL: ${candidate.link}`);
      console.log(`Title: ${candidate.title}`);
      console.log(`Published: ${candidate.publicationDate}`);
      console.log(`URLs: ${candidate.urls.join(", ") || "none"}`);
      console.log("\nDocument payload:");
      console.log(JSON.stringify(document, null, 2));
      console.log("\n" + "-".repeat(80));
    }

    if (response.meta?.next_token) {
      console.log(
        `\nMore bookmarks available (next_token: ${response.meta.next_token})`,
      );
    }
  } catch (err) {
    console.error("Failed to fetch bookmarks:", err);
    process.exit(1);
  }
}

void main();
