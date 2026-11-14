/**
 * Assinatura no banco: teste vencido sem pagamento bloqueia a criação de
 * registros (critério de aceite), carência de 7 dias no atraso, limites do plano
 * e superadmin restrito ao servidor.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("assinatura (modo só leitura e limites)", () => {
  const env = createTestEnv("assinatura");
  const admin = env.admin;

  let owner: Client;
  let clinicId = "";
  let planId = "";
  const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  const setClinic = (values: Database["public"]["Tables"]["clinics"]["Update"]) => admin.from("clinics").update(values).eq("id", clinicId);
  const insertPatient = (name: string) => owner.from("patients").insert({ clinic_id: clinicId, full_name: name });

  beforeAll(async () => {
    const user = await env.createUser("owner", "Clínica Assinatura");
    clinicId = user.clinicId!;
    owner = await env.signIn("owner");
    const { data: plan } = await admin
      .from("plans")
      .insert({ name: `Teste ${env.runId}`, price_cents: 9900, max_units: 1, max_professionals: 2 })
      .select("id")
      .single();
    planId = plan!.id;
  });

  afterAll(async () => {
    await env.cleanup();
    await admin.from("plans").delete().eq("id", planId);
  });

  it("em teste válido, escreve normalmente", async () => {
    const { data } = await owner.rpc("clinic_access_state", { _clinic_id: clinicId });
    expect(data).toBe("ok");
    expect((await insertPatient("Durante o teste")).error).toBeNull();
  });

  it("teste vencido sem pagamento bloqueia criação, mas a leitura continua", async () => {
    await setClinic({ trial_ends_at: days(-1) });
    const { data: state } = await owner.rpc("clinic_access_state", { _clinic_id: clinicId });
    expect(state).toBe("read_only");

    const { error } = await insertPatient("Depois do teste");
    expect(error?.code).toBe("OS001");

    const { data: patients } = await owner.from("patients").select("full_name");
    expect(patients?.map((p) => p.full_name)).toEqual(["Durante o teste"]);

    const { error: updateError } = await owner.from("patients").update({ notes: "x" }).eq("clinic_id", clinicId);
    expect(updateError?.code).toBe("OS001");
  });

  it("atraso dá 7 dias de carência; depois, só leitura", async () => {
    await setClinic({ subscription_status: "past_due", past_due_since: days(-3), plan_id: planId });
    expect((await insertPatient("Em carência")).error).toBeNull();

    await setClinic({ past_due_since: days(-8) });
    expect((await insertPatient("Fora da carência")).error?.code).toBe("OS001");

    await setClinic({ subscription_status: "active", past_due_since: null });
    expect((await insertPatient("Pagou")).error).toBeNull();
  });

  it("limites do plano: 1 unidade e 2 profissionais", async () => {
    const { error: unitError } = await owner.from("units").insert({ clinic_id: clinicId, name: "Segunda unidade" });
    expect(unitError?.code).toBe("OS002");

    const pro = (name: string) => owner.from("professionals").insert({ clinic_id: clinicId, name });
    expect((await pro("Um")).error).toBeNull();
    expect((await pro("Dois")).error).toBeNull();
    expect((await pro("Três")).error?.code).toBe("OS002");
  });

  it("cancelada fica só leitura; superadmin não é visível ao app", async () => {
    await setClinic({ subscription_status: "canceled" });
    expect((await insertPatient("Cancelada")).error?.code).toBe("OS001");

    const { data: isAdmin } = await owner.rpc("is_platform_admin");
    expect(isAdmin).toBe(false);
    const { data: admins } = await owner.from("platform_admins" as never).select("*");
    expect(admins ?? []).toEqual([]);
  });
});
