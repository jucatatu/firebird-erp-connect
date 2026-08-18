import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { PermissionProfile, PermissionResource, PermissionRule } from "@/lib/permissions/admin-types";
import { saveProfileRules } from "@/lib/permissions/admin-profiles.functions";

interface RulesEditorDialogProps {
  profile: PermissionProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RulesEditorDialog({ profile, open, onOpenChange }: RulesEditorDialogProps) {
  const queryClient = useQueryClient();
  const [localRules, setLocalRules] = useState<Record<string, PermissionRule>>({});

  // Carregar recursos reais do banco
  const resourcesQ = useQuery({
    queryKey: ["admin", "resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_resources")
        .select("*")
        .eq("active", true)
        .order("parent_id", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true });
      
      if (error) throw error;
      return data as PermissionResource[];
    },
    enabled: open,
  });

  // Carregar regras atuais do perfil
  const rulesQ = useQuery({
    queryKey: ["admin", "profile-rules", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("permission_profile_rules")
        .select("*")
        .eq("profile_id", profile.id);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!profile,
  });

  // Inicializar estado local quando os dados carregarem
  useEffect(() => {
    if (resourcesQ.data && rulesQ.data && open) {
      const initialMap: Record<string, PermissionRule> = {};
      
      resourcesQ.data.forEach(res => {
        const existing = rulesQ.data.find((r: any) => r.resource_id === res.id);
        initialMap[res.id] = {
          resourceId: res.id,
          canView: existing?.can_view ?? false,
          canCreate: existing?.can_create ?? false,
          canEdit: existing?.can_edit ?? false,
          canDelete: existing?.can_delete ?? false,
        };
      });
      
      setLocalRules(initialMap);
    }
  }, [resourcesQ.data, rulesQ.data, open]);

  const toggleRule = (resourceId: string, action: keyof Omit<PermissionRule, "resourceId">) => {
    if (profile?.isSystem && profile?.name === "Administrador") return;

    setLocalRules(prev => ({
      ...prev,
      [resourceId]: {
        ...prev[resourceId],
        [action]: !prev[resourceId][action]
      }
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      return saveProfileRules({
        data: {
          profileId: profile.id,
          rules: Object.values(localRules)
        }
      });
    },
    onSuccess: () => {
      toast.success("Regras salvas com sucesso");
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar regras");
    }
  });

  const isLoading = resourcesQ.isLoading || rulesQ.isLoading;
  const isReadOnly = profile?.isSystem && profile?.name === "Administrador";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle>Gerenciar Regras: {profile?.name}</DialogTitle>
            <DialogDescription>
              {isReadOnly 
                ? "As regras do perfil Administrador são fixas e não podem ser alteradas." 
                : "Defina as permissões de acesso para cada recurso do sistema."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden px-6">
          <ScrollArea className="h-full border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[300px]">Recurso</TableHead>
                  <TableHead className="text-center">Visualizar</TableHead>
                  <TableHead className="text-center">Criar</TableHead>
                  <TableHead className="text-center">Editar</TableHead>
                  <TableHead className="text-center">Deletar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-4 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  resourcesQ.data?.map(res => {
                    const rule = localRules[res.id] || { 
                      canView: false, canCreate: false, canEdit: false, canDelete: false 
                    };
                    return (
                      <TableRow key={res.id}>
                        <TableCell className="font-medium">
                          <div className={res.parentId ? "pl-6 text-sm opacity-80" : "font-bold"}>
                            {res.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={rule.canView || isReadOnly}
                            onCheckedChange={() => toggleRule(res.id, "canView")}
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={rule.canCreate || isReadOnly}
                            onCheckedChange={() => toggleRule(res.id, "canCreate")}
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={rule.canEdit || isReadOnly}
                            onCheckedChange={() => toggleRule(res.id, "canEdit")}
                            disabled={isReadOnly}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox 
                            checked={rule.canDelete || isReadOnly}
                            onCheckedChange={() => toggleRule(res.id, "canDelete")}
                            disabled={isReadOnly}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <div className="p-6 pt-2">
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            {!isReadOnly && (
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || isLoading}>
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Regras
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
