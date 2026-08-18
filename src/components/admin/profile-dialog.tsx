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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { PermissionProfile } from "@/lib/permissions/admin-types";
import { 
  createPermissionProfile, 
  updatePermissionProfile 
} from "@/lib/permissions/admin-profiles-crud.functions";

const profileFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  active: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileDialogProps {
  profile?: PermissionProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ profile, open, onOpenChange }: ProfileDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!profile;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      description: "",
      active: true,
    },
  });

  useEffect(() => {
    if (profile && open) {
      form.reset({
        name: profile.name,
        description: profile.description || "",
        active: profile.active,
      });
    } else if (!isEditing && open) {
      form.reset({
        name: "",
        description: "",
        active: true,
      });
    }
  }, [profile, open, form, isEditing]);

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (isEditing && profile) {
        return updatePermissionProfile({
          data: {
            id: profile.id,
            ...values,
          }
        });
      } else {
        return createPermissionProfile({
          data: values,
        });
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Perfil atualizado" : "Perfil criado");
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar perfil");
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  const isSystemProfile = profile?.isSystem && isEditing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Perfil" : "Novo Perfil"}</DialogTitle>
          <DialogDescription>
            Defina o nome e a descrição do perfil de permissões.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Perfil</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Vendedor Externo" 
                      disabled={isSystemProfile}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Breve descrição das responsabilidades" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSystemProfile}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Perfil Ativo</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Criar Perfil"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
