import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus, Download, Inbox } from "lucide-react";

import { AiSuggestion } from "@/components/app/ai-suggestion";
import { BrandLogo, BrandMark } from "@/components/app/brand-mark";
import { KpiStrip } from "@/components/app/kpi-strip";
import { PressureBar } from "@/components/app/pressure-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PROFESSIONAL_COLORS } from "@/lib/professional-colors";

import { SegmentedDemo } from "./segmented-demo";

export const metadata: Metadata = { title: "Componentes" };

/** Vitrine dos tokens e componentes do redesign. Só em desenvolvimento. */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-10 sm:py-10">
      <PageHeader
        title="Componentes"
        description="Tokens, tipografia e componentes base do visual Arcada."
        actions={
          <>
            <Button variant="outline">
              <Download aria-hidden /> Exportar
            </Button>
            <Button>
              <CalendarPlus aria-hidden /> Nova consulta
            </Button>
          </>
        }
      />

      <section className="space-y-4" aria-labelledby="marca">
        <h2 id="marca" className="type-label text-muted-foreground">Marca</h2>
        <div className="flex flex-wrap items-center gap-6">
          <BrandLogo />
          <BrandMark className="size-12" title="Símbolo Arcada" />
          <div className="rounded-card bg-brand-deep p-4">
            <BrandMark variant="light" className="size-12" />
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="tipografia">
        <h2 id="tipografia" className="type-label text-muted-foreground">Tipografia · Montserrat</h2>
        <p className="type-display">Boa tarde, Helena</p>
        <p className="type-title">Agenda de hoje</p>
        <p className="type-section">Seção do cartão</p>
        <p className="text-sm">Texto da interface em peso normal, para rótulos, tabelas e formulários.</p>
        <p className="text-[0.8125rem] text-muted-foreground">Texto secundário e legendas.</p>
        <p className="type-kpi">R$ 48.920,00</p>
      </section>

      <section className="space-y-3" aria-labelledby="botoes">
        <h2 id="botoes" className="type-label text-muted-foreground">Botões</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="outline">Secundário</Button>
          <Button variant="secondary">Suave</Button>
          <Button variant="destructive">Perigo</Button>
          <Button variant="danger">Excluir</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Desativado</Button>
          <Button size="sm" variant="outline">Pequeno</Button>
        </div>
        <div className="flex items-center gap-3 rounded-card bg-brand-deep p-4">
          <Button variant="on-dark">Sobre fundo escuro</Button>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="status">
        <h2 id="status" className="type-label text-muted-foreground">Status</h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success">Confirmada</StatusBadge>
          <StatusBadge tone="warning">Na espera</StatusBadge>
          <StatusBadge tone="danger">Faltou</StatusBadge>
          <StatusBadge tone="info">Primeira vez</StatusBadge>
          <StatusBadge tone="neutral">Concluída</StatusBadge>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="indicadores">
        <h2 id="indicadores" className="type-label text-muted-foreground">Indicadores</h2>
        <KpiStrip
          items={[
            { label: "Faturamento", value: "R$ 48,9 mil", delta: { text: "+12%", tone: "up" }, trend: [4, 5, 4, 7, 6, 9, 8], context: "Meta do mês: R$ 60 mil" },
            { label: "Consultas", value: "214", delta: { text: "+4%", tone: "up" }, trend: [30, 28, 33, 31, 35, 34, 36], context: "32 nesta semana" },
            { label: "Faltas", value: "6,1%", delta: { text: "+0,8 p.p.", tone: "down" }, trend: [5, 5, 6, 5, 6, 7, 6], context: "13 pacientes" },
            { label: "Conversão", value: "41%", delta: { text: "0%", tone: "flat" }, trend: [40, 42, 41, 39, 41, 41, 41], context: "Orçamentos aprovados" },
          ]}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Cartões">
        <Card>
          <CardHeader>
            <CardTitle>Para recuperar</CardTitle>
            <CardDescription>Orçamentos e faltas parados, pelos dias sem contato.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border-soft">
              {[
                { name: "Marina Alves", what: "Implante · R$ 4.800", days: 26 },
                { name: "João Pereira", what: "Faltou na avaliação", days: 12 },
                { name: "Clara Souza", what: "Clareamento · R$ 900", days: 3 },
              ].map((i) => (
                <li key={i.name} className="flex gap-3 py-3">
                  <PressureBar days={i.days} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{i.name}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">{i.what}</p>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">{i.days} dias</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="demo-name">Nome do paciente</Label>
              <Input id="demo-name" placeholder="Ex.: Maria da Silva" />
              <p className="text-[0.8125rem] text-muted-foreground">Como aparece na agenda.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-cpf">CPF</Label>
              <Input id="demo-cpf" aria-invalid defaultValue="123.456.789-00" />
              <p className="text-[0.8125rem] text-destructive">CPF inválido.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-notes">Observações</Label>
              <Textarea id="demo-notes" />
            </div>
            <SegmentedDemo />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="ia">
        <h2 id="ia" className="type-label text-muted-foreground">Sugestão da IA</h2>
        <AiSuggestion title="Sugestão da Arcada" action={<Button variant="outline" size="sm">Ver orçamentos</Button>}>
          3 orçamentos de implante estão parados há mais de 20 dias.
        </AiSuggestion>
        <AiSuggestion variant="highlight" title="Vaga liberada às 14h" action={<Button variant="on-dark" size="sm">Oferecer</Button>}>
          2 pacientes da lista de espera aceitam esse horário.
        </AiSuggestion>
      </section>

      <section className="space-y-3" aria-labelledby="tabela">
        <h2 id="tabela" className="type-label text-muted-foreground">Tabela</h2>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Marina Alves</TableCell>
                <TableCell>10/11/2026</TableCell>
                <TableCell><StatusBadge tone="danger">Vencido</StatusBadge></TableCell>
                <TableCell className="text-right">R$ 480,00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">João Pereira</TableCell>
                <TableCell>20/11/2026</TableCell>
                <TableCell><StatusBadge tone="warning">Em aberto</StatusBadge></TableCell>
                <TableCell className="text-right">R$ 1.250,00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Clara Souza</TableCell>
                <TableCell>02/11/2026</TableCell>
                <TableCell><StatusBadge tone="success">Pago</StatusBadge></TableCell>
                <TableCell className="text-right">R$ 900,00</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="profissionais">
        <h2 id="profissionais" className="type-label text-muted-foreground">Cores de profissional</h2>
        <div className="flex flex-wrap gap-2">
          {PROFESSIONAL_COLORS.map((c) => (
            <span key={c.value} className="inline-flex h-9 items-center gap-2 rounded-lg border-l-4 px-3 text-sm font-medium" style={{ backgroundColor: c.soft, borderColor: c.value, color: c.value }}>
              {c.label}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Estados">
        <EmptyState icon={Inbox} title="Nenhuma consulta hoje" description="Os horários marcados aparecem aqui." action={<Button>Nova consulta</Button>} />
        <div className="space-y-3 rounded-card border border-border bg-card p-6" aria-label="Carregando">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </section>
    </main>
  );
}
