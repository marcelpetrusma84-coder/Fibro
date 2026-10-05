// supabase-js 2.113.0 staat in de eigen repo (supabase-lib.js), niet meer via jsdelivr
import { createClient } from './supabase-lib.js?v=1'

export const supabase = createClient(
  'https://qmgatbphiplrfxrljtbe.supabase.co',
  'sb_publishable_pyFn83YMR7K2O8K1s7g4YQ_mSJZwGSf'
)
