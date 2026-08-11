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
    if (isMapsLoaded) return;
    setIsLoadingMaps(true);
    setMapsError(null);
    try {
      const libs = await loadGoogleMapsLibraries();
      setMapsLibs(libs);
      setIsMapsLoaded(true);
    } catch (err: any) {
      console.error("Erro ao carregar Google Maps:", err);
      setMapsError("Não foi possível carregar o Google Maps. Use o preenchimento manual.");
      toast.error("Erro ao carregar Google Maps");
    } finally {
      setIsLoadingMaps(false);
    }
  };

  // Setup Autocomplete
  useEffect(() => {
    if (isSearching && isMapsLoaded && mapsLibs && autocompleteRef.current) {
      const { AutocompleteElement } = mapsLibs;
      const autocomplete = new AutocompleteElement({
        fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
        locationBias: { radius: 10000, center: { lat: -26.48, lng: -49.07 } }, // Bias towards Jaraguá do Sul region
      });

      // Clear previous
      autocompleteRef.current.innerHTML = "";
      autocompleteRef.current.appendChild(autocomplete);

      autocomplete.addEventListener("gmp-placeselect", async (event: any) => {
        const place = event.place;
        if (!place.geometry || !place.geometry.location) return;

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
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
          placeId: place.place_id,
          complement: deliveryAddress?.complement || "",
          reference: deliveryAddress?.reference || ""
        };

        setDeliveryAddress(newAddress);
        setDeliveryAddressConfirmed(false);
        setIsSearching(false);
      });
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
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs text-muted-foreground">Carregando Google Maps...</span>
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
