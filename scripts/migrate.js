const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log('Running migrations...');
  
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      // Note: This is a simplified migration runner
      // For production, use Supabase CLI or a proper migration tool
      const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
      
      if (error) {
        console.error(`Error in migration ${file}:`, error);
        // Continue with other migrations
      } else {
        console.log(`✓ Applied: ${file}`);
      }
    } catch (err) {
      console.error(`Error applying migration ${file}:`, err.message);
    }
  }

  console.log('\nMigrations completed!');
  console.log('\nNote: For production, use Supabase CLI:');
  console.log('  supabase db push');
}

migrate();
