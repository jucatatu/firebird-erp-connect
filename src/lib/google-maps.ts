import { Loader } from "@googlemaps/js-api-loader";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function loadGoogleMapsLibraries() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("VITE_GOOGLE_MAPS_API_KEY não configurada.");
  }

  const loader = new Loader({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: "weekly",
    libraries: ["places", "marker"]
  });

  // Sprint 8.9.37: Usando a API de carregamento dinâmico
  // O Loader carrega o script globalmente, importLibrary retorna a biblioteca
  const { Map, InfoWindow } = await loader.importLibrary("maps") as any;
  const { AdvancedMarkerElement, PinElement } = await loader.importLibrary("marker") as any;
  const { Place, AutocompleteElement } = await loader.importLibrary("places") as any;

  return { Map, InfoWindow, AdvancedMarkerElement, PinElement, Place, AutocompleteElement };
}

