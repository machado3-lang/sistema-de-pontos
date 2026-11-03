import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'sua_url_aqui'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sua_chave_aqui'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
