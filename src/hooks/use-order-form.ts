import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDaysToDateOnly } from "@/utils/date-utils";

export interface OrderItem {
  productId: number;
  description: string;
  quantity: number;
  unitPrice: number; // Preço original do ERP
  appliedUnitPrice: number; // Preço final (ERP ou manual)
  manualPrice: boolean;
  total: number;
}

export interface OrderEquipment {
  equipmentTypeId: number;
  description: string;
  quantity: number;
  role?: "TAP" | "KEG" | "OTHER";
  tapLines?: number;
  capacityLiters?: number;
  assignedProductId?: number | null; // Produto de chopp ao qual este barril está associado
}

export interface OrderFormStore {
  clientId: number | null;
  clientName: string | null;
  companyId: number | null;
  idempotencyKey: string | null;
  submissionStatus: "draft" | "submitting" | "created" | "unknown" | "failed" | "editing";
  lastAttemptAt: string | null;
  erpOrderId: number | null;
  erpOrderNumber: number | null;
  isEditing: boolean;
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
  addItem: (item: Omit<OrderItem, "total" | "appliedUnitPrice" | "manualPrice"> & { manualUnitPrice?: number | null }) => void;
  removeItem: (productId: number) => void;
  updateItemQuantity: (productId: number, quantity: number) => void;
  updateItemPrice: (productId: number, manualUnitPrice: number | null) => void;
  addEquipment: (eq: OrderEquipment) => void;
  removeEquipment: (typeId: number, assignedProductId?: number | null) => void;
  setDelivery: (deliver: boolean, date: string | null) => void;
  setReturn: (ret: boolean, date: string | null) => void;
  setNotes: (notes: string) => void;
  setPayment: (termId: number | null, methodId: number | null) => void;
  setSaleType: (typeId: number | null) => void;
  reset: () => void;
  resetItemsAndClient: () => void;
  
