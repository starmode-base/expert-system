import { randomId } from "~/lib/random-id";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
  title: text("title").notNull(),
  takeaway: text("takeaway").notNull(),
  concept: text("concept").notNull(),
  novelty: text("novelty").notNull(),
  importance: text("importance").notNull(),
  monetization: text("monetization").notNull(),
  // remove value on delete
  categoryId: text().references(() => categories.id, { onDelete: "set null" }),
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
