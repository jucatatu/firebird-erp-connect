/**
 * Constantes e helpers geográficos para a regra de negócio de atendimento.
 * SPRINT 8.9.42.2
 */

export const CUSTOMER_SERVICE_AREA_CENTER = {
  lat: -26.48,
  lng: -49.07
};

export const CUSTOMER_SERVICE_RADIUS_METERS = 50000; // 50 km

/**
 * Calcula a distância geodésica entre dois pontos usando a fórmula de Haversine.
 * Retorna a distância em metros.
 */
export function distanceMetersBetweenCoordinates(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Verifica se uma coordenada está dentro da área de atendimento permitida.
 */
export function isWithinCustomerServiceArea(lat: number, lng: number): boolean {
  const distance = distanceMetersBetweenCoordinates(
    CUSTOMER_SERVICE_AREA_CENTER.lat,
    CUSTOMER_SERVICE_AREA_CENTER.lng,
    lat,
    lng
  );
  return distance <= CUSTOMER_SERVICE_RADIUS_METERS;
}
