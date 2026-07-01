begin;

create table public.availability_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sensei_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  weekdays smallint[] not null,
  local_start time not null,
  local_end time not null,
  timezone text not null,
  level text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (sensei_id, organization_id) references public.senseis(id, organization_id) on delete cascade,
  foreign key (created_by_member_id, organization_id) references public.organization_members(id, organization_id) on delete restrict,
  check (ends_on >= starts_on),
  check (local_end > local_start),
  check (cardinality(weekdays) > 0 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
);

alter table public.classes add column availability_series_id uuid;
alter table public.classes add constraint classes_availability_series_fkey
  foreign key (availability_series_id, organization_id)
  references public.availability_series(id, organization_id) on delete set null (availability_series_id);

create index availability_series_sensei_idx on public.availability_series (organization_id, sensei_id, status);
create index classes_availability_series_idx on public.classes (availability_series_id) where availability_series_id is not null;

alter table public.availability_series enable row level security;
create policy availability_series_select_authorized on public.availability_series
for select to authenticated using (
  public.has_org_role(organization_id, array['admin']::public.organization_role[])
  or exists (
    select 1 from public.senseis s
    where s.id = availability_series.sensei_id
      and s.member_id = public.current_member_id(availability_series.organization_id)
  )
);

create trigger availability_series_set_updated_at before update on public.availability_series
for each row execute function public.set_updated_at();

