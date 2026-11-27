/**
 * Fase 3, P10: pedido de avaliação no Google depois do "Atendido" (WhatsApp
 * simulado). Só com o modelo ligado e o link cadastrado; uma vez por consulta
 * e no máximo uma por paciente a cada 90 dias.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { createTestEnv, hasSupabase } from "@/test/supabase";

import { runReviewRequests } from "./service";

describe.skipIf(!hasSupabase)("pedido de avaliação no Google (P10)", () => {
  const env = createTestEnv("avaliacao-p10");
  const admin = env.admin;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let patient = "";

  const doneAppointment = async (hoursAgo: number) => {
    const end = new Date(Date.now() - hoursAgo * 3_600_000);
    const start = new Date(end.getTime() - 1_800_000);
    const { data } = await admin
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patient, professional_id: pro, starts_at: start.toISOString(), ends_at: end.toISOString(), status: "done" })
      .select("id")
      .single();
    return data!.id;
  };
  const sentCount = async () =>
    (await admin.from("messages_log").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("template_kind", "review_request")).count ?? 0;

  beforeAll(async () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    const owner = await env.createUser("owner", "Clínica Avaliação");
    clinicId = owner.clinicId!;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Nota" }).select("id").single();
    pro = p!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Bruno Avaliador", whatsapp: "11966665555" }).select("id").single();
    patient = pat!.id;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await env.cleanup();
  });

  it("modelo nasce desligado; sem link ou desligado não envia", async () => {
    const { data: tpl } = await admin.from("message_templates").select("active, body").eq("clinic_id", clinicId).eq("kind", "review_request").single();
    expect(tpl!.active).toBe(false);
    expect(tpl!.body).toContain("{{link}}");
    await doneAppointment(5);
    await runReviewRequests(createAdminClient(), new Date(), clinicId);
    expect(await sentCount()).toBe(0);
  });

  it("ligado e com link: respeita as horas de espera, envia uma vez e não repete para o mesmo paciente", async () => {
    await admin.from("message_templates").update({ active: true }).eq("clinic_id", clinicId).eq("kind", "review_request");
    await admin.from("clinics").update({ google_review_url: "https://g.page/r/clinica-teste/review", review_request_delay_hours: 3 }).eq("id", clinicId);
    // A consulta de 5 horas atrás (do teste anterior) sai agora; a de 1 hora atrás ainda espera.
    const early = await doneAppointment(1);
    expect((await runReviewRequests(createAdminClient(), new Date(), clinicId)).sent).toBe(1);
    expect((await admin.from("appointments").select("review_requested_at").eq("id", early).single()).data!.review_requested_at).toBeNull();
    const { data: log } = await admin.from("messages_log").select("body, status").eq("clinic_id", clinicId).eq("template_kind", "review_request").single();
    expect(log!.body).toContain("https://g.page/r/clinica-teste/review");
    expect(log!.status).toBe("simulated");

    // Horas depois a consulta "cedo demais" já passou do prazo, mas o paciente já recebeu: não repete.
    const later = new Date(Date.now() + 3 * 3_600_000);
    expect((await runReviewRequests(createAdminClient(), later, clinicId)).sent).toBe(0);
    expect(await sentCount()).toBe(1);
    expect((await admin.from("appointments").select("review_requested_at").eq("id", early).single()).data!.review_requested_at).not.toBeNull();
  });
});
