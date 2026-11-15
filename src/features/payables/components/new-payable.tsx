"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/lib/dates";
import { parseBRLToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

import { createPayable, prepareAttachment } from "../actions";

type Option = { id: string; name: string };
type Props = { categories: Option[]; suppliers: Option[]; costCenters: Option[]; paymentMethods: Option[] };

export function NewPayableButton({ categories, suppliers, costCenters, paymentMethods }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState("none");
  const [costCenterId, setCostCenterId] = useState("none");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [mode, setMode] = useState<"single" | "installments" | "recurring">("single");
  const [installments, setInstallments] = useState("2");
  const [methodId, setMethodId] = useState("none");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    const cents = parseBRLToCents(amount);
    if (!cents) return setError("Valor inválido.");
    setError(null);
    startTransition(async () => {
      let attachmentPath: string | null = null;
      if (file) {
        const prepared = await prepareAttachment(file.name, file.size);
        if (prepared.error || !prepared.path) return setError(prepared.error ?? "Não foi possível anexar.");
        const { error: upload } = await createClient().storage.from("clinic").upload(prepared.path, file, { contentType: file.type || "application/octet-stream" });
        if (upload) return setError("Não foi possível enviar o comprovante.");
        attachmentPath = prepared.path;
      }
      const r = await createPayable({
        description,
        categoryId,
        supplierId: supplierId === "none" ? null : supplierId,
        costCenterId: costCenterId === "none" ? null : costCenterId,
        amountCents: cents,
        dueDate,
        mode,
        installments: Number(installments) || 1,
        paymentMethodId: methodId === "none" ? null : methodId,
        attachmentPath,
        notes: null,
      });
      if (r.error) setError(r.error);
      else {
        setOpen(false);
        setDescription("");
        setAmount("");
        setFile(null);
      }
    });
  }

  const segment = (active: boolean) => cn("h-8 flex-1 rounded-md px-2 text-sm font-medium pointer-coarse:h-11", active ? "bg-background shadow-xs" : "text-muted-foreground");

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden />
        Nova conta
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="pay-desc">Descrição</Label>
            <Input id="pay-desc" placeholder="Ex.: aluguel, compra de resinas" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SimpleSelect id="pay-category" label="Categoria" value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <SimpleSelect id="pay-supplier" label="Fornecedor" value={supplierId} onChange={setSupplierId} options={[{ value: "none", label: "Nenhum" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
          <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="Tipo de lançamento">
            <button type="button" className={segment(mode === "single")} aria-pressed={mode === "single"} onClick={() => setMode("single")}>Única</button>
            <button type="button" className={segment(mode === "installments")} aria-pressed={mode === "installments"} onClick={() => setMode("installments")}>Parcelada</button>
            <button type="button" className={segment(mode === "recurring")} aria-pressed={mode === "recurring"} onClick={() => setMode("recurring")}>Mensal fixa</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">{mode === "installments" ? "Valor total (R$)" : "Valor (R$)"}</Label>
              <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-due">{mode === "single" ? "Vencimento" : "1º vencimento"}</Label>
              <Input id="pay-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {mode === "installments" ? (
            <div className="space-y-1.5">
              <Label htmlFor="pay-installments">Parcelas</Label>
              <Input id="pay-installments" inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-24" />
            </div>
          ) : mode === "recurring" ? (
            <p className="text-sm text-muted-foreground">Lança os próximos 12 meses com o mesmo valor. Dá para cancelar as futuras depois.</p>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <SimpleSelect id="pay-method" label="Forma de pagamento" value={methodId} onChange={setMethodId} options={[{ value: "none", label: "A definir" }, ...paymentMethods.map((m) => ({ value: m.id, label: m.name }))]} />
            {costCenters.length ? (
              <SimpleSelect id="pay-cc" label="Centro de custo" value={costCenterId} onChange={setCostCenterId} options={[{ value: "none", label: "Nenhum" }, ...costCenters.map((c) => ({ value: c.id, label: c.name }))]} />
            ) : null}
          </div>
          <div>
            <input ref={fileRef} type="file" className="sr-only" id="pay-file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Paperclip aria-hidden />
              {file ? file.name : "Anexar boleto ou comprovante"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={pending || !description.trim()}>
              {pending ? "Salvando..." : "Lançar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
