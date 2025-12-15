import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { appendFileSync } from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Guard against missing env vars - create client only if both are present
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  // #region agent log
  try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'supabaseClient.ts:10',message:'Creating Supabase client',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseServiceRoleKey,urlLength:supabaseUrl.length,keyLength:supabaseServiceRoleKey.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'supabaseClient.ts:10',message:'Creating Supabase client',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseServiceRoleKey,urlLength:supabaseUrl.length,keyLength:supabaseServiceRoleKey.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e2){}}
  // #endregion
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log('[supabase] Client initialized');
  // #region agent log
  try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'supabaseClient.ts:17',message:'Supabase client created',data:{hasClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'supabaseClient.ts:17',message:'Supabase client created',data:{hasClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e2){}}
  // #endregion
} else {
  console.warn('[supabase] Missing environment variables - Supabase features disabled');
  // #region agent log
  try{const logPath='/Users/seneca/Desktop/minr.online/.cursor/debug.log';appendFileSync(logPath,JSON.stringify({location:'supabaseClient.ts:20',message:'Supabase client NOT created - missing env vars',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseServiceRoleKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){try{appendFileSync('/var/www/minr-online/.cursor/debug.log',JSON.stringify({location:'supabaseClient.ts:20',message:'Supabase client NOT created - missing env vars',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseServiceRoleKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e2){}}
  // #endregion
}

// Export a getter that returns null if Supabase is not configured
export { supabase };

