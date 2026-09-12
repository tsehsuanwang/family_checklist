create or replace function public.add_family_member_by_email(member_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_family_id uuid;
  member_user_id uuid;
begin
  select family_id
  into current_family_id
  from public.family_members
  where user_id = auth.uid()
    and role = 'parent'
  order by joined_at
  limit 1;

  if current_family_id is null then
    raise exception 'You do not belong to a family';
  end if;

  select id
  into member_user_id
  from auth.users
  where lower(email) = lower(trim(member_email));

  if member_user_id is null then
    raise exception 'No account was found for that email';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (current_family_id, member_user_id, 'parent')
  on conflict (family_id, user_id) do nothing;

  return current_family_id;
end;
$$;

revoke all on function public.add_family_member_by_email(text) from public;
grant execute on function public.add_family_member_by_email(text) to authenticated;