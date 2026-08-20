# Database design

## Status

**Phase 3 implemented.** The schema ships in ordered migrations
`0001_auth_foundation.sql` through `0006_messaging.sql` and covers
authentication, farm membership, diagnoses, farm statistics, authorized
diagnosis detail, and farm-scoped messaging.

## Platform

- PostgreSQL hosted by Supabase.
- Auth handled by Supabase Auth (managed `auth.users` table).
- Row Level Security enabled on every application table.
- SQL migrations stored in `supabase/migrations/`.

## Implemented entities

### profiles

Extends the Supabase Auth `auth.users` record with application data. Row-level
reads are limited to the own profile (plus admins reading their own farm's
members). There is **no** `INSERT`/`UPDATE` policy — role and farm changes only
happen inside SECURITY DEFINER functions keyed on `auth.uid()`.

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK, FK -> `auth.users(id)` ON DELETE CASCADE |
| email | text | from the auth user |
| full_name | text, null | |
| role | `public.app_role` | `farmer` \| `farm_admin`; default `farmer` |
| farm_id | uuid, null | FK -> `farms(id)` ON DELETE SET NULL; null until assigned |
| created_at | timestamptz | |

A trigger (`handle_new_user`) inserts a row whenever an auth user is created.

### farms

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| name | text | `char_length` 2..120 |
| admin_id | uuid | FK -> `profiles(id)` ON DELETE RESTRICT |
| created_at | timestamptz | |

The circular `farms.admin_id` <-> `profiles.farm_id` relation is resolved
after both tables exist.

### invitations

One row per email invited to join a farm.

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| farm_id | uuid | FK -> `farms(id)` ON DELETE CASCADE |
| email | text | |
| invited_name | text, null | |
| status | `public.invitation_status` | `pending` \| `accepted` |
| created_at | timestamptz | |
| accepted_at | timestamptz, null | |

Invitations are inserted/read by the farm admin of the target farm; the invited
farmer can read their own.

## SECURITY DEFINER transitions

Because profiles have no direct update policy, guarded transitions run as
SECURITY DEFINER functions that re-check `auth.uid()` internally:

- `complete_admin_onboarding(new_farm_name)` — creates a farm and promotes the
  caller to `farm_admin`. Only allowed while the caller has no farm.
- `update_profile_full_name(p_full_name)` — updates the caller's own display
  name.
- `claim_pending_invitation()` — binds the caller to the farm of their oldest
  pending invitation (role `farmer`, farm_id from the invitation row).

### diagnoses

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| farmer_id | uuid | FK -> `profiles(id)` |
| farm_id | uuid | FK -> `farms(id)`; snapshot of farm at diagnosis time |
| disease | text | Predicted class name |
| confidence | numeric | 0..1 |
| crop | text | Derived crop name |
| model_version | text | model used |
| created_at | timestamptz | |

Diagnosis rows are append-only. Inserts run through the secured
`save_diagnosis()` function, which derives farmer and farm ownership from
`auth.uid()`.

### messages

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK |
| sender_id | uuid | FK -> `profiles(id)` |
| recipient_id | uuid | FK -> `profiles(id)` |
| body | text | |
| read_at | timestamptz, null | |
| created_at | timestamptz | |

Messages are visible only to their sender or recipient. Sending and read-state
updates run through secured functions, and participants must be opposite-role
members of the same farm.

## Conventions

- UUID primary keys.
- Timestamps are `timestamptz`.
- Row Level Security enabled on every table; policies added per role in the
  phase that introduces each feature.
- Storage buckets (e.g. `leaf-photos`) created in the phase that introduces
  uploads.