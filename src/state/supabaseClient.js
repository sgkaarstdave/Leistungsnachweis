import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xmggfyewamvpjbcehmit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZ2dmeWV3YW12cGpiY2VobWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MTc3MzksImV4cCI6MjA3OTI5MzczOX0.weuc5pYVpuwoxy1U9UJdlTnnE_-TdWeDSgOMHNax5vI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};
