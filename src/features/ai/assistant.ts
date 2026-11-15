import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { createBookedAppointment, loadBookingForClinic, slotsForPage } from "@/features/booking/service";
import { normalizePhone } from "@/features/booking/slots";
import { AI_FALLBACK, AI_MODEL, aiClient, checkAiAccess, recordAiUsage } from "@/lib/ai/claude";
import { addUsage, type Usage } from "@/lib/ai/cost";
import { getMessagingProvider } from "@/lib/messaging";
import { toWhatsAppNumber } from "@/lib/messaging/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatLongDate, utcToZoned } from "@/lib/timezone";

type Admin = ReturnType<typeof createAdminClient>;
type Conversation = { id: string; clinic_id: string; phone: string; patient_id: string | null; mode: "bot" | "human"; unread: number };

/** Telefone do WhatsApp (55 + DDD + número) → só DDD + número, como no cadastro. */
export function localPhone(waPhone: string): string | null {
  return normalizePhone(waPhone);
}

/**
 * De qual clínica é a mensagem: pelo número de WhatsApp da clínica (quando
 * cadastrado) ou, com um número único para todas, pelo telefone do paciente
 * — só se ele estiver em uma clínica só.
 */
export async function resolveClinic(admin: Admin, phoneNumberId: string | null, from: string): Promise<string | null> {
  if (phoneNumberId) {
    const { data } = await admin.from("clinic_ai_settings").select("clinic_id").eq("whatsapp_phone_number_id", phoneNumberId).maybeSingle();
    if (data) return data.clinic_id;
  }
  const phone = localPhone(from);
  if (!phone) return null;
  const { data: patients } = await admin.from("patients").select("clinic_id").or(`phone.eq.${phone},whatsapp.eq.${phone}`).is("archived_at", null).limit(10);
  const clinics = [...new Set((patients ?? []).map((p) => p.clinic_id))];
  return clinics.length === 1 ? clinics[0]! : null;
}

async function conversationFor(admin: Admin, clinicId: string, phone: string): Promise<Conversation> {
  const { data: existing } = await admin.from("whatsapp_conversations").select("id, clinic_id, phone, patient_id, mode, unread").eq("clinic_id", clinicId).eq("phone", phone).maybeSingle();
  if (existing) return existing;
  const { data: patient } = await admin.from("patients").select("id").eq("clinic_id", clinicId).is("archived_at", null).or(`phone.eq.${phone},whatsapp.eq.${phone}`).limit(1).maybeSingle();
  const { data, error } = await admin.from("whatsapp_conversations").insert({ clinic_id: clinicId, phone, patient_id: patient?.id ?? null }).select("id, clinic_id, phone, patient_id, mode, unread").single();
  if (error) throw error;
  return data;
}

async function addMessage(admin: Admin, c: Conversation, author: "patient" | "bot" | "staff" | "system", body: string, createdBy: string | null = null) {
  await admin.from("whatsapp_messages").insert({ clinic_id: c.clinic_id, conversation_id: c.id, author, body: body.slice(0, 4000), created_by: createdBy });
  await admin
    .from("whatsapp_conversations")
    .update({ last_message_at: new Date().toISOString(), ...(author === "patient" ? { unread: c.unread + 1 } : {}) })
    .eq("id", c.id);
}

/** Envia um texto ao paciente (resposta dentro da conversa) e guarda na caixa de entrada. */
export async function sendToConversation(c: Conversation, author: "bot" | "staff", body: string, createdBy: string | null = null) {
  const admin = createAdminClient();
  const to = toWhatsAppNumber(c.phone);
  if (to) {
    await getMessagingProvider()
      .send({ to, kind: "appointment_confirmation", text: body, variables: { paciente: "", clinica: "" }, isReply: true })
      .catch(() => undefined);
  }
  await addMessage(admin, c, author, body, createdBy);
}

const SYSTEM = (clinicName: string, info: string, today: string) =>
  [
    `Você é o atendente virtual da ${clinicName}, uma clínica odontológica, conversando pelo WhatsApp.`,
    `Hoje é ${today} (horário de Brasília).`,
    "Responda em português do Brasil, com mensagens curtas e cordiais, como no WhatsApp. Sem markdown.",
    "Use só as informações da clínica abaixo e o que as ferramentas devolverem. Se não souber, diga que vai chamar alguém da equipe e use handoff_to_human.",
    "Nunca dê diagnóstico, prescrição ou orientação clínica: para isso, sugira uma consulta.",
    "Para marcar, primeiro busque horários livres, ofereça poucas opções e só marque depois que o paciente escolher; peça o nome completo se for paciente novo.",
    "Para desmarcar, confirme qual consulta antes. Fale só das consultas deste próprio paciente.",
    "Se o paciente pedir para falar com uma pessoa, reclamar ou o assunto for sensível (urgência, dor forte, pagamento), use handoff_to_human.",
    "",
    "Informações da clínica:",
    info || "(a clínica ainda não cadastrou informações)",
  ].join("\n");

