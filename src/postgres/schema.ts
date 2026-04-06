import { randomId } from "~/lib/random-id";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Recommended schema defaults
 */
const idField = text().primaryKey().$default(randomId);
const createdAtField = timestamp().notNull().defaultNow();
const updatedAtField = timestamp()
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/**
 * Base schema for most tables
 */
const baseSchema = {
  id: idField,
  createdAt: createdAtField,
  updatedAt: updatedAtField,
};

/**
 * Users table
 */
export const users = pgTable("users", {
  ...baseSchema,
  email: text().notNull(),
  clerkUserId: text().notNull().unique(),
  planTier: text().$type<"free" | "unlimited">().notNull().default("free"),
  stripeCustomerId: text(),
  stripeSubscriptionId: text(),
  paymentStatus: text().$type<"ok" | "past_due">().notNull().default("ok"),
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

/**
 * Organizations table
 */
export const organizations = pgTable("organizations", {
  ...baseSchema,
  name: text().notNull(),
});

export type OrganizationSelect = typeof organizations.$inferSelect;
export type OrganizationInsert = typeof organizations.$inferInsert;

/**
 * Organization members junction table
 */
export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: text()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAtField,
    updatedAt: updatedAtField,
    // role: text().$type<"member" | "administrator">().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.userId] })],
);

export type OrganizationMemberSelect = typeof organizationMembers.$inferSelect;
export type OrganizationMemberInsert = typeof organizationMembers.$inferInsert;

/**
 * Accounts table
 */
export const accounts = pgTable("accounts", {
  ...baseSchema,
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text()
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

/**
 * Documents table
 */

export const documents = pgTable("documents", {
  ...baseSchema,
  // TODO - add user and org foreign keys
  //   userId: text()
  //   .notNull()
  //   .references(() => users.id, { onDelete: "cascade" }),
  // organizationId: text()
  //   .notNull()
  //   .references(() => organizations.id, { onDelete: "cascade" }),
  source: text().notNull(),
  title: text().notNull(),
  description: text().notNull(),
  publicationDate: timestamp().notNull(),
  link: text().notNull(),
  articleText: text().notNull(),
  isSubstantive: boolean().notNull().default(true),
});

export type DocumentSelect = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;

/**
 * Document Images — images extracted from scraped articles, stored in Vercel Blob
 */
export const documentImages = pgTable("document_images", {
  ...baseSchema,
  documentId: text()
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  blobUrl: text().notNull(),
  altText: text(),
  position: integer().notNull(),
  widthPx: integer(),
  heightPx: integer(),
  sizeBytes: integer(),
});

export type DocumentImageSelect = typeof documentImages.$inferSelect;
export type DocumentImageInsert = typeof documentImages.$inferInsert;

export const takeaways = pgTable("takeaways", {
  ...baseSchema,
  documentId: text()
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  title: text().notNull(),
  takeaway: text().notNull(),
  concept: text().notNull(),
  // remove value on delete
  categoryId: text().references(() => categories.id, { onDelete: "set null" }),
  summary: text().notNull(),
  retrievalSummary: text(),
});

export type TakeawaySelect = typeof takeaways.$inferSelect;
export type TakeawayInsert = typeof takeaways.$inferInsert;

export const takeawayReferences = pgTable("takeaway_references", {
  ...baseSchema,
  takeawayId: text()
    .notNull()
    .references(() => takeaways.id, { onDelete: "cascade" }),
  referenceNumber: integer().notNull(),
  reference: text().notNull(),
});

export type TakeawayReferenceSelect = typeof takeawayReferences.$inferSelect;
export type TakeawayReferenceInsert = typeof takeawayReferences.$inferInsert;

// TODO - add tag junction table
// export const takeawayTags = pgTable(
//   "takeaway_tags",
//   {
//     takeawayId: text()
//       .notNull()
//       .references(() => takeaways.id, { onDelete: "cascade" }),
//     tagId: text()
//       .notNull()
//       .references(() => tags.id, { onDelete: "cascade" }),
//   },
//   (table) => [primaryKey({ columns: [table.takeawayId, table.tagId] })],
// );

export const takeawayEmbeddings = pgTable(
  "takeaway_embeddings",
  {
    ...baseSchema,
    takeawayId: text()
      .notNull()
      .unique()
      .references(() => takeaways.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (table) => [
    index("takeawayEmbeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const conceptEmbeddings = pgTable(
  "concept_embeddings",
  {
    ...baseSchema,
    takeawayId: text()
      .notNull()
      .unique()
      .references(() => takeaways.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (table) => [
    index("conceptEmbeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const stockSymbols = pgTable("stock_symbols", {
  ...baseSchema,
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  assetType: text(),
  description: text(),
  cik: text(),
  exchange: text(),
  currency: text(),
  country: text(),
  sector: text(),
  industry: text(),
  address: text(),
  officialSite: text(),
  fiscalYearEnd: text(),
  overviewFetchedAt: timestamp(),
});

export type StockSymbolSelect = typeof stockSymbols.$inferSelect;
export type StockSymbolInsert = typeof stockSymbols.$inferInsert;

export const stockSymbolEmbeddings = pgTable(
  "stock_symbol_embeddings",
  {
    ...baseSchema,
    stockSymbolId: text()
      .notNull()
      .unique()
      .references(() => stockSymbols.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  },
  (table) => [
    index("stockSymbolEmbeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

/**
 * Tracked Companies - User-specific company watchlist
 */
export const trackedCompanies = pgTable(
  "tracked_companies",
  {
    ...baseSchema,
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stockSymbolId: text()
      .notNull()
      .references(() => stockSymbols.id, { onDelete: "cascade" }),
  },
  (table) => [unique().on(table.userId, table.stockSymbolId)],
);

export type TrackedCompanySelect = typeof trackedCompanies.$inferSelect;
export type TrackedCompanyInsert = typeof trackedCompanies.$inferInsert;

/**
 * Earnings Schedule - Cached earnings calendar from Alpha Vantage
 */
export const earningsSchedule = pgTable(
  "earnings_schedule",
  {
    ...baseSchema,
    symbol: text().notNull(),
    name: text().notNull(),
    reportDate: timestamp().notNull(),
    fiscalDateEnding: text().notNull(),
    estimate: doublePrecision(),
    currency: text(),
  },
  (table) => [unique().on(table.symbol, table.fiscalDateEnding)],
);

export type EarningsScheduleSelect = typeof earningsSchedule.$inferSelect;
export type EarningsScheduleInsert = typeof earningsSchedule.$inferInsert;

/**
 * Earnings Fetch Jobs - Track status of automated transcript fetches
 */
export const earningsFetchJobs = pgTable("earnings_fetch_jobs", {
  ...baseSchema,
  earningsScheduleId: text()
    .notNull()
    .references(() => earningsSchedule.id, { onDelete: "cascade" }),
  status: text()
    .$type<"pending" | "processing" | "completed" | "failed" | "skipped">()
    .notNull()
    .default("pending"),
  processedAt: timestamp(),
  errorMessage: text(),
});

export type EarningsFetchJobSelect = typeof earningsFetchJobs.$inferSelect;
export type EarningsFetchJobInsert = typeof earningsFetchJobs.$inferInsert;

/**
 * Takeaway Categories
 */
export const categories = pgTable("categories", {
  ...baseSchema,
  name: text().notNull(),
});

export type CategorySelect = typeof categories.$inferSelect;
export type CategoryInsert = typeof categories.$inferInsert;

export const tags = pgTable("tags", {
  ...baseSchema,
  // Foreign key to categories
  categoryId: text()
    .references(() => categories.id, { onDelete: "cascade" })
    .notNull(),
  name: text().notNull(),
});

export const insights = pgTable("insights", {
  ...baseSchema,
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text().notNull(),
  summary: text(),
  insight: text(),
  research: text(),
  seedText: text(),
  insightPrompt: text(),
});

export type InsightSelect = typeof insights.$inferSelect;
export type InsightInsert = typeof insights.$inferInsert;

export const insightReferences = pgTable(
  "insight_references",
  {
    insightId: text()
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    insightReferenceNumber: integer().notNull(),
    referenceId: text()
      .notNull()
      .references(() => takeawayReferences.id, { onDelete: "cascade" }),
    createdAt: createdAtField,
    updatedAt: updatedAtField,
  },
  (table) => [primaryKey({ columns: [table.insightId, table.referenceId] })],
);

export type InsightReferenceSelect = typeof insightReferences.$inferSelect;
export type InsightReferenceInsert = typeof insightReferences.$inferInsert;

/**
 * X Bookmarks Auth - Stores OAuth2 tokens for X bookmarks sync
 *
 * Each user can connect one X account. Tokens are used by:
 * - The daily bookmark sync job (refreshes token, fetches bookmarks)
 * - The settings UI (displays connection status)
 *
 * Fields:
 * - userId: Our internal user ID (who connected this X account)
 * - xUserId: X's user ID (required for bookmarks API - must match authenticated user)
 * - refreshToken: Used to get new access tokens without user interaction
 * - accessToken: Current token for API calls (expires after ~2 hours)
 * - expiresAt: When the access token expires (refresh before this time)
 * - lastSyncCursor: Pagination token for incremental bookmark fetching
 * - selectedFolderId: X bookmark folder ID to sync (null = all bookmarks)
 * - selectedFolderName: Display name of selected folder (for UI)
 */
export const xBookmarksAuth = pgTable("x_bookmarks_auth", {
  ...baseSchema,
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  xUserId: text().notNull(),
  refreshToken: text().notNull(),
  accessToken: text().notNull(),
  expiresAt: timestamp().notNull(),
  lastSyncCursor: text(),
  selectedFolderId: text(),
  selectedFolderName: text(),
});

export type XBookmarksAuthSelect = typeof xBookmarksAuth.$inferSelect;
export type XBookmarksAuthInsert = typeof xBookmarksAuth.$inferInsert;

// insights <> takeaways junction table
export const insightTakeaways = pgTable(
  "insight_takeaways",
  {
    insightId: text()
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    takeawayId: text()
      .notNull()
      .references(() => takeaways.id, { onDelete: "cascade" }),
    type: text().$type<"concept" | "takeaway">().notNull(),
  },
  (table) => [primaryKey({ columns: [table.insightId, table.takeawayId] })],
);

export type InsightTakeawaySelect = typeof insightTakeaways.$inferSelect;
export type InsightTakeawayInsert = typeof insightTakeaways.$inferInsert;

/**
 * Blogs - RSS feed registry for automated scraping
 */
export const blogs = pgTable("blogs", {
  ...baseSchema,
  title: text().notNull(),
  description: text(),
  xmlUrl: text().notNull().unique(),
  htmlUrl: text(),
  enabled: boolean().notNull().default(false),
  contentInFeed: boolean().notNull().default(false),
  lastScrapedAt: timestamp(),
});

export type BlogSelect = typeof blogs.$inferSelect;
export type BlogInsert = typeof blogs.$inferInsert;

/**
 * API Keys - Secret keys for external REST API access
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    ...baseSchema,
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    keyHash: text().notNull().unique(), // SHA-256 hex of raw key
    keyPrefix: text().notNull(), // first 13 chars for display
    lastUsedAt: timestamp(),
    revokedAt: timestamp(), // null = active; non-null = revoked
  },
  (table) => [index("api_keys_user_id_idx").on(table.userId)],
);

export type ApiKeySelect = typeof apiKeys.$inferSelect;
export type ApiKeyInsert = typeof apiKeys.$inferInsert;

/**
 * API Usage — per-user, per-endpoint monthly request counters
 */
export const apiUsage = pgTable(
  "api_usage",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text().notNull(), // "YYYY-MM"
    endpoint: text().notNull(),
    requestCount: integer().notNull().default(0),
    createdAt: createdAtField,
    updatedAt: updatedAtField,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.month, table.endpoint] }),
  ],
);
