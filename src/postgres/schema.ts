import { randomId } from "~/lib/random-id";
import {
  doublePrecision,
  index,
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
});

export type DocumentSelect = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;

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
});

export type TakeawaySelect = typeof takeaways.$inferSelect;
export type TakeawayInsert = typeof takeaways.$inferInsert;

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
});

export type StockSymbolSelect = typeof stockSymbols.$inferSelect;
export type StockSymbolInsert = typeof stockSymbols.$inferInsert;

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
  insight: text(),
});

export type InsightSelect = typeof insights.$inferSelect;
export type InsightInsert = typeof insights.$inferInsert;

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
  },
  (table) => [primaryKey({ columns: [table.insightId, table.takeawayId] })],
);

export type InsightTakeawaySelect = typeof insightTakeaways.$inferSelect;
export type InsightTakeawayInsert = typeof insightTakeaways.$inferInsert;
