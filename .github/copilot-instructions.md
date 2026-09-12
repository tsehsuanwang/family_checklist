# Kusuma App Project Instructions

This project is a family checklist application.

## Tech Stack

- Next.js with the App Router
- TypeScript
- Tailwind CSS
- Supabase

## Development Guidelines

- Design mobile-first and ensure layouts remain usable on larger screens.
- Prefer simple, readable code over clever abstractions.
- Use strong TypeScript types; avoid `any` unless there is a documented reason.
- Extract reusable UI and logic when it is shared or clearly represents a domain concept.
- Keep components small and focused on one responsibility.
- Use semantic HTML and accessible interaction patterns, including keyboard support, visible focus states, labels, and appropriate ARIA only when needed.
- Prefer Server Components by default. Add `"use client"` only when client-side state, effects, browser APIs, or event handlers require it.
- Keep Supabase access on the server when possible. Never expose service-role credentials to the browser.
- Keep database queries, mutations, and authorization aligned with the Supabase schema and Row Level Security policies.
- Preserve existing project conventions and avoid unrelated refactors.
- Use the existing Tailwind setup rather than introducing additional styling systems without a clear need.
- Add focused validation for changed behavior and keep user-facing error states understandable.

## Validation

Before finishing a code change, run the relevant checks. For application changes, run:

```sh
npm run lint
npm run build
```

Keep changes scoped to the requested behavior and update documentation when a change affects project conventions or data contracts.
