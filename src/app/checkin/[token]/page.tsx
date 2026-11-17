import type { Metadata } from "next";
import { PublicNotice, PublicShell } from "@/components/app/public-shell";
import { QrCode } from "lucide-react";

import { loadCheckinUnit } from "@/features/booking/checkin";
import { CheckinForm } from "@/features/booking/components/checkin-form";

import { doCheckin, lookupCheckin } from "./actions";

export const metadata: Metadata = { title: "Check-in", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/checkin/[token]">) {
  const { token } = await params;
  const unit = await loadCheckinUnit(token);
  return (
    <PublicShell clinicName={unit?.clinicName ?? null} detail={unit?.unitName ? `Unidade ${unit.unitName}` : null} width="sm">
      {unit ? (
        <>
          <div className="space-y-1">
            <h1 className="type-title">Check-in</h1>
            <p className="text-sm text-muted-foreground">Avise que você chegou{unit.unitName ? ` na unidade ${unit.unitName}` : ""}.</p>
          </div>
          <CheckinForm token={token} lookup={lookupCheckin} confirm={doCheckin} />
        </>
      ) : (
        <PublicNotice icon={<QrCode aria-hidden />} title="QR Code inválido">
          Fale com a recepção.
        </PublicNotice>
      )}
    </PublicShell>
  );
}
