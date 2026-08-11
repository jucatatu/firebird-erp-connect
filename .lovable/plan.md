# Plan: Order Lifecycle and Identity Lock (Sprint 8.9.36)

This plan implements a strict architectural flow for the Order Wizard, ensuring that once a client/company (identity) is defined, it remains immutable throughout the order's lifecycle. It also optimizes the Edit Mode experience and navigation guards.

## User Review Required

> [!IMPORTANT]
> - Switching clients after Step 1 will now require canceling the order and starting over.
> - Swipe navigation will be restricted to prevent returning to Step 1 once a client is selected.
> - Edit Mode will bypass Step 1 entirely, showing a read-only identity header.

- Does the "Cancel Order" confirmation dialog meet your requirements for clearing the session?
- Is the removal of Step 1 from the mobile tab bar acceptable after identity lock, or should it remain as a disabled "Locked" tab?

## Proposed Changes

### Frontend: Store & State (`src/hooks/use-order-form.ts`)

- Add `identityLocked: boolean` to `OrderFormStore`.
- Update `setClient`: automatically set `identityLocked = true` and `companyId` (if not already set).
- Update `reset`: clear `identityLocked` and all session data.
- Update `editErpOrder`: set `identityLocked = true` and `submissionStatus = "editing"`.

### Frontend: Wizard UI & Navigation (`src/routes/_authenticated.pedidos-venda.novo.tsx`)

#### 1. Lifecycle & Hydration
- Refine the `useEffect` for `editParam` to ensure atomic hydration and set `step = "items"` immediately after success.
- Ensure the loading state is robust and prevents interaction during hydration.

#### 2. Navigation Guards
- Modify `setStep` logic: if `identityLocked` is true, prevent changing step to `"client"`.
- Update `Tabs` component:
    - Disable the "Cliente" tab if `identityLocked`.
    - Optionally hide it on mobile to save space.
- Update `react-swipeable` configuration:
    - `onSwipedRight` on Step 2 should be a no-op if `identityLocked`.

#### 3. Identity Header
- Implement a persistent header for the Wizard (especially in Edit mode or Locked state) showing:
    - Order Status (if editing).
    - Client Name (Snapshot).
    - Company Label.
    - "Cancelar Pedido/Edição" button.

#### 4. Step 1 (Client Selection)
- When a client is clicked in the search results:
    1. Call `setClient(id, name)`.
    2. Advance to `setStep("items")` automatically.

#### 5. Step 5 (Review) & Saving
- Ensure `handleUpdateOrder` (PUT) and `handleCreateOrder` (POST) correctly handle the submission status and redirection.

### Backend: Node.js API (Internal Verification)

- The backend status validation in `erp-api/src/modules/orders/orders.service.js` will be double-checked to ensure it re-validates the status from Firebird during `updateOrder` regardless of the payload's reported status.

## Technical Details

- **Store Keys**: `identityLocked` (boolean), `isEditing` (boolean), `erpOrderNumber` (number).
- **Zustand Persistence**: The `identityLocked` flag will be persisted to ensure page refreshes don't lose the lock state while the order is active.
- **Swipe Logic**: 
  ```typescript
  onSwipedRight: () => {
    if (step === "items" && identityLocked) return; // Block
    // ... else normal back navigation
  }
  ```

## Acceptance Criteria

- **Create Flow**: Selecting a client locks Step 1 and moves to Step 2. User cannot return to Step 1 via tabs, swipe, or "Voltar".
- **Edit Flow**: Opening `?edit=8623` loads data, locks identity, and lands on Step 2. Read-only client header visible.
- **Cancellation**: Confirmation dialog resets all store fields and redirects to list.
- **Node Sync**: PUT endpoint re-verifies status `[1, 20, 24, 27]` before updating.
