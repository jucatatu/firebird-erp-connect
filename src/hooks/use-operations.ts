import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { operationService } from "@/lib/operations/OrderOperationService";
import type {
  OperationState,
  OrderSnapshotInput,
  OperationalStatus,
} from "@/lib/operations/types";
import { OperationConflictError } from "@/lib/operations/types";

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

export function useOperationMutations(
  operationDate: string,
  companyId?: number | null,
  onConflict?: () => void,
) {
  const qc = useQueryClient();
  const invalidate = (stateId?: string) => {
    qc.invalidateQueries({ queryKey: ["operation-states"] });
    if (stateId) {
      qc.invalidateQueries({ queryKey: ["operation-events", stateId] });
      qc.invalidateQueries({ queryKey: ["operation-notes", stateId] });
    }
  };
  const handleConflict = (err: unknown) => {
    if (err instanceof OperationConflictError) {
      qc.invalidateQueries({ queryKey: ["operation-states"] });
      onConflict?.();
    }
  };

  const ensure = useMutation({
    mutationFn: (input: OrderSnapshotInput) => operationService.ensureState(input),
    onSuccess: (s: OperationState) => invalidate(s.id),
  });

  const applyStatus = useMutation({
    mutationFn: (args: {
      stateId: string;
      status: OperationalStatus;
      expectedVersion: number;
    }) => operationService.applyStatus(args),
    onSuccess: (s: OperationState) => invalidate(s.id),
    onError: handleConflict,
  });

  const reschedule = useMutation({
    mutationFn: (args: {
      stateId: string;
      newDate: string;
      reason: string;
      expectedVersion: number;
    }) => operationService.reschedule(args),
    onSuccess: (s: OperationState) => invalidate(s.id),
    onError: handleConflict,
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

  // Silence unused-parameter warning for companyId (kept for future scoping).
  void companyId;

  return { ensure, applyStatus, reschedule, addNote, reorder };
}