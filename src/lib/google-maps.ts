import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// A conexão gerenciada do Lovable disponibiliza a chave via VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function loadGoogleMapsLibraries() {
  console.log("[GOOGLE MAPS] loader iniciado");
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[GOOGLE MAPS] VITE_GOOGLE_MAPS_API_KEY ausente");
    throw new Error("VITE_GOOGLE_MAPS_API_KEY não configurada.");
  }

  console.log("[GOOGLE MAPS] API key presente: SIM");

  try {
    // Sprint 8.9.37.1: Diagnóstico e Contrato Moderno
    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: "weekly",
      // O PlaceAutocompleteElement (Web Component) requer a biblioteca 'places'
      // A biblioteca 'marker' é usada para o AdvancedMarkerElement
    });

    console.log("[GOOGLE MAPS] Carregando bibliotecas...");

    // Carregamento paralelo das bibliotecas necessárias
    const [mapsLib, markerLib, placesLib] = await Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
      importLibrary("places")
    ]);

    console.log("[GOOGLE MAPS] Libraries loaded");

    // Na API moderna, importLibrary("places") retorna o namespace que contém PlaceAutocompleteElement
    const isAutocompleteAvailable = !!(placesLib as any).PlaceAutocompleteElement || !!(window as any).google?.maps?.places?.PlaceAutocompleteElement;
    console.log("[GOOGLE MAPS] PlaceAutocompleteElement disponível:", isAutocompleteAvailable);

    return { 
      Map: mapsLib.Map, 
      InfoWindow: mapsLib.InfoWindow, 
      AdvancedMarkerElement: markerLib.AdvancedMarkerElement, 
      PinElement: markerLib.PinElement, 
      Place: placesLib.Place,
      placesLib // Retornar a lib inteira para checagem de componentes
    };
  } catch (err: any) {
    console.error("[GOOGLE MAPS] erro:", {
      message: err.message,
      name: err.name,
      stack: err.stack
    });
    throw err;
  }
}


