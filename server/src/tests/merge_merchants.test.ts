import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { merchantsTable, merchantPairsTable, mergeHistoryTable } from '../db/schema';
import { type MergeMerchantsInput } from '../schema';
import { mergeMerchants } from '../handlers/merge_merchants';
import { eq, and, or } from 'drizzle-orm';

describe('mergeMerchants', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test merchants
  const createTestMerchants = async () => {
    await db.insert(merchantsTable).values([
      {
        id: 'merchant_1',
        name: 'Test Merchant 1',
        creation_date: new Date('2023-01-01'),
        is_active: 'true'
      },
      {
        id: 'merchant_2',
        name: 'Test Merchant 2',
        creation_date: new Date('2023-01-02'),
        is_active: 'true'
      },
      {
        id: 'merchant_3',
        name: 'Inactive Merchant',
        creation_date: new Date('2023-01-03'),
        is_active: 'false'
      }
    ]).execute();
  };

  // Helper function to create test merchant pairs
  const createTestMerchantPairs = async () => {
    await db.insert(merchantPairsTable).values([
      {
        merchant_id_1: 'merchant_1',
        merchant_name_1: 'Test Merchant 1',
        creation_date_1: new Date('2023-01-01'),
        merchant_id_2: 'merchant_2',
        merchant_name_2: 'Test Merchant 2',
        creation_date_2: new Date('2023-01-02'),
        cosine_distance: '0.85000000',
        is_processed: 'false'
      },
      {
        merchant_id_1: 'merchant_2',
        merchant_name_1: 'Test Merchant 2',
        creation_date_1: new Date('2023-01-02'),
        merchant_id_2: 'merchant_1',
        merchant_name_2: 'Test Merchant 1',
        creation_date_2: new Date('2023-01-01'),
        cosine_distance: '0.90000000',
        is_processed: 'false'
      }
    ]).execute();
  };

  const testInput: MergeMerchantsInput = {
    keep_merchant_id: 'merchant_1',
    discard_merchant_id: 'merchant_2'
  };

  it('should successfully merge two valid merchants', async () => {
    await createTestMerchants();

    const result = await mergeMerchants(testInput);

    expect(result.success).toBe(true);
    expect(result.message).toEqual('Merchants merged successfully');
    expect(result.kept_merchant_id).toEqual('merchant_1');
    expect(result.discarded_merchant_id).toEqual('merchant_2');
  });

  it('should deactivate the discarded merchant', async () => {
    await createTestMerchants();

    await mergeMerchants(testInput);

    // Verify the discarded merchant is marked as inactive
    const discardedMerchant = await db.select()
      .from(merchantsTable)
      .where(eq(merchantsTable.id, 'merchant_2'))
      .execute();

    expect(discardedMerchant).toHaveLength(1);
    expect(discardedMerchant[0].is_active).toEqual('false');
    expect(discardedMerchant[0].updated_at).toBeInstanceOf(Date);
  });

  it('should keep the kept merchant active', async () => {
    await createTestMerchants();

    await mergeMerchants(testInput);

    // Verify the kept merchant remains active
    const keptMerchant = await db.select()
      .from(merchantsTable)
      .where(eq(merchantsTable.id, 'merchant_1'))
      .execute();

    expect(keptMerchant).toHaveLength(1);
    expect(keptMerchant[0].is_active).toEqual('true');
  });

  it('should record merge operation in merge history', async () => {
    await createTestMerchants();

    await mergeMerchants(testInput);

    // Verify merge history record was created
    const mergeHistory = await db.select()
      .from(mergeHistoryTable)
      .where(
        and(
          eq(mergeHistoryTable.kept_merchant_id, 'merchant_1'),
          eq(mergeHistoryTable.discarded_merchant_id, 'merchant_2')
        )
      )
      .execute();

    expect(mergeHistory).toHaveLength(1);
    expect(mergeHistory[0].kept_merchant_id).toEqual('merchant_1');
    expect(mergeHistory[0].discarded_merchant_id).toEqual('merchant_2');
    expect(mergeHistory[0].merged_at).toBeInstanceOf(Date);
    expect(mergeHistory[0].merged_by).toBeNull();
  });

  it('should mark relevant merchant pairs as processed', async () => {
    await createTestMerchants();
    await createTestMerchantPairs();

    await mergeMerchants(testInput);

    // Verify merchant pairs involving these merchants are marked as processed
    const processedPairs = await db.select()
      .from(merchantPairsTable)
      .where(
        or(
          and(
            eq(merchantPairsTable.merchant_id_1, 'merchant_1'),
            eq(merchantPairsTable.merchant_id_2, 'merchant_2')
          ),
          and(
            eq(merchantPairsTable.merchant_id_1, 'merchant_2'),
            eq(merchantPairsTable.merchant_id_2, 'merchant_1')
          )
        )
      )
      .execute();

    expect(processedPairs).toHaveLength(2);
    processedPairs.forEach(pair => {
      expect(pair.is_processed).toEqual('true');
    });
  });

  it('should return error when keep merchant does not exist', async () => {
    await createTestMerchants();

    const invalidInput: MergeMerchantsInput = {
      keep_merchant_id: 'nonexistent_merchant',
      discard_merchant_id: 'merchant_2'
    };

    const result = await mergeMerchants(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Merchant to keep.*not found/);
    expect(result.kept_merchant_id).toEqual('nonexistent_merchant');
    expect(result.discarded_merchant_id).toEqual('merchant_2');
  });

  it('should return error when discard merchant does not exist', async () => {
    await createTestMerchants();

    const invalidInput: MergeMerchantsInput = {
      keep_merchant_id: 'merchant_1',
      discard_merchant_id: 'nonexistent_merchant'
    };

    const result = await mergeMerchants(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Merchant to discard.*not found/);
    expect(result.kept_merchant_id).toEqual('merchant_1');
    expect(result.discarded_merchant_id).toEqual('nonexistent_merchant');
  });

  it('should return error when trying to merge merchant with itself', async () => {
    await createTestMerchants();

    const invalidInput: MergeMerchantsInput = {
      keep_merchant_id: 'merchant_1',
      discard_merchant_id: 'merchant_1'
    };

    const result = await mergeMerchants(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toEqual('Cannot merge merchant with itself');
    expect(result.kept_merchant_id).toEqual('merchant_1');
    expect(result.discarded_merchant_id).toEqual('merchant_1');
  });

  it('should return error when trying to discard already inactive merchant', async () => {
    await createTestMerchants();

    const invalidInput: MergeMerchantsInput = {
      keep_merchant_id: 'merchant_1',
      discard_merchant_id: 'merchant_3' // This merchant is already inactive
    };

    const result = await mergeMerchants(invalidInput);

    expect(result.success).toBe(false);
    expect(result.message).toEqual('Merchant to discard is already inactive');
    expect(result.kept_merchant_id).toEqual('merchant_1');
    expect(result.discarded_merchant_id).toEqual('merchant_3');
  });

  it('should handle merchant pairs correctly when they exist in different order', async () => {
    await createTestMerchants();
    
    // Create pair with merchants in reverse order
    await db.insert(merchantPairsTable).values({
      merchant_id_1: 'merchant_2',
      merchant_name_1: 'Test Merchant 2',
      creation_date_1: new Date('2023-01-02'),
      merchant_id_2: 'merchant_1',
      merchant_name_2: 'Test Merchant 1',
      creation_date_2: new Date('2023-01-01'),
      cosine_distance: '0.75000000',
      is_processed: 'false'
    }).execute();

    await mergeMerchants(testInput);

    // Verify the pair is marked as processed regardless of order
    const processedPairs = await db.select()
      .from(merchantPairsTable)
      .where(eq(merchantPairsTable.is_processed, 'true'))
      .execute();

    expect(processedPairs).toHaveLength(1);
    expect(processedPairs[0].merchant_id_1).toEqual('merchant_2');
    expect(processedPairs[0].merchant_id_2).toEqual('merchant_1');
  });

  it('should not affect unrelated merchant pairs', async () => {
    await createTestMerchants();
    
    // Create merchants and pairs not involved in the merge
    await db.insert(merchantsTable).values({
      id: 'merchant_4',
      name: 'Unrelated Merchant',
      creation_date: new Date('2023-01-04'),
      is_active: 'true'
    }).execute();

    await db.insert(merchantPairsTable).values([
      {
        merchant_id_1: 'merchant_1',
        merchant_name_1: 'Test Merchant 1',
        creation_date_1: new Date('2023-01-01'),
        merchant_id_2: 'merchant_2',
        merchant_name_2: 'Test Merchant 2',
        creation_date_2: new Date('2023-01-02'),
        cosine_distance: '0.85000000',
        is_processed: 'false'
      },
      {
        merchant_id_1: 'merchant_3',
        merchant_name_1: 'Inactive Merchant',
        creation_date_1: new Date('2023-01-03'),
        merchant_id_2: 'merchant_4',
        merchant_name_2: 'Unrelated Merchant',
        creation_date_2: new Date('2023-01-04'),
        cosine_distance: '0.70000000',
        is_processed: 'false'
      }
    ]).execute();

    await mergeMerchants(testInput);

    // Check that only the relevant pair is marked as processed
    const allPairs = await db.select()
      .from(merchantPairsTable)
      .execute();

    const processedPairs = allPairs.filter(pair => pair.is_processed === 'true');
    const unprocessedPairs = allPairs.filter(pair => pair.is_processed === 'false');

    expect(processedPairs).toHaveLength(1);
    expect(unprocessedPairs).toHaveLength(1);
    
    // Verify the unrelated pair is not processed
    expect(unprocessedPairs[0].merchant_id_1).toEqual('merchant_3');
    expect(unprocessedPairs[0].merchant_id_2).toEqual('merchant_4');
  });
});