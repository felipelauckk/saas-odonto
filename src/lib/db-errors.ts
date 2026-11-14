/** Erros do banco que já trazem mensagem pronta para o usuário (assinatura e limites do plano). */
export function subscriptionErrorMessage(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  if (error.code === "OS001" || error.code === "OS002") return error.message ?? null;
  return null;
}
