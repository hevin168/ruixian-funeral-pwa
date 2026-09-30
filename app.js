const SUPABASE_URL = "https://zjetemcqysvpbnyvpyma.supabase.co";
const SUPABASE_KEY = "sb_publishable_jdeKO7PxDMGjAg_qCFw5FA_wr5OJcei";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

alert("Supabase連線程式已載入");
