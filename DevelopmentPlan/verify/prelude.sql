-- Minimal emulation of the Supabase environment SCHEMA.md assumes exists.
-- Nothing here is part of the project schema; it stands in for what Supabase
-- provisions (roles, the auth schema, auth.uid(), default grants).

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase grants select on public tables to anon by default privilege, which
-- is what makes the column-level revoke on authors meaningful.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb
);

-- PostgREST sets request.jwt.claim.sub per request; tests set it directly.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;
