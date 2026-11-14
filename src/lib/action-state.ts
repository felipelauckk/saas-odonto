/** Resultado padrão das Server Actions usadas com useActionState. */
export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Valores enviados, para reapresentar o formulário depois de um erro. */
  values?: Record<string, string>;
};

export const idleState: ActionState = { status: "idle" };

/** Converte FormData em objeto simples (só campos de texto). */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

const SECRET_FIELDS = new Set(["password", "confirmPassword"]);

/** Remove senhas antes de devolver os valores ao navegador. */
export function withoutSecrets(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !SECRET_FIELDS.has(key)));
}
