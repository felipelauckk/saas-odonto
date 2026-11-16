"use client";

import { usePathname } from "next/navigation";

import { TabNav } from "@/components/app/tab-nav";

import { PATIENT_TABS } from "../labels";

export function PatientTabs({ patientId }: { patientId: string }) {
  const pathname = usePathname();
  const base = `/pacientes/${patientId}`;
  const tabs = PATIENT_TABS.map(({ slug, label }) => {
    const href = slug ? `${base}/${slug}` : base;
    const active = slug ? pathname.startsWith(href) : pathname === base || pathname === `${base}/editar`;
    return { href, label, active };
  });
  return <TabNav label="Ficha do paciente" tabs={tabs} />;
}
