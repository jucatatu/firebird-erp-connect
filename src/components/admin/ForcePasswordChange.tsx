import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { completeInitialPasswordChange } from "@/lib/permissions/password-change.functions";

const passwordSchema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string().min(8, "A confirmação deve ter pelo menos 8 caracteres"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface ForcePasswordChangeProps {
  onLogout: () => void;
  onSuccess: () => void;
}

export function ForcePasswordChange({ onLogout, onSuccess }: ForcePasswordChangeProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    setLoading(true);
    try {
      // 1. Atualizar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (authError) throw authError;

      // 2. Chamar Server Function para marcar must_change_password = false
      const result = await completeInitialPasswordChange();
      if (!result.success) throw new Error("Falha ao atualizar perfil.");

      toast.success("Senha atualizada com sucesso!");
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao alterar senha:", error);
      toast.error(error.message || "Erro ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Defina sua nova senha</CardTitle>
          <CardDescription>
            Este é seu primeiro acesso. Para sua segurança, você deve definir uma nova senha pessoal.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
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
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-6">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ALTERAR SENHA
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full gap-2 text-muted-foreground" 
                onClick={onLogout}
                disabled={loading}
              >
                <LogOut className="h-4 w-4" />
                SAIR
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
