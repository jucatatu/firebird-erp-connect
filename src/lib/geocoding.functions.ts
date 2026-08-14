import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
 * Sprint 8.9.37.5: Geocodificação Server-side via Managed Google Maps Connector
 * Não utiliza o ERP Node para geocodificação.
 * Requer autenticação para usar o connector.
 */
export const geocodeStructuredAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    // A geocodificação do endereço estruturado deve utilizar a conexão:
    // Google Maps -> Managed by Lovable através do gateway server-side do conector.
    
    const { callConnector } = await import("@/integrations/supabase/connector-attacher.server");
    
    // Montar endereço para geocodificação: Rua + Número, Bairro, Cidade - UF, País
    const addressLine = `${data.street}, ${data.number}, ${data.neighborhood}, ${data.city} - ${data.state}, ${data.country}`;
    
    console.log("[GEOCODE SERVER] Geocodificando via Lovable Connector:", addressLine);
    
    try {
      const response = await callConnector({
        connector_id: "google_maps",
        path: "/maps/api/geocode/json",
        method: "GET",
        query_params: {
          address: addressLine,
          language: "pt-BR"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[GEOCODE SERVER] Erro gateway:", response.status, errorText);
        return {
          ok: false,
          status: response.status,
          data: null,
          error: "Erro na comunicação com o serviço de mapas."
        };
      }

      const body = await response.json();

      if (body.status === "OK" && body.results && body.results.length > 0) {
        const result = body.results[0];
        const location = result.geometry.location;
        
        const mappedResult: GeocodeResult = {
          latitude: location.lat,
          longitude: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          locationType: result.geometry.location_type,
          precision: result.geometry.location_type as any
        };

        return {
          ok: true,
          status: 200,
          data: mappedResult,
          error: null
        };
      }

      return {
        ok: false,
        status: 404,
        data: null,
        error: body.status || "ADDRESS_NOT_FOUND"
      };
    } catch (error: any) {
      console.error("[GEOCODE SERVER] Exceção connector:", error);
      return {
        ok: false,
        status: 500,
        data: null,
        error: error.message || "INTERNAL_CONNECTOR_ERROR"
      };
    }
  });