  // Repetir/Novo (Sprint 8.9.22)
  repeatOrder: (payload: any, customerName: string) => void;
  newOrderFromClient: (clientId: number, customerName: string, companyId: number) => void;
  editErpOrder: (draft: any) => void;
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
      isEditing: false,
      items: [],
      equipments: [],
      deliver: true, // true = Entrega, false = Retirada
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
      addItem: (item) => set((state: OrderFormStore) => {
        const exists = state.items.find(i => i.productId === item.productId);
        const manualPrice = item.manualUnitPrice !== undefined && item.manualUnitPrice !== null;
        const appliedPrice = manualPrice ? (item.manualUnitPrice as number) : item.unitPrice;
        
        const finalItem: OrderItem = {
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          manualPrice,
          appliedUnitPrice: appliedPrice,
          total: appliedPrice * item.quantity
        };

        if (exists) {
          return {
            items: state.items.map(i => 
              i.productId === item.productId ? finalItem : i
            )
          };
        }
        return { items: [...state.items, finalItem] };
      }),
      removeItem: (productId: number) => set((state: OrderFormStore) => ({
        items: state.items.filter(i => i.productId !== productId)
      })),
      updateItemQuantity: (productId: number, quantity: number) => set((state: OrderFormStore) => ({
        items: state.items.map(i => 
          i.productId === productId 
            ? { ...i, quantity, total: quantity * i.appliedUnitPrice }
            : i
        )
      })),
      updateItemPrice: (productId: number, manualUnitPrice: number | null) => set((state: OrderFormStore) => ({
        items: state.items.map(i => {
          if (i.productId !== productId) return i;
          const applied = manualUnitPrice ?? i.unitPrice;
          return {
            ...i,
            manualPrice: manualUnitPrice !== null,
            appliedUnitPrice: applied,
            total: i.quantity * applied
          };
        })
      })),
      addEquipment: (eq: OrderEquipment) => set((state: OrderFormStore) => {
        const sameIdentity = (e: OrderEquipment) => 
          e.equipmentTypeId === eq.equipmentTypeId && 
          (e.assignedProductId ?? null) === (eq.assignedProductId ?? null);
          
        const exists = state.equipments.find(sameIdentity);
        if (exists) {
          return {
            equipments: state.equipments.map(e => 
              sameIdentity(e)
                ? { ...e, quantity: e.quantity + eq.quantity }
                : e
            )
          };
        }
        return { equipments: [...state.equipments, eq] };
      }),
      removeEquipment: (typeId: number, assignedProductId?: number | null) => set((state: OrderFormStore) => ({
        equipments: state.equipments.filter(e => 
          !(e.equipmentTypeId === typeId && (e.assignedProductId ?? null) === (assignedProductId ?? null))
        )
      })),
      setDelivery: (deliver: boolean, date: string | null) => set((state) => {
        const newState: Partial<OrderFormStore> = { deliver, deliveryAt: date };
        if (state.returnEquipment && date) {
          newState.returnAt = addDaysToDateOnly(date, 7);
        }
        return newState;
      }),
      setReturn: (ret: boolean, date: string | null) => set((state) => {
        const newState: Partial<OrderFormStore> = { returnEquipment: ret, returnAt: date };
        if (ret && !date && state.deliveryAt) {
          newState.returnAt = addDaysToDateOnly(state.deliveryAt.split('T')[0], 7);
        }
        return newState;
      }),
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
        isEditing: false,
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
        idempotencyKey: crypto.randomUUID(), 
        submissionStatus: "draft",
        lastAttemptAt: null,
        erpOrderId: null,
        erpOrderNumber: null,
        isEditing: false,
        notes: "",
        deliveryAt: null,
        returnAt: null,
      }),
      repeatOrder: (payload: any, customerName: string) => {
        // Reset base mas preserva empresa e cliente
        const companyId = payload.companyId;
        const clientId = payload.clientId;
        
        set({
          clientId,
          clientName: customerName,
          companyId,
          idempotencyKey: crypto.randomUUID(),
          submissionStatus: "draft",
          lastAttemptAt: null,
          erpOrderId: null,
          erpOrderNumber: null,
          isEditing: false,
          items: (payload.items || []).map((item: any) => ({
            productId: item.productId,
            description: item.description || `Produto ${item.productId}`,
            quantity: item.quantity,
            unitPrice: 0, // Será resolvido no stepper
            appliedUnitPrice: 0,
            manualPrice: false,
            total: 0
          })),
          equipments: (payload.equipments || []).map((eq: any) => ({
            equipmentTypeId: eq.equipmentTypeId,
            description: eq.description || `Equip. ${eq.equipmentTypeId}`,
            quantity: eq.quantity,
            role: eq.role || "OTHER",
            tapLines: eq.tapLines,
            capacityLiters: eq.capacityLiters,
            assignedProductId: eq.assignedProductId || (payload.items?.length === 1 ? payload.items[0].productId : null)
          })),
          deliver: payload.deliver ?? true,
          deliveryAt: null, // Data deve ser preenchida pelo vendedor
          returnEquipment: payload.returnEquipment ?? false,
          returnAt: null,
          notes: payload.notes || "",
          paymentTermId: payload.paymentTermId || null,
          paymentMethodId: payload.paymentMethodId || null,
          saleTypeId: payload.saleTypeId || null,
        });
      },
      newOrderFromClient: (clientId: number, customerName: string, companyId: number) => {
        set({
          clientId,
          clientName: customerName,
          companyId,
          idempotencyKey: crypto.randomUUID(),
          submissionStatus: "draft",
          lastAttemptAt: null,
          erpOrderId: null,
          erpOrderNumber: null,
          isEditing: false,
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
        });
      },
      editErpOrder: (draft: any) => {
        const payload = draft.payload || {};
        
        set({
          clientId: payload.clientId,
          clientName: draft.customer_name_snapshot,
          companyId: draft.company_id,
          idempotencyKey: draft.idempotency_key || crypto.randomUUID(),
          submissionStatus: "editing",
          isEditing: true,
          erpOrderId: draft.erp_order_id,
          erpOrderNumber: draft.erp_order_number,
          items: (payload.items || []).map((i: any) => ({
            productId: i.productId,
            description: i.description || `Produto ${i.productId}`,
            quantity: i.quantity,
            unitPrice: i.unitPrice || 0,
            appliedUnitPrice: i.manualUnitPrice || i.unitPrice || 0,
            manualPrice: !!i.manualUnitPrice,
            total: (i.manualUnitPrice || i.unitPrice || 0) * i.quantity
          })),
          equipments: (payload.equipments || []).map((e: any) => ({
            equipmentTypeId: e.equipmentTypeId,
            description: e.description || `Equip. ${e.equipmentTypeId}`,
            quantity: e.quantity
          })),
          deliver: payload.deliver ?? true,
          deliveryAt: payload.deliveryAt,
          returnEquipment: payload.returnEquipment ?? false,
          returnAt: payload.returnAt,
          notes: payload.notes || "",
          paymentTermId: payload.paymentTermId,
          paymentMethodId: payload.paymentMethodId,
          saleTypeId: payload.saleTypeId
        });
      },
    }),
    }),
    { name: "order-form-storage" }
  )
);
