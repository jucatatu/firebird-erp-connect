import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateErpClient, useErpCustomerGroups, useErpPaymentOptions } from "@/hooks/use-erp";
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
import { Loader2, UserPlus, Building2, User, MapPin, Search, CheckCircle2, Phone, MessageSquare, Mail, CreditCard, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadGoogleMapsLibraries } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

const clientFormSchema = z.object({
  companyId: z.number(),
  personType: z.enum(["PF", "PJ"]),
  name: z.string().min(3, "Nome muito curto").max(100, "Nome muito longo"),
  tradeName: z.string().max(100, "Nome muito longo").optional().nullable(),
  document: z.string().min(11, "Documento inválido").max(14, "Documento inválido"),
  mobile: z.string().min(10, "Celular inválido"),
  phone: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  groupId: z.string().min(1, "Selecione um grupo"),
  paymentTermId: z.string().min(1, "Selecione a condição de pagamento"),
  paymentMethodId: z.string().min(1, "Selecione a forma de pagamento"),
  address: z.object({
    zip: z.string().optional().nullable(),
    state: z.string().length(2, "UF deve ter 2 letras"),
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
  const paymentOptionsQ = useErpPaymentOptions();

  // Google Maps state
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionToken, setSessionToken] = useState<any>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
      paymentTermId: "",
      paymentMethodId: "",
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

  // Load Google Maps
  useEffect(() => {
    const initMaps = async () => {
      try {
        await loadGoogleMapsLibraries();
        setIsMapsLoaded(true);
        const { AutocompleteSessionToken } = (window as any).google.maps.places;
        if (AutocompleteSessionToken) {
          setSessionToken(new AutocompleteSessionToken());
        }
      } catch (err) {
        console.error("Erro ao carregar Google Maps:", err);
      }
    };
    initMaps();
  }, []);

  // Click outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced address search
  useEffect(() => {
    if (!addressQuery || addressQuery.length < 3 || !isMapsLoaded || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { AutocompleteSuggestion } = (window as any).google.maps.places;
        const request = {
          input: addressQuery,
          includedRegionCodes: ["br"],
          locationBias: {
            center: { lat: -26.48, lng: -49.07 },
            radius: 50000 // 50km
          },
          sessionToken
        };

        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        
        const normalized = (results || [])
          .map((suggestion: any) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;
            return {
              prediction,
              primaryText: prediction.mainText?.text || prediction.text?.text || "",
              secondaryText: prediction.secondaryText?.text || "",
              fullText: prediction.text?.text || "",
            };
          })
          .filter(Boolean);

        setSuggestions(normalized);
      } catch (err) {
        console.error("[PLACES] error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [addressQuery, isMapsLoaded, showSuggestions, sessionToken]);

  const handleSelectPrediction = async (suggestion: any) => {
    setShowSuggestions(false);
    try {
      const prediction = suggestion.prediction;
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location", "id", "displayName"]
      });

      const components = place.addressComponents;
      const getComp = (types: string[], useShort = false) => {
        const comp = components?.find((c: any) => types.some(t => c.types.includes(t)));
        return useShort ? comp?.shortText : comp?.longText;
      };

      const street = getComp(["route"]) || place.displayName?.text || "";
      const number = getComp(["street_number"]) || "";
      const district = getComp(["neighborhood", "sublocality", "sublocality_level_1"]) || "";
      const city = getComp(["locality", "administrative_area_level_2"]) || "";
      const state = getComp(["administrative_area_level_1"], true) || ""; 
      const zip = getComp(["postal_code"]) || "";

      form.setValue("address.street", street);
      form.setValue("address.number", number);
      form.setValue("address.district", district);
      form.setValue("address.city", city);
      form.setValue("address.state", state.slice(0, 2).toUpperCase());
      form.setValue("address.zip", zip.replace(/\D/g, ""));

      setAddressQuery(street);
      
      const { AutocompleteSessionToken } = (window as any).google.maps.places;
      if (AutocompleteSessionToken) setSessionToken(new AutocompleteSessionToken());

      if (!number) {
        toast.info("Por favor, informe o número do endereço.");
        setTimeout(() => document.getElementById("client-addr-number")?.focus(), 150);
      }
    } catch (err) {
      toast.error("Erro ao processar endereço selecionado.");
    }
  };

  const onSubmit = async (values: ClientFormValues) => {
    try {
      const payload = {
        ...values,
        groupId: parseInt(values.groupId),
        paymentTermId: parseInt(values.paymentTermId),
        paymentMethodId: parseInt(values.paymentMethodId),
      };

      const res = await createClient.mutateAsync(payload as any);
      
      if (res.ok && res.data) {
        toast.success("Cliente cadastrado com sucesso!");
        onSuccess(res.data.id, res.data.name);
      } else {
        const errorMsg = res.error?.message || "Erro ao cadastrar cliente.";
        toast.error(errorMsg);
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
