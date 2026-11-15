/**
 * Remove dados que sobraram de testes automáticos no Supabase configurado em
 * .env.local: usuários @example.com e as clínicas que só têm esses usuários.
 *
 *   node scripts/purge-test-data.mjs          # só mostra o que seria apagado
 *   node scripts/purge-test-data.mjs --apply  # apaga
 *
 * Usuários com outros e-mails e as clínicas deles nunca são tocados. A conta
 * de teste manual (clinicateste@example.com / "Clínica Teste") é protegida.
 */
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const apply = process.argv.includes("--apply");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PROTECTED_EMAILS = new Set(["clinicateste@example.com"]);
const PROTECTED_CLINICS = new Set(["Clínica Teste"]);
// Usuários criados pelos testes automáticos: e2e-xxxx@example.com e <prefixo>-<papel>-<execução>@example.com.
const isTestEmail = (email) => /@example\.com$/i.test(email ?? "") && !PROTECTED_EMAILS.has((email ?? "").toLowerCase());

const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const testUsers = users.filter((u) => isTestEmail(u.email));
const testIds = new Set(testUsers.map((u) => u.id));

const { data: clinics, error: clinicsError } = await admin.from("clinics").select("id, name").limit(10000);
if (clinicsError) throw clinicsError;
const { data: members } = await admin.from("clinic_members").select("clinic_id, user_id").limit(50000);
const usersByClinic = new Map();
for (const m of members ?? []) usersByClinic.set(m.clinic_id, [...(usersByClinic.get(m.clinic_id) ?? []), m.user_id]);
// Clínica de teste: todos os membros são usuários de teste (ou não sobrou nenhum membro e o nome é de teste).
const testClinics = clinics.filter((c) => {
  if (PROTECTED_CLINICS.has(c.name)) return false;
  const list = usersByClinic.get(c.id) ?? [];
  // Sem nenhum membro: sobra de teste cuja limpeza falhou no meio.
  return list.length ? list.every((id) => testIds.has(id)) : true;
});
const kept = clinics.filter((c) => !testClinics.includes(c));

console.log(`Usuários: ${users.length} (${testUsers.length} de teste). Reais: ${users.filter((u) => !testIds.has(u.id)).map((u) => u.email).join(", ")}`);
console.log(`Clínicas: ${clinics.length} (${testClinics.length} de teste). Ficam: ${kept.map((c) => c.name).join(", ")}`);
if (!apply) {
  console.log("Nada foi apagado. Rode com --apply para apagar.");
  process.exit(0);
}

const { purgeClinic } = await import("../src/test/purge-clinic.ts");
let done = 0;
const failed = [];
for (const c of testClinics) {
  try {
    await purgeClinic(admin, c.id);
    done++;
  } catch (e) {
    failed.push(`${c.name}: ${e.message}`);
  }
}
for (const u of testUsers) await admin.auth.admin.deleteUser(u.id);
console.log(`Apagadas ${done} clínicas e ${testUsers.length} usuários de teste.`);
if (failed.length) console.log(`Falharam ${failed.length}:\n${failed.slice(0, 10).join("\n")}`);
