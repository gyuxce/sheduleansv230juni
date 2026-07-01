begin;

create or replace function public.get_sensei_dashboard(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_sensei_id uuid;
  v_timezone text;
  v_today date;
  v_next_class jsonb;
  v_result jsonb;
begin
  v_member_id := public.current_member_id(p_organization_id);
  if v_member_id is null then
    raise exception using errcode = '42501', message = 'Tidak memiliki akses ke organisasi';
  end if;

  select id into v_sensei_id
  from public.senseis
  where organization_id = p_organization_id and member_id = v_member_id;
  if not found then
    raise exception using errcode = '42501', message = 'Profil sensei tidak ditemukan';
  end if;

  select timezone into v_timezone from public.organizations where id = p_organization_id;
  v_today := (now() at time zone v_timezone)::date;

  select jsonb_build_object(
    'id', c.id,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'level', c.level,
    'meeting_url', c.meeting_url,
    'student_name', coalesce(p.full_name, 'Murid')
  ) into v_next_class
  from public.classes c
  join public.students st on st.id = c.student_id
  join public.organization_members m on m.id = st.member_id
  join public.profiles p on p.id = m.profile_id
  where c.organization_id = p_organization_id
    and c.sensei_id = v_sensei_id
    and c.status = 'booked'
    and c.ends_at >= now()
  order by c.starts_at
  limit 1;

  select jsonb_build_object(
    'next_class', v_next_class,
    'classes_today', (
      select count(*) from public.classes
      where organization_id = p_organization_id
        and sensei_id = v_sensei_id
        and status = 'booked'
        and (starts_at at time zone v_timezone)::date = v_today
    ),
    'pending_count', (
      select count(*) from public.classes
      where organization_id = p_organization_id
        and sensei_id = v_sensei_id
        and status = 'pending_confirmation'
    ),
    'available_count', (
      select count(*) from public.classes
      where organization_id = p_organization_id
        and sensei_id = v_sensei_id
        and status = 'available'
        and ends_at >= now()
    ),
    'active_students', (
      select count(distinct student_id) from public.classes
      where organization_id = p_organization_id
        and sensei_id = v_sensei_id
        and student_id is not null
        and status in ('pending_confirmation', 'booked', 'completed')
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.delete_external_busy(p_busy_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_busy public.sensei_external_busy%rowtype;
  v_member_id uuid;
begin
  select * into v_busy from public.sensei_external_busy where id = p_busy_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Blok jadwal tidak ditemukan';
  end if;

  v_member_id := public.current_member_id(v_busy.organization_id);
  if v_member_id is null then
    raise exception using errcode = '42501', message = 'Tidak memiliki akses';
  end if;
  if not public.has_org_role(v_busy.organization_id, array['admin']::public.organization_role[])
     and not exists (
       select 1 from public.senseis s
       where s.id = v_busy.sensei_id and s.member_id = v_member_id
     ) then
    raise exception using errcode = '42501', message = 'Tidak boleh menghapus blok jadwal ini';
  end if;

  delete from public.sensei_external_busy where id = v_busy.id;
  return jsonb_build_object('ok', true, 'message', 'Blok jadwal berhasil dihapus', 'busy_id', v_busy.id);
end;
$$;

revoke all on function public.get_sensei_dashboard(uuid) from public;
revoke all on function public.delete_external_busy(uuid) from public;
grant execute on function public.get_sensei_dashboard(uuid) to authenticated;
grant execute on function public.delete_external_busy(uuid) to authenticated;

commit;
