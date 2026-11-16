-- Minimal stand-in for the parts of a Supabase database our migrations use.
-- Lets us run the real migrations in PGlite (Postgres in WASM) in unit tests
-- and CI, without Docker or a hosted project.
--
-- Mirrors Supabase behaviour for: roles, auth.users, auth.uid(),
-- storage.buckets, storage.objects (RLS on) and storage.foldername().

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- auth -----------------------------------------------------------------------
create schema auth;

create table auth.users (
  id           uuid primary key,
  is_anonymous boolean not null default true
);

-- Same lookup order as Supabase's auth.uid().
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- storage --------------------------------------------------------------------
create schema storage;

create table storage.buckets (
  id                 text primary key,
  name               text not null unique,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id),
  name       text not null,
  owner      uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- public: Supabase's default privileges on new tables ------------------------
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
