"use server";

import { z } from "zod";

import { checkIn, findTodayAppointments, loadCheckinUnit } from "@/features/booking/checkin";

/** Ações públicas do QR Code da recepção. */
export async function lookupCheckin(token: string, phone: string) {
  const unit = await loadCheckinUnit(token);
  if (!unit) return { error: "QR Code inválido." };
  return findTodayAppointments(unit, phone.slice(0, 30));
}

export async function doCheckin(token: string, appointmentId: string, phone: string) {
  const unit = await loadCheckinUnit(token);
  if (!unit || !z.uuid().safeParse(appointmentId).success) return { error: "QR Code inválido." };
  return checkIn(unit, appointmentId, phone.slice(0, 30));
}