/**
 * Responde uma mensagem do paciente com o assistente. Devolve o texto enviado
 * (ou nulo se a conversa passou para a equipe ou a IA está desligada).
 */
export async function runAssistant(conversation: Conversation, client: Pick<Anthropic, "beta"> = aiClient()): Promise<string | null> {
  const admin = createAdminClient();
  const access = await checkAiAccess(conversation.clinic_id, "assistant");
  if (!access.ok) return null;
  const [{ data: clinic }, { data: settings }, { data: units }, page, { data: history }] = await Promise.all([
    admin.from("clinics").select("name").eq("id", conversation.clinic_id).single(),
    admin.from("clinic_ai_settings").select("assistant_info").eq("clinic_id", conversation.clinic_id).single(),
    admin.from("units").select("id, name, address").eq("clinic_id", conversation.clinic_id).eq("active", true),
    loadBookingForClinic(conversation.clinic_id),
    admin.from("whatsapp_messages").select("author, body").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const today = utcToZoned(new Date()).date;
  let patientId = conversation.patient_id;
  let handedOff = false;

  const tools = [
    betaZodTool({
      name: "find_free_slots",
      description: "Horários livres para consulta a partir de uma data (até 7 dias). Use antes de oferecer horários.",
      inputSchema: z.object({
        from: z.string().describe("data inicial AAAA-MM-DD"),
        unit_id: z.string().nullable().describe("id da unidade, ou null para a primeira"),
        professional_id: z.string().nullable().describe("id do profissional, ou null para qualquer um"),
      }),
      run: async ({ from, unit_id, professional_id }) => {
        if (!page) return "Agendamento indisponível: chame a equipe.";
        const unitId = unit_id ?? page.units[0]?.id;
        if (!unitId) return "Nenhuma unidade disponível.";
        const slots = await slotsForPage(page, { unitId, professionalId: professional_id, procedureId: page.procedures[0]?.id ?? null, from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : today });
        if (!slots?.length) return "Nenhum horário livre nesses dias.";
        const name = (id: string) => page.professionals.find((p) => p.id === id)?.name ?? "";
        return JSON.stringify(slots.slice(0, 12).map((s) => ({ starts_at: s.startsAt, quando: `${formatLongDate(s.date)} às ${s.time}`, professional_id: s.professionalId, profissional: name(s.professionalId), unit_id: unitId })));
      },
    }),
    betaZodTool({
      name: "book_appointment",
      description: "Marca a consulta num horário devolvido por find_free_slots, depois que o paciente escolheu.",
      inputSchema: z.object({ starts_at: z.string(), professional_id: z.string(), unit_id: z.string(), patient_name: z.string().describe("nome completo do paciente") }),
      run: async (input) => {
        if (!page) return "Agendamento indisponível.";
        const duration = page.procedures[0]?.durationMin ?? page.defaultDurationMin;
        const start = new Date(input.starts_at);
        if (Number.isNaN(start.getTime())) return "Horário inválido.";
        const result = await createBookedAppointment(
          page,
          { unitId: input.unit_id, professionalId: input.professional_id, procedureId: page.procedures[0]?.id ?? null, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + duration * 60_000).toISOString(), name: input.patient_name, phone: conversation.phone },
          "Agendado pelo assistente de WhatsApp.",
        );
        if ("error" in result) return result.error;
        patientId = result.patientId;
        await admin.from("whatsapp_conversations").update({ patient_id: result.patientId }).eq("id", conversation.id);
        return "Consulta marcada.";
      },
    }),
    betaZodTool({
      name: "my_appointments",
      description: "Próximas consultas deste paciente.",
      inputSchema: z.object({}),
      run: async () => {
        if (!patientId) return "Nenhum paciente cadastrado com este telefone.";
        const { data } = await admin.from("appointments").select("id, starts_at, status, professionals(name)").eq("patient_id", patientId).gte("starts_at", new Date().toISOString()).not("status", "in", "(canceled,no_show)").order("starts_at").limit(5);
        if (!data?.length) return "Nenhuma consulta marcada.";
        return JSON.stringify(data.map((a) => ({ id: a.id, quando: `${formatLongDate(utcToZoned(a.starts_at).date)} às ${utcToZoned(a.starts_at).time}`, profissional: a.professionals?.name })));
      },
    }),
    betaZodTool({
      name: "cancel_appointment",
      description: "Desmarca uma consulta deste paciente (id de my_appointments), depois que ele confirmou.",
      inputSchema: z.object({ appointment_id: z.string() }),
      run: async ({ appointment_id }) => {
        if (!patientId) return "Paciente não identificado.";
        const { data } = await admin
          .from("appointments")
          .update({ status: "canceled", cancel_reason: "patient_canceled", cancel_note: "Desmarcada pelo paciente no WhatsApp." })
          .eq("id", appointment_id)
          .eq("patient_id", patientId)
          .gte("starts_at", new Date().toISOString())
          .select("id");
        return data?.length ? "Consulta desmarcada." : "Consulta não encontrada.";
      },
    }),
    betaZodTool({
      name: "handoff_to_human",
      description: "Passa a conversa para a equipe da clínica (o assistente para de responder).",
      inputSchema: z.object({ reason: z.string() }),
      run: async ({ reason }) => {
        handedOff = true;
        await admin.from("whatsapp_conversations").update({ mode: "human" }).eq("id", conversation.id);
        await addMessage(admin, conversation, "system", `Assistente passou para a equipe: ${reason}`);
        return "Conversa passada para a equipe. Avise o paciente que alguém vai responder em breve.";
      },
    }),
  ];

  // Histórico do mais antigo ao mais novo; paciente = user, robô/equipe = assistant.
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of [...(history ?? [])].reverse()) {
    if (m.author === "system") continue;
    const role = m.author === "patient" ? "user" : "assistant";
    const last = messages.at(-1);
    if (last && last.role === role) last.content = `${last.content as string}\n${m.body}`;
    else messages.push({ role, content: m.body });
  }
  while (messages[0]?.role === "assistant") messages.shift();
  if (!messages.length) return null;

  const unitsInfo = (units ?? []).map((u) => `Unidade ${u.name} (id ${u.id})`).join("; ");
  const prosInfo = page?.professionals.map((p) => `${p.name} (id ${p.id})`).join("; ") ?? "";
  const runner = client.beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 2000,
    ...AI_FALLBACK,
    system: `${SYSTEM(clinic?.name ?? "clínica", settings?.assistant_info ?? "", formatLongDate(today))}\n\n${unitsInfo}\nProfissionais: ${prosInfo}`,
    messages,
    tools,
    output_config: { effort: "low" },
    max_iterations: 6,
  });
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  let final: Anthropic.Beta.BetaMessage | null = null;
  for await (const message of runner) {
    usage = addUsage(usage, message.usage);
    final = message;
  }
  await recordAiUsage({ clinicId: conversation.clinic_id, userId: null, feature: "assistant", usage });
  if (!final || final.stop_reason === "refusal") {
    if (!handedOff) {
      await admin.from("whatsapp_conversations").update({ mode: "human" }).eq("id", conversation.id);
      await addMessage(admin, conversation, "system", "Assistente não conseguiu responder: conversa passada para a equipe.");
    }
    return null;
  }
  const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  if (!text) return null;
  await sendToConversation(conversation, "bot", text);
  return text;
}

/**
 * Mensagem recebida do paciente: guarda na caixa de entrada e, se a conversa
 * está com o robô e o assistente está ligado, responde.
 */
export async function handleInboundMessage(input: { phoneNumberId: string | null; from: string; text: string; clinicId?: string }, client?: Pick<Anthropic, "beta">) {
  const admin = createAdminClient();
  const clinicId = input.clinicId ?? (await resolveClinic(admin, input.phoneNumberId, input.from));
  const phone = localPhone(input.from);
  if (!clinicId || !phone) return { handled: false as const };
  const conversation = await conversationFor(admin, clinicId, phone);
  await addMessage(admin, conversation, "patient", input.text);
  if (conversation.mode === "human") return { handled: true as const, reply: null };
  try {
    const reply = await runAssistant({ ...conversation, unread: conversation.unread + 1 }, client);
    return { handled: true as const, reply };
  } catch {
    await admin.from("whatsapp_conversations").update({ mode: "human" }).eq("id", conversation.id);
    await addMessage(admin, conversation, "system", "Assistente indisponível: conversa passada para a equipe.");
    return { handled: true as const, reply: null };
  }
}
