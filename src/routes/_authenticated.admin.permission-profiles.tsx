import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listPermissionProfiles } from "@/lib/permissions/admin-profiles.functions";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/permission-profiles")({
  component: AdminProfilesPage,
});

function AdminProfilesPage() {
  const profilesQ = useSuspenseQuery({
    queryKey: ["admin", "profiles"],
    queryFn: () => listPermissionProfiles(),
  });

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfis de Permissão</h1>
          <p className="text-muted-foreground">
            Defina papéis e regras de acesso para os usuários do sistema.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo perfil
        </Button>
      </div>

      <PermissionGate resource="admin.permission_profiles" action="view">
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profilesQ.data.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      {profile.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {profile.description || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {profile.isSystem ? (
                      <Badge variant="secondary">Sistema</Badge>
                    ) : (
                      <Badge variant="outline">Customizado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.active ? "default" : "secondary"}>
                      {profile.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{profile.userCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Gerenciar Regras
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </PermissionGate>
    </div>
  );
}
