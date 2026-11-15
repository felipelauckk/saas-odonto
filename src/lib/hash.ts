import { createHash, randomBytes } from "node:crypto";

/** SHA-256 em hexadecimal (64 caracteres). */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Token de link público: 32 bytes aleatórios em base64url (impossível de adivinhar). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Formato aceito para tokens recebidos de fora (evita consultas com lixo). */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
