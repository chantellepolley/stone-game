import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tabsvmsnkdltuzenhgkw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYnN2bXNua2RsdHV6ZW5oZ2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDgzMTYsImV4cCI6MjA5MTg4NDMxNn0.jHLlIj_u998taHN-Qo4zp_ivjQi6UDA11kiKeqQ48Rc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
