import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listAdminUsers } from "@/lib/permissions/admin-users.functions";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { ShieldAlert, UserPlus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const usersQ = useSuspenseQuery({
    queryKey: ["admin", "users"],
    queryFn: () => listAdminUsers(),
  });

  const [search, setSearch] = useState("");

  const filteredUsers = usersQ.data.filter((u) =>
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie o acesso e as permissões dos colaboradores.
          </p>
        </div>
        <PermissionAction resource="admin.users" action="create">
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo usuário
          </Button>
        </PermissionAction>

      </div>

      <PermissionGate resource="admin.users" action="view">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Empresas</TableHead>
                <TableHead>Roles Legadas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.fullName || "Sem nome"}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.active ? "default" : "secondary"}>
                      {user.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.permissionProfileName ? (
                      <span className="text-sm">{user.permissionProfileName}</span>
                    ) : (
                      <Badge variant="outline" className="text-destructive border-destructive">
                        Sem Perfil
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {user.companies.includes(1) && <Badge variant="outline">GRAAL</Badge>}
                      {user.companies.includes(3) && <Badge variant="outline">GROTT</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px] uppercase">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </PermissionGate>
    </div>
  );
}
