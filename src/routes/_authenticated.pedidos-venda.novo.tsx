import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCreateDraft } from "@/hooks/use-drafts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Loader2, User, Package, Truck, CreditCard, ClipboardCheck, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pedidos-venda/novo")({
  head: () => ({
    meta: [
      { title: "Novo pedido — ERP" },
      { name: "description", content: "Criar um novo rascunho de pedido." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NewDraftPage,
});

type CompanyChoice = "auto" | "1" | "3";

const STEPS = [
  { key: "customer", label: "Cliente", icon: User, unlocked: true },
  { key: "items", label: "Itens", icon: Package, unlocked: false },
  { key: "delivery", label: "Entrega", icon: Truck, unlocked: false },
  { key: "payment", label: "Pagamento", icon: CreditCard, unlocked: false },
  { key: "review", label: "Revisão", icon: ClipboardCheck, unlocked: false },
];

function StepIndicator() {
  return (
    <ol className="mb-6 grid grid-cols-5 gap-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const active = i === 0;
        return (
          <li
            key={s.key}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-center",
              active
                ? "border-primary bg-primary/5"
                : "border-dashed bg-muted/30 text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full",
                active ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {s.unlocked ? <Icon className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
            </div>
            <span className="text-[11px] font-medium">{s.label}</span>
            <span className="text-[9px] uppercase tracking-wide">
              {active ? "Etapa atual" : s.unlocked ? "Disponível" : "Em breve"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NewDraftPage() {
  const navigate = useNavigate();
  const create = useCreateDraft();
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [company, setCompany] = useState<CompanyChoice>("auto");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    try {
      const draft = await create.mutateAsync({
        title: title.trim() || null,
        customerName: customerName.trim(),
        companyId: company === "auto" ? null : (Number(company) as 1 | 3),
        notes: notes.trim(),
      });
      toast.success("Rascunho criado");
      navigate({ to: "/orders/$draftId", params: { draftId: draft.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Não foi possível criar", { description: msg });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo pedido"
        description="Cadastro faseado. Nesta etapa registramos apenas os dados iniciais do cliente."
        crumbs={[{ label: "Pedidos de venda", to: "/pedidos-venda" }, { label: "Novo" }]}
      />

      <StepIndicator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapa 1 · Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título (opcional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Pedido semanal — Cliente X"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Nome do cliente</Label>
              <Input
                id="customer"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome informado (temporário)"
              />
              <p className="text-xs text-muted-foreground">
                A busca oficial no cadastro do ERP será liberada em breve.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={company} onValueChange={(v) => setCompany(v as CompanyChoice)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática / não definida</SelectItem>
                  <SelectItem value="1">Graal — ID 1</SelectItem>
                  <SelectItem value="3">Grott — ID 3</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. A resolução final ocorre no ERP durante o envio.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações iniciais</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
              <Button asChild type="button" variant="outline">
                <Link to="/pedidos-venda">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Criar rascunho
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Após criar o rascunho, itens, entrega e pagamento poderão ser preenchidos assim que as próximas
        etapas forem liberadas.
      </p>
    </div>
  );
}