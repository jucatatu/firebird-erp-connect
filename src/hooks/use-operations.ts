import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { operationService } from "@/lib/operations/OrderOperationService";
import type {
  OperationState,
  OrderSnapshotInput,
  OperationalStatus,
} from "@/lib/operations/types";

export function useOperationStates(operationDate: string, companyId?: number | null) {
  return useQuery({
    queryKey: ["operation-states", operationDate, companyId ?? "all"],
    queryFn: () => operationService.listStates({ operationDate, companyId }),
    staleTime: 5_000,
  });
}

export function useOperationEvents(stateId: string | null | undefined) {
  return useQuery({
    queryKey: ["operation-events", stateId],
    queryFn: () => operationService.listEvents(stateId as string),
    enabled: !!stateId,
  });
}

export function useOperationNotes(stateId: string | null | undefined) {
  return useQuery({
    queryKey: ["operation-notes", stateId],
    queryFn: () => operationService.listNotes(stateId as string),
    enabled: !!stateId,
  });
}

export function useOperationMutations(operationDate: string, companyId?: number | null) {
  const qc = useQueryClient();
  const invalidate = (stateId?: string) => {
    qc.invalidateQueries({ queryKey: ["operation-states", operationDate, companyId ?? "all"] });
    if (stateId) {
      qc.invalidateQueries({ queryKey: ["operation-events", stateId] });
      qc.invalidateQueries({ queryKey: ["operation-notes", stateId] });
    }
  };

  const ensure = useMutation({
    mutationFn: (input: OrderSnapshotInput) => operationService.ensureState(input),
    onSuccess: (s) => invalidate(s.id),
  });

  const setStatus = useMutation({
    mutationFn: async (args: { stateId: string; status: OperationalStatus }) => {
      switch (args.status) {
        case "in_progress": return operationService.startOrder(args.stateId);
        case "delivered": return operationService.markDelivered(args.stateId);
        case "collected": return operationService.markCollected(args.stateId);
        case "customer_will_call": return operationService.markCustomerWillCall(args.stateId);
        case "not_found": return operationService.markNotFound(args.stateId);
        default: throw new Error(`Transição não suportada: ${args.status}`);
      }
    },
    onSuccess: (s: OperationState) => invalidate(s.id),
  });

  const reschedule = useMutation({
    mutationFn: (args: { stateId: string; newDate: string; reason: string }) =>
      operationService.reschedule(args),
    onSuccess: (s) => invalidate(s.id),
  });

  const addNote = useMutation({
    mutationFn: (args: { stateId: string; body: string }) =>
      operationService.addNote(args),
    onSuccess: (n) => invalidate(n.operation_state_id),
  });

  const reorder = useMutation({
    mutationFn: (args: { orderedStateIds: string[] }) =>
      operationService.reorder({ operationDate, orderedStateIds: args.orderedStateIds }),
    onSuccess: () => invalidate(),
  });

  return { ensure, setStatus, reschedule, addNote, reorder };
}