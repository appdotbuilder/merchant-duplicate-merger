import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { merchantPairsTable } from '../db/schema';
import { getMerchantPairs } from '../handlers/get_merchant_pairs';

describe('getMerchantPairs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no merchant pairs exist', async () => {
    const result = await getMerchantPairs();
    
    expect(result).toEqual([]);
  });

  it('should return unprocessed merchant pairs', async () => {
    // Create test merchant pairs - one processed, one unprocessed
    await db.insert(merchantPairsTable).values([
      {
        merchant_id_1: 'merchant_1',
        merchant_name_1: 'Test Merchant 1',
        creation_date_1: new Date('2023-01-15'),
        merchant_id_2: 'merchant_2',
        merchant_name_2: 'Test Merchant 2',
        creation_date_2: new Date('2023-02-10'),
        cosine_distance: '0.85', // String for numeric column
        is_processed: 'false'
      },
      {
        merchant_id_1: 'merchant_3',
        merchant_name_1: 'Processed Merchant',
        creation_date_1: new Date('2023-03-01'),
        merchant_id_2: 'merchant_4',
        merchant_name_2: 'Another Processed',
        creation_date_2: new Date('2023-03-05'),
        cosine_distance: '0.92',
        is_processed: 'true' // This should be filtered out
      }
    ]).execute();

    const result = await getMerchantPairs();

    // Should return only the unprocessed pair
    expect(result).toHaveLength(1);
    
    const pair = result[0];
    expect(pair.merchant_id_1).toEqual('merchant_1');
    expect(pair.merchant_name_1).toEqual('Test Merchant 1');
    expect(pair.creation_date_1).toEqual(new Date('2023-01-15'));
    expect(pair.merchant_id_2).toEqual('merchant_2');
    expect(pair.merchant_name_2).toEqual('Test Merchant 2');
    expect(pair.creation_date_2).toEqual(new Date('2023-02-10'));
    expect(pair.cosine_distance).toEqual(0.85);
    expect(typeof pair.cosine_distance).toBe('number');
  });

  it('should return multiple unprocessed pairs', async () => {
    // Create multiple unprocessed merchant pairs
    await db.insert(merchantPairsTable).values([
      {
        merchant_id_1: 'merchant_a',
        merchant_name_1: 'Merchant A',
        creation_date_1: new Date('2023-01-01'),
        merchant_id_2: 'merchant_b',
        merchant_name_2: 'Merchant B',
        creation_date_2: new Date('2023-01-02'),
        cosine_distance: '0.75',
        is_processed: 'false'
      },
      {
        merchant_id_1: 'merchant_c',
        merchant_name_1: 'Merchant C',
        creation_date_1: new Date('2023-02-01'),
        merchant_id_2: 'merchant_d',
        merchant_name_2: 'Merchant D',
        creation_date_2: new Date('2023-02-02'),
        cosine_distance: '0.88',
        is_processed: 'false'
      }
    ]).execute();

    const result = await getMerchantPairs();

    expect(result).toHaveLength(2);
    
    // Verify all pairs have proper numeric conversion
    result.forEach(pair => {
      expect(typeof pair.cosine_distance).toBe('number');
      expect(pair.creation_date_1).toBeInstanceOf(Date);
      expect(pair.creation_date_2).toBeInstanceOf(Date);
    });

    // Check specific values
    const firstPair = result.find(p => p.merchant_id_1 === 'merchant_a');
    expect(firstPair).toBeDefined();
    expect(firstPair!.cosine_distance).toEqual(0.75);

    const secondPair = result.find(p => p.merchant_id_1 === 'merchant_c');
    expect(secondPair).toBeDefined();
    expect(secondPair!.cosine_distance).toEqual(0.88);
  });

  it('should handle high precision cosine distances correctly', async () => {
    // Test with high precision decimal values
    await db.insert(merchantPairsTable).values({
      merchant_id_1: 'precision_test_1',
      merchant_name_1: 'Precision Test 1',
      creation_date_1: new Date('2023-06-01'),
      merchant_id_2: 'precision_test_2',
      merchant_name_2: 'Precision Test 2',
      creation_date_2: new Date('2023-06-02'),
      cosine_distance: '0.12345678', // High precision value
      is_processed: 'false'
    }).execute();

    const result = await getMerchantPairs();

    expect(result).toHaveLength(1);
    expect(result[0].cosine_distance).toEqual(0.12345678);
    expect(typeof result[0].cosine_distance).toBe('number');
  });

  it('should not return processed merchant pairs', async () => {
    // Create only processed pairs
    await db.insert(merchantPairsTable).values([
      {
        merchant_id_1: 'processed_1',
        merchant_name_1: 'Processed Merchant 1',
        creation_date_1: new Date('2023-04-01'),
        merchant_id_2: 'processed_2',
        merchant_name_2: 'Processed Merchant 2',
        creation_date_2: new Date('2023-04-02'),
        cosine_distance: '0.95',
        is_processed: 'true'
      },
      {
        merchant_id_1: 'processed_3',
        merchant_name_1: 'Another Processed',
        creation_date_1: new Date('2023-04-03'),
        merchant_id_2: 'processed_4',
        merchant_name_2: 'Yet Another Processed',
        creation_date_2: new Date('2023-04-04'),
        cosine_distance: '0.87',
        is_processed: 'true'
      }
    ]).execute();

    const result = await getMerchantPairs();

    expect(result).toHaveLength(0);
  });
});