import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { fields: { name: string; label: string; type: "date" | "month"; value: string }[]; selects?: { name: string; label: string; value: string; options: { value: string; label: string }[] }[] };

/** Filtro simples por GET (funciona sem JavaScript). */
export function PeriodFilter({ fields, selects = [] }: Props) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={`pf-${f.name}`}>{f.label}</Label>
          <Input id={`pf-${f.name}`} name={f.name} type={f.type} defaultValue={f.value} className="w-auto" />
        </div>
      ))}
      {selects.map((s) => (
        <div key={s.name} className="space-y-1.5">
          <Label htmlFor={`pf-${s.name}`}>{s.label}</Label>
          <select id={`pf-${s.name}`} name={s.name} defaultValue={s.value} className="h-9 rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11">
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit" variant="outline">
        Aplicar
      </Button>
    </form>
  );
}
