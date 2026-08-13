import React, { useEffect, useRef, useState } from "react";
import { useOrderFormStore, type DeliveryAddress } from "@/hooks/use-order-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, MapPin, Search, Truck, Loader2, Map as MapIcon, Navigation } from "lucide-react";
import { loadGoogleMapsLibraries } from "@/lib/google-maps";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { geocodeStructuredAddress } from "@/lib/geocoding.functions.ts";
import { useServerFn } from "@tanstack/react-start";

export function DeliveryAddressSection({ clientAddress }: { clientAddress: any }) {
  const { 
    deliveryAddress, 
    deliveryAddressConfirmed, 
    setDeliveryAddress, 
    setDeliveryAddressConfirmed 
  } = useOrderFormStore();
  
  const geocodeFn = useServerFn(geocodeStructuredAddress);

  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [mapsLibs, setMapsLibs] = useState<any>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const autocompleteRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize with client address if nothing exists
  useEffect(() => {
    if (!deliveryAddress && clientAddress) {
      const initialAddress: DeliveryAddress = {
        formattedAddress: `${clientAddress.street || ""}, ${clientAddress.number || ""}, ${clientAddress.district || ""}, ${clientAddress.city || ""} - ${clientAddress.state || ""}`,
        street: clientAddress.street || "",
        number: clientAddress.number || "",
        neighborhood: clientAddress.district || "",
        city: clientAddress.city || "",
        state: clientAddress.state || "",
        postalCode: clientAddress.zip || "",
        country: "Brasil",
        latitude: null,
        longitude: null,
        placeId: null,
        complement: clientAddress.complement || "",
        reference: "",
        noNumber: clientAddress.number === "S/N"
      };
      setDeliveryAddress(initialAddress);
      setDeliveryAddressConfirmed(false);
    }
  }, [clientAddress, deliveryAddress, setDeliveryAddress, setDeliveryAddressConfirmed]);

  const loadMaps = async () => {
    if (isMapsLoaded || isLoadingMaps) return;
    setIsLoadingMaps(true);
    setMapsError(null);
    try {
      const libs = await loadGoogleMapsLibraries();
      setMapsLibs(libs);
      setIsMapsLoaded(true);
    } catch (err: any) {
      // O erro detalhado já foi logado pelo helper
      setMapsError("Não foi possível carregar o Google Maps. Use o preenchimento manual.");
      toast.error("Erro ao carregar Google Maps");
    } finally {
      setIsLoadingMaps(false);
    }
  };

  // Setup Autocomplete
  useEffect(() => {
    if (isSearching && isMapsLoaded && mapsLibs && autocompleteRef.current) {
      console.log("[GOOGLE MAPS] Inicializando autocomplete...");
      
      const autocomplete = document.createElement("gmp-place-autocomplete");
      
      // Sprint 8.9.37.2: Campos estruturados via address_components
      // Sprint 8.9.37.3: Usando propriedades modernas da Places API (New)
      (autocomplete as any).fields = ["address_components", "formatted_address", "geometry", "name", "place_id"];
      
      // Bias para Jaraguá do Sul/SC (Apenas como BIAS, não restrição rígida)
      (autocomplete as any).locationBias = { 
        radius: 10000, 
        center: { lat: -26.48, lng: -49.07 } 
      };
      
      // Restrição para Brasil usando a propriedade correta da API New
      (autocomplete as any).includedRegionCodes = ["br"];

      autocomplete.setAttribute("placeholder", "Digite rua, endereço ou estabelecimento");

      autocompleteRef.current.innerHTML = "";
      autocompleteRef.current.appendChild(autocomplete);

      const handlePlaceSelect = async (event: any) => {
        console.log("[GOOGLE MAPS] Local selecionado:", event.place);
        const place = event.place;
        
        if (!place || typeof place === 'string') return;

        // Se o place não tiver campos carregados (pode acontecer se disparar antes do fetch completar internamente)
        // usamos o Place object moderno se disponível
        let fullPlace = place;
        if (!place.address_components && mapsLibs.Place) {
           try {
             fullPlace = await place.fetchFields({
               fields: ["address_components", "formatted_address", "geometry", "name", "place_id", "location"]
             });
           } catch (e) {
             console.error("[GOOGLE MAPS] Erro ao buscar campos extras:", e);
           }
        }

        const components = fullPlace.address_components || [];
        const getComp = (types: string[]) => components.find((c: any) => types.some(t => c.types.includes(t)))?.long_name || "";

        const streetNumber = getComp(["street_number"]);
        const street = getComp(["route"]);
        
        // Bairro resolution tolerante
        const neighborhood = getComp(["neighborhood", "sublocality", "sublocality_level_1"]);
        
        // Cidade resolution
        const city = getComp(["administrative_area_level_2", "locality"]);
        
        const state = getComp(["administrative_area_level_1"]);
        const postalCode = getComp(["postal_code"]);
        const country = getComp(["country"]);

        const lat = fullPlace.geometry?.location?.lat;
        const lng = fullPlace.geometry?.location?.lng;

        const newAddress: DeliveryAddress = {
          formattedAddress: fullPlace.formatted_address || fullPlace.name || "",
          street: street,
          number: streetNumber,
          neighborhood: neighborhood,
          city: city,
          state: state,
          postalCode: postalCode,
          country: country,
          latitude: typeof lat === 'function' ? lat() : lat,
          longitude: typeof lng === 'function' ? lng() : lng,
          placeId: fullPlace.place_id,
          complement: deliveryAddress?.complement || "",
          reference: deliveryAddress?.reference || "",
          noNumber: false
        };

        console.log("[GOOGLE MAPS] Endereço estruturado:", newAddress);

        setDeliveryAddress(newAddress);
        setDeliveryAddressConfirmed(false);
        setIsSearching(false);
        
        // Se não retornou número, focar no campo número após o render
        if (!streetNumber && street) {
          setTimeout(() => {
            const numInput = document.getElementById("delivery-number");
            numInput?.focus();
          }, 100);
        }
      };

      autocomplete.addEventListener("gmp-placeselect", handlePlaceSelect);

      return () => {
        autocomplete.removeEventListener("gmp-placeselect", handlePlaceSelect);
      };
    }
  }, [isSearching, isMapsLoaded, mapsLibs, setDeliveryAddress, setDeliveryAddressConfirmed]);

  // Setup Map
  useEffect(() => {
    if (deliveryAddress?.latitude && deliveryAddress?.longitude && isMapsLoaded && mapsLibs && mapContainerRef.current) {
      const { Map, AdvancedMarkerElement } = mapsLibs;
      
      const position = { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new Map(mapContainerRef.current, {
          center: position,
          zoom: 17,
          mapId: "DELIVERY_MAP",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });

        markerRef.current = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: position,
          gmpDraggable: true,
          title: "Local de Entrega"
        });

        markerRef.current.addListener("dragend", () => {
          const newPos = markerRef.current.position;
          setDeliveryAddress({
            ...deliveryAddress,
            latitude: newPos.lat,
            longitude: newPos.lng
          });
          setDeliveryAddressConfirmed(false);
        });
      } else {
        mapInstanceRef.current.setCenter(position);
        markerRef.current.position = position;
      }
    }
  }, [deliveryAddress, isMapsLoaded, mapsLibs, setDeliveryAddress, setDeliveryAddressConfirmed]);

  const handleConfirm = async () => {
    if (!deliveryAddress) return;
    
    // Validação de número (Sprint 8.9.37.2)
    const needsNumber = deliveryAddress.street && !deliveryAddress.noNumber;
    if (needsNumber && (!deliveryAddress.number || deliveryAddress.number === "S/N")) {
      toast.error("Por favor, informe o número ou marque 'Sem número'");
      document.getElementById("delivery-number")?.focus();
      return;
    }

    if (deliveryAddress.noNumber && !deliveryAddress.reference) {
       toast.error("Para endereços sem número, um ponto de referência é obrigatório");
       document.getElementById("delivery-reference")?.focus();
       return;
    }

    // Geocodificação após número estar presente
    setIsGeocoding(true);
    try {
      console.log("[GEOCODE] Iniciando geocodificação server-side para:", deliveryAddress);
      const res = await geocodeFn({
        data: {
          street: deliveryAddress.street,
          number: deliveryAddress.number || "S/N",
          neighborhood: deliveryAddress.neighborhood,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          country: deliveryAddress.country || "Brasil"
        }
      });

      if (res.ok && res.data) {
        const { latitude, longitude, formattedAddress, placeId, precision } = res.data;
        
        setDeliveryAddress({
          ...deliveryAddress,
          latitude,
          longitude,
          formattedAddress: formattedAddress || deliveryAddress.formattedAddress,
          placeId: placeId || deliveryAddress.placeId
        });

        if (precision === "APPROXIMATE" || precision === "GEOMETRIC_CENTER") {
          toast.warning("Localização aproximada. Confira o ponto no mapa.");
        } else {
          toast.success("Endereço validado com sucesso!");
        }
        
        setDeliveryAddressConfirmed(true);
      } else {
        console.warn("[GEOCODE] Falha na geocodificação precisa:", res.error);
        toast.error("Não foi possível validar as coordenadas exatas. Tente ajustar no mapa.");
        // Permitir confirmar mesmo assim se houver rua, mas avisar
        if (deliveryAddress.street) {
           setDeliveryAddressConfirmed(true);
        }
      }
    } catch (err) {
      console.error("[GEOCODE] Erro:", err);
      toast.error("Erro ao validar endereço.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleManualEdit = (field: keyof DeliveryAddress, value: any) => {
    if (!deliveryAddress) return;
    
    const updated = { ...deliveryAddress, [field]: value };
    
    // Se marcou noNumber, forçar number para "S/N"
    if (field === "noNumber") {
      updated.number = value ? "S/N" : "";
    }
    
    setDeliveryAddress(updated);
    // Se mudou qualquer campo estruturado crítico, invalidar confirmação
    const criticalFields: (keyof DeliveryAddress)[] = ["street", "number", "neighborhood", "city", "state", "postalCode", "noNumber"];
    if (criticalFields.includes(field)) {
      setDeliveryAddressConfirmed(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Endereço de Entrega</h3>
        </div>
        {deliveryAddressConfirmed ? (
          <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1 py-1 px-3">
            <CheckCircle2 className="h-3 w-3" /> Confirmado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 gap-1 py-1 px-3">
            <AlertCircle className="h-3 w-3" /> Não confirmado
          </Badge>
        )}
      </div>

      {!isSearching ? (
        <div className="space-y-4">
          <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
            <div className="flex items-start gap-3 pb-2 border-b border-dashed">
              <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug">{deliveryAddress?.formattedAddress || "Nenhum endereço definido"}</p>
                <div className="flex gap-2 mt-1">
                   <Badge variant="secondary" className="text-[9px] uppercase font-bold py-0 h-4">
                     {deliveryAddress?.city || "Cidade não informada"}
                   </Badge>
                   {deliveryAddress?.neighborhood && (
                     <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 h-4">
                       {deliveryAddress.neighborhood}
                     </Badge>
                   )}
                </div>
              </div>
            </div>

            {/* Formulário Estruturado (Sprint 8.9.37.2) */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8 sm:col-span-9 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  Logradouro <Navigation className="h-2 w-2" />
                </Label>
                <Input 
                  placeholder="Rua, Av, Travessa..." 
                  value={deliveryAddress?.street || ""} 
                  onChange={(e) => handleManualEdit("street", e.target.value)}
                  className="h-9 text-xs font-medium"
                />
              </div>
              <div className="col-span-4 sm:col-span-3 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Número</Label>
                <Input 
                  id="delivery-number"
                  placeholder="Ex: 123" 
                  value={deliveryAddress?.noNumber ? "S/N" : (deliveryAddress?.number || "")} 
                  disabled={deliveryAddress?.noNumber}
                  onChange={(e) => handleManualEdit("number", e.target.value)}
                  className={cn("h-9 text-xs font-bold", !deliveryAddress?.number && !deliveryAddress?.noNumber && "border-amber-500 bg-amber-50/30")}
                />
              </div>

              <div className="col-span-12 flex items-center space-x-2 -mt-1">
                <Checkbox 
                  id="no-number" 
                  checked={deliveryAddress?.noNumber || false} 
                  onCheckedChange={(checked) => handleManualEdit("noNumber", checked)}
                />
                <label 
                  htmlFor="no-number" 
                  className="text-[11px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Endereço sem número
                </label>
              </div>

              <div className="col-span-6 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bairro</Label>
                <Input 
                  placeholder="Bairro" 
                  value={deliveryAddress?.neighborhood || ""} 
                  onChange={(e) => handleManualEdit("neighborhood", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="col-span-6 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cidade</Label>
                <Input 
                  placeholder="Cidade" 
                  value={deliveryAddress?.city || ""} 
                  onChange={(e) => handleManualEdit("city", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="col-span-6 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Complemento</Label>
                <Input 
                  placeholder="Ex: Apto 101, Fundos..." 
                  value={deliveryAddress?.complement || ""} 
                  onChange={(e) => handleManualEdit("complement", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="col-span-6 space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                   Ponto de Referência {deliveryAddress?.noNumber && <span className="text-destructive">*</span>}
                </Label>
                <Input 
                  id="delivery-reference"
                  placeholder="Ex: Próximo ao mercado..." 
                  value={deliveryAddress?.reference || ""} 
                  onChange={(e) => handleManualEdit("reference", e.target.value)}
                  className={cn("h-9 text-xs", deliveryAddress?.noNumber && !deliveryAddress?.reference && "border-amber-500 bg-amber-50/30")}
                />
              </div>
            </div>

            {deliveryAddress?.latitude && deliveryAddress?.longitude && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <MapIcon className="h-3 w-3" /> Localização no Mapa
                  </Label>
                  <span className="text-[9px] text-muted-foreground italic">Arraste o marcador se necessário</span>
                </div>
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-[200px] rounded-xl border bg-muted/20 overflow-hidden shadow-inner animate-in zoom-in duration-300" 
                />
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button 
                className={cn(
                  "w-full h-12 text-sm font-bold gap-2 shadow-md transition-all active:scale-[0.98]",
                  deliveryAddressConfirmed 
                    ? "bg-green-600 text-white hover:bg-green-700" 
                    : "bg-primary text-primary-foreground hover:shadow-lg"
                )}
                onClick={handleConfirm}
                disabled={isGeocoding}
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Geocodificando...
                  </>
                ) : deliveryAddressConfirmed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Endereço Confirmado
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4" /> Validar e Confirmar Endereço
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full h-10 text-xs font-semibold gap-2 border-dashed"
                onClick={() => {
                  setIsSearching(true);
                  loadMaps();
                }}
              >
                <Search className="h-3 w-3" /> Buscar outro endereço (Google)
              </Button>
            </div>
            
            <p className="text-[10px] text-muted-foreground text-center italic leading-tight">
              * Dados estruturados serão salvos no pedido para o motorista.<br/>
              Alterações aqui não afetam o cadastro fixo do cliente.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">Buscar novo endereço</h4>
            <Button variant="ghost" size="sm" onClick={() => setIsSearching(false)} className="h-8 text-[10px] uppercase font-bold text-muted-foreground">
              Voltar
            </Button>
          </div>
          
          <div className="space-y-4">
            {isLoadingMaps ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Carregando busca de endereços...</span>
              </div>
            ) : mapsError ? (
              <div className="p-3 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2">
                <p className="text-xs text-destructive">{mapsError}</p>
                <Button variant="outline" className="w-full text-xs" onClick={() => setIsSearching(false)}>
                  Preencher Manualmente
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                 <div 
                   ref={autocompleteRef} 
                   className="w-full [&_gmp-place-autocomplete]:w-full [&_input]:h-12 [&_input]:rounded-xl [&_input]:border-primary/30 [&_input]:focus:border-primary [&_input]:shadow-sm" 
                 />
                 <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                   <Search className="h-4 w-4 text-blue-500 shrink-0" />
                   <p className="text-[11px] text-blue-700 leading-tight">
                     Digite a rua e número, estabelecimento ou um local conhecido.
                   </p>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
