import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface GeocodeAddressInput {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
  locationType: string;
  precision: "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE";
}

/**
 * Sprint 8.9.37.2: Geocodificação Server-side via Managed Google Maps
 * Utiliza o Lovable AI Gateway / Managed Google Maps para converter endereço estruturado em coordenadas.
 */
export const geocodeStructuredAddress = createServerFn({ method: "POST" })
  .inputValidator((d) => 
    z.object({
      street: z.string().min(1),
      number: z.string().min(1),
      neighborhood: z.string().optional().default(""),
      city: z.string().min(1),
      state: z.string().min(1),
      country: z.string().optional().default("Brasil")
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { callErp } = await import("./erp.server");
    
    // O backend erp-api (v1.4.1+) já possui geocodificação server-side
    // que gerencia o cache e usa a API Key do Google.
    // Vamos delegar para o endpoint oficial de geocodificação do Node.js.
    
    const addressLine = `${data.street}, ${data.number}, ${data.neighborhood}, ${data.city} - ${data.state}, ${data.country}`;
    
    console.log("[GEOCODE SERVER] Solicitando geocodificação estruturada:", addressLine);
    
    // O backend Node espera um endereço completo ou estruturado.
    // Conforme Sprint 10 da erp-api, podemos enviar o endereço estruturado.
    const result = await callErp({
      method: "POST",
      path: "/api/v1/map/geocode-address",
      body: { 
        street: data.street,
        number: data.number,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        country: data.country
      } as any
    });

    return result as {
      ok: boolean;
      status: number;
      data: GeocodeResult | null;
      error: any;
    };
  });
