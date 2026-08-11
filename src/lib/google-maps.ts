import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function loadGoogleMapsLibraries() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("VITE_GOOGLE_MAPS_API_KEY não configurada.");
  }

  // Sprint 8.9.37: Usando a API funcional moderna
  setOptions({
    apiKey: GOOGLE_MAPS_API_KEY,
    version: "weekly",
    libraries: ["places", "marker"]
  });

  const { Map, InfoWindow } = await importLibrary("maps");
  const { AdvancedMarkerElement, PinElement } = await importLibrary("marker");
  const { Place, AutocompleteElement } = await importLibrary("places");

  return { Map, InfoWindow, AdvancedMarkerElement, PinElement, Place, AutocompleteElement };
}

