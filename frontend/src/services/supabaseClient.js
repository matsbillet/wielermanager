import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL en Anon Key moeten ingesteld zijn in .env.local",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
