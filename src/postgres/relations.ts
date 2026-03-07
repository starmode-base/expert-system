import { relations } from "drizzle-orm/relations";
import {
  takeaways,
  conceptEmbeddings,
  takeawayEmbeddings,
  users,
  accounts,
  organizations,
  categories,
  tags,
  insights,
  earningsSchedule,
  earningsFetchJobs,
  trackedCompanies,
  stockSymbols,
  stockSymbolEmbeddings,
  documents,
  takeawayReferences,
  insightTakeaways,
  organizationMembers,
  insightReferences,
  xBookmarksAuth,
  blogs,
  apiKeys,
} from "./schema";

export const conceptEmbeddingsRelations = relations(
  conceptEmbeddings,
  ({ one }) => ({
    takeaway: one(takeaways, {
      fields: [conceptEmbeddings.takeawayId],
      references: [takeaways.id],
    }),
  }),
);

export const takeawaysRelations = relations(takeaways, ({ one, many }) => ({
  conceptEmbeddings: many(conceptEmbeddings),
  takeawayEmbeddings: many(takeawayEmbeddings),
  document: one(documents, {
    fields: [takeaways.documentId],
    references: [documents.id],
  }),
  category: one(categories, {
    fields: [takeaways.categoryId],
    references: [categories.id],
  }),
  takeawayReferences: many(takeawayReferences),
  insightTakeaways: many(insightTakeaways),
}));

export const takeawayEmbeddingsRelations = relations(
  takeawayEmbeddings,
  ({ one }) => ({
    takeaway: one(takeaways, {
      fields: [takeawayEmbeddings.takeawayId],
      references: [takeaways.id],
    }),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [accounts.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  insights: many(insights),
  trackedCompanies: many(trackedCompanies),
  organizationMembers: many(organizationMembers),
  xBookmarksAuth: many(xBookmarksAuth),
  apiKeys: many(apiKeys),
}));

export const xBookmarksAuthRelations = relations(xBookmarksAuth, ({ one }) => ({
  user: one(users, {
    fields: [xBookmarksAuth.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  accounts: many(accounts),
  organizationMembers: many(organizationMembers),
}));

export const tagsRelations = relations(tags, ({ one }) => ({
  category: one(categories, {
    fields: [tags.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tags: many(tags),
  takeaways: many(takeaways),
}));

export const insightsRelations = relations(insights, ({ one, many }) => ({
  user: one(users, {
    fields: [insights.userId],
    references: [users.id],
  }),
  insightTakeaways: many(insightTakeaways),
  insightReferences: many(insightReferences),
}));

export const earningsFetchJobsRelations = relations(
  earningsFetchJobs,
  ({ one }) => ({
    earningsSchedule: one(earningsSchedule, {
      fields: [earningsFetchJobs.earningsScheduleId],
      references: [earningsSchedule.id],
    }),
  }),
);

export const earningsScheduleRelations = relations(
  earningsSchedule,
  ({ many }) => ({
    earningsFetchJobs: many(earningsFetchJobs),
  }),
);

export const trackedCompaniesRelations = relations(
  trackedCompanies,
  ({ one }) => ({
    user: one(users, {
      fields: [trackedCompanies.userId],
      references: [users.id],
    }),
    stockSymbol: one(stockSymbols, {
      fields: [trackedCompanies.stockSymbolId],
      references: [stockSymbols.id],
    }),
  }),
);

export const stockSymbolsRelations = relations(
  stockSymbols,
  ({ many, one }) => ({
    trackedCompanies: many(trackedCompanies),
    stockSymbolEmbedding: one(stockSymbolEmbeddings),
  }),
);

export const stockSymbolEmbeddingsRelations = relations(
  stockSymbolEmbeddings,
  ({ one }) => ({
    stockSymbol: one(stockSymbols, {
      fields: [stockSymbolEmbeddings.stockSymbolId],
      references: [stockSymbols.id],
    }),
  }),
);

export const documentsRelations = relations(documents, ({ many }) => ({
  takeaways: many(takeaways),
}));

export const takeawayReferencesRelations = relations(
  takeawayReferences,
  ({ one, many }) => ({
    takeaway: one(takeaways, {
      fields: [takeawayReferences.takeawayId],
      references: [takeaways.id],
    }),
    insightReferences: many(insightReferences),
  }),
);

export const insightTakeawaysRelations = relations(
  insightTakeaways,
  ({ one }) => ({
    insight: one(insights, {
      fields: [insightTakeaways.insightId],
      references: [insights.id],
    }),
    takeaway: one(takeaways, {
      fields: [insightTakeaways.takeawayId],
      references: [takeaways.id],
    }),
  }),
);

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  }),
);

export const insightReferencesRelations = relations(
  insightReferences,
  ({ one }) => ({
    insight: one(insights, {
      fields: [insightReferences.insightId],
      references: [insights.id],
    }),
    takeawayReference: one(takeawayReferences, {
      fields: [insightReferences.referenceId],
      references: [takeawayReferences.id],
    }),
  }),
);

export const blogsRelations = relations(blogs, () => ({}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));
