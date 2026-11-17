import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { fields: { name: string; label: string; type: "date" | "month"; value: string }[]; selects?: { name: string; label: string; value: string; options: { value: string; label: string }[] }[] };

/** Filtro simples por GET (funciona sem JavaScript). */
export function PeriodFilter({ fields, selects = [] }: Props) {
  return (
    <form method="get" className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      {fields.map((f) => (
        <div key={f.name} className="min-w-0 space-y-1.5">
          <Label htmlFor={`pf-${f.name}`}>{f.label}</Label>
          <Input id={`pf-${f.name}`} name={f.name} type={f.type} defaultValue={f.value} className="w-full sm:w-auto" />
        </div>
      ))}
      {selects.map((s) => (
        <div key={s.name} className="min-w-0 space-y-1.5">
          <Label htmlFor={`pf-${s.name}`}>{s.label}</Label>
          <select id={`pf-${s.name}`} name={s.name} defaultValue={s.value} className="h-10 w-full rounded-lg border border-input sm:w-auto bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring pointer-coarse:h-11">
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
        Aplicar
      </Button>
    </form>
  );
}
