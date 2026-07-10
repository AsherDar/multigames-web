import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wsjvmzuixauhsasatltb.supabase.co';
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzanZtenVpeGF1aHNhc2F0bHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzEwMjUsImV4cCI6MjA5OTEwNzAyNX0.pHbLcOFDZiwMdXdDtnOJzDbCKERx_6AVerdSwGg9K_E"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);