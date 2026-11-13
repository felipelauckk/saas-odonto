import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ message: "SUPABASE_SERVICE_ROLE_KEY ausente" })
    .min(1, "SUPABASE_SERVICE_ROLE_KEY ausente"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Variáveis secretas. Este módulo não pode ser importado em componente client. */
export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
