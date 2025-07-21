import { createClient } from '@supabase/supabase-js';

// Test configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

describe('match_quran RPC function', () => {
  let testIds: string[] = [];

  beforeEach(async () => {
    // Start transaction and insert test data
    const { data: verse1, error: error1 } = await supabase
      .from('quran')
      .insert({
        source_ref: 'Test:1',
        text_ar: 'هذا نص تجريبي أول',
        text_en: 'This is first test text',
        embedding: Array(1536).fill(0).map((_, i) => i === 0 ? 1 : 0) // Vector similar to [1,0,0,...]
      })
      .select('id')
      .single();

    const { data: verse2, error: error2 } = await supabase
      .from('quran')
      .insert({
        source_ref: 'Test:2', 
        text_ar: 'هذا نص تجريبي ثاني',
        text_en: 'This is second test text',
        embedding: Array(1536).fill(0).map((_, i) => i === 1 ? 1 : 0) // Vector similar to [0,1,0,...]
      })
      .select('id')
      .single();

    if (error1 || error2) {
      throw new Error(`Failed to insert test data: ${error1?.message || error2?.message}`);
    }

    testIds = [verse1.id, verse2.id];
  });

  afterEach(async () => {
    // Clean up test data
    if (testIds.length > 0) {
      await supabase
        .from('quran')
        .delete()
        .in('id', testIds);
    }
  });

  test('should return verses ordered by similarity', async () => {
    // Query with vector similar to first test verse
    const queryVector = Array(1536).fill(0).map((_, i) => i === 0 ? 1 : 0);

    const { data, error } = await supabase.rpc('match_quran', {
      embedding_input: queryVector,
      match_count: 2
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    // First result should be more similar (higher similarity score)
    if (data.length >= 2) {
      const firstResult = data.find(item => item.id === testIds[0]);
      const secondResult = data.find(item => item.id === testIds[1]);
      
      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
      expect(firstResult.similarity).toBeGreaterThan(secondResult.similarity);
    }
  });

  test('should respect match_count parameter', async () => {
    const queryVector = Array(1536).fill(0).map((_, i) => i === 0 ? 1 : 0);

    const { data, error } = await supabase.rpc('match_quran', {
      embedding_input: queryVector,
      match_count: 1
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(1);
  });

  test('should return expected fields', async () => {
    const queryVector = Array(1536).fill(0).map((_, i) => i === 0 ? 1 : 0);

    const { data, error } = await supabase.rpc('match_quran', {
      embedding_input: queryVector,
      match_count: 1
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    if (data && data.length > 0) {
      const result = data[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('source_ref');
      expect(result).toHaveProperty('text_ar');
      expect(result).toHaveProperty('text_en');
      expect(result).toHaveProperty('similarity');
      expect(typeof result.similarity).toBe('number');
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    }
  });
});