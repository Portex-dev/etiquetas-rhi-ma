create table if not exists public.label_records (
  id bigint generated always as identity primary key,
  collaborator_name text not null check (char_length(collaborator_name) between 1 and 120),
  registration_number text not null check (char_length(registration_number) between 1 and 30),
  area_id text not null check (area_id in ('m-10', 'rk-1')),
  equipment_name text not null check (equipment_name in (
    'Exaustor Q-904', 'Ventilador Q-902-1', 'Ventilador Q-902-2',
    'Queimador F-901-x-1', 'Queimador F-901-x-2', 'Correia T-2302',
    'Correia T-2304', 'Correia T-2306', 'Correia T-2307'
  )),
  tag_type text not null check (tag_type in ('vermelha', 'amarela', 'azul')),
  anomaly_description text not null check (char_length(anomaly_description) between 1 and 1000),
  location_description text not null check (char_length(location_description) between 1 and 500),
  photo_path text,
  photo_size_bytes bigint not null default 0 check (photo_size_bytes >= 0),
  status text not null default 'novo' check (status in ('novo', 'visto')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.label_records enable row level security;

revoke all on table public.label_records from anon;
grant select, update, delete on table public.label_records to authenticated;
grant select, insert, update, delete on table public.label_records to service_role;
grant usage, select on sequence public.label_records_id_seq to service_role;

create policy "authenticated staff can read records"
on public.label_records for select
to authenticated
using ((select auth.uid()) is not null);

create policy "authenticated staff can update records"
on public.label_records for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy "authenticated staff can delete expired trash"
on public.label_records for delete
to authenticated
using (deleted_at < now() - interval '30 days' and (select auth.uid()) is not null);

create index if not exists label_records_active_created_idx
on public.label_records (created_at desc)
where deleted_at is null;

create index if not exists label_records_new_created_idx
on public.label_records (created_at desc)
where deleted_at is null and status = 'novo';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('label-photos', 'label-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated staff can view label photos"
on storage.objects for select
to authenticated
using (bucket_id = 'label-photos' and (select auth.uid()) is not null);

create policy "authenticated staff can delete expired label photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'label-photos' and (select auth.uid()) is not null);

comment on table public.label_records is 'Registros digitais de etiquetas dos equipamentos RHI MA.';

create table if not exists public.submission_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.submission_attempts enable row level security;
revoke all on table public.submission_attempts from anon, authenticated;
grant select, insert, delete on table public.submission_attempts to service_role;
grant usage, select on sequence public.submission_attempts_id_seq to service_role;
create index if not exists submission_attempts_lookup_idx on public.submission_attempts (ip_hash, created_at desc);
