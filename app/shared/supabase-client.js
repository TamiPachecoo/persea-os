// Real Supabase client — the actual backend, replacing localStorage/MockDB
// one role at a time (client role first; see docs/supabase-schema-plan.md).
// Loaded via esm.sh since this app has no build step/bundler, same
// "no build step" convention as the rest of the prototype.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://bletlyuptkppacjcbcvw.supabase.co';
// Publishable key — safe to expose client-side (mirrors the old "anon key"
// role), every real access rule is enforced by Postgres RLS policies, not
// by keeping this secret.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_37D7JJzhUDCUwtHtYA4gjw_jiSXDMxu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
