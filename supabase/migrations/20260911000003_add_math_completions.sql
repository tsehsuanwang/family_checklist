create table public.math_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.routine_assignments(id) on delete cascade,
  question_index integer not null check (question_index >= 0),
  completion_date date not null default current_date,
  submitted_answer integer,
  is_correct boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (assignment_id, question_index, completion_date)
);

create index math_completions_assignment_date_idx
  on public.math_completions (assignment_id, completion_date);

alter table public.math_completions enable row level security;

create policy "Parents can manage math completions"
on public.math_completions for all
to authenticated
using (
  exists (
    select 1
    from public.routine_assignments
    join public.children on children.id = routine_assignments.child_id
    where routine_assignments.id = math_completions.assignment_id
      and public.is_family_parent(children.family_id)
  )
)
with check (
  exists (
    select 1
    from public.routine_assignments
    join public.children on children.id = routine_assignments.child_id
    join public.routines on routines.id = routine_assignments.routine_id
    where routine_assignments.id = math_completions.assignment_id
      and routines.routine_type = 'math'
      and public.is_family_parent(children.family_id)
  )
);
