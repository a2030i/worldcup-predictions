import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("⚠️ أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env");
}
export const supabase = createClient(url, key);
