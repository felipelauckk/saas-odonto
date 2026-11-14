// Dá acesso ao painel /admin para um usuário já cadastrado.
// Uso: npm run admin:add -- email@exemplo.com
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Informe o e-mail: npm run admin:add -- email@exemplo.com");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: id, error } = await admin.rpc("find_user_id_by_email", { _email: email });
if (error || !id) {
  console.error("Usuário não encontrado:", email);
  process.exit(1);
}
const { error: insertError } = await admin.from("platform_admins").upsert({ user_id: id });
if (insertError) {
  console.error(insertError.message);
  process.exit(1);
}
console.log("Superadmin liberado para", email);
