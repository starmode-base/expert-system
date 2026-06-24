import { relations } from "drizzle-orm/relations";
import {
  takeaways,
  takeawayEmbeddings,
  users,
  accounts,
  organizations,
  categories,
  tags,
  documents,
  earningsCalls,
  trackedStocks,
  insights,
  takeawayReferences,
  xBookmarksAuth,
  apiKeys,
  insightTakeaways,
  organizationMembers,
  insightReferences,
  apiUsage,
  documentImages,
} from "./schema";

export const takeawaysRelations = relations(takeaways, ({ one, many }) => ({
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
  xBookmarksAuths: many(xBookmarksAuth),
  apiKeys: many(apiKeys),
  organizationMembers: many(organizationMembers),
  apiUsages: many(apiUsage),
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

export const documentsRelations = relations(documents, ({ many }) => ({
  takeaways: many(takeaways),
  images: many(documentImages),
  earningsCalls: many(earningsCalls),
}));

export const documentImagesRelations = relations(documentImages, ({ one }) => ({
  document: one(documents, {
    fields: [documentImages.documentId],
    references: [documents.id],
  }),
}));

export const trackedStocksRelations = relations(trackedStocks, ({ many }) => ({
  earningsCalls: many(earningsCalls),
}));

export const earningsCallsRelations = relations(earningsCalls, ({ one }) => ({
  trackedStock: one(trackedStocks, {
    fields: [earningsCalls.trackedStockId],
    references: [trackedStocks.id],
  }),
  document: one(documents, {
    fields: [earningsCalls.documentId],
    references: [documents.id],
  }),
}));

export const insightsRelations = relations(insights, ({ one, many }) => ({
  user: one(users, {
    fields: [insights.userId],
    references: [users.id],
  }),
  insightTakeaways: many(insightTakeaways),
  insightReferences: many(insightReferences),
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

export const xBookmarksAuthRelations = relations(xBookmarksAuth, ({ one }) => ({
  user: one(users, {
    fields: [xBookmarksAuth.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

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

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  user: one(users, {
    fields: [apiUsage.userId],
    references: [users.id],
  }),
}));
