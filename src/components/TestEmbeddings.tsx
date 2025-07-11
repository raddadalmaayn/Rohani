import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

export function TestEmbeddings() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerateEmbeddings = async () => {
    setIsGenerating(true);
    setResult(null);
    
    try {
      console.log('Calling generate-embeddings function...');
      
      const { data, error } = await supabase.functions.invoke('generate-embeddings', {
        body: {}
      });

      if (error) {
        console.error('Generate embeddings error:', error);
        setResult({ error: error.message });
      } else {
        console.log('Generate embeddings response:', data);
        setResult(data);
      }
      
    } catch (error) {
      console.error('Unexpected error:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const checkEmbeddings = async () => {
    try {
      const { data, error } = await supabase
        .from('scripture')
        .select('id, source_ref, embedding')
        .limit(5);
      
      if (error) {
        console.error('Check embeddings error:', error);
        setResult({ error: error.message });
      } else {
        console.log('Embeddings check:', data);
        setResult({ embeddings: data });
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Test Embeddings Generation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerateEmbeddings} 
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Embeddings'}
          </Button>
          <Button onClick={checkEmbeddings} variant="outline">
            Check Embeddings
          </Button>
        </div>
        
        {result && (
          <div className="bg-gray-100 p-4 rounded text-sm">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}