import { db } from '../db';
import { merchantsTable, merchantPairsTable, mergeHistoryTable } from '../db/schema';
import { type MergeMerchantsInput, type MergeMerchantsResponse } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export async function mergeMerchants(input: MergeMerchantsInput): Promise<MergeMerchantsResponse> {
  try {
    // Validate that the merchants are not the same
    if (input.keep_merchant_id === input.discard_merchant_id) {
      return {
        success: false,
        message: 'Cannot merge merchant with itself',
        kept_merchant_id: input.keep_merchant_id,
        discarded_merchant_id: input.discard_merchant_id
      };
    }

    // 1. Validate that both merchant IDs exist in the merchants table
    const merchants = await db.select()
      .from(merchantsTable)
      .where(
        or(
          eq(merchantsTable.id, input.keep_merchant_id),
          eq(merchantsTable.id, input.discard_merchant_id)
        )
      )
      .execute();

    const keepMerchant = merchants.find(m => m.id === input.keep_merchant_id);
    const discardMerchant = merchants.find(m => m.id === input.discard_merchant_id);

    if (!keepMerchant) {
      return {
        success: false,
        message: `Merchant to keep with ID '${input.keep_merchant_id}' not found`,
        kept_merchant_id: input.keep_merchant_id,
        discarded_merchant_id: input.discard_merchant_id
      };
    }

    if (!discardMerchant) {
      return {
        success: false,
        message: `Merchant to discard with ID '${input.discard_merchant_id}' not found`,
        kept_merchant_id: input.keep_merchant_id,
        discarded_merchant_id: input.discard_merchant_id
      };
    }

    // Check if the merchant to discard is already inactive
    if (discardMerchant.is_active === 'false') {
      return {
        success: false,
        message: 'Merchant to discard is already inactive',
        kept_merchant_id: input.keep_merchant_id,
        discarded_merchant_id: input.discard_merchant_id
      };
    }

    // 2. Update the discarded merchant's is_active status to 'false'
    await db.update(merchantsTable)
      .set({ 
        is_active: 'false',
        updated_at: new Date()
      })
      .where(eq(merchantsTable.id, input.discard_merchant_id))
      .execute();

    // 3. Record the merge operation in the merge_history table
    await db.insert(mergeHistoryTable)
      .values({
        kept_merchant_id: input.keep_merchant_id,
        discarded_merchant_id: input.discard_merchant_id,
        merged_at: new Date()
      })
      .execute();

    // 4. Mark any relevant merchant pairs as processed in the merchant_pairs table
    await db.update(merchantPairsTable)
      .set({ is_processed: 'true' })
      .where(
        or(
          and(
            eq(merchantPairsTable.merchant_id_1, input.keep_merchant_id),
            eq(merchantPairsTable.merchant_id_2, input.discard_merchant_id)
          ),
          and(
            eq(merchantPairsTable.merchant_id_1, input.discard_merchant_id),
            eq(merchantPairsTable.merchant_id_2, input.keep_merchant_id)
          )
        )
      )
      .execute();

    // 5. Return success response with the merchant IDs
    return {
      success: true,
      message: 'Merchants merged successfully',
      kept_merchant_id: input.keep_merchant_id,
      discarded_merchant_id: input.discard_merchant_id
    };

  } catch (error) {
    console.error('Merchant merge failed:', error);
    return {
      success: false,
      message: 'Database operation failed during merchant merge',
      kept_merchant_id: input.keep_merchant_id,
      discarded_merchant_id: input.discard_merchant_id
    };
  }
}