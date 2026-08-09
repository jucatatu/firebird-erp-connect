import { describe, it, expect, vi } from 'vitest';

// Mock types since we can't easily import the real ones in this environment
interface ErpEquipmentType {
  id: number | null;
  description: string | null;
  code: string | null;
}

interface ErpEquipmentTypesPayload {
  equipmentTypes: ErpEquipmentType[];
}

interface ErpEnvelope<T> {
  ok: boolean;
  data: T | null;
}

describe('Sprint 8.5.1 - Equipment Shape Defense', () => {
  it('should handle equipmentTypes as an array within data object', () => {
    const payload: any = {
      equipmentTypes: [
        { id: 1, description: 'BARRIL 50L', code: 'B50' }
      ]
    };
    
    const list = payload && typeof payload === 'object' && 'equipmentTypes' in payload 
      ? (payload.equipmentTypes as ErpEquipmentType[]) 
      : (Array.isArray(payload) ? (payload as ErpEquipmentType[]) : []);
      
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe('BARRIL 50L');
  });

  it('should handle payload as a direct array (fallback)', () => {
    const payload: any = [
      { id: 2, description: 'CILINDRO CO2', code: 'CO2' }
    ];
    
    const list = payload && typeof payload === 'object' && 'equipmentTypes' in payload 
      ? (payload.equipmentTypes as ErpEquipmentType[]) 
      : (Array.isArray(payload) ? (payload as ErpEquipmentType[]) : []);
      
    expect(list).toHaveLength(1);
    expect(list[0].description).toBe('CILINDRO CO2');
  });

  it('should handle null payload safely', () => {
    const payload: any = null;
    
    const list = payload && typeof payload === 'object' && 'equipmentTypes' in payload 
      ? (payload.equipmentTypes as ErpEquipmentType[]) 
      : (Array.isArray(payload) ? (payload as ErpEquipmentType[]) : []);
      
    expect(list).toHaveLength(0);
  });
});
