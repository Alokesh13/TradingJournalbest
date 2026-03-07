import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://egeefulckusdepssgykk.supabase.co"
const supabaseKey = "sb_publishable_6IxH5R3CbqzqrwawozSzvQ_DlTdXxS9"

export const supabase = createClient(supabaseUrl, supabaseKey)
