/**
 * Recursos de IA com um cliente falso no lugar da API do Claude (sem custo,
 * sem rede): liga/desliga por clínica, limite mensal, registro de custo, ditado
 * estruturado, assistente de WhatsApp (ferramentas reais de agenda, passagem
 * para a equipe) e perguntas sobre os dados com as permissões do usuário.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { checkAiAccess } from "@/lib/ai/claude";
import { utcToZoned } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { handleInboundMessage } from "./assistant";
import { askData } from "./insights";
import { structureDictation } from "./voice";

type ToolLike = { name: string; run: (input: unknown) => Promise<string> | string };
const usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

/** Cliente falso: parse devolve o objeto dado; toolRunner executa as ferramentas pedidas e termina com o texto. */
function fakeClient(script: { parsed?: unknown; calls?: { name: string; input: unknown }[]; reply?: string }) {
  const results: string[] = [];
  return {
    results,
    client: {
      beta: {
        messages: {
          parse: async () => ({ stop_reason: "end_turn", parsed_output: script.parsed, usage }),
          create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: script.reply ?? "" }], usage }),
          toolRunner: (params: { tools: ToolLike[] }) => ({
            async *[Symbol.asyncIterator]() {
              for (const call of script.calls ?? []) {
                const tool = params.tools.find((t) => t.name === call.name)!;
                results.push(await tool.run(call.input));
                yield { stop_reason: "tool_use", content: [], usage };
              }
              yield { stop_reason: "end_turn", content: [{ type: "text", text: script.reply ?? "" }], usage };
            },
          }),
        },
      },
    } as never,
  };
}

