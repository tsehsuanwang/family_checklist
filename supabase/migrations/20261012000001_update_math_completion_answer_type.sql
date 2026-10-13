alter table public.math_completions
  alter column submitted_answer type text
  using submitted_answer::text;
