import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: typeof google;
    __erpInitMap?: () => void;
  }
}

export interface MapMarkerData {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    if (!key) {
      reject(new Error("Google Maps browser key ausente"));
      return;
    }
    window.__erpInitMap = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__erpInitMap`;
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };

export function MapView({
  markers,
  onMarkerClick,
  selectedId,
}: {
  markers: MapMarkerData[];
  onMarkerClick?: (id: string) => void;
  selectedId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerObjectsRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    const map = mapRef.current;
    const existing = markerObjectsRef.current;
    const nextIds = new Set(markers.map((m) => m.id));
    existing.forEach((mk, id) => {
      if (!nextIds.has(id)) {
        mk.setMap(null);
        existing.delete(id);
      }
    });
    for (const m of markers) {
      let mk = existing.get(m.id);
      const icon: google.maps.Symbol = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: m.color,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: selectedId === m.id ? 3 : 2,
        scale: selectedId === m.id ? 11 : 8,
      };
      if (!mk) {
        mk = new window.google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          title: m.label,
          icon,
        });
        mk.addListener("click", () => onMarkerClick?.(m.id));
        existing.set(m.id, mk);
      } else {
        mk.setPosition({ lat: m.lat, lng: m.lng });
        mk.setIcon(icon);
      }
    }
    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 80);
    }
  }, [markers, ready, selectedId, onMarkerClick]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="rounded-md border bg-surface px-4 py-3 text-sm text-destructive">
            Não foi possível carregar o mapa: {error}
          </div>
        </div>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 text-sm text-muted-foreground">
          Carregando mapa…
        </div>
      )}
    </div>
  );
}