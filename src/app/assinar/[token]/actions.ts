"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { answerSchema } from "@/features/clinical/anamnesis";
import { completeSignature } from "@/features/documents/signing";

const schema = z.object({
  token: z.string().max(100),
  accepted: z.literal(true, { message: "Marque a caixa de aceite." }),
  signerName: z.string().trim().min(5, "Digite seu nome completo.").max(160),
  signature: z.string().startsWith("data:image/png;base64,", "Desenhe sua assinatura.").max(600_000, "Assinatura grande demais."),
  answers: z.array(answerSchema).max(80).optional(),
});

/** Ação pública (sem login): o próprio link é a credencial. */
export async function submitSignature(input: z.input<typeof schema>): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const png = Buffer.from(parsed.data.signature.slice("data:image/png;base64,".length), "base64");
  // Assinatura vazia ou quase vazia (PNG mínimo ~100 bytes) não vale.
  if (png.byteLength < 400) return { error: "Desenhe sua assinatura no quadro." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconhecido").trim();
  const userAgent = h.get("user-agent") ?? "desconhecido";

  const error = await completeSignature({
    token: parsed.data.token,
    signerName: parsed.data.signerName,
    signaturePng: new Uint8Array(png),
    ip,
    userAgent,
    answers: parsed.data.answers,
  });
  return error ? { error } : {};
}
