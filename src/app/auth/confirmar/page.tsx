import { Suspense } from "react";
import type { Metadata } from "next";

import { Brand } from "@/components/layout/brand";
import { AuthCallback } from "@/features/auth/components/auth-callback";

export const metadata: Metadata = { title: "Confirmando acesso" };

export default function Page() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <main className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xs sm:p-8">
        <Suspense>
          <AuthCallback />
        </Suspense>
      </main>
    </div>
  );
}
