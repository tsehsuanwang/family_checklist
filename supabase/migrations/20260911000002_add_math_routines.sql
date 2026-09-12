alter table public.routines
  add column routine_type text not null default 'checklist'
    check (routine_type in ('checklist', 'math')),
  add column math_difficulty text not null default 'grade_1'
    check (math_difficulty in ('grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 'grade_6')),
  add column math_operations text[] not null default array['addition']::text[],
  add column math_question_count integer not null default 5
    check (math_question_count between 1 and 20);

alter table public.routines
  add constraint routines_math_operations_check
  check (
    cardinality(math_operations) > 0
    and math_operations <@ array['addition', 'subtraction', 'multiplication', 'division']::text[]
  );
