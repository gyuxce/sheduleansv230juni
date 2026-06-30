begin;

create or replace function public.admin_register_member(
  p_organization_id uuid,
  p_profile_id uuid,
  p_role public.organization_role,
  p_full_name text,
  p_level text default null,
  p_can_self_book boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.organization_members%rowtype;
  v_entity_id uuid;
begin
  if not public.has_org_role(p_organization_id, array['admin']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'Hanya admin yang dapat menambahkan anggota';
  end if;
  if p_role not in ('sensei', 'murid') then
    raise exception using errcode = '22023', message = 'Role hanya boleh sensei atau murid';
  end if;
  if length(trim(p_full_name)) < 2 then
    raise exception using errcode = '22023', message = 'Nama lengkap terlalu pendek';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception using errcode = 'P0002', message = 'Profil user belum tersedia';
  end if;

  update public.profiles set full_name = trim(p_full_name) where id = p_profile_id;
  insert into public.organization_members (organization_id, profile_id, role, status)
  values (p_organization_id, p_profile_id, p_role, 'active')
  returning * into v_member;

  if p_role = 'sensei' then
    insert into public.senseis (organization_id, member_id, teaching_levels, can_self_book)
    values (
      p_organization_id,
      v_member.id,
      case when nullif(trim(p_level), '') is null then '{}'::text[] else array[trim(p_level)] end,
      p_can_self_book
    ) returning id into v_entity_id;
  else
    insert into public.students (organization_id, member_id, current_level)
    values (p_organization_id, v_member.id, nullif(trim(p_level), ''))
    returning id into v_entity_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', case when p_role = 'sensei' then 'Sensei berhasil diundang' else 'Murid berhasil diundang' end,
    'member_id', v_member.id,
    'entity_id', v_entity_id,
    'role', p_role
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'User sudah terdaftar di organisasi ini';
end;
$$;

revoke all on function public.admin_register_member(uuid, uuid, public.organization_role, text, text, boolean) from public;
grant execute on function public.admin_register_member(uuid, uuid, public.organization_role, text, text, boolean) to authenticated;

commit;
