# Plan: Sprint 8.9.37 — Delivery Address & Google Maps

Implement mandatory delivery address confirmation for orders using Google Maps, ensuring it remains as an order snapshot without modifying the client's ERP registration.

## User Review Required

> [!IMPORTANT]
> A Google Maps API Key is required. Please add `VITE_GOOGLE_MAPS_API_KEY` to the project environment variables.

## Proposed Changes

### Database (Supabase)

#### [order_drafts] & [operation_states]
- Audit snapshots to ensure `delivery_address` (JSONB) and `delivery_address_confirmed` (boolean) are supported.
- These tables already use JSONB fields (`payload`, `payload_v2`, `snapshot`), so no migration is strictly necessary unless we want explicit columns for indexing. We will start by using the JSONB payloads.

### Frontend

#### Zustand Store (`src/hooks/use-order-form.ts`)
- Add `deliveryAddress` (structured object) and `deliveryAddressConfirmed` (boolean) to `OrderFormStore`.
- Update `editErpOrder` and `repeatOrder` to handle these new fields.
- Ensure `reset` and `resetItemsAndClient` clear these fields.

#### Wizard Flow (`src/routes/_authenticated.pedidos-venda.novo.tsx`)
- **Step: Delivery**:
  - Create a new `DeliveryAddressSection` component.
  - Integration with Google Maps (Places Autocomplete).
  - Implementation of "Confirm Address" vs "Search new address".
  - Map display for visual confirmation and marker adjustment.
  - Fallback for manual entry if Google fails.
- **Navigation Guards**:
  - Block moving from "Delivery" to "Payment" if `deliver === true` and `deliveryAddressConfirmed === false`.

#### Operations / Map
- Update the operational maps to prioritize `deliveryAddress.latitude/longitude` from the order snapshot over the client's default coordinates.

## Technical Details

- **Google Maps**: Use `@googlemaps/js-api-loader` for clean dynamic loading.
- **Persistence**: Save the full `deliveryAddress` object in the order snapshot to ensure the driver has the exact location used during the sale.
- **No ERP Mutation**: No calls to update the client's address will be implemented.

## Node.js Backend

- **NODE ALTERADO: NÃO** (The backend already accepts arbitrary snapshots in the payload/metadata fields for operational data).
