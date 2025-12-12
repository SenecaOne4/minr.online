import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Guard against missing env vars - create client only if both are present
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log('[supabase] Client initialized');
} else {
  console.warn('[supabase] Missing environment variables - Supabase features disabled');
}

// Export a getter that returns null if Supabase is not configured
export { supabase };

