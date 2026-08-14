import React, { useEffect, useRef, useState, useCallback } from "react";
import { useOrderFormStore, type DeliveryAddress } from "@/hooks/use-order-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, MapPin, Search, Truck, Loader2, Map as MapIcon, Navigation, ChevronDown, ChevronUp, Map, User, Home, Info } from "lucide-react";
import { loadGoogleMapsLibraries } from "@/lib/google-maps";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { geocodeStructuredAddress } from "@/lib/geocoding.functions.ts";
import { useServerFn } from "@tanstack/react-start";
import { Separator } from "@/components/ui/separator";

export function DeliveryAddressSection({ clientAddress }: { clientAddress: any }) {
  const { 
    deliveryAddress, 
    deliveryAddressConfirmed, 
    deliveryAddressSource,
    setDeliveryAddress, 
    setDeliveryAddressConfirmed,
    setDeliveryAddressSource,
    deliver,
    setDelivery,
    deliveryAt
  } = useOrderFormStore();
  
  const geocodeFn = useServerFn(geocodeStructuredAddress);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMapsLoaded, setIsMapsLoaded] = useState(false);
  const [mapsLibs, setMapsLibs] = useState<any>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [showFullAddress, setShowFullAddress] = useState(false);
  
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

  // Sprint 8.9.38 - Regra Centralizada de Validação
  const hasValidClientAddress = Boolean(
    clientAddress?.street && 
    (clientAddress?.number || clientAddress?.number === "S/N") && 
    clientAddress?.city && 
    clientAddress?.state
  );

  // Initialize/Sync address based on source
  useEffect(() => {
    if (deliveryAddressSource === "client" && clientAddress) {
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
      // Endereço cadastral não exige confirmação extra se for completo
      if (hasValidClientAddress) {
        setDeliveryAddressConfirmed(true);
      }
      setQuery(clientAddress.street || "");
    }
  }, [clientAddress, deliveryAddressSource, setDeliveryAddress, setDeliveryAddressConfirmed, hasValidClientAddress]);

  // Load Maps if needed (only for custom source)
  const loadMaps = useCallback(async () => {
    if (isMapsLoaded || isLoadingMaps || deliveryAddressSource === "client") return;
    setIsLoadingMaps(true);
    setMapsError(null);
    try {
      const libs = await loadGoogleMapsLibraries();
      setMapsLibs(libs);
      setIsMapsLoaded(true);
      const { AutocompleteSessionToken } = (window as any).google.maps.places;
      setSessionToken(new AutocompleteSessionToken());
    } catch (err: any) {
      setMapsError("Erro ao carregar Google Maps");
    } finally {
      setIsLoadingMaps(false);
    }
  }, [isMapsLoaded, isLoadingMaps, deliveryAddressSource]);

  useEffect(() => {
    if (deliveryAddressSource === "custom" && deliver) {
      loadMaps();
    }
  }, [loadMaps, deliveryAddressSource, deliver]);

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
    if (!query || query.length < 3 || !isMapsLoaded || !showSuggestions || deliveryAddressSource === "client") {
      setSuggestions([]);
      return;
    }

    let active = true;
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
        
        if (!active) return;

        const normalized = (results || [])
          .map((suggestion: any) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return null;

            return {
              prediction,
              placeId: prediction.placeId,
              primaryText: prediction.mainText?.text ?? prediction.text?.text ?? (typeof prediction.text === 'string' ? prediction.text : "") ?? "",
              secondaryText: prediction.secondaryText?.text ?? "",
              fullText: prediction.text?.text ?? (typeof prediction.text === 'string' ? prediction.text : "") ?? "",
            };
          })
          .filter((s: any) => s !== null && (s.primaryText || s.fullText));

        setSuggestions(normalized);
      } catch (err) {
        console.error("[PLACES AUTOCOMPLETE] error:", err);
        setSuggestions([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, isMapsLoaded, sessionToken, showSuggestions, deliveryAddressSource]);

  const handleSelectPrediction = async (normalizedSuggestion: any) => {
    setShowSuggestions(false);
    setIsGeocoding(true);
    
    try {
      const prediction = normalizedSuggestion.prediction;
      if (!prediction) throw new Error("PlacePrediction ausente");
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ["addressComponents", "formattedAddress", "location", "id", "displayName"]
      });

      const components = place.addressComponents;
      const getComp = (types: string[]) => components?.find((c: any) => types.some(t => c.types.includes(t)))?.longText || "";

      const street = getComp(["route"]) || (typeof place.displayName === 'string' ? place.displayName : place.displayName?.text) || "";
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
      
      try {
        const { AutocompleteSessionToken } = (window as any).google.maps.places;
        if (AutocompleteSessionToken) setSessionToken(new AutocompleteSessionToken());
      } catch (tokenErr) {}

      if (!streetNumber) {
        setTimeout(() => document.getElementById("delivery-number")?.focus(), 150);
      }
    } catch (err: any) {
      toast.error("Erro ao obter detalhes do endereço");
    } finally {
      setIsGeocoding(false);
    }
  };

  // Setup Map
  useEffect(() => {
    if (deliveryAddressSource === "custom" && deliveryAddress?.latitude && deliveryAddress?.longitude && isMapsLoaded && mapsLibs && mapContainerRef.current) {
      const g = (window as any).google?.maps;
      const MapCtor = mapsLibs.Map ?? g?.Map;
      const MarkerCtor = mapsLibs.AdvancedMarkerElement ?? g?.marker?.AdvancedMarkerElement;
      if (typeof MapCtor !== "function" || typeof MarkerCtor !== "function") return;
      const position = { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude };

      try {
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new MapCtor(mapContainerRef.current, {
            center: position,
            zoom: 17,
            mapId: "DELIVERY_MAP",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
          });

          markerRef.current = new MarkerCtor({
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
      } catch (err) {
        console.error("[MAP] error:", err);
      }
    }
  }, [deliveryAddress?.latitude, deliveryAddress?.longitude, isMapsLoaded, mapsLibs, deliveryAddressSource]);

  const handleManualEdit = (field: keyof DeliveryAddress, value: any) => {
    if (!deliveryAddress || deliveryAddressSource === "client") return;
    
    const updated = { ...deliveryAddress, [field]: value };
    if (field === "noNumber") updated.number = value ? "S/N" : "";
    if (field === "street") {
      setQuery(value);
      setShowSuggestions(true);
      updated.latitude = null;
      updated.longitude = null;
      updated.placeId = null;
    }
    
    setDeliveryAddress(updated);
    const criticalFields: (keyof DeliveryAddress)[] = ["street", "number", "neighborhood", "city", "state", "postalCode", "noNumber"];
    if (criticalFields.includes(field)) setDeliveryAddressConfirmed(false);
  };

  const validateAndConfirm = async (showSuccessToast = true) => {
    if (!deliveryAddress || deliveryAddressSource === "client") return;
    
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
        
        if (showSuccessToast) setDeliveryAddressConfirmed(true);
      } else {
        if (showSuccessToast) toast.error("Não foi possível validar as coordenadas exatas. Tente ajustar no mapa.");
        if (deliveryAddress.street && showSuccessToast) setDeliveryAddressConfirmed(true);
      }
    } catch (err) {
      if (showSuccessToast) toast.error("Erro ao validar endereço.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSwitchToCustom = () => {
    setDeliveryAddressSource("custom");
    setDeliveryAddressConfirmed(false);
    setShowFullAddress(true);
  };

  const handleSwitchToClient = () => {
    setDeliveryAddressSource("client");
    if (hasValidClientAddress) {
      setDeliveryAddressConfirmed(true);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 overflow-visible">
      <div id="logistics-start" className="space-y-3">
        <Label className="text-xs font-bold uppercase text-muted-foreground">Como o cliente receberá o pedido?</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant={deliver ? "default" : "outline"}
            className={cn(
              "h-14 rounded-xl flex flex-col gap-1 items-center justify-center transition-all",
              deliver && "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]"
            )}
            onClick={() => setDelivery(true, deliveryAt)}
          >
            <Truck className="h-5 w-5" />
            <span className="text-xs font-bold">Entrega</span>
          </Button>
          <Button
            type="button"
            variant={!deliver ? "default" : "outline"}
            className={cn(
              "h-14 rounded-xl flex flex-col gap-1 items-center justify-center transition-all",
              !deliver && "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-[1.02]"
            )}
            onClick={() => setDelivery(false, deliveryAt)}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-bold">Retirada</span>
          </Button>
        </div>
      </div>

      {!deliver && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <Info className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            O pedido será marcado para <strong>Retirada na Unidade</strong>. 
            Nenhum endereço de entrega será exigido.
          </p>
        </div>
      )}

      {deliver && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">Endereço de Entrega</h3>
            </div>
            {deliveryAddressConfirmed ? (
              <Badge className="bg-green-600 text-white gap-1 py-1 px-3">
                <CheckCircle2 className="h-3 w-3" /> Confirmado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 gap-1 py-1 px-3">
                <AlertCircle className="h-3 w-3" /> Não Confirmado
              </Badge>
            )}
          </div>

          <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
            {deliveryAddressSource === "client" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                    <User className="h-3 w-3" /> Endereço do cadastro
                  </div>
                  {!hasValidClientAddress && (
                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200 bg-amber-50">Incompleto</Badge>
                  )}
                </div>
                
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    {deliveryAddress?.street || "Não informado"}, {deliveryAddress?.number || ""}
                  </p>
                  <p className="text-xs text-slate-600">
                    {deliveryAddress?.neighborhood || ""}{deliveryAddress?.neighborhood && " - "}{deliveryAddress?.city} / {deliveryAddress?.state}
                  </p>
                </div>

                {!hasValidClientAddress ? (
                  <div className="space-y-3">
                    <p className="text-[11px] text-amber-700 font-medium">
                      O cadastro do cliente não possui endereço completo para entrega.
                    </p>
                    <Button 
                      variant="default" 
                      className="w-full h-10 rounded-lg gap-2"
                      onClick={handleSwitchToCustom}
                    >
                      <Search className="h-4 w-4" /> Informar Endereço de Entrega
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    className="w-full h-9 text-xs font-bold text-primary hover:text-primary hover:bg-primary/5 rounded-lg border border-primary/20 border-dashed"
                    onClick={handleSwitchToCustom}
                  >
                    Alterar Endereço
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                    <MapPin className="h-3 w-3" /> Endereço customizado
                  </div>
                  {hasValidClientAddress && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[9px] uppercase font-bold text-primary hover:bg-primary/5 p-0"
                      onClick={handleSwitchToClient}
                    >
                      Usar endereço do cadastro
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-3">
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
                                <div className="text-sm font-bold text-slate-900 leading-tight">{s.primaryText}</div>
                                {s.secondaryText && <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{s.secondaryText}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-span-6 space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Número</Label>
                    <Input 
                      id="delivery-number"
                      placeholder="Ex: 56" 
                      value={deliveryAddress?.noNumber ? "S/N" : (deliveryAddress?.number || "")} 
                      disabled={deliveryAddress?.noNumber}
                      onChange={(e) => handleManualEdit("number", e.target.value)}
                      className="h-11 text-sm font-bold"
                    />
                  </div>

                  <div className="col-span-6 flex items-center space-x-2 h-11 pt-5">
                    <Checkbox 
                      id="no-number" 
                      checked={deliveryAddress?.noNumber || false} 
                      onCheckedChange={(checked) => handleManualEdit("noNumber", checked)}
                    />
                    <label htmlFor="no-number" className="text-[11px] font-medium leading-none cursor-pointer">Sem número</label>
                  </div>

                  <div className="col-span-12 pt-2 border-t border-dashed">
                    <Button variant="ghost" size="sm" className="w-full h-8 text-[9px] uppercase font-bold text-muted-foreground gap-1" onClick={() => setShowFullAddress(!showFullAddress)}>
                      {showFullAddress ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {showFullAddress ? "Recolher detalhes" : "Ver endereço completo"}
                    </Button>
                  </div>

                  {showFullAddress && (
                    <>
                      <div className="col-span-12 sm:col-span-6 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Bairro</Label>
                        <Input placeholder="Bairro" value={deliveryAddress?.neighborhood || ""} onChange={(e) => handleManualEdit("neighborhood", e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="col-span-12 sm:col-span-6 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cidade</Label>
                        <Input placeholder="Cidade" value={deliveryAddress?.city || ""} onChange={(e) => handleManualEdit("city", e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="col-span-6 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">UF</Label>
                        <Input placeholder="SC" value={deliveryAddress?.state || ""} onChange={(e) => handleManualEdit("state", e.target.value)} className="h-9 text-xs uppercase" />
                      </div>
                      <div className="col-span-6 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">CEP</Label>
                        <Input placeholder="00000-000" value={deliveryAddress?.postalCode || ""} onChange={(e) => handleManualEdit("postalCode", e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="col-span-12 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Complemento</Label>
                        <Input placeholder="Apto, Bloco..." value={deliveryAddress?.complement || ""} onChange={(e) => handleManualEdit("complement", e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="col-span-12 space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                          Ponto de Referência {deliveryAddress?.noNumber && <span className="text-destructive">*</span>}
                        </Label>
                        <Input id="delivery-reference" placeholder="Próximo a..." value={deliveryAddress?.reference || ""} onChange={(e) => handleManualEdit("reference", e.target.value)} className={cn("h-9 text-xs", deliveryAddress?.noNumber && !deliveryAddress?.reference && "border-amber-500 bg-amber-50/30")} />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-dashed space-y-4">
                  {deliveryAddress?.latitude && deliveryAddress?.longitude && (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Localização Confirmada no Mapa</Label>
                      <div ref={mapContainerRef} className="w-full h-48 rounded-lg border overflow-hidden relative bg-slate-100" />
                    </div>
                  )}

                  {!deliveryAddressConfirmed && deliveryAddress?.street && (
                    <Button 
                      className="w-full h-11 bg-primary text-white font-bold rounded-xl gap-2 shadow-lg"
                      onClick={() => validateAndConfirm(true)}
                      disabled={isGeocoding}
                    >
                      {isGeocoding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
                      Confirmar Endereço
                    </Button>
                  )}
                  
                  {deliveryAddressConfirmed && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-green-800 leading-tight">Confirmado</p>
                        <p className="text-[10px] text-green-600">Endereço logístico pronto.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-[9px] text-muted-foreground text-center italic leading-tight pt-2 border-t border-slate-100">
              * Alterações no endereço valem apenas para este pedido.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
