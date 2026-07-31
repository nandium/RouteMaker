# Contributing

Prefer deletion and direct code over compatibility branches or speculative
layers. Extract a shared abstraction when three real callers make it clearer.

Keep constants consolidated at the narrowest useful scope:

- API paths and wire types: `app/src/client-contract.ts`
- visual tokens: `app/theme.css`
- detector constants: `app/web/yolo.ts`
- Worker limits and shared runtime values: `worker/src/shared.ts`

The API remains three cohesive domains: auth/profile, routes/social, and admin.
Do not add repositories, service classes, queues, or provider interfaces until
measured change pressure earns them.

Comments should explain why a boundary or non-obvious flow exists. Obvious code
does not need narration. Complex functions deserve a short, intuitive flow
summary in their current scope.

Run the checks in the root README before requesting review.
