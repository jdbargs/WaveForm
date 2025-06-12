// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hppvbcggmujfnvqnmhew.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwcHZiY2dnbXVqZm52cW5taGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2NDY3MzgsImV4cCI6MjA2NTIyMjczOH0.iC2pX0OIqUdXwfcVvX4gkMQktkpysMM4RbAnl_7Ycsc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
