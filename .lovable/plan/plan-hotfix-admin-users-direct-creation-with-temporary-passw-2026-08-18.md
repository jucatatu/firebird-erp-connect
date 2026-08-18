# Plan - Hotfix Admin Users: Direct Creation with Temporary Password

&nbsp;

Switch from invitation emails to direct user creation by administrators with a temporary password. Fix idempotency issues in user setup to prevent `profiles_pkey` errors and enforce a mandatory password change on the first login.

&nbsp;

## Proposed Changes

&nbsp;

### Backend (Supabase/PostgreSQL)

&nbsp;

#### [Migration] Create one corrective migration

- Add `must_change_password boolean NOT NULL DEFAULT false` to `public.profiles`.

- Existing users must remain `false`.

- Update `admin_setup_invited_user` or preferably create `admin_setup_created_user`.

- Setup must be idempotent using:

&nbsp;

  `INSERT ... ON CONFLICT (id) DO UPDATE`

&nbsp;

- Clear and recreate `user_roles` before insertion.

- Clear and recreate `user_company_access` before insertion.

- Preserve:

  - `INVALID_COMPANY_ACCESS`

  - `INVALID_PERMISSION_PROFILE`

  - Administrator profile ↔ admin role normalization.

- The setup RPC itself must force:

  - `active = true`

  - `must_change_password = true`

  for a newly created administrative user.

- Do NOT receive `must_change_password` as a user-controlled parameter.

- Create a secure RPC/function allowing only the currently authenticated user to change their own `must_change_password` from `true` to `false`.

- Do not modify `LAST_ADMIN_PROTECTION` or unrelated RLS.

&nbsp;

### Server Functions (TanStack Start)

&nbsp;

#### [New] `src/lib/permissions/admin-users-create.functions.ts`

&nbsp;

Implement `createAdminUser`.

&nbsp;

Required order:

&nbsp;

1. Authenticate administrator.

2. Check `admin.users/create`.

3. Validate input.

4. Validate companies.

5. Validate permission profile.

6. Validate ERP Seller when provided.

7. Validate Seller × companies.

8. Validate temporary password.

9. Only then call:

&nbsp;

   `supabaseAdmin.auth.admin.createUser({

      email,

      password: temporaryPassword,

      email_confirm: true

   })`

&nbsp;

10. Call the idempotent setup RPC.

11. If setup fails after Auth creation, call `deleteUser(newUserId)` as compensation.

12. Return success without password.

&nbsp;

Never call `inviteUserByEmail` in the active flow.

&nbsp;

Password must never be logged, persisted in public tables, returned, or sent to an RPC.

&nbsp;

#### [Update] `src/lib/permissions/admin-users-update.functions.ts`

&nbsp;

- Preserve current administrative behavior.

- Do NOT expose or modify `must_change_password` during normal user editing.

- Do NOT add password fields to normal edit.

- Preserve:

  - LAST_ADMIN_PROTECTION

  - INVALID_COMPANY_ACCESS

  - INVALID_PERMISSION_PROFILE

  - Seller validation.

&nbsp;

#### [New] `src/lib/permissions/password-change.functions.ts`

&nbsp;

Implement `completeInitialPasswordChange`.

&nbsp;

Requirements:

&nbsp;

- authenticated user only;

- no arbitrary `userId` from the browser;

- identify user from authenticated session;

- only allow clearing the flag for the current user;

- set `must_change_password = false`.

&nbsp;

This function must only be called AFTER the password has been successfully changed in Supabase Auth.

&nbsp;

### Frontend

&nbsp;

#### [Update] `src/hooks/use-auth.ts`

&nbsp;

Update `useMyProfile()` to load:

&nbsp;

- id

- full_name

- active

- erp_seller_id

- must_change_password

&nbsp;

Do not create a duplicate `use-my-profile.ts` hook.

&nbsp;

#### [Update] `src/components/admin/user-dialog.tsx`

&nbsp;

Creation mode must contain:

&nbsp;

- Full Name

- Email

- Temporary Password

- Confirm Temporary Password

- Permission Profile

- Companies

- ERP Seller

&nbsp;

Replace:

&nbsp;

`Send Invite`

&nbsp;

with:

&nbsp;

`Create User`

&nbsp;

Remove invitation terminology.

&nbsp;

Temporary password validation:

&nbsp;

- required;

- minimum 8 characters;

- cannot be blank/whitespace;

- confirmation must match.

&nbsp;

Temporary password fields must only appear during creation.

&nbsp;

Editing an existing user must not display or retrieve passwords.

&nbsp;

Preserve Seller Combobox and company compatibility validation.

