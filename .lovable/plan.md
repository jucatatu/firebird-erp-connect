# Sprint 8.9.43 — Permission System Implementation Plan

This plan implements a hierarchical permission system for Firebird ERP Connect, defining profiles, resources, and rules with frontend and backend integration.

## Backend (Supabase)

### Database Schema
1. **Tables**:
   - `permission_profiles`: Stores roles like "Admin", "Seller", "Driver".
   - `permission_resources`: Hierarchical tree of system features (e.g., `commercial.orders`).
   - `permission_profile_rules`: Junction table mapping profiles to resources with `can_view`, `can_create`, `can_edit`, `can_delete` flags.
2. **Schema Modifications**:
   - Add `permission_profile_id` to `profiles` table.
3. **Stored Procedures & RLS**:
   - `public.has_permission(_user_id, _resource_key, _action)`: SECURITY DEFINER function for access resolution.
   - Strict RLS policies for all new tables.
4. **Initial Data (Seed)**:
   - Resource tree covering Operation, Commercial, and Admin.
   - Default "Administrador" profile with full access.
   - Link existing 'admin' users to the new profile.

## Frontend (TanStack Start)

### Core Logic
- `src/lib/permissions/`: Define `PermissionAction`, `PermissionMap`, and technical keys (`commercial.orders`).
- `src/hooks/use-permissions.ts`: Hook for client-side permission checks.
- `src/components/permissions/`:
  - `PermissionGate`: Conditional rendering for blocks/components.
  - `PermissionDenied`: Standard UI for unauthorized access.
  - `PermissionAction`: Wrapper for buttons/actions to disable them when unauthorized.

## Server Integration
- `src/lib/permissions/permissions.server.ts`: Helper `requirePermission` for use in `createServerFn`.
- Standardized `PERMISSION_DENIED` error handling (HTTP 403).

## Technical Details

### Database Operations (Migration)
```sql
CREATE TABLE public.permission_profiles (...);
CREATE TABLE public.permission_resources (...);
CREATE TABLE public.permission_profile_rules (...);
ALTER TABLE public.profiles ADD COLUMN permission_profile_id UUID REFERENCES ...;

CREATE OR REPLACE FUNCTION public.has_permission(...) ...;

-- Grants
GRANT SELECT ON public.permission_profiles TO authenticated;
GRANT SELECT ON public.permission_resources TO authenticated;
GRANT SELECT ON public.permission_profile_rules TO authenticated;
```

### Security
- RLS remains active for all sensitive data.
- Permissions are verified both on UI (UX/disable buttons) and Server (Security enforcement).
- Admins (via `user_roles`) will be used to manage permissions during transition.
