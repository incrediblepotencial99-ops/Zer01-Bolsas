import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables are missing! Check your .env file.")
}

// Defensive: createClient throws if url/key are undefined, which causes white screen on mobile
let supabase
try {
  supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
} catch (err) {
  console.error("Failed to initialize Supabase client:", err)
  // Create a dummy client that won't crash the app
  supabase = createClient('https://placeholder.supabase.co', 'placeholder')
}

export { supabase }
