/// <reference types="google.maps" />
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
  /** Número comercial do pedido (nunca ID interno). */
  orderNumber?: string;
  /** Rótulo pronto do horário — "HH:mm" ou "Sem horário". */
  deliveryTimeLabel?: string;
}

let loaderPromise: Promise<void> | null = null;

/**
 * Limite superior do zoom aplicado APENAS pelo enquadramento automático
 * (abertura, troca de data, refetch, botão centralizar). O usuário
 * continua livre para aproximar manualmente além disto.
 */
export const MAX_AUTO_ZOOM = 16;

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
  timeLabel: string;
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
    const num = current.orderNumber?.trim() || "—";
    const time = current.timeLabel?.trim() || "Sem horário";
    div.innerHTML =
      `<div class="mom-label">` +
      `<div class="mom-order">${escapeHtml(num)}</div>` +
      `<div class="mom-time">${escapeHtml(time)}</div>` +
      `</div>` +
      `<div class="mom-dot" aria-hidden="true"></div>`;
  }

  overlay.onAdd = function onAdd() {
    div = document.createElement("div");
    div.className = "mom-wrap";
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");
    div.style.position = "absolute";
    div.style.transform = "translate(-50%, -100%)";
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
    if (div) div.dataset.selected = selected ? "true" : "false";
  };

  overlay.destroy = function destroy() {
    overlay.setMap(null);
  };

  return overlay;
}

/**
 * Aplica o enquadramento automático respeitando MAX_AUTO_ZOOM.
 * - 0 pontos: não faz nada (mantém centro/zoom atual).
 * - 1 ponto: centraliza no ponto e usa MAX_AUTO_ZOOM.
 * - 2+ pontos: fitBounds e, se necessário, limita o zoom final.
 */
function fitMapToMarkers(map: google.maps.Map, markers: MapMarkerData[]) {
  if (!window.google) return;
  if (markers.length === 0) return;
  if (markers.length === 1) {
    const m = markers[0];
    map.setCenter({ lat: m.lat, lng: m.lng });
    map.setZoom(MAX_AUTO_ZOOM);
    return;
  }
  const bounds = new window.google.maps.LatLngBounds();
  markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
  map.fitBounds(bounds, 80);
  window.google.maps.event.addListenerOnce(map, "idle", () => {
    const z = map.getZoom();
    if (typeof z === "number" && z > MAX_AUTO_ZOOM) {
      map.setZoom(MAX_AUTO_ZOOM);
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
        timeLabel: m.deliveryTimeLabel ?? "Sem horário",
        color: m.color,
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

  // Enquadramento automático controlado: dispara apenas quando o
  // conjunto de marcadores muda (fingerprint), respeitando MAX_AUTO_ZOOM.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    fitMapToMarkers(mapRef.current, markers);
    // Depende do fingerprint — não do onMarkerClick nem do selectedId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fingerprint]);

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