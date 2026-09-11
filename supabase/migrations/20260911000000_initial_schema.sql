create extension if not exists "pgcrypto";

create type public.family_member_role as enum ('parent');

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_member_role not null default 'parent',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  color text,
  icon text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_assignments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  days_of_week smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[],
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  check (cardinality(days_of_week) > 0),
  check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.routine_assignments(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  completion_date date not null default current_date,
  completed_at timestamptz not null default now(),
  unique (assignment_id, task_id, completion_date)
);

create or replace function public.add_family_creator_as_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.created_by, 'parent');
  return new;
end;
$$;

create trigger families_add_creator_as_parent
after insert on public.families
for each row execute function public.add_family_creator_as_parent();

create index family_members_user_id_idx on public.family_members (user_id);
create index children_family_id_idx on public.children (family_id);
create index routines_family_id_idx on public.routines (family_id);
create index tasks_routine_id_sort_order_idx on public.tasks (routine_id, sort_order);
create index routine_assignments_child_id_idx on public.routine_assignments (child_id);
create index routine_assignments_routine_id_idx on public.routine_assignments (routine_id);
create index task_completions_assignment_date_idx on public.task_completions (assignment_id, completion_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger families_set_updated_at
before update on public.families
for each row execute function public.set_updated_at();

create trigger children_set_updated_at
before update on public.children
for each row execute function public.set_updated_at();

create trigger routines_set_updated_at
before update on public.routines
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger routine_assignments_set_updated_at
before update on public.routine_assignments
for each row execute function public.set_updated_at();

create or replace function public.is_family_parent(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
      and role = 'parent'
  );
$$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.children enable row level security;
alter table public.routines enable row level security;
alter table public.tasks enable row level security;
alter table public.routine_assignments enable row level security;
alter table public.task_completions enable row level security;

create policy "Parents can view their families"
on public.families for select
using (public.is_family_parent(id));

create policy "Authenticated users can create families"
on public.families for insert
to authenticated
with check (created_by = auth.uid());

create policy "Parents can update their families"
on public.families for update
using (public.is_family_parent(id))
with check (public.is_family_parent(id));

create policy "Parents can view family members"
on public.family_members for select
using (public.is_family_parent(family_id));

create policy "Parents can manage family members"
on public.family_members for all
to authenticated
using (public.is_family_parent(family_id))
with check (public.is_family_parent(family_id) and role = 'parent');

create policy "Parents can manage children"
on public.children for all
to authenticated
using (public.is_family_parent(family_id))
with check (public.is_family_parent(family_id));

create policy "Parents can manage routines"
on public.routines for all
to authenticated
using (public.is_family_parent(family_id))
with check (public.is_family_parent(family_id) and created_by = auth.uid());

create policy "Parents can manage tasks"
on public.tasks for all
to authenticated
using (
  exists (
    select 1
    from public.routines
    where routines.id = tasks.routine_id
      and public.is_family_parent(routines.family_id)
  )
)
with check (
  exists (
    select 1
    from public.routines
    where routines.id = tasks.routine_id
      and public.is_family_parent(routines.family_id)
  )
);

create policy "Parents can manage routine assignments"
on public.routine_assignments for all
to authenticated
using (
  exists (
    select 1
    from public.children
    where children.id = routine_assignments.child_id
      and public.is_family_parent(children.family_id)
  )
)
with check (
  exists (
    select 1
    from public.children
    join public.routines on routines.family_id = children.family_id
    where children.id = routine_assignments.child_id
      and routines.id = routine_assignments.routine_id
      and public.is_family_parent(children.family_id)
  )
);

create policy "Parents can manage task completions"
on public.task_completions for all
to authenticated
using (
  exists (
    select 1
    from public.routine_assignments
    join public.children on children.id = routine_assignments.child_id
    where routine_assignments.id = task_completions.assignment_id
      and public.is_family_parent(children.family_id)
  )
)
with check (
  exists (
    select 1
    from public.routine_assignments
    join public.children on children.id = routine_assignments.child_id
    join public.routines on routines.id = routine_assignments.routine_id
    join public.tasks on tasks.id = task_completions.task_id
    where routine_assignments.id = task_completions.assignment_id
      and routines.id = tasks.routine_id
      and public.is_family_parent(children.family_id)
  )
);
