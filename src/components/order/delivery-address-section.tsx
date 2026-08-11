import React, { useEffect, useRef, useState } from "react";
import { useOrderFormStore, type DeliveryAddress } from "@/hooks/use-order-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, MapPin, Search, Truck, Loader2 } from "lucide-react";
import { loadGoogleMapsLibraries } from "@/lib/google-maps";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function DeliveryAddressSection({ clientAddress }: { clientAddress: any }) {
  const { 
    deliveryAddress, 
    deliveryAddressConfirmed, 
    setDeliveryAddress, 
    setDeliveryAddressConfirmed 
  } = useOrderFormStore();

  const [isSearching, setIsSearching] = useState(false);
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
        reference: ""
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
      
      // Sprint 8.9.37.1: Garantir que o elemento existe antes de tentar usar
      // A Places API New usa o web component <gmp-place-autocomplete>
      const autocomplete = document.createElement("gmp-place-autocomplete");
      
      // Configurações básicas
      (autocomplete as any).fields = "address_components,formatted_address,geometry,name,place_id";
      
      // Priorizar Brasil, mas sem restrição rígida de cidade (apenas bias)
      if (deliveryAddress?.latitude && deliveryAddress?.longitude) {
        (autocomplete as any).locationBias = { 
          radius: 10000, 
          center: { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude } 
        };
      } else {
        // Bias padrão para Jaraguá do Sul se não houver coords
        (autocomplete as any).locationBias = { radius: 10000, center: { lat: -26.48, lng: -49.07 } };
      }

      // Adicionar label para acessibilidade/UX conforme pedido
      autocomplete.setAttribute("placeholder", "Digite um endereço, local ou estabelecimento");

      // Limpar e anexar
      autocompleteRef.current.innerHTML = "";
      autocompleteRef.current.appendChild(autocomplete);

      const handlePlaceSelect = async (event: any) => {
        console.log("[GOOGLE MAPS] Local selecionado:", event.place);
        const place = event.place;
        
        // Se for uma string (apenas texto digitado sem selecionar sugestão), ignorar ou tratar
        if (!place || typeof place === 'string' || !place.geometry) {
          console.warn("[GOOGLE MAPS] Seleção inválida ou incompleta");
          return;
        }

        const components = place.address_components || [];
        const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || "";

        const newAddress: DeliveryAddress = {
          formattedAddress: place.formatted_address || place.name || "",
          street: getComp("route"),
          number: getComp("street_number"),
          neighborhood: getComp("sublocality_level_1") || getComp("neighborhood"),
          city: getComp("administrative_area_level_2") || getComp("locality"),
          state: getComp("administrative_area_level_1"),
          postalCode: getComp("postal_code"),
          country: getComp("country"),
          latitude: typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat,
          longitude: typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng,
          placeId: place.place_id,
          complement: deliveryAddress?.complement || "",
          reference: deliveryAddress?.reference || ""
        };

        console.log("[GOOGLE MAPS] Endereço estruturado:", newAddress);

        setDeliveryAddress(newAddress);
        setDeliveryAddressConfirmed(false);
        setIsSearching(false);
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

  const handleConfirm = () => {
    setDeliveryAddressConfirmed(true);
    toast.success("Endereço de entrega confirmado!");
  };

  const handleManualEdit = (field: keyof DeliveryAddress, value: any) => {
    if (!deliveryAddress) return;
    setDeliveryAddress({ ...deliveryAddress, [field]: value });
    setDeliveryAddressConfirmed(false);
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
          <div className="p-4 border rounded-xl bg-card shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug">{deliveryAddress?.formattedAddress || "Nenhum endereço definido"}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase font-medium">Preenchido a partir do cadastro do cliente</p>
              </div>
            </div>

            {deliveryAddress?.latitude && deliveryAddress?.longitude && (
              <div 
                ref={mapContainerRef} 
                className="w-full h-48 rounded-lg border bg-muted/20 overflow-hidden" 
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Complemento</Label>
                <Input 
                  placeholder="Ex: Apto 101, Fundos..." 
                  value={deliveryAddress?.complement || ""} 
                  onChange={(e) => handleManualEdit("complement", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ponto de Referência</Label>
                <Input 
                  placeholder="Ex: Próximo ao mercado..." 
                  value={deliveryAddress?.reference || ""} 
                  onChange={(e) => handleManualEdit("reference", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {!deliveryAddressConfirmed ? (
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 font-bold"
                  onClick={handleConfirm}
                >
                  Confirmar este endereço
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setDeliveryAddressConfirmed(false)}
                >
                  Alterar endereço
                </Button>
              )}
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setIsSearching(true);
                  loadMaps();
                }}
              >
                <Search className="h-4 w-4 mr-2" /> Buscar outro endereço
              </Button>
            </div>
            
            {!deliveryAddressConfirmed && (
              <p className="text-[10px] text-destructive font-medium text-center italic">
                * As alterações aqui valem somente para este pedido.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold">Buscar novo endereço</h4>
            <Button variant="ghost" size="sm" onClick={() => setIsSearching(false)}>Cancelar</Button>
          </div>
          
          <div className="space-y-3">
            {isLoadingMaps ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Carregando busca de endereços...</span>
              </div>
            ) : mapsError ? (
              <div className="p-3 border rounded-lg bg-destructive/5 border-destructive/20 space-y-2">
                <p className="text-xs text-destructive">{mapsError}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    placeholder="Rua" 
                    value={deliveryAddress?.street || ""} 
                    onChange={(e) => handleManualEdit("street", e.target.value)}
                  />
                  <Input 
                    placeholder="Número" 
                    value={deliveryAddress?.number || ""} 
                    onChange={(e) => handleManualEdit("number", e.target.value)}
                  />
                  <Input 
                    placeholder="Bairro" 
                    value={deliveryAddress?.neighborhood || ""} 
                    onChange={(e) => handleManualEdit("neighborhood", e.target.value)}
                  />
                  <Input 
                    placeholder="Cidade" 
                    value={deliveryAddress?.city || ""} 
                    onChange={(e) => handleManualEdit("city", e.target.value)}
                  />
                </div>
                <Button variant="outline" className="w-full text-xs" onClick={() => {
                  setDeliveryAddressConfirmed(false);
                  setIsSearching(false);
                }}>Confirmar Manualmente</Button>
              </div>
            ) : (
              <div ref={autocompleteRef} className="google-places-autocomplete-container" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
