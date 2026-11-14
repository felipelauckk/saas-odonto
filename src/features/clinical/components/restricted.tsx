import { Lock } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";

export function ClinicalRestricted() {
  return (
    <EmptyState
      icon={Lock}
      title="Prontuário restrito"
      description="Anamnese completa, odontograma, evoluções e arquivos clínicos são vistos só pelos dentistas e pela gestão da clínica."
    />
  );
}
