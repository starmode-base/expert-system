import { relations } from "drizzle-orm/relations";
import {
  takeaways,
  conceptEmbeddings,
  takeawayEmbeddings,
  users,
  accounts,
  organizations,
  documents,
  organizationMembers,
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
  organizationMembers: many(organizationMembers),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  accounts: many(accounts),
  organizationMembers: many(organizationMembers),
}));

export const documentsRelations = relations(documents, ({ many }) => ({
  takeaways: many(takeaways),
}));

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
