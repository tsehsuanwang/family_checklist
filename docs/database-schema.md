# Supabase Database Schema

The migration in `supabase/migrations/20260911000000_initial_schema.sql` creates the first data model for Kusuma App.

## Access model

- Supabase Auth users represent parents.
- A family is the ownership boundary for children, routines, tasks, and assignments.
- Creating a family automatically adds its creator as a parent member.
- Row-level security currently protects all data for authenticated parent users.
- The PRD does not define child authentication. Until a child PIN, device session, or another child identity mechanism is chosen, the client should use a trusted server action for child views and task completion rather than exposing unrestricted anonymous writes.

## Tables

### `families`

Stores the household or account container. The `created_by` column points to the Supabase Auth user who created it. All family-owned records use `family_id` directly or through a parent record.

### `family_members`

Associates authenticated users with families. The initial role is `parent`; the table is intentionally separate so additional parent accounts or roles can be added without changing every other table.

### `children`

Stores child profiles displayed by the profile picker. `sort_order` controls presentation order, while `is_active` supports archiving a profile without deleting its history.

### `routines`

Stores reusable routine definitions such as “Morning” or “Bedtime.” A routine belongs to a family and contains the parent-editable name, description, color, and icon.

### `tasks`

Stores the ordered checklist items inside a routine. Tasks are reusable through their routine and can be required or optional for progress calculations.

### `routine_assignments`

Connects a routine to a child and defines when it applies. `starts_on`, `ends_on`, and `days_of_week` support recurring schedules without generating a row for every calendar day. Sunday is `0` and Saturday is `6`, matching PostgreSQL's `extract(dow)` convention.

### `task_completions`

Stores a child's completion state for one task on one scheduled date. The unique constraint makes checking a task idempotent and supports unchecking by deleting the row. Progress can be calculated by joining today's assignments, tasks, and completions.

## Future extensions

- Notifications can reference `routine_assignments` or add a notification-preferences table.
- Rewards can reference `children` and `task_completions`.
- Streaks should be derived from completion history or stored in a separate summary table once the rules are defined.
- Child access should add an explicit identity/session model before anonymous RLS policies are introduced.