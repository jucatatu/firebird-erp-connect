import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateErpClient, useErpCustomerGroups } from "@/hooks/use-erp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, UserPlus, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const clientFormSchema = z.object({
  companyId: z.number(),
  personType: z.enum(["PF", "PJ"]),
  name: z.string().min(3, "Nome muito curto").max(60, "Nome muito longo"),
  tradeName: z.string().optional().nullable(),
  document: z.string().min(11, "Documento inválido").max(14, "Documento inválido"),
  mobile: z.string().min(10, "Celular inválido"),
  phone: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  groupId: z.string().min(1, "Selecione um grupo"),
  address: z.object({
    zip: z.string().optional().nullable(),
    state: z.string().length(2, "UF inválida"),
    city: z.string().min(2, "Cidade inválida"),
    district: z.string().min(2, "Bairro inválido"),
    street: z.string().min(2, "Logradouro inválido"),
    number: z.string().min(1, "Número obrigatório"),
    complement: z.string().optional().nullable(),
  }),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface CreateClientFormProps {
  companyId: number;
  onSuccess: (clientId: number, name: string) => void;
  onCancel: () => void;
}

export function CreateClientForm({ companyId, onSuccess, onCancel }: CreateClientFormProps) {
  const createClient = useCreateErpClient();
  const groupsQ = useErpCustomerGroups();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      companyId,
      personType: "PJ",
      name: "",
      tradeName: "",
      document: "",
      mobile: "",
      phone: "",
      email: "",
      groupId: "",
      address: {
        zip: "",
        state: "",
        city: "",
        district: "",
        street: "",
        number: "",
        complement: "",
      },
    },
  });

  const onSubmit = async (values: ClientFormValues) => {
    try {
      const payload = {
        ...values,
        groupId: parseInt(values.groupId),
        // Defaults obrigatórios para a SP no Node
        paymentTermId: 1, // À VISTA (ajustável no wizard depois)
        paymentMethodId: 1, // DINHEIRO
      };

      const res = await createClient.mutateAsync(payload as any);
      
      if (res.ok && res.data) {
        toast.success("Cliente cadastrado com sucesso!");
        onSuccess(res.data.id, res.data.name);
      } else {
        const errorMsg = res.error?.message || "Erro ao cadastrar cliente.";
        toast.error(errorMsg);
        if (res.status === 409) {
           // Se duplicado, poderíamos sugerir selecionar o existente,
           // mas o toast já informa os detalhes se exposeDetails for true.
        }
      }
    } catch (err) {
      toast.error("Erro de conexão com o servidor.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Novo Cliente
          </h2>
          <p className="text-xs text-muted-foreground">O cadastro será realizado diretamente no ERP.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 text-xs">
          Cancelar
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="personType"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Tipo de Pessoa</FormLabel>
                  <Tabs 
                    defaultValue={field.value} 
                    onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("document", ""); // Limpa ao trocar tipo
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 h-10">
                      <TabsTrigger value="PJ" className="gap-2">
                        <Building2 className="h-4 w-4" /> Jurídica
                      </TabsTrigger>
                      <TabsTrigger value="PF" className="gap-2">
                        <User className="h-4 w-4" /> Física
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>{form.watch("personType") === "PJ" ? "Razão Social" : "Nome Completo"}</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: João da Silva / Restaurante Graal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("personType") === "PJ" && (
              <FormField
                control={form.control}
                name="tradeName"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Nome Fantasia (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Graal Market" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="document"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{form.watch("personType") === "PJ" ? "CNPJ" : "CPF"}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={form.watch("personType") === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} 
                      {...field} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        field.onChange(val.slice(0, form.watch("personType") === "PJ" ? 14 : 11));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo de Cliente</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o grupo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupsQ.data?.data?.groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.description}
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
              name="mobile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular (WhatsApp)</FormLabel>
                  <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} />
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
                    <Input placeholder="contato@empresa.com.br" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Endereço</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem className="col-span-full md:col-span-3">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, Avenida, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input placeholder="123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.district"
                render={({ field }) => (
                  <FormItem className="col-span-full md:col-span-2">
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Centro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem className="col-span-full md:col-span-1">
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" maxLength={2} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1 font-bold h-12" 
              disabled={createClient.isPending}
            >
              {createClient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando no ERP...
                </>
              ) : (
                "Cadastrar e Continuar Pedido"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
