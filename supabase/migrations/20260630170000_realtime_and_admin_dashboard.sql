begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'classes'
  ) then
    alter publication supabase_realtime add table public.classes;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create or replace function public.get_admin_dashboard_stats(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_today date;
  v_week_start date;
  v_result jsonb;
begin
  if not public.has_org_role(p_organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Hanya admin yang dapat melihat statistik';
  end if;

  select timezone into v_timezone from public.organizations where id = p_organization_id;
  if not found then raise exception using errcode = 'P0002', message = 'Organisasi tidak ditemukan'; end if;
  v_today := (now() at time zone v_timezone)::date;
  v_week_start := date_trunc('week', v_today::timestamp)::date;

  select jsonb_build_object(
    'total_senseis', (select count(*) from public.senseis where organization_id = p_organization_id),
    'total_students', (select count(*) from public.students where organization_id = p_organization_id),
    'classes_today', (
      select count(*) from public.classes
      where organization_id = p_organization_id and status = 'booked'
        and (starts_at at time zone v_timezone)::date = v_today
    ),
    'classes_this_week', (
      select count(*) from public.classes
      where organization_id = p_organization_id and status in ('pending_confirmation', 'booked', 'completed')
        and (starts_at at time zone v_timezone)::date >= v_week_start
        and (starts_at at time zone v_timezone)::date < v_week_start + 7
    ),
    'pending_approval', (
      select count(*) from public.classes where organization_id = p_organization_id and status = 'pending_confirmation'
    ),
    'available_slots', (
      select count(*) from public.classes
      where organization_id = p_organization_id and status = 'available' and ends_at > now()
    ),
    'utilization', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sensei_id', summary.sensei_id,
        'name', summary.full_name,
        'booked_minutes', summary.booked_minutes,
        'available_minutes', summary.available_minutes,
        'percentage', case
          when summary.booked_minutes + summary.available_minutes = 0 then 0
          else round(100.0 * summary.booked_minutes / (summary.booked_minutes + summary.available_minutes), 1)
        end
      ) order by summary.full_name)
      from (
        select s.id as sensei_id, coalesce(p.full_name, 'Sensei') as full_name,
          coalesce(sum(extract(epoch from (c.ends_at - c.starts_at)) / 60) filter (where c.status in ('booked','completed')), 0)::numeric as booked_minutes,
          coalesce(sum(extract(epoch from (c.ends_at - c.starts_at)) / 60) filter (where c.status = 'available'), 0)::numeric as available_minutes
        from public.senseis s
        join public.organization_members m on m.id = s.member_id
        join public.profiles p on p.id = m.profile_id
        left join public.classes c on c.sensei_id = s.id
          and c.starts_at >= now() - interval '30 days'
          and c.starts_at < now() + interval '30 days'
        where s.organization_id = p_organization_id
        group by s.id, p.full_name
      ) summary
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_dashboard_stats(uuid) from public;
grant execute on function public.get_admin_dashboard_stats(uuid) to authenticated;

commit;
