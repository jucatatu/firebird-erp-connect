import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OrderItem {
  productId: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface OrderEquipment {
  equipmentTypeId: number;
  description: string;
  quantity: number;
}

interface OrderFormStore {
  clientId: number | null;
  clientName: string | null;
  companyId: number | null;
  idempotencyKey: string | null;
  submissionStatus: "draft" | "submitting" | "created" | "unknown" | "failed";
  lastAttemptAt: string | null;
  erpOrderId: number | null;
  erpOrderNumber: number | null;
  items: OrderItem[];
  equipments: OrderEquipment[];
  deliver: boolean;
  deliveryAt: string | null;
  returnEquipment: boolean;
  returnAt: string | null;
  notes: string;
  paymentTermId: number | null;
  paymentMethodId: number | null;
  saleTypeId: number | null;
  
  // Actions
  setClient: (id: number, name: string) => void;
  setCompany: (id: number | null) => void;
  setIdempotencyKey: (key: string) => void;
  setSubmissionStatus: (status: OrderFormStore["submissionStatus"], erpData?: { orderId?: number; orderNumber?: number }) => void;
  addItem: (item: OrderItem) => void;
  removeItem: (productId: number) => void;
  updateItemQuantity: (productId: number, quantity: number) => void;
  addEquipment: (eq: OrderEquipment) => void;
  removeEquipment: (typeId: number) => void;
  setDelivery: (deliver: boolean, date: string | null) => void;
  setReturn: (ret: boolean, date: string | null) => void;
  setNotes: (notes: string) => void;
  setPayment: (termId: number | null, methodId: number | null) => void;
  setSaleType: (typeId: number | null) => void;
  reset: () => void;
  resetItemsAndClient: () => void;
}

export const useOrderFormStore = create<OrderFormStore>()(
  persist(
    (set) => ({
      clientId: null,
      clientName: null,
      companyId: null,
      idempotencyKey: null,
      submissionStatus: "draft",
      lastAttemptAt: null,
      erpOrderId: null,
      erpOrderNumber: null,
      items: [],
      equipments: [],
      deliver: true,
      deliveryAt: null,
      returnEquipment: false,
      returnAt: null,
      notes: "",
      paymentTermId: null,
      paymentMethodId: null,
      saleTypeId: null,

      setClient: (id: number, name: string) => set({ clientId: id, clientName: name }),
      setCompany: (id: number | null) => set({ companyId: id }),
      setIdempotencyKey: (key: string) => set({ idempotencyKey: key }),
      setSubmissionStatus: (status, erpData) => set({ 
        submissionStatus: status,
        lastAttemptAt: new Date().toISOString(),
        erpOrderId: erpData?.orderId ?? null,
        erpOrderNumber: erpData?.orderNumber ?? null
      }),
      addItem: (item: OrderItem) => set((state: OrderFormStore) => {
        const exists = state.items.find(i => i.productId === item.productId);
        if (exists) {
          return {
            items: state.items.map(i => 
              i.productId === item.productId 
                ? { ...i, quantity: item.quantity, total: item.quantity * i.unitPrice }
                : i
            )
          };
        }
        return { items: [...state.items, item] };
      }),
      removeItem: (productId: number) => set((state: OrderFormStore) => ({
        items: state.items.filter(i => i.productId !== productId)
      })),
      updateItemQuantity: (productId: number, quantity: number) => set((state: OrderFormStore) => ({
        items: state.items.map(i => 
          i.productId === productId 
            ? { ...i, quantity, total: quantity * i.unitPrice }
            : i
        )
      })),
      addEquipment: (eq: OrderEquipment) => set((state: OrderFormStore) => {
        const exists = state.equipments.find(e => e.equipmentTypeId === eq.equipmentTypeId);
        if (exists) {
          return {
            equipments: state.equipments.map(e => 
              e.equipmentTypeId === eq.equipmentTypeId 
                ? { ...e, quantity: e.quantity + eq.quantity }
                : e
            )
          };
        }
        return { equipments: [...state.equipments, eq] };
      }),
      removeEquipment: (typeId: number) => set((state: OrderFormStore) => ({
        equipments: state.equipments.filter(e => e.equipmentTypeId !== typeId)
      })),
      setDelivery: (deliver: boolean, date: string | null) => set({ deliver, deliveryAt: date }),
      setReturn: (ret: boolean, date: string | null) => set({ returnEquipment: ret, returnAt: date }),
      setNotes: (notes: string) => set({ notes }),
      setPayment: (termId: number | null, methodId: number | null) => set({ paymentTermId: termId, paymentMethodId: methodId }),
      setSaleType: (typeId: number | null) => set({ saleTypeId: typeId }),
      reset: () => set({
        clientId: null,
        clientName: null,
        companyId: null,
        idempotencyKey: null,
        submissionStatus: "draft",
        lastAttemptAt: null,
        erpOrderId: null,
        erpOrderNumber: null,
        items: [],
        equipments: [],
        deliver: true,
        deliveryAt: null,
        returnEquipment: false,
        returnAt: null,
        notes: "",
        paymentTermId: null,
        paymentMethodId: null,
        saleTypeId: null,
      }),
      resetItemsAndClient: () => set({
        clientId: null,
        clientName: null,
        items: [],
        equipments: [],
        paymentTermId: null,
        paymentMethodId: null,
        saleTypeId: null,
        idempotencyKey: crypto.randomUUID(), // Renovação forçada
        submissionStatus: "draft",
      }),
    }),
    { name: "order-form-storage" }
  )
);
