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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders/new")({
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
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo pedido</h1>
        <p className="text-sm text-muted-foreground">
          Este rascunho ainda não é enviado ao ERP. Itens e envio serão adicionados em fases futuras.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados iniciais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título (opcional)</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                A busca real de clientes no ERP será adicionada em uma fase futura.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={company} onValueChange={(v) => setCompany(v as CompanyChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática / não definida</SelectItem>
                  <SelectItem value="1">Graal — ID 1</SelectItem>
                  <SelectItem value="3">Grott — ID 3</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Opcional. A resolução oficial ocorrerá no ERP no envio.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações iniciais</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link to="/orders">Cancelar</Link>
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar rascunho
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}