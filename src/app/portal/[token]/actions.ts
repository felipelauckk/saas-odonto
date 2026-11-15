"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { openPortal, portalApprovePlan, portalConfirmAppointment, portalPayReceivable, portalRequestReschedule, portalSignLink } from "@/features/booking/portal";

/** Ações do portal: o próprio link é a credencial; tudo é conferido contra o paciente do link. */
async function session(token: string) {
  return openPortal(token);
}

const id = z.uuid();

export async function confirmAppointmentAction(token: string, appointmentId: string) {
  const s = await session(token);
  if (!s || !id.safeParse(appointmentId).success) return { error: "Link expirado. Peça um novo à clínica." };
  const r = await portalConfirmAppointment(s, appointmentId);
  revalidatePath(`/portal/${token}`);
  return r;
}

export async function rescheduleAction(token: string, appointmentId: string) {
  const s = await session(token);
  if (!s || !id.safeParse(appointmentId).success) return { error: "Link expirado. Peça um novo à clínica." };
  const r = await portalRequestReschedule(s, appointmentId);
  revalidatePath(`/portal/${token}`);
  return r;
}

export async function approvePlanAction(token: string, planId: string) {
  const s = await session(token);
  if (!s || !id.safeParse(planId).success) return { error: "Link expirado. Peça um novo à clínica." };
  const r = await portalApprovePlan(s, planId);
  revalidatePath(`/portal/${token}`);
  return r;
}

export async function payAction(token: string, receivableId: string) {
  const s = await session(token);
  if (!s || !id.safeParse(receivableId).success) return { error: "Link expirado. Peça um novo à clínica." };
  return portalPayReceivable(s, receivableId);
}

export async function signAction(token: string, target: { documentId: string } | { anamnesis: true }) {
  const s = await session(token);
  if (!s || ("documentId" in target && !id.safeParse(target.documentId).success)) return { error: "Link expirado. Peça um novo à clínica." };
  return portalSignLink(s, target);
}
