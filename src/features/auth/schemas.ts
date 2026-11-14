import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .pipe(z.email("E-mail inválido."))
  .transform((value) => value.toLowerCase());

/** Senha forte: 8+ caracteres, com letra e número. */
export const strongPassword = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa ter pelo menos uma letra.")
  .regex(/\d/, "A senha precisa ter pelo menos um número.");

/** WhatsApp brasileiro com DDD. Guarda só os dígitos. */
export const whatsapp = z
  .string()
  .trim()
  .min(1, "Informe o WhatsApp.")
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => /^[1-9]{2}9?\d{8}$/.test(digits), "WhatsApp inválido. Use DDD + número.");

const personName = z
  .string()
  .trim()
  .min(2, "Informe o nome completo.")
  .max(120, "Nome muito longo.");

export const signUpSchema = z.object({
  clinicName: z
    .string()
    .trim()
    .min(2, "Informe o nome da clínica.")
    .max(120, "Nome muito longo."),
  fullName: personName,
  email,
  whatsapp,
  password: strongPassword,
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha."),
});

export const recoverPasswordSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
