import React, { useEffect, useRef, useState, useCallback } from "react";
import { useOrderFormStore, type DeliveryAddress } from "@/hooks/use-order-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, MapPin, Search, Truck, Loader2, Map as MapIcon, Navigation, ChevronDown, ChevronUp } from "lucide-react";
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

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [mapsLibs, setMapsLibs] = useState<any>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [showFullAddress, setShowFullAddress] = useState(true);

  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteInstanceRef = useRef<any>(null);

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

  const loadMaps = useCallback(async () => {
    if (isMapsLoaded || isLoadingMaps) return;
    setIsLoadingMaps(true);
    setMapsError(null);
    try {
      const libs = await loadGoogleMapsLibraries();
      setMapsLibs(libs);
      setIsMapsLoaded(true);
    } catch (err: any) {
      setMapsError("Erro ao carregar Google Maps");
      toast.error("Erro ao carregar Google Maps");
    } finally {
      setIsLoadingMaps(false);
    }
  }, [isMapsLoaded, isLoadingMaps]);

  // Carregar mapas automaticamente ao montar para o Logradouro (Autocomplete)
  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  // Setup Autocomplete no Logradouro
  useEffect(() => {
    if (isMapsLoaded && mapsLibs && autocompleteInputRef.current && !autocompleteInstanceRef.current) {
      const { Autocomplete } = (window as any).google.maps.places;
      
      const options = {
        fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
        includedRegionCodes: ["br"],
        locationBias: { radius: 10000, center: { lat: -26.48, lng: -49.07 } },
        types: ["address", "establishment"]
      };

      const autocomplete = new Autocomplete(autocompleteInputRef.current, options);
      autocompleteInstanceRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place || !place.address_components) return;

        const components = place.address_components;
        const getComp = (types: string[]) => components.find((c: any) => types.some(t => c.types.includes(t)))?.long_name || "";

        const street = getComp(["route"]) || place.name || "";
        const streetNumber = getComp(["street_number"]);
        const neighborhood = getComp(["neighborhood", "sublocality", "sublocality_level_1"]);
        const city = getComp(["administrative_area_level_2", "locality"]);
        const state = getComp(["administrative_area_level_1"]);
        const postalCode = getComp(["postal_code"]);
        const country = getComp(["country"]);

        const lat = place.geometry?.location?.lat;
        const lng = place.geometry?.location?.lng;

        const newAddress: DeliveryAddress = {
          ...deliveryAddress!,
          formattedAddress: place.formatted_address || place.name || "",
          street: street,
          number: streetNumber || "",
          neighborhood: neighborhood || deliveryAddress?.neighborhood || "",
          city: city || deliveryAddress?.city || "",
          state: state || deliveryAddress?.state || "",
          postalCode: postalCode || deliveryAddress?.postalCode || "",
          country: country || "Brasil",
          latitude: typeof lat === 'function' ? lat() : lat,
          longitude: typeof lng === 'function' ? lng() : lng,
          placeId: place.place_id,
          noNumber: false,
          complement: deliveryAddress?.complement || "",
          reference: deliveryAddress?.reference || ""
        };

        setDeliveryAddress(newAddress);
        setDeliveryAddressConfirmed(false);
        
        // Focar no campo número após selecionar rua se vier vazio
        if (!streetNumber) {
          setTimeout(() => {
            const numInput = document.getElementById("delivery-number");
            numInput?.focus();
          }, 100);
        }
      });
    }
  }, [isMapsLoaded, mapsLibs, setDeliveryAddress, setDeliveryAddressConfirmed, deliveryAddress]);

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
            latitude: typeof newPos.lat === 'function' ? newPos.lat() : newPos.lat,
            longitude: typeof newPos.lng === 'function' ? newPos.lng() : newPos.lng
          });
          setDeliveryAddressConfirmed(false);
        });
      } else {
        mapInstanceRef.current.setCenter(position);
        markerRef.current.position = position;
      }
    }
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude, isMapsLoaded, mapsLibs, setDeliveryAddress, setDeliveryAddressConfirmed]);

  const handleManualEdit = (field: keyof DeliveryAddress, value: any) => {
    if (!deliveryAddress) return;
    
    const updated = { ...deliveryAddress, [field]: value };
    
    if (field === "noNumber") {
      updated.number = value ? "S/N" : "";
    }
    
    setDeliveryAddress(updated);
    
    const criticalFields: (keyof DeliveryAddress)[] = ["street", "number", "neighborhood", "city", "state", "postalCode", "noNumber"];
    if (criticalFields.includes(field)) {
      setDeliveryAddressConfirmed(false);
      
      // Se for alteração de número e for um número válido, podemos tentar geocodificar (opcional, vamos manter manual por enquanto como solicitado)
      // Se alterar logradouro, o efeito de limpeza já deve ser tratado no Autocomplete listener
    }
  };

  // Efeito para geocodificação automática após preencher número (Sprint 8.9.37.4 Item 9)
  useEffect(() => {
    if (!deliveryAddress || deliveryAddressConfirmed || isGeocoding) return;
    
    const hasBaseInfo = deliveryAddress.street && (deliveryAddress.number || deliveryAddress.noNumber) && deliveryAddress.city;
    if (!hasBaseInfo) return;

    const timer = setTimeout(() => {
      validateAndConfirm(false); // Validar sem mostrar toast de sucesso imediato
    }, 1500);

    return () => clearTimeout(timer);
  }, [deliveryAddress?.street, deliveryAddress?.number, deliveryAddress?.noNumber, deliveryAddress?.city, deliveryAddressConfirmed]);

  const validateAndConfirm = async (showSuccessToast = true) => {
    if (!deliveryAddress) return;
    
    const needsNumber = deliveryAddress.street && !deliveryAddress.noNumber;
    if (needsNumber && (!deliveryAddress.number || deliveryAddress.number === "S/N")) {
      if (showSuccessToast) toast.error("Por favor, informe o número ou marque 'Sem número'");
      document.getElementById("delivery-number")?.focus();
      return;
    }

    if (deliveryAddress.noNumber && !deliveryAddress.reference) {
       if (showSuccessToast) toast.error("Para endereços sem número, um ponto de referência é obrigatório");
       document.getElementById("delivery-reference")?.focus();
       return;
    }

    setIsGeocoding(true);
    try {
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
        toast.error("Não foi possível validar as coordenadas exatas. Tente ajustar no mapa.");
        if (deliveryAddress.street) {
           setDeliveryAddressConfirmed(true);
        }
      }
    } catch (err) {
      toast.error("Erro ao validar endereço.");
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
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

      <div className="space-y-4">
        <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
          <div className="grid grid-cols-12 gap-3">
            {/* LOGRADOURO com Google Autocomplete */}
            <div className="col-span-12 space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                Logradouro <Search className="h-2 w-2" />
              </Label>
              <Input 
                ref={autocompleteInputRef}
                placeholder="🔍 Digite o nome da rua ou local" 
                value={deliveryAddress?.street || ""} 
                onChange={(e) => handleManualEdit("street", e.target.value)}
                className="h-11 text-sm font-medium border-primary/20 focus:border-primary"
              />
            </div>

            {/* NÚMERO */}
            <div className="col-span-6 space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Número</Label>
              <Input 
                id="delivery-number"
                placeholder="Ex: 56" 
                value={deliveryAddress?.noNumber ? "S/N" : (deliveryAddress?.number || "")} 
                disabled={deliveryAddress?.noNumber}
                onChange={(e) => handleManualEdit("number", e.target.value)}
                className={cn("h-11 text-sm font-bold", !deliveryAddress?.number && !deliveryAddress?.noNumber && "border-amber-500 bg-amber-50/30")}
              />
            </div>

            {/* Endereço sem número */}
            <div className="col-span-6 flex items-center space-x-2 h-11 pt-5">
              <Checkbox 
                id="no-number" 
                checked={deliveryAddress?.noNumber || false} 
                onCheckedChange={(checked) => handleManualEdit("noNumber", checked)}
              />
              <label 
                htmlFor="no-number" 
                className="text-[11px] font-medium leading-none cursor-pointer"
              >
                Sem número
              </label>
            </div>

            <div className="col-span-12 pt-2 border-t border-dashed">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-8 text-[9px] uppercase font-bold text-muted-foreground gap-1"
                onClick={() => setShowFullAddress(!showFullAddress)}
              >
                {showFullAddress ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showFullAddress ? "Recolher detalhes" : "Ver endereço completo"}
              </Button>
            </div>

            {showFullAddress && (
              <>
                <div className="col-span-12 sm:col-span-6 space-y-1 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bairro</Label>
                  <Input 
                    placeholder="Bairro" 
                    value={deliveryAddress?.neighborhood || ""} 
                    onChange={(e) => handleManualEdit("neighborhood", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6 space-y-1 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cidade</Label>
                  <Input 
                    placeholder="Cidade" 
                    value={deliveryAddress?.city || ""} 
                    onChange={(e) => handleManualEdit("city", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="col-span-6 space-y-1 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">UF</Label>
                  <Input 
                    placeholder="SC" 
                    value={deliveryAddress?.state || ""} 
                    onChange={(e) => handleManualEdit("state", e.target.value)}
                    className="h-9 text-xs uppercase"
                  />
                </div>
                <div className="col-span-6 space-y-1 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">CEP</Label>
                  <Input 
                    placeholder="00000-000" 
                    value={deliveryAddress?.postalCode || ""} 
                    onChange={(e) => handleManualEdit("postalCode", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="col-span-12 space-y-1 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Complemento</Label>
                  <Input 
                    placeholder="Apto, Bloco..." 
                    value={deliveryAddress?.complement || ""} 
                    onChange={(e) => handleManualEdit("complement", e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="col-span-12 space-y-1 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    Ponto de Referência {deliveryAddress?.noNumber && <span className="text-destructive">*</span>}
                  </Label>
                  <Input 
                    id="delivery-reference"
                    placeholder="Próximo a..." 
                    value={deliveryAddress?.reference || ""} 
                    onChange={(e) => handleManualEdit("reference", e.target.value)}
                    className={cn("h-9 text-xs", deliveryAddress?.noNumber && !deliveryAddress?.reference && "border-amber-500 bg-amber-50/30")}
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-dashed space-y-4">
            <Button 
              className={cn(
                "w-full h-12 text-sm font-bold gap-2 shadow-md transition-all active:scale-[0.98]",
                deliveryAddressConfirmed 
                  ? "bg-green-600 text-white hover:bg-green-700" 
                  : "bg-primary text-primary-foreground hover:shadow-lg"
              )}
              onClick={validateAndConfirm}
              disabled={isGeocoding}
            >
              {isGeocoding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Validando Localização...
                </>
              ) : deliveryAddressConfirmed ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Endereço Confirmado
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" /> Validar Localização
                </>
              )}
            </Button>

            {deliveryAddress?.latitude && deliveryAddress?.longitude && (
              <div className="space-y-2 animate-in zoom-in duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <MapIcon className="h-3 w-3" /> Mapa de Entrega
                  </Label>
                  <span className="text-[9px] text-muted-foreground italic">Arraste para ajuste fino</span>
                </div>
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-[180px] rounded-xl border bg-muted/20 overflow-hidden shadow-inner" 
                />
                
                {!deliveryAddressConfirmed && (
                   <p className="text-[10px] text-destructive font-bold text-center">
                     ⚠️ ENDEREÇO NÃO CONFIRMADO. Clique em Validar.
                   </p>
                )}
              </div>
            )}
          </div>
          
          <p className="text-[9px] text-muted-foreground text-center italic leading-tight">
            * O endereço é uma sugestão baseada no cadastro. <br/>
            Alterações valem apenas para este pedido.
          </p>
        </div>
      </div>
    </div>
  );
}
