import { Badge } from "@/components/ui/badge";

import { statusLabels, type AppointmentStatus } from "../labels";

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const variant = status === "no_show" ? "destructive" : status === "canceled" ? "secondary" : status === "done" ? "outline" : "default";
  return <Badge variant={variant}>{statusLabels[status]}</Badge>;
}
