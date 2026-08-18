import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listPermissionProfiles } from "@/lib/permissions/admin-profiles.functions";
import { deletePermissionProfile } from "@/lib/permissions/admin-profiles-crud.functions";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { PermissionAction } from "@/components/permissions/permission-action";
import { Shield, Plus, Settings2, Edit2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { ProfileDialog } from "@/components/admin/profile-dialog";
import { RulesEditorDialog } from "@/components/admin/rules-editor-dialog";
import { PermissionProfile } from "@/lib/permissions/admin-types";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/permission-profiles")({
  component: AdminProfilesPage,
});

function AdminProfilesPage() {
  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfis de Permissão</h1>
          <p className="text-muted-foreground">Defina papéis e regras de acesso para os usuários do sistema.</p>
        </div>
      </div>
      <PermissionGate resource="admin.permission_profiles" action="view">
        <AdminProfilesContent />
      </PermissionGate>
    </div>
  );
}

function AdminProfilesContent() {
  const queryClient = useQueryClient();
  const profilesQ = useSuspenseQuery({
    queryKey: ["admin", "profiles"],
    queryFn: () => listPermissionProfiles(),
  });

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PermissionProfile | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePermissionProfile({ data: { id } }),
    onSuccess: () => {
      toast.success("Perfil excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir perfil");
    }
  });

  const handleCreate = () => {
    setSelectedProfile(null);
    setProfileDialogOpen(true);
  };

  const handleEdit = (profile: PermissionProfile) => {
    setSelectedProfile(profile);
    setProfileDialogOpen(true);
  };

  const handleManageRules = (profile: PermissionProfile) => {
    setSelectedProfile(profile);
    setRulesDialogOpen(true);
  };

  const handleDeleteClick = (profile: PermissionProfile) => {
    setSelectedProfile(profile);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <PermissionAction resource="admin.permission_profiles" action="create">
          <Button className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Novo perfil
          </Button>
        </PermissionAction>
      </div>

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
                  <span className="text-sm text-muted-foreground">{profile.description || "—"}</span>
                </TableCell>
                <TableCell>
                  {profile.isSystem ? <Badge variant="secondary">Sistema</Badge> : <Badge variant="outline">Customizado</Badge>}
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
                  <div className="flex justify-end gap-2">
                    <PermissionAction resource="admin.permission_profiles" action="edit">
                      <Button variant="ghost" size="icon" onClick={() => handleManageRules(profile)} title="Gerenciar Regras">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </PermissionAction>
                    <PermissionAction resource="admin.permission_profiles" action="edit">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)} title="Editar Perfil">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </PermissionAction>
                    {!profile.isSystem && (
                      <PermissionAction resource="admin.permission_profiles" action="delete">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive" 
                          onClick={() => handleDeleteClick(profile)}
                          title="Excluir Perfil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionAction>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} profile={selectedProfile} />
      <RulesEditorDialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen} profile={selectedProfile} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil "{selectedProfile?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => selectedProfile && deleteMutation.mutate(selectedProfile.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
