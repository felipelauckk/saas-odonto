import { z } from "zod";

import { memberRoles } from "@/features/tenancy/roles";

export const inviteMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail.")
    .pipe(z.email("E-mail inválido."))
    .transform((value) => value.toLowerCase()),
  role: z.enum(memberRoles, { message: "Escolha o papel." }),
});

export const updateMemberSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(memberRoles).optional(),
  active: z.boolean().optional(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
