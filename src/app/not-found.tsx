import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">O endereço acessado não existe.</p>
      <Button className="mt-6" render={<Link href="/painel" />} nativeButton={false}>
        Voltar ao painel
      </Button>
    </div>
  );
}
