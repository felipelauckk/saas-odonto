import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";

import type { ProstheticKind, ProstheticStage } from "./labels";

export type ProstheticOrder = {
  id: string;
  kind: ProstheticKind;
  stage: ProstheticStage;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  professionalId: string | null;
  planItemId: string | null;
  planItemLabel: string | null;
  labId: string | null;
  labName: string | null;
  labPhone: string | null;
  labServiceId: string | null;
  workType: string;
  teeth: number[];
  shade: string | null;
  material: string | null;
  sentOn: string | null;
  expectedReturnOn: string | null;
  returnedOn: string | null;
  costCents: number;
  payableId: string | null;
  alignerTotal: number | null;
  alignerChangeDays: number | null;
  alignersDelivered: number;
  alignerStartedOn: string | null;
  notes: string | null;
  stageChangedAt: string;
};

const SELECT =
  "id, kind, stage, patient_id, professional_id, plan_item_id, lab_id, lab_service_id, work_type, teeth, shade, material, sent_on, expected_return_on, returned_on, cost_cents, payable_id, aligner_total, aligner_change_days, aligners_delivered, aligner_started_on, notes, stage_changed_at, patients(full_name, whatsapp, phone), labs(name, phone), treatment_items(description, tooth)";

type Row = {
  id: string;
  kind: ProstheticKind;
  stage: ProstheticStage;
  patient_id: string;
  professional_id: string | null;
  plan_item_id: string | null;
  lab_id: string | null;
  lab_service_id: string | null;
  work_type: string;
  teeth: number[];
  shade: string | null;
  material: string | null;
  sent_on: string | null;
  expected_return_on: string | null;
  returned_on: string | null;
  cost_cents: number;
  payable_id: string | null;
  aligner_total: number | null;
  aligner_change_days: number | null;
  aligners_delivered: number;
  aligner_started_on: string | null;
  notes: string | null;
  stage_changed_at: string;
  patients: { full_name: string; whatsapp: string | null; phone: string | null } | null;
  labs: { name: string; phone: string | null } | null;
  treatment_items: { description: string; tooth: number | null } | null;
};

function map(r: Row): ProstheticOrder {
  return {
    id: r.id,
    kind: r.kind,
    stage: r.stage,
    patientId: r.patient_id,
    patientName: r.patients?.full_name ?? "Paciente",
    patientPhone: r.patients?.whatsapp ?? r.patients?.phone ?? null,
    professionalId: r.professional_id,
    planItemId: r.plan_item_id,
    planItemLabel: r.treatment_items ? `${r.treatment_items.description}${r.treatment_items.tooth ? ` (dente ${r.treatment_items.tooth})` : ""}` : null,
    labId: r.lab_id,
    labName: r.labs?.name ?? null,
    labPhone: r.labs?.phone ?? null,
    labServiceId: r.lab_service_id,
    workType: r.work_type,
    teeth: r.teeth,
    shade: r.shade,
    material: r.material,
    sentOn: r.sent_on,
    expectedReturnOn: r.expected_return_on,
    returnedOn: r.returned_on,
    costCents: r.cost_cents,
    payableId: r.payable_id,
    alignerTotal: r.aligner_total,
    alignerChangeDays: r.aligner_change_days,
    alignersDelivered: r.aligners_delivered,
    alignerStartedOn: r.aligner_started_on,
    notes: r.notes,
    stageChangedAt: r.stage_changed_at,
  };
}

/** Quadro: tudo em andamento + entregues nos últimos 60 dias (alinhadores em uso sempre aparecem). */
export async function getProstheticsBoard(today: string) {
  const supabase = await createClient();
  const cutoff = zonedToUtc(addDays(today, -60), "00:00").toISOString();
  const [ordersRes, labsRes, servicesRes, prosRes] = await Promise.all([
    supabase.from("prosthetic_orders").select(SELECT).neq("stage", "canceled").order("expected_return_on", { nullsFirst: false }).limit(1000),
    supabase.from("labs").select("id, name, phone, active").order("name"),
    supabase.from("lab_services").select("id, lab_id, name, price_cents, days, active").order("name"),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  const orders = (ordersRes.data as unknown as Row[])
    .map(map)
    .filter((o) => o.stage !== "delivered" || o.stageChangedAt >= cutoff || (o.kind === "aligner" && o.alignersDelivered < (o.alignerTotal ?? 0)));
  return { orders, labs: labsRes.data ?? [], services: servicesRes.data ?? [], professionals: prosRes.data ?? [] };
}

export async function listPatientOrders(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("prosthetic_orders").select(SELECT).eq("patient_id", patientId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(map);
}

export async function listLabsSetup() {
  const supabase = await createClient();
  const [labs, services] = await Promise.all([
    supabase.from("labs").select("id, name, contact_name, phone, email, notes, active").order("name"),
    supabase.from("lab_services").select("id, lab_id, name, price_cents, days, active").order("name"),
  ]);
  return { labs: labs.data ?? [], services: services.data ?? [] };
}