create or replace function public.create_recurring_availability(
  p_sensei_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_weekdays smallint[],
  p_local_start time,
  p_local_end time,
  p_level text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sensei public.senseis%rowtype;
  v_member_id uuid;
  v_timezone text;
  v_slot_minutes integer;
  v_series_id uuid;
  v_date date;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_local_cursor timestamp;
  v_local_end timestamp;
  v_class public.classes%rowtype;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  select * into v_sensei from public.senseis where id = p_sensei_id;
  if not found then raise exception using errcode = 'P0002', message = 'Sensei tidak ditemukan'; end if;
  v_member_id := public.current_member_id(v_sensei.organization_id);
  if v_member_id is null then raise exception using errcode = '42501', message = 'Tidak memiliki akses'; end if;
  if v_sensei.member_id <> v_member_id and not public.has_org_role(v_sensei.organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Tidak boleh membuka jadwal sensei lain';
  end if;
  if p_ends_on < p_starts_on or p_local_end <= p_local_start then
    raise exception using errcode = '22023', message = 'Rentang tanggal atau jam tidak valid';
  end if;
  if cardinality(p_weekdays) = 0 or not (p_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception using errcode = '22023', message = 'Hari berulang tidak valid';
  end if;

  select timezone, slot_duration_minutes into v_timezone, v_slot_minutes
  from public.organizations where id = v_sensei.organization_id;
  if extract(epoch from (p_local_end - p_local_start))::integer % (v_slot_minutes * 60) <> 0 then
    raise exception using errcode = '22023', message = 'Rentang jam harus habis dibagi durasi slot organisasi';
  end if;

  insert into public.availability_series (
    organization_id, sensei_id, starts_on, ends_on, weekdays, local_start, local_end,
    timezone, level, created_by_member_id
  ) values (
    v_sensei.organization_id, p_sensei_id, p_starts_on, p_ends_on, p_weekdays,
    p_local_start, p_local_end, v_timezone, nullif(trim(p_level), ''), v_member_id
  ) returning id into v_series_id;

  for v_date in select value::date from generate_series(p_starts_on, p_ends_on, interval '1 day') value
  loop
    if extract(isodow from v_date)::smallint = any(p_weekdays)
       and v_date >= (now() at time zone v_timezone)::date then
      v_local_cursor := v_date + p_local_start;
      v_local_end := v_date + p_local_end;
      while v_local_cursor < v_local_end loop
        v_slot_start := v_local_cursor at time zone v_timezone;
        v_slot_end := (v_local_cursor + make_interval(mins => v_slot_minutes)) at time zone v_timezone;
        if exists (
          select 1 from public.sensei_external_busy b where b.sensei_id = p_sensei_id
            and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(v_slot_start,v_slot_end,'[)')
        ) or exists (
          select 1 from public.classes c where c.sensei_id = p_sensei_id and c.status <> 'cancelled'
            and tstzrange(c.starts_at,c.ends_at,'[)') && tstzrange(v_slot_start,v_slot_end,'[)')
        ) then
          v_skipped := v_skipped + 1;
        else
          insert into public.classes (
            organization_id, sensei_id, starts_at, ends_at, level, status, source,
            created_by_member_id, availability_series_id
          ) values (
            v_sensei.organization_id, p_sensei_id, v_slot_start, v_slot_end,
            nullif(trim(p_level), ''), 'available', 'sensei_availability', v_member_id, v_series_id
          ) returning * into v_class;
          insert into public.class_activity_log (organization_id,class_id,action,after_data,performed_by_member_id)
          values (v_sensei.organization_id,v_class.id,'recurring_availability_opened',to_jsonb(v_class),v_member_id);
          v_created := v_created + 1;
        end if;
        v_local_cursor := v_local_cursor + make_interval(mins => v_slot_minutes);
      end loop;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'message','Availability berulang berhasil dibuat','series_id',v_series_id,'created_count',v_created,'skipped_count',v_skipped);
end;
$$;

create or replace function public.update_recurring_availability(
  p_series_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_weekdays smallint[],
  p_local_start time,
  p_local_end time,
  p_level text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.availability_series%rowtype;
  v_member_id uuid;
  v_slot_minutes integer;
  v_date date;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_local_cursor timestamp;
  v_local_end timestamp;
  v_class public.classes%rowtype;
  v_created integer := 0;
  v_skipped integer := 0;
  v_cancelled integer := 0;
begin
  select * into v_series from public.availability_series where id = p_series_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Rangkaian availability tidak ditemukan'; end if;
  if v_series.status <> 'active' then raise exception using errcode = 'P0001', message = 'Rangkaian sudah dibatalkan'; end if;
  v_member_id := public.current_member_id(v_series.organization_id);
  if not public.has_org_role(v_series.organization_id,array['admin']::public.organization_role[])
     and not exists (select 1 from public.senseis s where s.id=v_series.sensei_id and s.member_id=v_member_id) then
    raise exception using errcode='42501',message='Tidak boleh mengubah rangkaian ini';
  end if;
  if p_ends_on < p_starts_on or p_local_end <= p_local_start or cardinality(p_weekdays)=0
     or not (p_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception using errcode='22023',message='Rentang atau hari berulang tidak valid';
  end if;
  select slot_duration_minutes into v_slot_minutes from public.organizations where id=v_series.organization_id;
  if extract(epoch from (p_local_end-p_local_start))::integer % (v_slot_minutes*60) <> 0 then
    raise exception using errcode='22023',message='Rentang jam harus habis dibagi durasi slot organisasi';
  end if;

  with closed as (
    update public.classes set status='cancelled'
    where availability_series_id=p_series_id and status='available' and ends_at>=now()
    returning *
  ), logged as (
    insert into public.class_activity_log (organization_id,class_id,action,after_data,performed_by_member_id)
    select organization_id,id,'recurring_availability_replaced',to_jsonb(closed),v_member_id from closed returning 1
  ) select count(*) into v_cancelled from logged;

  update public.availability_series set
    starts_on=p_starts_on,ends_on=p_ends_on,weekdays=p_weekdays,
    local_start=p_local_start,local_end=p_local_end,level=nullif(trim(p_level),'')
  where id=p_series_id returning * into v_series;

  for v_date in select value::date from generate_series(greatest(p_starts_on,(now() at time zone v_series.timezone)::date),p_ends_on,interval '1 day') value
  loop
    if extract(isodow from v_date)::smallint=any(p_weekdays) then
      v_local_cursor:=v_date+p_local_start; v_local_end:=v_date+p_local_end;
      while v_local_cursor<v_local_end loop
        v_slot_start:=v_local_cursor at time zone v_series.timezone;
        v_slot_end:=(v_local_cursor+make_interval(mins=>v_slot_minutes)) at time zone v_series.timezone;
        if exists (select 1 from public.sensei_external_busy b where b.sensei_id=v_series.sensei_id and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(v_slot_start,v_slot_end,'[)'))
           or exists (select 1 from public.classes c where c.sensei_id=v_series.sensei_id and c.status<>'cancelled' and tstzrange(c.starts_at,c.ends_at,'[)')&&tstzrange(v_slot_start,v_slot_end,'[)')) then
          v_skipped:=v_skipped+1;
        else
          insert into public.classes (organization_id,sensei_id,starts_at,ends_at,level,status,source,created_by_member_id,availability_series_id)
          values (v_series.organization_id,v_series.sensei_id,v_slot_start,v_slot_end,nullif(trim(p_level),''),'available','sensei_availability',v_member_id,p_series_id)
          returning * into v_class;
          insert into public.class_activity_log (organization_id,class_id,action,after_data,performed_by_member_id)
          values (v_series.organization_id,v_class.id,'recurring_availability_updated',to_jsonb(v_class),v_member_id);
          v_created:=v_created+1;
        end if;
        v_local_cursor:=v_local_cursor+make_interval(mins=>v_slot_minutes);
      end loop;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'message','Rangkaian availability diperbarui','series_id',p_series_id,'cancelled_count',v_cancelled,'created_count',v_created,'skipped_count',v_skipped);
end;
$$;

create or replace function public.cancel_recurring_availability(p_series_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_series public.availability_series%rowtype;
  v_member_id uuid;
  v_cancelled integer:=0;
begin
  select * into v_series from public.availability_series where id=p_series_id for update;
  if not found then raise exception using errcode='P0002',message='Rangkaian availability tidak ditemukan'; end if;
  v_member_id:=public.current_member_id(v_series.organization_id);
  if not public.has_org_role(v_series.organization_id,array['admin']::public.organization_role[])
     and not exists(select 1 from public.senseis s where s.id=v_series.sensei_id and s.member_id=v_member_id) then
    raise exception using errcode='42501',message='Tidak boleh membatalkan rangkaian ini';
  end if;
  with closed as (
    update public.classes set status='cancelled'
    where availability_series_id=p_series_id and status='available' and ends_at>=now()
    returning *
  ), logged as (
    insert into public.class_activity_log (organization_id,class_id,action,after_data,performed_by_member_id)
    select organization_id,id,'recurring_availability_cancelled',to_jsonb(closed),v_member_id from closed returning 1
  ) select count(*) into v_cancelled from logged;
  update public.availability_series set status='cancelled' where id=p_series_id;
  return jsonb_build_object('ok',true,'message','Rangkaian availability dibatalkan','series_id',p_series_id,'cancelled_count',v_cancelled);
end;
$$;

revoke all on function public.create_recurring_availability(uuid,date,date,smallint[],time,time,text) from public;
revoke all on function public.update_recurring_availability(uuid,date,date,smallint[],time,time,text) from public;
revoke all on function public.cancel_recurring_availability(uuid) from public;
grant execute on function public.create_recurring_availability(uuid,date,date,smallint[],time,time,text) to authenticated;
grant execute on function public.update_recurring_availability(uuid,date,date,smallint[],time,time,text) to authenticated;
grant execute on function public.cancel_recurring_availability(uuid) to authenticated;

commit;
