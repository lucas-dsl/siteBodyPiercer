export const SUPABASE_URL = "https://cctpqkndzulicjkuneft.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mgGCZvAVHshW_QZcmd8xpA_i_sRwDq3";

export const supabaseConfigurado =
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("COLE_AQUI");
