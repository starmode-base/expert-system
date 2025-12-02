import { relations } from "drizzle-orm/relations";
import {
  users,
  accounts,
  organizations,
  takeaways,
  conceptEmbeddings,
  categories,
  tags,
  takeawayEmbeddings,
  documents,
  insights,
  insightTakeaways,
  organizationMembers,
  trackedCompanies,
  stockSymbols,
  earningsSchedule,
  earningsFetchJobs,
} from "./schema";

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
  organizationMembers: many(organizationMembers),
  trackedCompanies: many(trackedCompanies),
  earningsFetchJobs: many(earningsFetchJobs),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  accounts: many(accounts),
  organizationMembers: many(organizationMembers),
}));

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
  insightTakeaways: many(insightTakeaways),
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

export const takeawayEmbeddingsRelations = relations(
  takeawayEmbeddings,
  ({ one }) => ({
    takeaway: one(takeaways, {
      fields: [takeawayEmbeddings.takeawayId],
      references: [takeaways.id],
    }),
  }),
);

export const documentsRelations = relations(documents, ({ many }) => ({
  takeaways: many(takeaways),
}));

export const insightsRelations = relations(insights, ({ one, many }) => ({
  user: one(users, {
    fields: [insights.userId],
    references: [users.id],
  }),
  insightTakeaways: many(insightTakeaways),
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

export const stockSymbolsRelations = relations(stockSymbols, ({ many }) => ({
  trackedCompanies: many(trackedCompanies),
}));

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

export const earningsScheduleRelations = relations(
  earningsSchedule,
  ({ many }) => ({
    earningsFetchJobs: many(earningsFetchJobs),
  }),
);

export const earningsFetchJobsRelations = relations(
  earningsFetchJobs,
  ({ one }) => ({
    user: one(users, {
      fields: [earningsFetchJobs.userId],
      references: [users.id],
    }),
    earningsSchedule: one(earningsSchedule, {
      fields: [earningsFetchJobs.earningsScheduleId],
      references: [earningsSchedule.id],
    }),
  }),
);
