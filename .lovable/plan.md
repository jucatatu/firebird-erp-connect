# Plan: HOTFIX CATALOG UX.1 — PERSISTÊNCIA INTEGRAL DO CATÁLOGO

## Audit Results
- `admin_reorder_catalog_items`: Found 2 versions (2 args and 3 args). Both return `void`.
- `upsert_order_catalog_setting`: Found 2 versions (11 args and 12 args).

## 1. Database Migrations
Create a new migration to:
- Drop legacy `admin_reorder_catalog_items(_item_type, _ordered_ids)` (2 args).
- Drop and recreate `admin_reorder_catalog_items(_item_type, _ordered_ids, _expected_versions)` to return `SETOF order_catalog_settings`.
- Implement strict validations in `admin_reorder_catalog_items`: duplicates, existence, item_type match, version match.
- Implement atomic update with `sort_order` in steps of 10.
- Drop legacy `upsert_order_catalog_setting` with 11 args.
- Re-implement canonical `upsert_order_catalog_setting` (12 args) with:
    - Automatic `sort_order` (MAX + 10) for new items if `_sort_order` is NULL.
    - Preservation of `sort_order` for existing items if not explicitly provided.
    - Strict version check and return of the persisted row.

## 2. Type System
- Update `src/integrations/supabase/types.ts` to reflect the new RPC signatures and return types.

## 3. Frontend - Hooks
- Update `useReorderCatalogItems`:
    - Perform roundtrip validation: RPC call -> verify returned data -> follow-up SELECT -> verify database state.
    - Throw error if mismatch occurs.
- Update `useUpsertCatalogSetting`:
    - Perform roundtrip validation: RPC call -> verify returned row -> follow-up SELECT -> verify database state.
    - Throw error if mismatch occurs.

## 4. Frontend - UI Components
- **CatalogItemDialog**:
    - Remove `sortOrder` manual state.
    - Remove immediate save on `logisticsType` change (use local state).
    - Ensure `expectedVersion` is captured on open.
- **CatalogReorderList**:
    - Ensure reorder only persists on "Salvar" click.
- **Catalogo Route**:
    - Update state management to handle local logistics type and versioning.

## 5. Verification
- Run Vitest for reorder utilities.
- Run Playwright tests for Equipment and Products persistence (Test A and Test B).
- Validate build and typecheck.

## Technical Details
- RPCs use `SECURITY DEFINER` and `SET search_path = public`.
- Permissions: `REVOKE anon`, `GRANT authenticated`.
- `expected_versions` ensures optimistic concurrency.
- `roundtrip_mismatch` errors handled in toasts.
