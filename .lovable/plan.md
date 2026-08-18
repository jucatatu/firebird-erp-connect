# Plan - Hotfix Admin Users: Direct Creation with Temporary Password

Switch from invitation emails to direct user creation by administrators with a temporary password. Fix idempotency issues in user setup to prevent `profiles_pkey` errors and enforce a mandatory password change on the first login.

## Proposed Changes

### Backend (Supabase/PostgreSQL)

#### [Migration] Create new migration file
- Add `must_change_password` column to `public.profiles` (default `false`).
- Update `admin_setup_invited_user` (or rename/add `admin_setup_created_user`) to be idempotent using `ON CONFLICT (id) DO UPDATE`.
- Ensure `user_roles` and `user_company_access` are cleared before re-insertion to prevent duplicates.
- Create a secure function/RPC for users to clear their own `must_change_password` flag after updating their password via Auth API.

### Server Functions (TanStack Start)

#### [New] `src/lib/permissions/admin-users-create.functions.ts`
- Implement `createAdminUser` server function.
- Flow:
  1. Authenticate admin and check `admin.users/create`.
  2. Validate input (email, name, temporary password, companies, profile, seller).
  3. Validate ERP Seller if provided (must match assigned companies).
  4. Call `supabaseAdmin.auth.admin.createUser` with `email_confirm: true`.
  5. Call the setup RPC with `must_change_password: true`.
  6. **Compensation**: If RPC fails, delete the Auth user.
- **Security**: Never log or return the password.

#### [Update] `src/lib/permissions/admin-users-update.functions.ts`
- Ensure it handles the new `must_change_password` field appropriately (preserve existing state).

#### [New] `src/lib/permissions/password-change.functions.ts`
- Implement `completeInitialPasswordChange` server function.
- It will mark `must_change_password = false` for the *currently authenticated user* only.

### Frontend (React/Components)

#### [Update] `src/hooks/use-my-profile.ts`
- Include `must_change_password` in the profile data.

#### [Update] `src/components/admin/user-dialog.tsx`
- Replace "Invite" logic with "Create".
- Show "Temporary Password" and "Confirm Password" fields only in creation mode.
- Update labels and toasts (remove "Invite" references).
- Enforce Zod validation for password (min 8 chars, matching confirmation).

#### [Update] `src/routes/_authenticated/route.tsx` (or similar gate)
- If `profile.must_change_password` is true, hijack the view to show a "Change Password" form.
- Prevent rendering the main app (sidebar, map, etc.) until the flag is cleared.

### Technical Details
- **Idempotency**: `INSERT INTO profiles ... ON CONFLICT (id) DO UPDATE SET ...`
- **Security**: Password validation occurs on the server before `createUser`. The client-side `supabase.auth.updateUser` is used for the user's password change.
- **Rollback**: Manual `deleteUser` in the server function's `catch` block if the metadata/profile setup fails.

## Verification Plan

### Automated Tests
- **Creation Tests**:
  - Verify `createUser` is called, not `inviteUserByEmail`.
  - Test validation failures (short password, mismatching passwords).
  - Test ERP Seller validation (invalid seller blocks creation).
  - Test compensation (setup failure triggers `deleteUser`).
- **Idempotency Tests**:
  - Trigger setup twice for the same ID to verify no `profiles_pkey` error.
- **First Access Tests**:
  - Mock a profile with `must_change_password: true` and verify the UI lock.

### Manual Verification
- Create a test user in the UI.
- Log in with the test user and verify the password change requirement.
- Change the password and verify the app becomes accessible.
