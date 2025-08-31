import { db } from '../db';
import { merchantPairsTable } from '../db/schema';
import { type MerchantPair } from '../schema';
import { eq } from 'drizzle-orm';

export const getMerchantPairs = async (): Promise<MerchantPair[]> => {
  try {
    // Query all unprocessed merchant pairs from the database
    const results = await db.select()
      .from(merchantPairsTable)
      .where(eq(merchantPairsTable.is_processed, 'false'))
      .execute();

    // Convert numeric fields back to numbers and format response
    return results.map(pair => ({
      merchant_id_1: pair.merchant_id_1,
      merchant_name_1: pair.merchant_name_1,
      creation_date_1: pair.creation_date_1,
      merchant_id_2: pair.merchant_id_2,
      merchant_name_2: pair.merchant_name_2,
      creation_date_2: pair.creation_date_2,
      cosine_distance: parseFloat(pair.cosine_distance) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to get merchant pairs:', error);
    throw error;
  }
};