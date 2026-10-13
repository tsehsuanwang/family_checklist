alter table public.routines
  drop constraint if exists routines_math_operations_check;

alter table public.routines
  add constraint routines_math_operations_check
  check (
    cardinality(math_operations) > 0
    and math_operations <@ array[
      'addition',
      'subtraction',
      'multiplication',
      'division',
      'time',
      'area',
      'perimeter',
      'shapes'
    ]::text[]
  );
