import { createBrowserClient } from "@supabase/ssr";

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings.');
    throw new Error('Supabase URL and Anon Key must be provided. Check Vercel environment variables.');
  }
  
  cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
};