&nbsp;

#### [Update] `src/routes/_authenticated.tsx`

&nbsp;

Do not create `_authenticated/route.tsx`.

&nbsp;

When:

&nbsp;

`profile.must_change_password === true`

&nbsp;

do NOT render the normal `AppShell` or application modules.

&nbsp;

Render only a mandatory password-change screen containing:

&nbsp;

- New Password

- Confirm Password

- Change Password

- Sign Out

&nbsp;

After successful:

&nbsp;

`supabase.auth.updateUser({ password: newPassword })`

&nbsp;

call `completeInitialPasswordChange`.

&nbsp;

Only after both operations succeed may normal ERP access be released.

&nbsp;

If password change fails, keep `must_change_password = true`.

&nbsp;

### Idempotency / profiles_pkey

&nbsp;

Explicitly reproduce the current bug:

&nbsp;

- Auth user exists;

- a `profiles` row with the same Auth ID already exists;

- administrative setup executes.

&nbsp;

Expected:

&nbsp;

- no `profiles_pkey` error;

- existing profile is updated;

- only one profile remains;

- roles are correct;

- companies are correct;

- Seller is correct;

- `must_change_password = true`.

&nbsp;

### Duplicate Email

&nbsp;

If the Auth account already exists:

&nbsp;

- do not reuse it automatically;

- do not run setup;

- show:

  `Já existe um usuário cadastrado com este e-mail.`

&nbsp;

### Seller

&nbsp;

Preserve the already homologated Sellers implementation.

&nbsp;

Do NOT alter:

&nbsp;

- `erp-api/src/modules/sellers/sellers.repository.js`

- `erp-api/src/modules/sellers/sellers.controller.js`

- `/api/v1/sellers`

- `/api/v1/sellers/:id`

&nbsp;

Seller validation must happen before Auth user creation.

&nbsp;

If Seller is invalid, incompatible, or ERP unavailable:

&nbsp;

`createUser` must NOT be called.

&nbsp;

ZERO Firebird writes.

&nbsp;

### Security

&nbsp;

Never:

&nbsp;

- log temporary password;

- persist it in `profiles`;

- put it in `user_metadata`;

- put it in `app_metadata`;

- send it to SQL RPC;

- return it from Server Functions;

- manually store it in localStorage/sessionStorage.

&nbsp;

Service Role remains server-only.

&nbsp;

### Automated Tests

&nbsp;

Cover at minimum:

&nbsp;

- `createUser` called for valid creation;

- `inviteUserByEmail` never called;

- short password rejected;

- password confirmation mismatch rejected;

- Seller null allowed;

- Seller valid allowed;

- Seller mismatch blocks before `createUser`;

- Seller not found blocks before `createUser`;

- ERP unavailable blocks before `createUser`;

- duplicate e-mail handled;

- setup failure triggers `deleteUser`;

- `profiles_pkey` regression test;

- existing profile updated idempotently;

- users existing before migration remain `must_change_password=false`;

- new users receive `must_change_password=true`;

- first login blocks normal ERP UI;

- password change success clears flag;

- password change failure keeps flag true.

&nbsp;

Preserve and run existing:

&nbsp;

- Sellers tests;

- admin-sync;

- permissions.server;

- use-permissions;

- Orders tests;

- Clients tests.

&nbsp;

Do NOT alter Orders code/tests to make this change pass.

&nbsp;

### Invariants

&nbsp;

- NO invitation email.

- NO Fast Visual Edit.

- NO changes to Map.

- NO changes to Orders.

- NO changes to Sellers Firebird.

- NO changes to LAST_ADMIN_PROTECTION.

- ZERO Firebird writes.

- Existing users must not be blocked by the migration.

&nbsp;

## Manual Verification After Publish

&nbsp;

1. Create test user with:

   - temporary password;

   - company 1;

   - Seller ROMEU.

2. Confirm user is created without invitation e-mail.

3. Login with temporary password.

4. Confirm ERP is blocked by mandatory password-change screen.

5. Set a new password.

6. Confirm normal ERP access is released.

7. Reopen user in Admin.

8. Confirm Seller ROMEU persisted.

9. Confirm login works with new password.

&nbsp;

## Final Status

&nbsp;

After implementation only:

&nbsp;

`NOVO FLUXO DE USUÁRIOS IMPLEMENTADO — AGUARDANDO HOMOLOGAÇÃO`

&nbsp;

Do NOT declare Sellers fully integrated yet.

&nbsp;

After implementation, tests and report:

&nbsp;

STOP.

&nbsp;

Do not start Map.

Do not start Sprint 8.9.43.2.

Wait for publish and Git review.