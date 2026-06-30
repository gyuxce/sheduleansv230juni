begin;

create extension if not exists btree_gist;

create type public.organization_role as enum ('admin', 'sensei', 'murid');
create type public.member_status as enum ('invited', 'active', 'suspended');
create type public.class_status as enum ('available', 'pending_confirmation', 'booked', 'cancelled', 'completed');
create type public.class_source as enum ('sensei_availability', 'student_booking', 'sensei_self_input', 'admin_manual');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Asia/Jakarta',
  slot_duration_minutes integer not null default 60 check (slot_duration_minutes in (30, 45, 60, 90, 120)),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id),
  unique (id, organization_id)
);

create table public.senseis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  teaching_levels text[] not null default '{}',
  can_self_book boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, member_id),
  unique (id, organization_id),
  foreign key (member_id, organization_id)
    references public.organization_members(id, organization_id) on delete cascade
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  current_level text,
  primary_sensei_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, member_id),
  unique (id, organization_id),
  foreign key (member_id, organization_id)
    references public.organization_members(id, organization_id) on delete cascade,
  foreign key (primary_sensei_id, organization_id)
    references public.senseis(id, organization_id) on delete set null (primary_sensei_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sensei_id uuid not null,
  student_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  level text,
  status public.class_status not null,
  source public.class_source not null,
  meeting_url text,
  notes text,
  created_by_member_id uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sensei_id, organization_id)
    references public.senseis(id, organization_id) on delete restrict,
  foreign key (student_id, organization_id)
    references public.students(id, organization_id) on delete restrict,
  foreign key (created_by_member_id, organization_id)
    references public.organization_members(id, organization_id) on delete restrict,
  check (ends_at > starts_at),
  check (
    (status = 'available' and student_id is null)
    or (status in ('pending_confirmation', 'booked', 'completed') and student_id is not null)
    or status = 'cancelled'
  )
);

