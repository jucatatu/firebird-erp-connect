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
  
  // UI de sugestões (Places Data API New)
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sessionToken, setSessionToken] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
      
      // Se tiver rua, popular o query do input para visual
      if (clientAddress.street) {
        setQuery(clientAddress.street);
      }
    } else if (deliveryAddress?.street && !query) {
      setQuery(deliveryAddress.street);
    }
  }, [clientAddress, deliveryAddress, setDeliveryAddress, setDeliveryAddressConfirmed]);

  const loadMaps = useCallback(async () => {
    if (isMapsLoaded || isLoadingMaps) return;
    setIsLoadingMaps(true);
    setMapsError(null);
    try {
      // Carregar apenas a library 'places' inicialmente (loadGoogleMapsLibraries já faz maps/marker/places)
      const libs = await loadGoogleMapsLibraries();
      setMapsLibs(libs);
      setIsMapsLoaded(true);
      
      // Inicializar Session Token
      const { AutocompleteSessionToken } = (window as any).google.maps.places;
      setSessionToken(new AutocompleteSessionToken());
    } catch (err: any) {
      setMapsError("Erro ao carregar Google Maps");
    } finally {
      setIsLoadingMaps(false);
    }
  }, [isMapsLoaded, isLoadingMaps]);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

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

  // Debounced search for suggestions (Places Data API New)
  useEffect(() => {
    if (!query || query.length < 3 || !isMapsLoaded || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { AutocompleteSuggestion } = (window as any).google.maps.places;
        
        const request = {
          input: query,
          includedRegionCodes: ["br"],
          locationBias: {
            center: { lat: -26.48, lng: -49.07 },
            radius: 10000
          },
          sessionToken
        };

        const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        setSuggestions(results || []);
      } catch (err) {
        console.error("Erro fetch suggestions:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, isMapsLoaded, sessionToken, showSuggestions]);

  const handleSelectPrediction = async (prediction: any) => {
    setShowSuggestions(false);
    setIsGeocoding(true);
    
    try {
      const place = prediction.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location", "id", "displayName"]
      });

      const components = place.addressComponents;
      const getComp = (types: string[]) => components.find((c: any) => types.some(t => c.types.includes(t)))?.longText || "";

      const street = getComp(["route"]) || place.displayName || "";
      const streetNumber = getComp(["street_number"]);
      const neighborhood = getComp(["neighborhood", "sublocality", "sublocality_level_1"]);
      const city = getComp(["locality", "administrative_area_level_2"]);
      const state = getComp(["administrative_area_level_1"]);
      const postalCode = getComp(["postal_code"]);
      const country = getComp(["country"]);

      const location = place.location;

      const newAddress: DeliveryAddress = {
        ...deliveryAddress!,
        formattedAddress: place.formattedAddress || "",
        street: street,
        number: streetNumber || "",
        neighborhood: neighborhood || "",
        city: city || "",
        state: state || "",
        postalCode: postalCode || "",
        country: country || "Brasil",
        latitude: location?.lat?.() || location?.lat || null,
        longitude: location?.lng?.() || location?.lng || null,
        placeId: place.id,
        noNumber: false,
        complement: deliveryAddress?.complement || "",
        reference: deliveryAddress?.reference || ""
      };

      setQuery(street);
      setDeliveryAddress(newAddress);
      setDeliveryAddressConfirmed(false);
      
      // Novo token para a próxima sessão
      const { AutocompleteSessionToken } = (window as any).google.maps.places;
      setSessionToken(new AutocompleteSessionToken());

      // Focar no campo número após selecionar rua se vier vazio
      if (!streetNumber) {
        setTimeout(() => {
          document.getElementById("delivery-number")?.focus();
        }, 150);
      }
    } catch (err) {
      console.error("Erro ao selecionar lugar:", err);
      toast.error("Erro ao obter detalhes do endereço");
    } finally {
      setIsGeocoding(false);
    }
  };

  // Setup Map
  useEffect(() => {
    if (deliveryAddress?.latitude && deliveryAddress?.longitude && isMapsLoaded && mapsLibs && mapContainerRef.current) {
      const { Map, AdvancedMarkerElement } = (window as any).google.maps;
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
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude, isMapsLoaded, mapsLibs]);

  const handleManualEdit = (field: keyof DeliveryAddress, value: any) => {
    if (!deliveryAddress) return;
    
    const updated = { ...deliveryAddress, [field]: value };
    
    if (field === "noNumber") {
      updated.number = value ? "S/N" : "";
    }
    
    if (field === "street") {
      setQuery(value);
      setShowSuggestions(true);
      // Ao alterar a rua, invalidamos coordenadas e confirmação
      updated.latitude = null;
      updated.longitude = null;
      updated.placeId = null;
    }
    
    setDeliveryAddress(updated);
    
    const criticalFields: (keyof DeliveryAddress)[] = ["street", "number", "neighborhood", "city", "state", "postalCode", "noNumber"];
    if (criticalFields.includes(field)) {
      setDeliveryAddressConfirmed(false);
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
        } else if (showSuccessToast) {
          toast.success("Endereço validado com sucesso!");
        }
        
        // A geocodificação automática NÃO confirma o endereço, apenas atualiza coordenadas
        if (showSuccessToast) {
          setDeliveryAddressConfirmed(true);
        }
      } else {
        if (showSuccessToast) toast.error("Não foi possível validar as coordenadas exatas. Tente ajustar no mapa.");
        if (deliveryAddress.street && showSuccessToast) {
           setDeliveryAddressConfirmed(true);
        }
      }
    } catch (err) {
      if (showSuccessToast) toast.error("Erro ao validar endereço.");
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
            {/* LOGRADOURO com Google Autocomplete como ASSISTENTE */}
            <div className="col-span-12 space-y-1 relative">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                Logradouro <Search className="h-2 w-2" />
              </Label>
              <div className="relative">
                <Input 
                  placeholder="🔍 Digite o nome da rua ou local" 
                  value={query} 
                  onChange={(e) => {
                    setQuery(e.target.value);
                    handleManualEdit("street", e.target.value);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="h-11 text-sm font-medium border-primary/20 focus:border-primary pr-10"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Lista de Sugestões Própria (Mobile Friendly) */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1"
                >
                  <div className="max-h-[300px] overflow-y-auto">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-0 transition-colors flex items-start gap-3"
                        onClick={() => handleSelectPrediction(s)}
                      >
                        <MapPin className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                        <div>
                          <div className="text-sm font-bold text-slate-900 leading-tight">
                            {s.placePrediction.text.mainText.text}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            {s.placePrediction.text.secondaryText?.text || ""}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* NÚMERO - FOCO AUTOMÁTICO APÓS LOGRADOURO */}
            <div className="col-span-6 space-y-1">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Número</Label>
              <Input 
                id="delivery-number"
                placeholder="Ex: 56" 
                value={deliveryAddress?.noNumber ? "S/N" : (deliveryAddress?.number || "")} 
                disabled={deliveryAddress?.noNumber}
                onChange={(e) => handleManualEdit("number", e.target.value)}
                className={cn(
                  "h-11 text-sm font-bold transition-all", 
                  !deliveryAddress?.number && !deliveryAddress?.noNumber && "border-amber-500 bg-amber-50/30 ring-1 ring-amber-500/20",
                  deliveryAddress?.number && !deliveryAddressConfirmed && "border-blue-500 bg-blue-50/30"
                )}
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
            {deliveryAddress?.latitude && deliveryAddress?.longitude && (
              <div className="space-y-2 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    Confirmar Localização <MapIcon className="h-2 w-2" />
                  </Label>
                  {deliveryAddress.placeId && (
                    <Badge variant="outline" className="text-[8px] h-4 font-normal">
                      ID: {deliveryAddress.placeId.slice(0, 8)}
                    </Badge>
                  )}
                </div>
                
                <div 
                  ref={mapContainerRef} 
                  className="w-full h-64 rounded-xl border-2 border-primary/10 shadow-inner overflow-hidden relative bg-slate-100"
                >
                  {isLoadingMaps && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  {mapsError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-50">
                      <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs font-medium text-muted-foreground">{mapsError}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">O endereço pode continuar sendo preenchido manualmente.</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground text-center px-4 italic">
                  Arraste o marcador para ajuste fino da entrega se necessário.
                </p>
              </div>
            )}

            {deliveryAddress && !deliveryAddressConfirmed && deliveryAddress.street && (
              <div className="pt-2">
                <Button 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl gap-2 shadow-lg shadow-primary/20"
                  onClick={() => validateAndConfirm(true)}
                  disabled={isGeocoding}
                >
                  {isGeocoding ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <Navigation className="h-5 w-5" />
                      Confirmar Endereço Logístico
                    </>
                  )}
                </Button>
                
                {!deliveryAddressConfirmed && !deliveryAddress.latitude && (deliveryAddress.number || deliveryAddress.noNumber) && (
                   <p className="text-[10px] text-amber-600 text-center mt-2 font-medium">
                     Aguardando geocodificação server-side...
                   </p>
                )}
              </div>
            )}
            
            {deliveryAddressConfirmed && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-green-800 leading-tight">Endereço Confirmado</p>
                  <p className="text-[10px] text-green-600">Pronto para finalização logística.</p>
                </div>
              </div>
            )}
          </div>
          
          <p className="text-[9px] text-muted-foreground text-center italic leading-tight mt-4">
            * O endereço é uma sugestão baseada no cadastro. <br/>
            Alterações valem apenas para este pedido.
          </p>
        </div>
      </div>
    </div>
  );
}

