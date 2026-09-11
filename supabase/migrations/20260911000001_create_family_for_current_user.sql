create or replace function public.create_family_for_current_user(family_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.families (name, created_by)
  values (trim(family_name), auth.uid())
  returning id into new_family_id;

  return new_family_id;
end;
$$;

revoke all on function public.create_family_for_current_user(text) from public;
grant execute on function public.create_family_for_current_user(text) to authenticated;
