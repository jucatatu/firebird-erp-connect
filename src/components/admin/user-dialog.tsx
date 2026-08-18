import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { AdminUser } from "@/lib/permissions/admin-types";
import { listPermissionProfiles } from "@/lib/permissions/admin-profiles.functions";
import { inviteUser } from "@/lib/permissions/admin-users-invite.functions";
import { updateUser } from "@/lib/permissions/admin-users-update.functions";

const userFormSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  permissionProfileId: z.string().min(1, "Perfil é obrigatório"),
  companies: z.array(z.number()).min(1, "Selecione pelo menos uma empresa"),
  roles: z.array(z.string()),
  erpSellerId: z.number().nullable(),
  active: z.boolean(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserDialogProps {
  user?: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const profilesQ = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: () => listPermissionProfiles(),
    enabled: open,
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      permissionProfileId: "",
      companies: [1],
      roles: [],
      erpSellerId: null,
      active: true,
    },
  });

  useEffect(() => {
    if (user && open) {
      form.reset({
        fullName: user.fullName || "",
        email: user.email,
        permissionProfileId: user.permissionProfileId || "",
        companies: user.companies,
        roles: user.roles,
        erpSellerId: user.erpSellerId,
        active: user.active,
      });
    } else if (!isEditing && open) {
      form.reset({
        fullName: "",
        email: "",
        permissionProfileId: "",
        companies: [1],
        roles: [],
        erpSellerId: null,
        active: true,
      });
    }
  }, [user, open, form, isEditing]);

  const selectedProfileId = form.watch("permissionProfileId");
  const selectedProfile = profilesQ.data?.find(p => p.id === selectedProfileId);
  
  useEffect(() => {
    if (selectedProfile?.name === "Administrador" && selectedProfile?.isSystem) {
      const currentRoles = form.getValues("roles");
      if (!currentRoles.includes("admin")) {
        form.setValue("roles", [...currentRoles, "admin"]);
      }
    }
  }, [selectedProfile, form]);

  const mutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (isEditing && user) {
        return updateUser({
          data: {
            id: user.id,
            ...values,
            roles: values.roles as any,
          }
        });
      } else {
        return inviteUser({
          data: {
            ...values,
            roles: values.roles as any,
          }
        });
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Usuário atualizado" : "Convite enviado");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Erro ao salvar usuário:", error);
      toast.error(error.message || "Erro ao processar solicitação");
    },
  });

  const onSubmit = (values: UserFormValues) => {
    mutation.mutate(values);
  };

  const isSystemAdmin = user?.permissionProfileName === "Administrador" && isEditing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Atualize os dados e permissões do colaborador." 
              : "Envie um convite por e-mail para um novo colaborador."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="exemplo@empresa.com" 
                      type="email" 
                      disabled={isEditing} 
                      {...field} 
                    />
                  </FormControl>
                  {isEditing && (
                    <FormDescription>O e-mail não pode ser alterado após o convite.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="permissionProfileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil de Permissões</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isSystemAdmin}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {profilesQ.data?.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-end pb-2">
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={field.onChange}
                          disabled={isSystemAdmin}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Usuário Ativo</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="companies"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel>Empresas com Acesso</FormLabel>
                  </div>
                  <div className="flex gap-4">
                    {[1, 3].map((id) => (
                      <FormField
                        key={id}
                        control={form.control}
                        name="companies"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={id}
                              className="flex flex-row items-start space-x-2 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, id])
                                      : field.onChange(
                                          field.value?.filter((v: number) => v !== id)
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                {id === 1 ? "GRAAL (1)" : "GROTT (3)"}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="erpSellerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor ERP</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Aguardando homologação..." 
                      disabled 
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Consulta de vendedores ERP aguardando homologação do schema.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Enviar Convite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