describe.skipIf(!hasSupabase)("recursos de IA", () => {
  const env = createTestEnv("ia");
  const admin = env.admin;

  let owner: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let ownerUserId = "";

  beforeAll(async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "teste");
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    const ownerUser = await env.createUser("owner", "Clínica IA");
    clinicId = ownerUser.clinicId!;
    ownerUserId = ownerUser.userId;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    await admin.from("professional_schedules").insert([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ clinic_id: clinicId, unit_id: unitId, professional_id: pro, weekday, start_time: "09:00", end_time: "11:00" })));
    await admin.from("online_booking_settings").update({ min_notice_hours: 0 }).eq("clinic_id", clinicId);
    owner = await env.signIn("owner");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await env.cleanup();
  });

  it("recurso desligado não roda; ligado roda e registra o custo; limite do mês bloqueia", async () => {
    expect((await checkAiAccess(clinicId, "voice")).ok).toBe(false);
    await admin.from("clinic_ai_settings").update({ voice_enabled: true, insights_enabled: true, assistant_enabled: true }).eq("clinic_id", clinicId);

    const { client } = fakeClient({ parsed: { text: "Restauração classe II no 36 com resina A2." } });
    const r = await structureDictation({ clinicId, userId: ownerUserId, kind: "note", text: "restauração no trinta e seis", context: {} }, client);
    expect(r).toEqual({ kind: "note", data: { text: "Restauração classe II no 36 com resina A2." } });
    const { data: log } = await admin.from("ai_usage_log").select("feature, input_tokens, output_tokens, cost_usd, user_id").eq("clinic_id", clinicId);
    // 1000 de entrada × $4/M + 200 de saída × $20/M = $0,008
    expect(log).toEqual([{ feature: "voice", input_tokens: 1000, output_tokens: 200, cost_usd: 0.008, user_id: ownerUserId }]);
    // Ninguém da clínica grava uso direto; a gestão lê.
    expect((await owner.from("ai_usage_log").select("id")).data).toHaveLength(1);

    // Limite com 2 casas decimais: zero já está abaixo do gasto.
    await admin.from("clinic_ai_settings").update({ monthly_limit_usd: 0 }).eq("clinic_id", clinicId);
    try {
      expect(await checkAiAccess(clinicId, "voice")).toEqual({ ok: false, error: "Limite mensal de uso de IA da clínica atingido." });
    } finally {
      await admin.from("clinic_ai_settings").update({ monthly_limit_usd: 20 }).eq("clinic_id", clinicId);
    }
  });

  it("assistente: busca horário livre e marca a consulta de verdade; cria paciente e conversa", async () => {
    const tomorrow = utcToZoned(new Date(Date.now() + 86_400_000)).date;
    const fake = fakeClient({
      calls: [{ name: "find_free_slots", input: { from: tomorrow, unit_id: null, professional_id: null } }],
      reply: "Tenho amanhã às 9h ou 9h30. Qual prefere?",
    });
    const first = await handleInboundMessage({ phoneNumberId: null, from: "5511933332222", text: "Oi, quero marcar uma avaliação", clinicId }, fake.client);
    expect(first.reply).toBe("Tenho amanhã às 9h ou 9h30. Qual prefere?");
    const slots = JSON.parse(fake.results[0]!) as { starts_at: string; professional_id: string; unit_id: string }[];
    expect(slots.length).toBeGreaterThan(0);

    const book = fakeClient({
      calls: [{ name: "book_appointment", input: { starts_at: slots[0]!.starts_at, professional_id: slots[0]!.professional_id, unit_id: slots[0]!.unit_id, patient_name: "Marcos WhatsApp" } }],
      reply: "Pronto, Marcos! Consulta marcada.",
    });
    await handleInboundMessage({ phoneNumberId: null, from: "5511933332222", text: "Pode ser às 9h, sou Marcos WhatsApp", clinicId }, book.client);
    expect(book.results).toEqual(["Consulta marcada."]);
    const { data: patient } = await admin.from("patients").select("id").eq("clinic_id", clinicId).eq("phone", "11933332222").single();
    const { data: appt } = await admin.from("appointments").select("booked_online, starts_at").eq("patient_id", patient!.id).single();
    expect(appt!.booked_online).toBe(true);

    const { data: conv } = await admin.from("whatsapp_conversations").select("id, patient_id, mode").eq("clinic_id", clinicId).eq("phone", "11933332222").single();
    expect(conv).toMatchObject({ patient_id: patient!.id, mode: "bot" });
    const { data: msgs } = await admin.from("whatsapp_messages").select("author").eq("conversation_id", conv!.id).order("created_at");
    expect(msgs!.map((m) => m.author)).toEqual(["patient", "bot", "patient", "bot"]);
  });

  it("assistente passa para a equipe e depois não responde mais; mensagem de clínica desconhecida é ignorada", async () => {
    const handoff = fakeClient({ calls: [{ name: "handoff_to_human", input: { reason: "pediu atendente" } }], reply: "Vou chamar alguém da equipe." });
    await handleInboundMessage({ phoneNumberId: null, from: "5511922221111", text: "Quero falar com uma pessoa", clinicId }, handoff.client);
    const { data: conv } = await admin.from("whatsapp_conversations").select("mode").eq("clinic_id", clinicId).eq("phone", "11922221111").single();
    expect(conv!.mode).toBe("human");
    const after = await handleInboundMessage({ phoneNumberId: null, from: "5511922221111", text: "Alô?", clinicId }, fakeClient({ reply: "não deveria" }).client);
    expect(after).toEqual({ handled: true, reply: null });
    expect(await handleInboundMessage({ phoneNumberId: "999", from: "5511900000001", text: "oi" })).toEqual({ handled: false });
  });

  it("perguntas sobre os dados usam os relatórios com as permissões de quem pergunta", async () => {
    const fake = fakeClient({ calls: [{ name: "run_report", input: { slug: "faltas", from: null, to: null, group_by: null, professional_id: null, months: null } }], reply: "Nenhuma falta neste mês." });
    const r = await askData({ supabase: owner as never, clinicId, userId: ownerUserId, question: "Quantas faltas tivemos?" }, fake.client);
    expect(r).toEqual({ answer: "Nenhuma falta neste mês." });
    const report = JSON.parse(fake.results[0]!) as { colunas: string[] };
    expect(report.colunas[0]).toContain("Profissional");
  });
});
