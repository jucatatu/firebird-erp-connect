import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

import { AdminUser } from "@/lib/permissions/admin-types";
import { listPermissionProfiles } from "@/lib/permissions/admin-profiles.functions";
import { createAdminUser } from "@/lib/permissions/admin-users-create.functions";
import { updateUser } from "@/lib/permissions/admin-users-update.functions";
import { searchErpSellers, type ErpSeller } from "@/lib/erp-sellers.functions";

const userFormSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  permissionProfileId: z.string().min(1, "Perfil é obrigatório"),
  companies: z.array(z.number()).min(1, "Selecione pelo menos uma empresa"),
  roles: z.array(z.string()),
  erpSellerId: z.number().int().positive().nullable(),
  active: z.boolean(),
  temporaryPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // Se não estiver editando (estiver criando), a senha é obrigatória
  if (data.temporaryPassword === undefined && data.confirmPassword === undefined) return true;
  if (data.temporaryPassword) {
    return data.temporaryPassword.trim().length >= 8;
  }
  return true;
}, {
  message: "Senha deve ter pelo menos 8 caracteres",
  path: ["temporaryPassword"],
}).refine((data) => {
  if (data.temporaryPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
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
  const [sellerSearch, setSellerSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

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
      temporaryPassword: "",
      confirmPassword: "",
    },
  });

  const selectedCompanies = form.watch("companies");
  const erpSellerId = form.watch("erpSellerId");

  const profilesQ = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: () => listPermissionProfiles(),
    enabled: open,
  });

  const sellersQ = useQuery({
    queryKey: ["erp", "sellers", sellerSearch],
    queryFn: async () => {
      const res = await searchErpSellers({ 
        data: { 
          q: sellerSearch,
          limit: 100
        } 
      });
      if (!res.ok) throw new Error(res.error?.message || "Erro ao carregar vendedores");
      return res.data?.sellers || [];
    },
    enabled: open,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const filteredSellers = useMemo(() => {
    if (!sellersQ.data) return [];
    return sellersQ.data.filter((s: ErpSeller) => selectedCompanies.includes(s.companyId));
  }, [sellersQ.data, selectedCompanies]);

  const selectedSeller = useMemo(() => {
    return sellersQ.data?.find((s: ErpSeller) => s.id === erpSellerId);
  }, [sellersQ.data, erpSellerId]);

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
        temporaryPassword: "",
        confirmPassword: "",
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
        temporaryPassword: "",
        confirmPassword: "",
      });
    }
  }, [user, open, form, isEditing]);

  const selectedProfileId = form.watch("permissionProfileId");
  const selectedProfile = profilesQ.data?.find(p => p.id === selectedProfileId);
  
  useEffect(() => {
    if (selectedProfile?.name === "Administrador") {
      const currentRoles = form.getValues("roles");
      if (!currentRoles.includes("admin")) {
        form.setValue("roles", [...currentRoles, "admin"]);
      }
    } else if (selectedProfile?.name === "Vendedor") {
      const currentRoles = form.getValues("roles");
      if (!currentRoles.includes("vendedor")) {
        form.setValue("roles", [...currentRoles, "vendedor"]);
      }
    } else if (selectedProfile?.name === "Aprovador") {
      const currentRoles = form.getValues("roles");
      if (!currentRoles.includes("aprovador")) {
        form.setValue("roles", [...currentRoles, "aprovador"]);
      }
    }
  }, [selectedProfile, form]);

  const mutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (values.erpSellerId) {
        const seller = sellersQ.data?.find((s: ErpSeller) => s.id === values.erpSellerId);
        if (seller && !values.companies.includes(seller.companyId)) {
          throw new Error("O vendedor ERP selecionado pertence a uma empresa que não está habilitada para este usuário.");
        }
      }

      if (isEditing && user) {
        return updateUser({
          data: {
            id: user.id,
            fullName: values.fullName,
            email: values.email,
            permissionProfileId: values.permissionProfileId,
            companies: values.companies as any,
            roles: values.roles as any,
            erpSellerId: values.erpSellerId,
            active: values.active,
          }
        });
      } else {
        if (!values.temporaryPassword) {
          throw new Error("Senha temporária é obrigatória para novos usuários.");
        }
        return createAdminUser({
          data: {
            fullName: values.fullName,
            email: values.email,
            permissionProfileId: values.permissionProfileId,
            companies: values.companies as any,
            roles: values.roles as any,
            erpSellerId: values.erpSellerId,
            temporaryPassword: values.temporaryPassword,
            confirmPassword: values.confirmPassword,
          }
        });
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Usuário atualizado" : "Usuário criado com sucesso.");
      if (!isEditing) {
        toast.info("O usuário deverá trocar a senha no primeiro acesso.");
      }
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
              : "Crie um novo usuário diretamente com senha temporária."}
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
                    <FormDescription>O e-mail não pode ser alterado após a criação.</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="temporaryPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Temporária</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

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
                <FormItem className="flex flex-col">
                  <FormLabel>Vendedor ERP</FormLabel>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className={cn(
                            "w-full justify-between font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {selectedSeller 
                            ? `${selectedSeller.name} — ${selectedSeller.companyId === 1 ? "GRAAL" : "GROTT"}`
                            : "Selecione um vendedor..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Buscar vendedor por nome ou apelido..." 
                          value={sellerSearch}
                          onValueChange={setSellerSearch}
                        />
                        <CommandList>
                          {sellersQ.isLoading && (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              <span className="text-sm text-muted-foreground">Carregando vendedores...</span>
                            </div>
                          )}
                          {!sellersQ.isLoading && filteredSellers.length === 0 && (
                            <CommandEmpty>Nenhum vendedor encontrado para as empresas selecionadas.</CommandEmpty>
                          )}
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                field.onChange(null);
                                setPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === null ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Nenhum Vendedor
                            </CommandItem>
                            {filteredSellers.map((seller: ErpSeller) => (
                              <CommandItem
                                key={seller.id}
                                value={String(seller.id)}
                                onSelect={() => {
                                  field.onChange(seller.id);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === seller.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{seller.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {seller.nickname && `${seller.nickname} • `}
                                    {seller.companyId === 1 ? "GRAAL (1)" : "GROTT (3)"}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    O vendedor deve pertencer a uma das empresas selecionadas acima.
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
                {isEditing ? "Salvar Alterações" : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
