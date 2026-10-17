// Configuração do banco (Supabase). A chave "anon" é pública por natureza:
// ela só permite chamar as funções de ranking definidas em supabase/schema.sql.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'COLE_AQUI_A_URL';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'COLE_AQUI_A_CHAVE_ANON';
