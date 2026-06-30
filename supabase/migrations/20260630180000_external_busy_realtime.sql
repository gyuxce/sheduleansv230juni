begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sensei_external_busy'
  ) then
    alter publication supabase_realtime add table public.sensei_external_busy;
  end if;
end;
$$;

commit;