alter table public.classes add constraint classes_no_overlap_sensei
  exclude using gist (
    sensei_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_confirmation', 'booked', 'completed'));

alter table public.classes add constraint classes_no_overlap_student
  exclude using gist (
    student_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_confirmation', 'booked', 'completed'));

create unique index classes_unique_available_slot
  on public.classes (sensei_id, starts_at, ends_at)
  where status = 'available';
create index classes_org_starts_idx on public.classes (organization_id, starts_at);
create index classes_sensei_starts_idx on public.classes (organization_id, sensei_id, starts_at);
create index classes_student_starts_idx on public.classes (organization_id, student_id, starts_at) where student_id is not null;
create index classes_pending_idx on public.classes (organization_id, starts_at) where status = 'pending_confirmation';

create table public.sensei_external_busy (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sensei_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'Pekerjaan lain',
  notes text,
  created_at timestamptz not null default now(),
  foreign key (sensei_id, organization_id)
    references public.senseis(id, organization_id) on delete cascade,
  check (ends_at > starts_at)
);

alter table public.sensei_external_busy add constraint external_busy_no_overlap
  exclude using gist (
    sensei_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

create index external_busy_sensei_starts_idx
  on public.sensei_external_busy (organization_id, sensei_id, starts_at);

create table public.class_activity_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  performed_by_member_id uuid not null,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  foreign key (performed_by_member_id, organization_id)
    references public.organization_members(id, organization_id) on delete restrict
);

create index class_activity_org_created_idx on public.class_activity_log (organization_id, created_at desc);
create index class_activity_class_idx on public.class_activity_log (class_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null,
  class_id uuid references public.classes(id) on delete cascade,
  type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (member_id, organization_id)
    references public.organization_members(id, organization_id) on delete cascade
);

create index notifications_member_unread_idx
  on public.notifications (member_id, created_at desc) where read_at is null;

create table public.rpc_idempotency_keys (
  member_id uuid not null references public.organization_members(id) on delete cascade,
  idempotency_key uuid not null,
  operation text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (member_id, idempotency_key)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if tg_table_name = 'classes' then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger classes_set_updated_at before update on public.classes
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_org_role(p_organization_id uuid, p_roles public.organization_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
      and m.role = any(p_roles)
  );
$$;

create or replace function public.current_member_id(p_organization_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.organization_members m
  where m.organization_id = p_organization_id
    and m.profile_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
revoke all on function public.current_member_id(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;
grant execute on function public.current_member_id(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.senseis enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.sensei_external_busy enable row level security;
alter table public.class_activity_log enable row level security;
alter table public.notifications enable row level security;
alter table public.rpc_idempotency_keys enable row level security;

create policy organizations_select_member on public.organizations
for select to authenticated using (public.is_org_member(id));

create policy profiles_select_self_or_cotenant on public.profiles
for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.profile_id = auth.uid() and mine.status = 'active' and theirs.profile_id = profiles.id
  )
);
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy members_select_cotenant on public.organization_members
for select to authenticated using (public.is_org_member(organization_id));
create policy members_admin_manage on public.organization_members
for all to authenticated using (public.has_org_role(organization_id, array['admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['admin']::public.organization_role[]));

create policy senseis_select_member on public.senseis
for select to authenticated using (public.is_org_member(organization_id));
create policy senseis_admin_manage on public.senseis
for all to authenticated using (public.has_org_role(organization_id, array['admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['admin']::public.organization_role[]));

create policy students_select_authorized on public.students
for select to authenticated using (
  public.has_org_role(organization_id, array['admin','sensei']::public.organization_role[])
  or member_id = public.current_member_id(organization_id)
);
create policy students_admin_manage on public.students
for all to authenticated using (public.has_org_role(organization_id, array['admin']::public.organization_role[]))
with check (public.has_org_role(organization_id, array['admin']::public.organization_role[]));

create policy classes_select_authorized on public.classes
for select to authenticated using (
  public.has_org_role(organization_id, array['admin']::public.organization_role[])
  or exists (
    select 1 from public.senseis s
    where s.id = classes.sensei_id and s.member_id = public.current_member_id(classes.organization_id)
  )
  or status = 'available'
  or exists (
    select 1 from public.students st
    where st.id = classes.student_id and st.member_id = public.current_member_id(classes.organization_id)
  )
);

create policy external_busy_select_authorized on public.sensei_external_busy
for select to authenticated using (
  public.has_org_role(organization_id, array['admin']::public.organization_role[])
  or exists (
    select 1 from public.senseis s
    where s.id = sensei_external_busy.sensei_id
      and s.member_id = public.current_member_id(sensei_external_busy.organization_id)
  )
);

create policy activity_select_admin on public.class_activity_log
for select to authenticated using (public.has_org_role(organization_id, array['admin']::public.organization_role[]));

create policy notifications_select_own on public.notifications
for select to authenticated using (member_id = public.current_member_id(organization_id));
create policy notifications_update_own on public.notifications
for update to authenticated using (member_id = public.current_member_id(organization_id))
with check (member_id = public.current_member_id(organization_id));

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'Asia/Jakarta'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization public.organizations%rowtype;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Autentikasi diperlukan';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception using errcode = '22023', message = 'Nama organisasi terlalu pendek';
  end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Slug organisasi tidak valid';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception using errcode = '22023', message = 'Zona waktu tidak valid';
  end if;

  insert into public.organizations (name, slug, timezone)
  values (trim(p_name), p_slug, p_timezone)
  returning * into v_organization;

  insert into public.organization_members (organization_id, profile_id, role, status)
  values (v_organization.id, auth.uid(), 'admin', 'active')
  returning id into v_member_id;

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_organization.id,
    'member_id', v_member_id,
    'slug', v_organization.slug
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Slug organisasi sudah digunakan';
end;
$$;

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;

create or replace function public.book_available_slot(
  p_class_id uuid,
  p_notes text default null,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classes%rowtype;
  v_student public.students%rowtype;
  v_member_id uuid;
  v_result jsonb;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Slot tidak ditemukan'; end if;

  v_member_id := public.current_member_id(v_class.organization_id);
  if v_member_id is null then raise exception using errcode = '42501', message = 'Tidak memiliki akses ke organisasi'; end if;

  select * into v_student from public.students
  where organization_id = v_class.organization_id and member_id = v_member_id;
  if not found then raise exception using errcode = '42501', message = 'Hanya murid yang dapat mengambil slot'; end if;

  select result into v_result from public.rpc_idempotency_keys
  where member_id = v_member_id and idempotency_key = p_idempotency_key;
  if found and v_result is not null then return v_result; end if;

  insert into public.rpc_idempotency_keys (member_id, idempotency_key, operation)
  values (v_member_id, p_idempotency_key, 'book_available_slot')
  on conflict (member_id, idempotency_key) do nothing;

  if v_class.status <> 'available' then
    raise exception using errcode = 'P0001', message = 'Slot sudah tidak tersedia';
  end if;

  if exists (
    select 1 from public.sensei_external_busy b
    where b.sensei_id = v_class.sensei_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_class.starts_at, v_class.ends_at, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'Sensei sedang tidak tersedia pada jam ini';
  end if;

  update public.classes set
    student_id = v_student.id,
    status = 'pending_confirmation',
    source = 'student_booking',
    notes = nullif(trim(p_notes), '')
  where id = v_class.id
  returning * into v_class;

  insert into public.class_activity_log (
    organization_id, class_id, action, before_data, after_data, performed_by_member_id
  ) values (
    v_class.organization_id, v_class.id, 'student_booked_slot',
    jsonb_build_object('status', 'available'), to_jsonb(v_class), v_member_id
  );

  insert into public.notifications (organization_id, member_id, class_id, type, message)
  select v_class.organization_id, m.id, v_class.id, 'booking_pending', 'Booking baru menunggu persetujuan'
  from public.organization_members m
  where m.organization_id = v_class.organization_id and m.status = 'active'
    and (m.role = 'admin' or m.id = v_member_id or m.id = (
      select s.member_id from public.senseis s where s.id = v_class.sensei_id
    ));

  v_result := jsonb_build_object(
    'ok', true,
    'message', 'Booking berhasil diajukan',
    'class_id', v_class.id,
    'status', v_class.status,
    'version', v_class.version
  );
  update public.rpc_idempotency_keys set result = v_result
  where member_id = v_member_id and idempotency_key = p_idempotency_key;
  return v_result;
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'Jadwal murid atau sensei bentrok dengan kelas lain';
end;
$$;

revoke all on function public.book_available_slot(uuid, text, uuid) from public;
grant execute on function public.book_available_slot(uuid, text, uuid) to authenticated;

revoke insert, update, delete on public.classes from authenticated;
revoke insert, update, delete on public.class_activity_log from authenticated;
revoke all on public.rpc_idempotency_keys from authenticated;

commit;
