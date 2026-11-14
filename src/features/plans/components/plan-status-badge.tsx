import { Badge } from "@/components/ui/badge";

import { planStatusLabels, type PlanStatus } from "../labels";

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const variant =
    status === "rejected" ? "destructive" : status === "draft" ? "secondary" : status === "presented" ? "outline" : "default";
  return <Badge variant={variant}>{planStatusLabels[status]}</Badge>;
}
