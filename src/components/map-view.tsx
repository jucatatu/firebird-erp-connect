/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Número comercial do pedido (nunca ID interno). */
  orderNumber?: string;
  /** Horário no formato "HH:mm". Null/undefined = não exibir horário. */
  deliveryTime?: string | null;
}

let loaderPromise: Promise<void> | null = null;

/** Zoom aplicado quando existe apenas um pedido localizado. */
export const SINGLE_ORDER_ZOOM = 16;
/** Teto do zoom em fitBounds automático de múltiplos pedidos próximos. */
export const MULTIPLE_ORDER_MAX_ZOOM = 14;
/** Compat: usado por consumidores antigos, mantém-se como o teto de um pedido. */
export const MAX_AUTO_ZOOM = SINGLE_ORDER_ZOOM;

/** Cor dourada única do marcador (padrão do sistema antigo). */
const MARKER_GOLD = "#d99a22";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
const DEFAULT_ZOOM = 11;

interface LabelOverlayOpts {
  orderNumber: string;
  /** "HH:mm" quando disponível; caso contrário null/undefined (não mostrar). */
  deliveryTime?: string | null;
  color: string;
  selected: boolean;
}

interface LabelOverlay extends google.maps.OverlayView {
  update(position: google.maps.LatLngLiteral, opts: LabelOverlayOpts): void;
  setSelected(selected: boolean): void;
  destroy(): void;
}

function createLabelOverlay(
  position: google.maps.LatLngLiteral,
  opts: LabelOverlayOpts,
  onClick: () => void,
): LabelOverlay {
  const overlay = new window.google!.maps.OverlayView() as LabelOverlay;
  let div: HTMLDivElement | null = null;
  let pos = position;
  let current = opts;

  function render() {
    if (!div) return;
    div.dataset.selected = current.selected ? "true" : "false";
    div.style.setProperty("--mom-dot", current.color);
    div.style.zIndex = current.selected ? "50" : "10";
    const num = current.orderNumber?.trim() || "—";
    const time =
      typeof current.deliveryTime === "string" ? current.deliveryTime.trim() : "";
    const timeHtml = time
      ? `<span class="mom-time">${escapeHtml(time)}</span>`
      : "";
    div.innerHTML =
      `<span class="mom-dot" aria-hidden="true"></span>` +
      `<span class="mom-label">` +
      `<strong class="mom-order">#${escapeHtml(num)}</strong>` +
      timeHtml +
      `</span>`;
  }

  overlay.onAdd = function onAdd() {
    div = document.createElement("div");
    div.className = "mom-wrap";
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");
    div.style.position = "absolute";
    // Bolinha ancorada exatamente sobre a coordenada: translada o wrap
    // meia-bolinha para a esquerda e metade da altura para cima.
    div.style.transform = "translate(-6px, -50%)";
    div.style.cursor = "pointer";
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
    render();
    const panes = overlay.getPanes();
    panes?.floatPane.appendChild(div);
  };

  overlay.draw = function draw() {
    if (!div) return;
    const proj = overlay.getProjection();
    if (!proj) return;
    const point = proj.fromLatLngToDivPixel(
      new window.google!.maps.LatLng(pos.lat, pos.lng),
    );
    if (!point) return;
    div.style.left = `${point.x}px`;
    div.style.top = `${point.y}px`;
  };

  overlay.onRemove = function onRemove() {
    if (div?.parentNode) div.parentNode.removeChild(div);
    div = null;
  };

  overlay.update = function update(nextPos, nextOpts) {
    const posChanged = nextPos.lat !== pos.lat || nextPos.lng !== pos.lng;
    pos = nextPos;
    current = nextOpts;
    render();
    if (posChanged) overlay.draw();
  };

  overlay.setSelected = function setSelected(selected) {
    current = { ...current, selected };
    if (div) {
      div.dataset.selected = selected ? "true" : "false";
      div.style.zIndex = selected ? "50" : "10";
    }
  };

  overlay.destroy = function destroy() {
    overlay.setMap(null);
  };

  return overlay;
}

