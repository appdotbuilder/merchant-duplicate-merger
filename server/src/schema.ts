import { z } from 'zod';

// Merchant pair schema for duplicate detection
export const merchantPairSchema = z.object({
  merchant_id_1: z.string(),
  merchant_name_1: z.string(),
  creation_date_1: z.coerce.date(), // Automatically converts ISO 8601 string to Date
  merchant_id_2: z.string(),
  merchant_name_2: z.string(),
  creation_date_2: z.coerce.date(), // Automatically converts ISO 8601 string to Date
  cosine_distance: z.number()
});

export type MerchantPair = z.infer<typeof merchantPairSchema>;

// Input schema for merging merchants
export const mergeMerchantsInputSchema = z.object({
  keep_merchant_id: z.string(),
  discard_merchant_id: z.string()
});

export type MergeMerchantsInput = z.infer<typeof mergeMerchantsInputSchema>;

// Response schema for merge operation
export const mergeMerchantsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  kept_merchant_id: z.string(),
  discarded_merchant_id: z.string()
});

export type MergeMerchantsResponse = z.infer<typeof mergeMerchantsResponseSchema>;