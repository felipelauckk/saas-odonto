import type { Metadata } from "next";
import { QrCode } from "lucide-react";

import { loadCheckinUnit } from "@/features/booking/checkin";
import { CheckinForm } from "@/features/booking/components/checkin-form";

import { doCheckin, lookupCheckin } from "./actions";

export const metadata: Metadata = { title: "Check-in", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/checkin/[token]">) {
  const { token } = await params;
  const unit = await loadCheckinUnit(token);
  return (
    <div className="min-h-full bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {unit ? (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">Check-in · {unit.clinicName}</h1>
              <p className="text-sm text-muted-foreground">Avise que você chegou{unit.unitName ? ` na unidade ${unit.unitName}` : ""}.</p>
            </div>
            <CheckinForm token={token} lookup={lookupCheckin} confirm={doCheckin} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
            <QrCode className="size-8 text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-medium">QR Code inválido</h1>
            <p className="text-sm text-muted-foreground">Fale com a recepção.</p>
          </div>
        )}
      </div>
    </div>
  );
}
