import { Badge } from "@/components/ui/badge";

export function StatusBadge({ active }: { active: boolean }) {
  return active ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>;
}
