begin;

create or replace function public.admin_create_booking(
  p_organization_id uuid,
  p_sensei_id uuid,
  p_student_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_level text default null,
  p_notes text default null,
  p_meeting_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_class public.classes%rowtype;
begin
  if not public.has_org_role(p_organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Hanya admin yang dapat membuat booking langsung';
  end if;
  v_member_id := public.current_member_id(p_organization_id);
  if p_ends_at <= p_starts_at then
    raise exception using errcode = '22023', message = 'Rentang waktu tidak valid';
  end if;
  if not exists (select 1 from public.senseis where id = p_sensei_id and organization_id = p_organization_id) then
    raise exception using errcode = 'P0002', message = 'Sensei tidak ditemukan';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and organization_id = p_organization_id) then
    raise exception using errcode = 'P0002', message = 'Murid tidak ditemukan';
  end if;
  if exists (
    select 1 from public.sensei_external_busy b
    where b.sensei_id = p_sensei_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'Sensei sedang tidak tersedia pada jam ini';
  end if;

  insert into public.classes (
    organization_id, sensei_id, student_id, starts_at, ends_at, level,
    status, source, notes, meeting_url, created_by_member_id
  ) values (
    p_organization_id, p_sensei_id, p_student_id, p_starts_at, p_ends_at,
    nullif(trim(p_level), ''), 'booked', 'admin_manual',
    nullif(trim(p_notes), ''), nullif(trim(p_meeting_url), ''), v_member_id
  ) returning * into v_class;

  insert into public.class_activity_log (organization_id, class_id, action, after_data, performed_by_member_id)
  values (p_organization_id, v_class.id, 'admin_booking_created', to_jsonb(v_class), v_member_id);

  insert into public.notifications (organization_id, member_id, class_id, type, message)
  select p_organization_id, target.member_id, v_class.id, 'booking_created', 'Admin membuat jadwal kelas baru'
  from (
    select s.member_id from public.senseis s where s.id = p_sensei_id
    union
    select st.member_id from public.students st where st.id = p_student_id
  ) target;

  return jsonb_build_object('ok', true, 'message', 'Kelas berhasil dibuat', 'class_id', v_class.id);
exception
  when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'Jadwal sensei atau murid bentrok dengan kelas lain';
end;
$$;

create or replace function public.admin_update_class_details(
  p_class_id uuid,
  p_expected_version integer,
  p_meeting_url text default null,
  p_notes text default null
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
  if not found then raise exception using errcode = 'P0002', message = 'Kelas tidak ditemukan'; end if;
  if not public.has_org_role(v_class.organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Hanya admin yang dapat mengubah detail kelas';
  end if;
  if v_class.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Data berubah, muat ulang halaman';
  end if;
  if v_class.status in ('cancelled', 'completed', 'available') then
    raise exception using errcode = 'P0001', message = 'Detail hanya dapat diubah pada booking aktif';
  end if;
  v_member_id := public.current_member_id(v_class.organization_id);
  v_before := to_jsonb(v_class);

  update public.classes set
    meeting_url = nullif(trim(p_meeting_url), ''),
    notes = nullif(trim(p_notes), '')
  where id = v_class.id returning * into v_class;

  insert into public.class_activity_log (organization_id, class_id, action, before_data, after_data, performed_by_member_id)
  values (v_class.organization_id, v_class.id, 'class_details_updated', v_before, to_jsonb(v_class), v_member_id);
  return jsonb_build_object('ok', true, 'message', 'Detail kelas diperbarui', 'class_id', v_class.id, 'version', v_class.version);
end;
$$;

create or replace function public.admin_transition_class(
  p_class_id uuid,
  p_expected_version integer,
  p_target_status public.class_status
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
  if not found then raise exception using errcode = 'P0002', message = 'Kelas tidak ditemukan'; end if;
  if not public.has_org_role(v_class.organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Hanya admin yang dapat mengubah status kelas';
  end if;
  if v_class.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Data berubah, muat ulang halaman';
  end if;
  if p_target_status = 'cancelled' and v_class.status not in ('available', 'pending_confirmation', 'booked') then
    raise exception using errcode = 'P0001', message = 'Kelas tidak dapat dibatalkan dari status saat ini';
  elsif p_target_status = 'completed' and v_class.status <> 'booked' then
    raise exception using errcode = 'P0001', message = 'Hanya kelas booked yang dapat diselesaikan';
  elsif p_target_status not in ('cancelled', 'completed') then
    raise exception using errcode = '22023', message = 'Target status tidak diizinkan';
  end if;

  v_member_id := public.current_member_id(v_class.organization_id);
  v_before := to_jsonb(v_class);
  update public.classes set status = p_target_status where id = v_class.id returning * into v_class;
  insert into public.class_activity_log (organization_id, class_id, action, before_data, after_data, performed_by_member_id)
  values (
    v_class.organization_id, v_class.id,
    case when p_target_status = 'cancelled' then 'class_cancelled' else 'class_completed' end,
    v_before, to_jsonb(v_class), v_member_id
  );

  insert into public.notifications (organization_id, member_id, class_id, type, message)
  select v_class.organization_id, target.member_id, v_class.id,
    case when p_target_status = 'cancelled' then 'class_cancelled' else 'class_completed' end,
    case when p_target_status = 'cancelled' then 'Kelas telah dibatalkan oleh admin' else 'Kelas ditandai selesai' end
  from (
    select s.member_id from public.senseis s where s.id = v_class.sensei_id
    union
    select st.member_id from public.students st where st.id = v_class.student_id
  ) target;

  return jsonb_build_object('ok', true, 'message', case when p_target_status = 'cancelled' then 'Kelas dibatalkan' else 'Kelas diselesaikan' end, 'class_id', v_class.id, 'status', v_class.status);
end;
$$;

revoke all on function public.admin_create_booking(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) from public;
revoke all on function public.admin_update_class_details(uuid, integer, text, text) from public;
revoke all on function public.admin_transition_class(uuid, integer, public.class_status) from public;
grant execute on function public.admin_create_booking(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.admin_update_class_details(uuid, integer, text, text) to authenticated;
grant execute on function public.admin_transition_class(uuid, integer, public.class_status) to authenticated;

commit;
