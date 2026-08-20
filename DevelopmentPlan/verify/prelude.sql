-- Minimal emulation of the Supabase environment SCHEMA.md assumes exists.
-- Nothing here is part of the project schema; it stands in for what Supabase
-- provisions (roles, the auth schema, auth.uid(), default grants).

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- NOTE: real Supabase grants NOTHING on new tables to anon. An earlier version
-- of this shim set `alter default privileges ... grant select to anon`, which
-- made the harness pass while the real stack returned 42501 for every table.
-- The grants now live in SCHEMA.md where they belong; this shim deliberately
-- adds none, so the harness fails the same way production would.
alter default privileges in schema public grant all on tables to service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Mirrors enough of Supabase's auth.users that ONE seed file serves both this
-- harness and the real stack. An earlier version had a narrower shape, which
-- forced a second copy of the seed here; the two promptly drifted and the
-- harness broke on a column the real seed had been using for days.
create table auth.users (
  instance_id             uuid,
  id                      uuid primary key default gen_random_uuid(),
  aud                     text,
  role                    text,
  email                   text unique,
  encrypted_password      text,
  email_confirmed_at      timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  raw_app_meta_data       jsonb not null default '{}'::jsonb,
  raw_user_meta_data      jsonb not null default '{}'::jsonb,
  confirmation_token      text,
  recovery_token          text,
  email_change_token_new  text,
  email_change            text
);

-- PostgREST sets request.jwt.claim.sub per request; tests set it directly.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;
