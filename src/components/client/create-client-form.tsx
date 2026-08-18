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
import { Loader2, UserPlus, Building2, User, MapPin, Search, CheckCircle2, Phone, MessageSquare, Mail, CreditCard, Landmark, Briefcase, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Tabs as TabsUI, TabsList as TabsListUI, TabsTrigger as TabsTriggerUI } from "@/components/ui/tabs";
import { loadGoogleMapsLibraries } from "@/lib/google-maps";
import { cn } from "@/lib/utils";
import { 
  isWithinCustomerServiceArea, 
  CUSTOMER_SERVICE_AREA_CENTER, 
  CUSTOMER_SERVICE_RADIUS_METERS,
  getCustomerServiceAreaBounds
} from "@/utils/geo-utils";

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
  allowedCompanyIds: number[];
  onCompanyChange: (companyId: number) => void;
  onSuccess: (clientId: number, name: string) => void;
  onCancel: () => void;
}

import { useMyProfile, useAuthSession } from "@/hooks/use-auth";
export function CreateClientForm({ companyId, allowedCompanyIds, onCompanyChange, onSuccess, onCancel }: CreateClientFormProps) {
  const createClient = useCreateErpClient();
  const groupsQ = useErpCustomerGroups();
  const paymentOptionsQ = useErpPaymentOptions();
  const { user } = useAuthSession();
  const profileQ = useMyProfile(user);

  // Google Maps state
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sessionToken, setSessionToken] = useState<any>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressValidationStatus, setAddressValidationStatus] = useState<"none" | "valid" | "outside" | "dirty" | "error" | "validating">("none");
  const [validatedCoords, setValidatedCoords] = useState<{ lat: number; lng: number } | null>(null);
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
        // SPRINT 8.9.42.2.2: Garantir geocoding importado
        await (window as any).google.maps.importLibrary("geocoding");
        setIsMapsLoaded(true);
        const { AutocompleteSessionToken } = (window as any).google?.maps?.places || {};
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
        
        // SPRINT 8.9.42.2.2: Usar LatLngBoundsLiteral para locationRestriction
        const bounds = getCustomerServiceAreaBounds();
        
        const request = {
          input: addressQuery,
          includedRegionCodes: ["br"],
          locationRestriction: bounds,
          origin: CUSTOMER_SERVICE_AREA_CENTER,
          sessionToken
        };

        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        
        if (results && results.length > 0) {
          const normalized = results.map((suggestion: any) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;
            return {
              prediction,
              primaryText: prediction.mainText?.text || prediction.text?.text || "",
              secondaryText: prediction.secondaryText?.text || "",
              fullText: prediction.text?.text || "",
            };
          }).filter(Boolean);
          setSuggestions(normalized);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("[PLACES] error:", err);
        toast.error("Não foi possível pesquisar endereços no Google Maps. Tente novamente.");
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

      form.setValue("address.street", street, { shouldValidate: true, shouldDirty: true });
      form.setValue("address.number", number, { shouldValidate: true, shouldDirty: true });
      form.setValue("address.district", district, { shouldValidate: true, shouldDirty: true });
      form.setValue("address.city", city, { shouldValidate: true, shouldDirty: true });
      form.setValue("address.state", state.slice(0, 2).toUpperCase(), { shouldValidate: true, shouldDirty: true });
      form.setValue("address.zip", zip.replace(/\D/g, ""), { shouldValidate: true, shouldDirty: true });

      // Validar área (Sprint 8.9.42.2)
      if (place.location) {
        const lat = place.location.lat();
        const lng = place.location.lng();
        if (isWithinCustomerServiceArea(lat, lng)) {
          setAddressValidationStatus("valid");
          setValidatedCoords({ lat, lng });
        } else {
          setAddressValidationStatus("outside");
          setValidatedCoords(null);
          toast.error("Endereço fora da área de atendimento (50 km).");
        }
      }

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
    // 1. Validar se o endereço está validado e dentro da área
    let currentStatus = addressValidationStatus;
    let coords = validatedCoords;

    if (currentStatus === "dirty" || currentStatus === "none") {
      setAddressValidationStatus("validating");
      try {
        const { Geocoder } = await (window as any).google.maps.importLibrary("geocoding");
        const geocoder = new Geocoder();
        const addressStr = `${values.address.street}, ${values.address.number}, ${values.address.district}, ${values.address.city}, ${values.address.state}, ${values.address.zip || ""}, Brasil`;
        
        const response = await geocoder.geocode({ address: addressStr });
        if (response.results && response.results.length > 0) {
          const location = response.results[0].geometry.location;
          const lat = location.lat();
          const lng = location.lng();
          
          if (isWithinCustomerServiceArea(lat, lng)) {
            currentStatus = "valid";
            coords = { lat, lng };
            setAddressValidationStatus("valid");
            setValidatedCoords(coords);
          } else {
            currentStatus = "outside";
            setAddressValidationStatus("outside");
            toast.error("Endereço fora da área de atendimento (50 km).");
            return;
          }
        } else {
          setAddressValidationStatus("error");
          toast.error("Não foi possível validar este endereço geograficamente.");
          return;
        }
      } catch (err) {
        setAddressValidationStatus("error");
        toast.error("Erro ao validar endereço. Tente novamente.");
        return;
      }
    }

    if (currentStatus !== "valid" || !coords) {
      toast.error("O endereço deve estar dentro da área de atendimento permitida.");
      return;
    }

    try {
      const payload = {
        ...values,
        groupId: parseInt(values.groupId),
        paymentTermId: parseInt(values.paymentTermId),
        paymentMethodId: parseInt(values.paymentMethodId),
        address: {
          ...values.address,
          validation: coords
        }
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
    <div className="space-y-6 animate-in fade-in duration-500 overflow-y-auto pb-8">


      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* SEÇÃO: DADOS DO CLIENTE */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-2 border-l-2 border-primary pl-2">
              <User className="h-3.5 w-3.5" /> Dados do Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="personType"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel className="text-xs font-bold uppercase">Tipo de Pessoa</FormLabel>
                    <TabsUI 
                      defaultValue={field.value} 
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("document", ""); 
                      }}
                      className="w-full"
                    >
                      <TabsListUI className="grid w-full grid-cols-2 h-10 bg-muted/50">
                        <TabsTriggerUI value="PJ" className="gap-2 text-xs font-bold">
                          <Building2 className="h-3.5 w-3.5" /> Jurídica
                        </TabsTriggerUI>
                        <TabsTriggerUI value="PF" className="gap-2 text-xs font-bold">
                          <User className="h-3.5 w-3.5" /> Física
                        </TabsTriggerUI>
                      </TabsListUI>
                    </TabsUI>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel className="text-xs font-bold uppercase">{form.watch("personType") === "PJ" ? "Razão Social" : "Nome Completo"} *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João da Silva / Restaurante Graal" {...field} className="h-10 text-sm" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              {form.watch("personType") === "PJ" && (
                <FormField
                  control={form.control}
                  name="tradeName"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel className="text-xs font-bold uppercase">Nome Fantasia (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Graal Market" {...field} value={field.value || ""} className="h-10 text-sm" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">{form.watch("personType") === "PJ" ? "CNPJ" : "CPF"} *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={form.watch("personType") === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"} 
                        {...field} 
                        className="h-10 text-sm"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          field.onChange(val.slice(0, form.watch("personType") === "PJ" ? 14 : 11));
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* SEÇÃO: COMERCIAL */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-2 border-l-2 border-primary pl-2">
              <Briefcase className="h-3.5 w-3.5" /> Comercial
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SPRINT 8.9.42.2.2: Empresa Editável */}
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Empresa *</FormLabel>
                    <TabsUI 
                      value={String(field.value)} 
                      onValueChange={(val) => {
                        const newId = parseInt(val);
                        field.onChange(newId);
                        onCompanyChange(newId);
                        // SPRINT 8.9.42.2.2: Limpar grupo ao trocar empresa
                        form.setValue("groupId", "");
                      }}
                      className="w-full"
                    >
                      <TabsListUI className="grid w-full grid-cols-2 h-10 bg-muted/50">
                        {allowedCompanyIds.includes(1) && (
                          <TabsTriggerUI value="1" className="text-[10px] font-bold uppercase tracking-tighter">
                            GRAAL (1)
                          </TabsTriggerUI>
                        )}
                        {allowedCompanyIds.includes(3) && (
                          <TabsTriggerUI value="3" className="text-[10px] font-bold uppercase tracking-tighter">
                            GROTT (3)
                          </TabsTriggerUI>
                        )}
                        {!allowedCompanyIds.includes(1) && !allowedCompanyIds.includes(3) && (
                          <div className="flex items-center justify-center h-full px-2 text-[10px] text-muted-foreground uppercase font-bold">
                            Sem acesso
                          </div>
                        )}
                      </TabsListUI>
                    </TabsUI>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Grupo de Cliente *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={groupsQ.isLoading}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder={groupsQ.isLoading ? "Carregando grupos..." : "Selecione o grupo"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {groupsQ.isLoading ? (
                          <div className="flex items-center gap-2 p-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Carregando grupos...</span>
                          </div>
                        ) : groupsQ.isError || groupsQ.data?.ok === false ? (
                          <div className="flex items-center gap-2 p-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs">Não foi possível carregar os grupos de clientes do ERP.</span>
                          </div>
                        ) : (
                          groupsQ.data?.data?.groups?.map((g: any) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.description}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>
            
            {/* SPRINT 8.9.42.2.2: Vendedor Automático */}
            <div className="mt-4 col-span-full space-y-2">
              <Label className="text-xs font-bold uppercase">Vendedor</Label>
              <div className="h-10 px-3 flex items-center bg-muted/30 border rounded-md text-sm font-medium text-muted-foreground italic">
                {(profileQ.data as any)?.full_name ? `${(profileQ.data as any).full_name} / automático` : "Automático pelo usuário logado"}
              </div>
            </div>
          </div>

          {/* SEÇÃO: FINANCEIRO */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-2 border-l-2 border-primary pl-2">
              <Landmark className="h-3.5 w-3.5" /> Financeiro
            </h3>
            
            {paymentOptionsQ.isError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-[10px] font-bold">
                <Info className="h-4 w-4" /> Não foi possível carregar as opções financeiras do ERP.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentTermId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Condição de Pagamento *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={paymentOptionsQ.isLoading || paymentOptionsQ.isError}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 text-sm">
                          {paymentOptionsQ.isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-xs">Carregando...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Selecione a condição" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentOptionsQ.data?.data?.paymentTerms.map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Forma de Pagamento *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={paymentOptionsQ.isLoading || paymentOptionsQ.isError}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 text-sm">
                          {paymentOptionsQ.isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-xs">Carregando...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Selecione a forma" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentOptionsQ.data?.data?.paymentMethods.map((m: any) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* SEÇÃO: CONTATO */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-2 border-l-2 border-primary pl-2">
              <MessageSquare className="h-3.5 w-3.5" /> Contato
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-green-600" /> WhatsApp / Celular *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} className="h-10 text-sm" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase flex items-center gap-1">
                      <Phone className="h-3 w-3 text-blue-600" /> Telefone Fixo
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 0000-0000" {...field} value={field.value || ""} className="h-10 text-sm" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel className="text-xs font-bold uppercase flex items-center gap-1">
                      <Mail className="h-3 w-3 text-red-500" /> E-mail
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="contato@empresa.com.br" {...field} value={field.value || ""} className="h-10 text-sm" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* SEÇÃO: ENDEREÇO */}
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary/80 flex items-center gap-2 border-l-2 border-primary pl-2">
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </h3>
              {addressValidationStatus === "valid" && (
                <div className="flex items-center gap-1.5 text-emerald-600 animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Área de atendimento validada</span>
                </div>
              )}
              {addressValidationStatus === "outside" && (
                <div className="flex items-center gap-1.5 text-destructive animate-in shake duration-300">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Fora da área (50km)</span>
                </div>
              )}
              {addressValidationStatus === "validating" && (
                <div className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-[10px] font-bold uppercase">Validando área...</span>
                </div>
              )}
            </div>

            
            <div className="relative space-y-2">
              <Label className="text-xs font-bold uppercase">Buscar endereço (Google Maps)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Digite rua, estabelecimento ou endereço..." 
                  className="pl-9 h-10 text-sm bg-primary/5 border-primary/20 focus:bg-background transition-colors"
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              
              {/* SPRINT 8.9.42.2.2: Feedback de erro na busca do Google */}
              {isMapsLoaded && !isSearching && addressQuery.length >= 3 && suggestions.length === 0 && showSuggestions && (
                <div className="text-[10px] text-muted-foreground italic px-1 animate-in fade-in">
                  Nenhum endereço encontrado nesta área.
                </div>
              )}

              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 border-b last:border-0 flex flex-col gap-0.5"
                      onClick={() => handleSelectPrediction(s)}
                    >
                      <span className="text-sm font-bold text-foreground">{s.primaryText}</span>
                      <span className="text-xs text-muted-foreground truncate">{s.secondaryText}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem className="col-span-full md:col-span-3">
                    <FormLabel className="text-xs font-bold uppercase">Logradouro *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Rua, Avenida, etc." 
                        {...field} 
                        className="h-10 text-sm" 
                        onChange={(e) => {
                          field.onChange(e);
                          if (addressValidationStatus !== "none") setAddressValidationStatus("dirty");
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />

                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Número *</FormLabel>
                    <FormControl>
                      <Input 
                        id="client-addr-number" 
                        placeholder="123" 
                        {...field} 
                        className="h-10 text-sm" 
                        onChange={(e) => {
                          field.onChange(e);
                          if (addressValidationStatus !== "none") setAddressValidationStatus("dirty");
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />

                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.district"
                render={({ field }) => (
                  <FormItem className="col-span-full md:col-span-2">
                    <FormLabel className="text-xs font-bold uppercase">Bairro *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Centro" 
                        {...field} 
                        className="h-10 text-sm" 
                        onChange={(e) => {
                          field.onChange(e);
                          if (addressValidationStatus !== "none") setAddressValidationStatus("dirty");
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />

                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem className="col-span-full md:col-span-1">
                    <FormLabel className="text-xs font-bold uppercase">Cidade *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: São Paulo" 
                        {...field} 
                        className="h-10 text-sm" 
                        onChange={(e) => {
                          field.onChange(e);
                          if (addressValidationStatus !== "none") setAddressValidationStatus("dirty");
                        }}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />

                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">UF *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="SP" 
                        maxLength={2} 
                        {...field} 
                        className="h-10 text-sm" 
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase());
                          if (addressValidationStatus !== "none") setAddressValidationStatus("dirty");
                        }}
                      />

                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">CEP</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="00000-000" 
                        {...field} 
                        value={field.value || ""} 
                        className="h-10 text-sm" 
                        onChange={(e) => {
                          field.onChange(e);
                          if (addressValidationStatus !== "none") setAddressValidationStatus("dirty");
                        }}
                      />

                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.complement"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel className="text-xs font-bold uppercase">Complemento</FormLabel>
                    <FormControl>
                      <Input placeholder="Apto, Sala, Bloco, etc." {...field} value={field.value || ""} className="h-10 text-sm" />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 pb-2 border-t mt-auto">
            <Button 
              type="submit" 
              className="flex-1 font-bold h-12 text-base shadow-lg shadow-primary/20" 
              disabled={createClient.isPending}
            >
              {createClient.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Salvando no ERP...
                </>
              ) : (
                "Cadastrar cliente"
              )}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}