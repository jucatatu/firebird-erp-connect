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

  // Usando a API atual do pacote conforme Sprint 8.9.37
  const { Map, InfoWindow } = await loader.importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } = await loader.importLibrary("marker");
  const { Place, AutocompleteElement } = await loader.importLibrary("places");

  return { Map, InfoWindow, AdvancedMarkerElement, PinElement, Place, AutocompleteElement };
}
