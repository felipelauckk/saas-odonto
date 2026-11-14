"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionState } from "@/lib/action-state";

import { saveSchedule } from "../actions/professionals";

/** Segunda a domingo (0 = domingo no banco). */
const WEEKDAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

type Entry = { key: string; unitId: string; weekday: number; start: string; end: string };

type ScheduleEditorProps = {
  professionalId: string;
  units: { id: string; name: string }[];
  initial: { unit_id: string; weekday: number; start_time: string; end_time: string }[];
};

let counter = 0;
const newKey = () => `p${++counter}`;

export function ScheduleEditor({ professionalId, units, initial }: ScheduleEditorProps) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    initial.map((s) => ({
      key: newKey(),
      unitId: s.unit_id,
      weekday: s.weekday,
      start: s.start_time.slice(0, 5),
      end: s.end_time.slice(0, 5),
    })),
  );
  const [message, setMessage] = useState<ActionState>({ status: "idle" });
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const defaultUnit = units[0]?.id ?? "";
  const unitItems = units.map((u) => ({ value: u.id, label: u.name }));

  function update(next: Entry[]) {
    setEntries(next);
    setDirty(true);
    setMessage({ status: "idle" });
  }

  function addPeriod(weekday: number) {
    const sameDay = entries.filter((e) => e.weekday === weekday).sort((a, b) => a.end.localeCompare(b.end));
    const last = sameDay.at(-1);
    const period = last
      ? { start: last.end < "13:00" ? "13:00" : last.end, end: last.end < "13:00" ? "18:00" : "20:00" }
      : { start: "08:00", end: "12:00" };
    update([...entries, { key: newKey(), unitId: last?.unitId ?? defaultUnit, weekday, ...period }]);
  }

  function copyMondayToWeekdays() {
    const monday = entries.filter((e) => e.weekday === 1);
    const others = entries.filter((e) => e.weekday === 0 || e.weekday === 6);
    const copies = [2, 3, 4, 5].flatMap((weekday) => monday.map((m) => ({ ...m, key: newKey(), weekday })));
    update([...monday, ...copies, ...others]);
  }

  function save() {
    startTransition(async () => {
      const result = await saveSchedule({
        professionalId,
        entries: entries.map(({ unitId, weekday, start, end }) => ({ unitId, weekday, start, end })),
      });
      if (result.error) {
        setMessage({ status: "error", message: result.error });
      } else {
        setDirty(false);
        setMessage({ status: "success", message: "Horários salvos." });
      }
    });
  }

  const hasMonday = entries.some((e) => e.weekday === 1);

  return (
    <div className="space-y-4">
      <FormMessage state={message} />
      <ul className="divide-y rounded-xl border">
        {WEEKDAYS.map((day) => {
          const periods = entries.filter((e) => e.weekday === day.value);
          return (
            <li key={day.value} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:px-5">
              <span className="w-24 shrink-0 pt-2 text-sm font-medium">{day.label}</span>
              <div className="flex flex-1 flex-col gap-2">
                {periods.length === 0 ? (
                  <span className="pt-2 text-sm text-muted-foreground">Não atende</span>
                ) : (
                  periods.map((p) => (
                    <div key={p.key} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${day.label}: início`}
                        value={p.start}
                        step={300}
                        onChange={(ev) => update(entries.map((e) => (e.key === p.key ? { ...e, start: ev.target.value } : e)))}
                        className="w-34"
                      />
                      <span className="text-sm text-muted-foreground">até</span>
                      <Input
                        type="time"
                        aria-label={`${day.label}: fim`}
                        value={p.end}
                        step={300}
                        onChange={(ev) => update(entries.map((e) => (e.key === p.key ? { ...e, end: ev.target.value } : e)))}
                        className="w-34"
                      />
                      {units.length > 1 ? (
                        <Select
                          items={unitItems}
                          value={p.unitId}
                          onValueChange={(value) =>
                            update(entries.map((e) => (e.key === p.key ? { ...e, unitId: String(value) } : e)))
                          }
                        >
                          <SelectTrigger
                            aria-label={`${day.label}: unidade`}
                            className="w-44 data-[size=default]:h-9 pointer-coarse:data-[size=default]:h-11"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id} className="pointer-coarse:min-h-11">
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover período de ${day.label}`}
                        onClick={() => update(entries.filter((e) => e.key !== p.key))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                aria-label={`Adicionar período na ${day.label}`}
                onClick={() => addPeriod(day.value)}
              >
                <Plus aria-hidden />
                Período
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Salvando..." : "Salvar horários"}
        </Button>
        {hasMonday ? (
          <Button type="button" variant="outline" onClick={copyMondayToWeekdays} disabled={pending}>
            Copiar segunda para terça a sexta
          </Button>
        ) : null}
      </div>
    </div>
  );
}
