import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gnobnyzezkuyptuakztf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('Please set: export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  process.exit(1);
}

console.log(`Using Supabase URL: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface RedditSource {
  name: string;
  url: string;
  country: string;
  enabled: boolean;
  query: string;
}

async function importRedditSources() {
  try {
    // Read CSV file
    const csvPath = path.join(process.cwd(), 'reddit-sources.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV (skip header)
    const lines = csvContent.split('\n').filter(line => line.trim());
    const sources: RedditSource[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const [name, url, country, enabled, query] = line.split(',').map(col => col.trim());
      
      if (!name || !url) continue;
      
      sources.push({
        name,
        url,
        country,
        enabled: enabled === 'TRUE',
        query
      });
    }
    
    console.log(`Parsed ${sources.length} Reddit sources from CSV`);
    
    // Get existing sources to avoid duplicates
    const { data: existing, error: fetchError } = await supabase
      .from('sources')
      .select('name')
      .or(`name.ilike.%Reddit%`);
    
    if (fetchError) {
      console.error('Error fetching existing sources:', fetchError);
    } else {
      console.log(`Found ${existing?.length || 0} existing Reddit sources in database`);
    }
    
    // Insert sources in batches
    const batchSize = 50;
    let inserted = 0;
    let duplicates = 0;
    let errors = 0;
    
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      
      for (const source of batch) {
        // Check if source already exists
        const { data: existing } = await supabase
          .from('sources')
          .select('id')
          .eq('name', source.name)
          .single();
        
        if (existing) {
          duplicates++;
          continue;
        }
        
        // Insert source
        const { error } = await supabase
          .from('sources')
          .insert({
            name: source.name,
            url: source.url,
            country: source.country,
            enabled: source.enabled,
            type: 'reddit',
            query: source.query,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.error(`Error inserting ${source.name}:`, error);
          errors++;
        } else {
          inserted++;
        }
      }
      
      console.log(`Progress: ${Math.min(i + batchSize, sources.length)} / ${sources.length}`);
    }
    
    console.log(`\n=== Import Complete ===`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Duplicates skipped: ${duplicates}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total: ${inserted + duplicates + errors} / ${sources.length}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importRedditSources();
