begin;

create or replace function public.get_student_dashboard(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_student_id uuid;
  v_next_class jsonb;
  v_result jsonb;
begin
  v_member_id := public.current_member_id(p_organization_id);
  if v_member_id is null then
    raise exception using errcode = '42501', message = 'Tidak memiliki akses ke organisasi';
  end if;

  select id into v_student_id
  from public.students
  where organization_id = p_organization_id and member_id = v_member_id;
  if not found then
    raise exception using errcode = '42501', message = 'Profil murid tidak ditemukan';
  end if;

  select jsonb_build_object(
    'id', c.id,
    'starts_at', c.starts_at,
    'ends_at', c.ends_at,
    'level', c.level,
    'meeting_url', c.meeting_url,
    'sensei_name', coalesce(p.full_name, 'Sensei')
  ) into v_next_class
  from public.classes c
  join public.senseis s on s.id = c.sensei_id
  join public.organization_members m on m.id = s.member_id
  join public.profiles p on p.id = m.profile_id
  where c.organization_id = p_organization_id
    and c.student_id = v_student_id
    and c.status = 'booked'
    and c.ends_at >= now()
  order by c.starts_at
  limit 1;

  select jsonb_build_object(
    'next_class', v_next_class,
    'pending_count', (
      select count(*) from public.classes
      where organization_id = p_organization_id
        and student_id = v_student_id
        and status = 'pending_confirmation'
    ),
    'completed_count', (
      select count(*) from public.classes
      where organization_id = p_organization_id
        and student_id = v_student_id
        and status = 'completed'
    ),
    'booked_count', (
      select count(*) from public.classes
      where organization_id = p_organization_id
        and student_id = v_student_id
        and status = 'booked'
        and ends_at >= now()
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_student_dashboard(uuid) from public;
grant execute on function public.get_student_dashboard(uuid) to authenticated;

commit;
