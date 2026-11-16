export type Optional<T> = { ok: true; value: T } | { ok: false };

/** Bloco opcional da tela: se a leitura falhar, só ele mostra o aviso e o resto segue. */
export async function optional<T>(tag: string, promise: Promise<T>): Promise<Optional<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    console.error(`[${tag}]`, error);
    return { ok: false };
  }
}
