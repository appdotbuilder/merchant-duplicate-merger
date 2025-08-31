import { serial, text, pgTable, timestamp, numeric } from 'drizzle-orm/pg-core';

// Merchants table to store merchant information
export const merchantsTable = pgTable('merchants', {
  id: text('id').primaryKey(), // Using text since merchant_id comes as string
  name: text('name').notNull(),
  creation_date: timestamp('creation_date').notNull(),
  is_active: text('is_active').default('true').notNull(), // Using text to store boolean as string
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Merchant pairs table to store potential duplicates
export const merchantPairsTable = pgTable('merchant_pairs', {
  id: serial('id').primaryKey(),
  merchant_id_1: text('merchant_id_1').notNull(),
  merchant_name_1: text('merchant_name_1').notNull(),
  creation_date_1: timestamp('creation_date_1').notNull(),
  merchant_id_2: text('merchant_id_2').notNull(),
  merchant_name_2: text('merchant_name_2').notNull(),
  creation_date_2: timestamp('creation_date_2').notNull(),
  cosine_distance: numeric('cosine_distance', { precision: 10, scale: 8 }).notNull(), // High precision for cosine distance
  is_processed: text('is_processed').default('false').notNull(), // Using text to store boolean as string
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Merge history table to track merge operations
export const mergeHistoryTable = pgTable('merge_history', {
  id: serial('id').primaryKey(),
  kept_merchant_id: text('kept_merchant_id').notNull(),
  discarded_merchant_id: text('discarded_merchant_id').notNull(),
  merged_at: timestamp('merged_at').defaultNow().notNull(),
  merged_by: text('merged_by'), // Nullable field for future user tracking
});

// TypeScript types for the table schemas
export type Merchant = typeof merchantsTable.$inferSelect; // For SELECT operations
export type NewMerchant = typeof merchantsTable.$inferInsert; // For INSERT operations

export type MerchantPair = typeof merchantPairsTable.$inferSelect;
export type NewMerchantPair = typeof merchantPairsTable.$inferInsert;

export type MergeHistory = typeof mergeHistoryTable.$inferSelect;
export type NewMergeHistory = typeof mergeHistoryTable.$inferInsert;

// Important: Export all tables and relations for proper query building
export const tables = { 
  merchants: merchantsTable,
  merchantPairs: merchantPairsTable,
  mergeHistory: mergeHistoryTable
};