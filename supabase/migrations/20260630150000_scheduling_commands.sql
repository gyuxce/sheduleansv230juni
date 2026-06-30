begin;

create or replace function public.open_availability(
  p_sensei_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_level text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sensei public.senseis%rowtype;
  v_member_id uuid;
  v_slot_minutes integer;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_class public.classes%rowtype;
  v_created integer := 0;
begin
  select * into v_sensei from public.senseis where id = p_sensei_id;
  if not found then raise exception using errcode = 'P0002', message = 'Sensei tidak ditemukan'; end if;
  v_member_id := public.current_member_id(v_sensei.organization_id);
  if v_member_id is null then raise exception using errcode = '42501', message = 'Tidak memiliki akses'; end if;
  if v_sensei.member_id <> v_member_id
     and not public.has_org_role(v_sensei.organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Tidak boleh membuka jadwal sensei lain';
  end if;
  if p_ends_at <= p_starts_at then raise exception using errcode = '22023', message = 'Rentang waktu tidak valid'; end if;

  select slot_duration_minutes into v_slot_minutes
  from public.organizations where id = v_sensei.organization_id;
  if extract(epoch from (p_ends_at - p_starts_at))::integer % (v_slot_minutes * 60) <> 0 then
    raise exception using errcode = '22023', message = 'Rentang harus habis dibagi durasi slot organisasi';
  end if;

  for v_slot_start in
    select generate_series(
      p_starts_at,
      p_ends_at - make_interval(mins => v_slot_minutes),
      make_interval(mins => v_slot_minutes)
    )
  loop
    v_slot_end := v_slot_start + make_interval(mins => v_slot_minutes);

    if exists (
      select 1 from public.sensei_external_busy b
      where b.sensei_id = p_sensei_id
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
    ) then
      raise exception using errcode = 'P0001', message = 'Rentang bertabrakan dengan jadwal eksternal';
    end if;

    if exists (
      select 1 from public.classes c
      where c.sensei_id = p_sensei_id and c.status <> 'cancelled'
        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
    ) then
      raise exception using errcode = 'P0001', message = 'Rentang bertabrakan dengan slot atau kelas yang sudah ada';
    end if;

    insert into public.classes (
      organization_id, sensei_id, starts_at, ends_at, level, status, source, created_by_member_id
    ) values (
      v_sensei.organization_id, p_sensei_id, v_slot_start, v_slot_end,
      nullif(trim(p_level), ''), 'available', 'sensei_availability', v_member_id
    ) returning * into v_class;

    insert into public.class_activity_log (
      organization_id, class_id, action, after_data, performed_by_member_id
    ) values (
      v_sensei.organization_id, v_class.id, 'availability_opened', to_jsonb(v_class), v_member_id
    );
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('ok', true, 'message', 'Ketersediaan berhasil dibuka', 'created_count', v_created);
end;
$$;

create or replace function public.cancel_available_slot(
  p_class_id uuid,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classes%rowtype;
  v_before jsonb;
  v_member_id uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Slot tidak ditemukan'; end if;
  v_member_id := public.current_member_id(v_class.organization_id);
  if v_member_id is null then raise exception using errcode = '42501', message = 'Tidak memiliki akses'; end if;
  if not public.has_org_role(v_class.organization_id, array['admin']::public.organization_role[])
     and not exists (select 1 from public.senseis s where s.id = v_class.sensei_id and s.member_id = v_member_id) then
    raise exception using errcode = '42501', message = 'Tidak boleh menutup slot ini';
  end if;
  if v_class.status <> 'available' then raise exception using errcode = 'P0001', message = 'Hanya slot available yang dapat ditutup'; end if;
  if v_class.version <> p_expected_version then raise exception using errcode = '40001', message = 'Data berubah, muat ulang halaman'; end if;

  v_before := to_jsonb(v_class);
  update public.classes set status = 'cancelled' where id = v_class.id returning * into v_class;
  insert into public.class_activity_log (organization_id, class_id, action, before_data, after_data, performed_by_member_id)
  values (v_class.organization_id, v_class.id, 'availability_cancelled', v_before, to_jsonb(v_class), v_member_id);
  return jsonb_build_object('ok', true, 'message', 'Slot ditutup', 'class_id', v_class.id);
end;
$$;

create or replace function public.create_direct_booking(
  p_sensei_id uuid,
  p_student_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_level text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sensei public.senseis%rowtype;
  v_student public.students%rowtype;
  v_member_id uuid;
  v_source public.class_source;
  v_class public.classes%rowtype;
begin
  select * into v_sensei from public.senseis where id = p_sensei_id;
  if not found then raise exception using errcode = 'P0002', message = 'Sensei tidak ditemukan'; end if;
  select * into v_student from public.students where id = p_student_id and organization_id = v_sensei.organization_id;
  if not found then raise exception using errcode = 'P0002', message = 'Murid tidak ditemukan di organisasi ini'; end if;
  v_member_id := public.current_member_id(v_sensei.organization_id);
  if v_member_id is null then raise exception using errcode = '42501', message = 'Tidak memiliki akses'; end if;

  if public.has_org_role(v_sensei.organization_id, array['admin']::public.organization_role[]) then
    v_source := 'admin_manual';
  elsif v_sensei.member_id = v_member_id and v_sensei.can_self_book then
    v_source := 'sensei_self_input';
  else
    raise exception using errcode = '42501', message = 'Sensei belum memiliki izin input booking manual';
  end if;
  if p_ends_at <= p_starts_at then raise exception using errcode = '22023', message = 'Rentang waktu tidak valid'; end if;
  if exists (
    select 1 from public.sensei_external_busy b
    where b.sensei_id = p_sensei_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then raise exception using errcode = 'P0001', message = 'Sensei sedang tidak tersedia pada jam ini'; end if;

  insert into public.classes (
    organization_id, sensei_id, student_id, starts_at, ends_at, level,
    status, source, notes, created_by_member_id
  ) values (
    v_sensei.organization_id, p_sensei_id, p_student_id, p_starts_at, p_ends_at,
    nullif(trim(p_level), ''), 'pending_confirmation', v_source,
    nullif(trim(p_notes), ''), v_member_id
  ) returning * into v_class;

  insert into public.class_activity_log (organization_id, class_id, action, after_data, performed_by_member_id)
  values (v_class.organization_id, v_class.id, 'direct_booking_created', to_jsonb(v_class), v_member_id);
  insert into public.notifications (organization_id, member_id, class_id, type, message)
  select v_class.organization_id, m.id, v_class.id, 'booking_pending', 'Booking manual menunggu persetujuan'
  from public.organization_members m
  where m.organization_id = v_class.organization_id and m.status = 'active'
    and (m.role = 'admin' or m.id in (v_sensei.member_id, v_student.member_id));
  return jsonb_build_object('ok', true, 'message', 'Booking berhasil diajukan', 'class_id', v_class.id);
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'Jadwal murid atau sensei bentrok dengan kelas lain';
end;
$$;

create or replace function public.decide_booking(
  p_class_id uuid,
  p_approve boolean,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.classes%rowtype;
  v_before jsonb;
  v_member_id uuid;
begin
  select * into v_class from public.classes where id = p_class_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Booking tidak ditemukan'; end if;
  v_member_id := public.current_member_id(v_class.organization_id);
  if not public.has_org_role(v_class.organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Hanya admin yang dapat memutuskan booking';
  end if;
  if v_class.status <> 'pending_confirmation' then raise exception using errcode = 'P0001', message = 'Booking tidak lagi menunggu persetujuan'; end if;
  if v_class.version <> p_expected_version then raise exception using errcode = '40001', message = 'Data berubah, muat ulang halaman'; end if;

  v_before := to_jsonb(v_class);
  update public.classes set status = case when p_approve then 'booked'::public.class_status else 'cancelled'::public.class_status end
  where id = v_class.id returning * into v_class;
  insert into public.class_activity_log (organization_id, class_id, action, before_data, after_data, performed_by_member_id)
  values (v_class.organization_id, v_class.id, case when p_approve then 'booking_approved' else 'booking_rejected' end, v_before, to_jsonb(v_class), v_member_id);
  insert into public.notifications (organization_id, member_id, class_id, type, message)
  select v_class.organization_id, target.member_id, v_class.id,
    case when p_approve then 'booking_approved' else 'booking_rejected' end,
    case when p_approve then 'Booking telah disetujui' else 'Booking ditolak' end
  from (
    select s.member_id from public.senseis s where s.id = v_class.sensei_id
    union
    select st.member_id from public.students st where st.id = v_class.student_id
  ) target;
  return jsonb_build_object('ok', true, 'message', case when p_approve then 'Booking disetujui' else 'Booking ditolak' end, 'class_id', v_class.id, 'status', v_class.status);
end;
$$;

create or replace function public.create_external_busy(
  p_sensei_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_source text default 'Pekerjaan lain',
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sensei public.senseis%rowtype;
  v_member_id uuid;
  v_busy_id uuid;
  v_closed integer;
begin
  select * into v_sensei from public.senseis where id = p_sensei_id;
  if not found then raise exception using errcode = 'P0002', message = 'Sensei tidak ditemukan'; end if;
  v_member_id := public.current_member_id(v_sensei.organization_id);
  if v_member_id is null then raise exception using errcode = '42501', message = 'Tidak memiliki akses'; end if;
  if v_sensei.member_id <> v_member_id
     and not public.has_org_role(v_sensei.organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Tidak boleh mengubah jadwal sensei lain';
  end if;
  if p_ends_at <= p_starts_at then raise exception using errcode = '22023', message = 'Rentang waktu tidak valid'; end if;
  if exists (
    select 1 from public.classes c
    where c.sensei_id = p_sensei_id and c.status in ('pending_confirmation','booked','completed')
      and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then raise exception using errcode = 'P0001', message = 'Blok eksternal bertabrakan dengan booking aktif'; end if;

  with closed_slots as (
    update public.classes set status = 'cancelled'
    where sensei_id = p_sensei_id and status = 'available'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    returning *
  )
  insert into public.class_activity_log (
    organization_id, class_id, action, after_data, performed_by_member_id
  )
  select organization_id, id, 'availability_cancelled_by_external_busy', to_jsonb(closed_slots), v_member_id
  from closed_slots;
  get diagnostics v_closed = row_count;

  insert into public.sensei_external_busy (organization_id, sensei_id, starts_at, ends_at, source, notes)
  values (v_sensei.organization_id, p_sensei_id, p_starts_at, p_ends_at, coalesce(nullif(trim(p_source), ''), 'Pekerjaan lain'), nullif(trim(p_notes), ''))
  returning id into v_busy_id;
  return jsonb_build_object('ok', true, 'message', 'Jadwal eksternal ditambahkan', 'busy_id', v_busy_id, 'closed_availability_count', v_closed);
end;
$$;

revoke all on function public.open_availability(uuid, timestamptz, timestamptz, text) from public;
revoke all on function public.cancel_available_slot(uuid, integer) from public;
revoke all on function public.create_direct_booking(uuid, uuid, timestamptz, timestamptz, text, text) from public;
revoke all on function public.decide_booking(uuid, boolean, integer) from public;
revoke all on function public.create_external_busy(uuid, timestamptz, timestamptz, text, text) from public;
grant execute on function public.open_availability(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.cancel_available_slot(uuid, integer) to authenticated;
grant execute on function public.create_direct_booking(uuid, uuid, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.decide_booking(uuid, boolean, integer) to authenticated;
grant execute on function public.create_external_busy(uuid, timestamptz, timestamptz, text, text) to authenticated;

commit;
