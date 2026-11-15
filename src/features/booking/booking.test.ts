/**
 * Agendamento online, check-in e portal com o banco real: horários vêm da
 * grade, código por WhatsApp (simulado), consulta + paciente + lead criados,
 * horário ocupado some; check-in só com o telefone do paciente; portal vê só
 * o próprio paciente, aprova orçamento e link desativado deixa de valer.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sha256Hex } from "@/lib/hash";
import { utcToZoned } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { checkIn, findTodayAppointments, loadCheckinUnit } from "./checkin";
import { issuePortalToken, loadPortal, openPortal, portalApprovePlan, portalRequestReschedule } from "./portal";
import { confirmBooking, listSlots, requestBooking } from "./service";

describe.skipIf(!hasSupabase)("agendamento online, check-in e portal", () => {
  const env = createTestEnv("portal");
  const admin = env.admin;

  let owner: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let slug = "";
  let token = "";
  const tomorrow = () => {
    const d = new Date(Date.now() + 86_400_000);
    return utcToZoned(d).date;
  };

  beforeAll(async () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    const ownerUser = await env.createUser("owner", "Clínica Portal");
    clinicId = ownerUser.clinicId!;
    const { data: unit } = await admin.from("units").select("id, checkin_token").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    token = unit!.checkin_token;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    // Expediente todos os dias, 09:00–10:00 (2 horários de 30 min).
    await admin.from("professional_schedules").insert([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ clinic_id: clinicId, unit_id: unitId, professional_id: pro, weekday, start_time: "09:00", end_time: "10:00" })));
    const { data: s } = await admin.from("online_booking_settings").update({ enabled: true, min_notice_hours: 0 }).eq("clinic_id", clinicId).select("slug").single();
    slug = s!.slug;
    owner = await env.signIn("owner");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await env.cleanup();
  });

  it("clínica nova tem endereço de agendamento (desligado até ativar)", async () => {
    // Nome da clínica de teste + código aleatório no fim.
    expect(slug).toMatch(/^clinica-portal-[a-z0-9-]+-[0-9a-f]{6}$/);
    await admin.from("online_booking_settings").update({ enabled: false }).eq("clinic_id", clinicId);
    expect(await listSlots(slug, { unitId, professionalId: null, procedureId: null, from: tomorrow() })).toBeNull();
    await admin.from("online_booking_settings").update({ enabled: true }).eq("clinic_id", clinicId);
  });

  it("agenda pelo código: cria paciente, lead e consulta; o horário some", async () => {
    const day = tomorrow();
    const slots = await listSlots(slug, { unitId, professionalId: null, procedureId: null, from: day });
    const first = slots!.find((s) => s.date === day)!;
    expect(first.time).toBe("09:00");

    const req = await requestBooking(slug, { unitId, professionalId: null, procedureId: null, startsAt: first.startsAt, name: "Paula Online", phone: "11977776666" });
    expect(req.devCode).toMatch(/^\d{6}$/);
    const wrong = req.devCode === "000000" ? "111111" : "000000";
    expect((await confirmBooking(slug, req.requestId!, wrong)).error).toBe("Código incorreto.");
    const ok = await confirmBooking(slug, req.requestId!, req.devCode!);
    expect(ok.error).toBeUndefined();
    expect(ok.when).toContain("09:00");

    const { data: patient } = await admin.from("patients").select("id, source").eq("clinic_id", clinicId).eq("phone", "11977776666").single();
    expect(patient!.source).toBe("site");
    const { data: appt } = await admin.from("appointments").select("booked_online, professional_id").eq("patient_id", patient!.id).single();
    expect(appt).toEqual({ booked_online: true, professional_id: pro });
    const { data: lead } = await admin.from("leads").select("crm_stages(auto_key)").eq("patient_id", patient!.id).single();
    expect(lead!.crm_stages?.auto_key).toBe("evaluation_scheduled");

    const after = await listSlots(slug, { unitId, professionalId: pro, procedureId: null, from: day });
    expect(after!.filter((s) => s.date === day).map((s) => s.time)).toEqual(["09:30"]);
    // O código não serve duas vezes; o mesmo horário não é aceito de novo.
    expect((await confirmBooking(slug, req.requestId!, req.devCode!)).error).toMatch(/Comece de novo/);
    expect((await requestBooking(slug, { unitId, professionalId: pro, procedureId: null, startsAt: first.startsAt, name: "Outra", phone: "11966665555" })).error).toMatch(/ocupado/);
  });

  it("check-in: acha a consulta de hoje pelo telefone e marca chegou", async () => {
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Carlos Checkin", whatsapp: "11955554444" }).select("id").single();
    const start = new Date(Date.now() + 30 * 60_000);
    const { data: appt, error: apptError } = await admin
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: pat!.id, professional_id: pro, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60_000).toISOString() })
      .select("id")
      .single();
    expect(apptError).toBeNull();
    const unit = (await loadCheckinUnit(token))!;
    expect(await loadCheckinUnit("0".repeat(32))).toBeNull();
    const found = await findTodayAppointments(unit, "(11) 95555-4444");
    expect(found).toEqual({ appointments: [{ id: appt!.id, firstName: "Carlos", time: utcToZoned(start).time }] });
    expect((await checkIn(unit, appt!.id, "11900000000")).error).toBeTruthy();
    expect(await checkIn(unit, appt!.id, "11955554444")).toEqual({});
    expect((await admin.from("appointments").select("status").eq("id", appt!.id).single()).data!.status).toBe("arrived");
  });

  it("portal: só os dados do paciente, aprova orçamento, pede remarcação; link desativado não abre", async () => {
    const { data: pats } = await admin.from("patients").insert([{ clinic_id: clinicId, full_name: "Dona Portal" }, { clinic_id: clinicId, full_name: "Outro Paciente" }]).select("id, full_name");
    const mine = pats!.find((p) => p.full_name === "Dona Portal")!.id;
    const other = pats!.find((p) => p.full_name === "Outro Paciente")!.id;
    const { data: plan } = await owner.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: mine, professional_id: pro }).select("id").single();
    await owner.from("treatment_items").insert({ clinic_id: clinicId, plan_id: plan!.id, description: "Limpeza", faces: [], price_cents: 25000, position: 0 });
    await admin.from("treatment_plans").update({ status: "presented" }).eq("id", plan!.id);
    const start = new Date(Date.now() + 3 * 86_400_000);
    const { data: appt } = await admin
      .from("appointments")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: mine, professional_id: pro, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 1_800_000).toISOString() })
      .select("id")
      .single();
    await admin.from("receivables").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: other, description: "Do outro", amount_cents: 999, due_date: "2030-01-01" });

    const { token: t, hash, expiresAt } = await issuePortalToken();
    await admin.from("portal_links").insert({ clinic_id: clinicId, patient_id: mine, token_hash: hash, expires_at: expiresAt });
    // O hash não é legível pelo app.
    expect((await owner.from("portal_links").select("token_hash")).error).not.toBeNull();

    const session = (await openPortal(t))!;
    expect(session.patientName).toBe("Dona Portal");
    const data = await loadPortal(session);
    expect(data.plans.map((p) => p.status)).toEqual(["presented"]);
    expect(data.receivables).toEqual([]);
    expect(data.appointments.map((a) => a.id)).toEqual([appt!.id]);

    expect(await portalApprovePlan(session, plan!.id)).toEqual({});
    const after = await loadPortal(session);
    expect(after.plans[0]!.status).toBe("approved");
    expect(after.receivables.map((r) => r.amount_cents)).toEqual([25000]);
    expect((await portalApprovePlan(session, plan!.id)).error).toBeTruthy();

    expect(await portalRequestReschedule(session, appt!.id)).toEqual({});
    expect((await admin.from("appointments").select("reschedule_requested_at").eq("id", appt!.id).single()).data!.reschedule_requested_at).not.toBeNull();

    await admin.from("portal_links").update({ revoked_at: new Date().toISOString() }).eq("token_hash", sha256Hex(t));
    expect(await openPortal(t)).toBeNull();
    expect(await openPortal("x".repeat(43))).toBeNull();
  });
});
