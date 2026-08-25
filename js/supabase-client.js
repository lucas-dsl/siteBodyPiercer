import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://cctpqkndzulicjkuneft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mgGCZvAVHshW_QZcmd8xpA_i_sRwDq3";

export const supabaseConfigurado =
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("COLE_AQUI");

export const supabase = supabaseConfigurado
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    })
    : null;

export function exigirSupabaseConfigurado() {
    if (!supabaseConfigurado) {
        throw new Error(
            "Configure a URL e a chave publicável em js/supabase-client.js."
        );
    }
}
