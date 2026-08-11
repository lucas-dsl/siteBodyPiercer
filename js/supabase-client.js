import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SUPABASE";
const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_A_CHAVE_PUBLICAVEL_DO_SUPABASE";

export const supabaseConfigurado =
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("COLE_AQUI");

export const supabase = supabaseConfigurado
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
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