/**
 * Enquadramento único: mostra TODOS os pedidos localizados.
 *  - 0 pontos: mantém centro/zoom;
 *  - 1 ponto: centraliza + SINGLE_ORDER_ZOOM;
 *  - 2+ pontos: fitBounds com padding, limitado apenas por MULTIPLE_ORDER_MAX_ZOOM (teto).
 * Nunca esconde pedidos — pontos distantes ficam visíveis, mesmo que o zoom
 * fique baixo. Não há mais fallback para “primeiro pedido”.
 */
function fitAll(map: google.maps.Map, markers: MapMarkerData[]) {
  if (!window.google) return;
  if (markers.length === 0) return;
  if (markers.length === 1) {
    const m = markers[0];
    map.setCenter({ lat: m.lat, lng: m.lng });
    map.setZoom(SINGLE_ORDER_ZOOM);
    return;
  }
  const bounds = new window.google.maps.LatLngBounds();
  markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
  map.fitBounds(bounds, { top: 70, right: 50, bottom: 70, left: 50 });
  window.google.maps.event.addListenerOnce(map, "idle", () => {
    const z = map.getZoom();
    if (typeof z === "number" && z > MULTIPLE_ORDER_MAX_ZOOM) {
      map.setZoom(MULTIPLE_ORDER_MAX_ZOOM);
    }
  });
}

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
  const overlaysRef = useRef<Map<string, LabelOverlay>>(new Map());
  const markersRef = useRef<MapMarkerData[]>(markers);
  markersRef.current = markers;
  const clickRef = useRef<typeof onMarkerClick>(onMarkerClick);
  clickRef.current = onMarkerClick;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
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

  // "Fingerprint" da coleção de marcadores: reenquadra somente quando a
  // lista muda de fato (ids + coordenadas), NÃO a cada seleção.
  const fingerprint = markers
    .map((m) => `${m.id}:${m.lat.toFixed(6)},${m.lng.toFixed(6)}`)
    .join("|");

  // Sincroniza overlays com a lista atual (add/update/remove) e
  // reflete o marcador selecionado. Não reenquadra o mapa aqui.
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    const map = mapRef.current;
    const existing = overlaysRef.current;
    const nextIds = new Set(markers.map((m) => m.id));
    existing.forEach((ov, id) => {
      if (!nextIds.has(id)) {
        ov.destroy();
        existing.delete(id);
      }
    });
    for (const m of markers) {
      const opts: LabelOverlayOpts = {
        orderNumber: m.orderNumber ?? m.label ?? "—",
        deliveryTime: m.deliveryTime ?? null,
        // Dourado único para todos os marcadores (padrão do sistema antigo).
        color: MARKER_GOLD,
        selected: selectedId === m.id,
      };
      let ov = existing.get(m.id);
      if (!ov) {
        ov = createLabelOverlay({ lat: m.lat, lng: m.lng }, opts, () =>
          clickRef.current?.(m.id),
        );
        ov.setMap(map);
        existing.set(m.id, ov);
      } else {
        ov.update({ lat: m.lat, lng: m.lng }, opts);
      }
    }
  }, [markers, ready, selectedId]);

  // Enquadramento automático operacional: dispara APENAS quando o
  // conjunto de marcadores muda (fingerprint) — não a cada seleção,
  // não ao abrir/fechar sheet, não a cada refetch.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    fitAll(mapRef.current, markersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fingerprint]);

  const onCenter = useCallback(() => {
    if (mapRef.current) fitAll(mapRef.current, markersRef.current);
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {ready && markers.length > 0 && (
        <button
          type="button"
          onClick={onCenter}
          title="Centralizar pedidos"
          aria-label="Centralizar pedidos"
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border bg-surface/95 text-foreground shadow-sm backdrop-blur transition hover:bg-surface md:right-4 md:top-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <line x1="12" y1="1" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="23" />
            <line x1="1" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="23" y2="12" />
          </svg>
        </button>
      )}
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