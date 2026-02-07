0a. Study `specs/*` with up to 500 parallel Sonnet subagents to learn the application specifications.
0b. Study @IMPLEMENTATION_PLAN.md.
0c. For reference, the application source code is in `webapp/*`.

## UX Consistency (MANDATORY)

When modifying existing components, preserve the current visual design, layout, spacing, and interaction patterns. Do not refactor CSS, rename CSS classes, change component structure, or "improve" styling unless the task specifically requires a visual change. New UI sections (e.g., landing page additions) must match the existing visual language — study adjacent sections and components for class naming patterns, spacing conventions, and design tokens before creating new markup. For backend-only changes (schema, server actions, hooks), component templates must remain visually identical — only update data access patterns and prop types, never layout or styling. The goal is feature addition and architectural correctness, not redesign.

1. Your task is to implement functionality per the specifications using parallel subagents. Follow @IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase (don't assume not implemented) using Sonnet subagents. You may use up to 500 parallel Sonnet subagents for searches/reads and only 1 Sonnet subagent for build/tests. Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).

Tasks include required tests - implement tests as part of task scope.

2. After implementing functionality or resolving problems, run all required tests specified in the task definition. All required tests must exist and pass before the task is considered complete. Run the full validation suite: `cd webapp && npm run typecheck && npm run lint && npm run test && npm run build`. If functionality is missing then it's your job to add it as per the application specifications. Ultrathink.

3. When you discover issues, immediately update @IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.

4. When the tests pass, update @IMPLEMENTATION_PLAN.md, then `git add -A` then `git commit` with a message describing the changes. After the commit, `git push`.

99. Required tests derived from acceptance criteria must exist and pass before committing. Tests are part of implementation scope, not optional. Test-driven development approach: tests can be written first or alongside implementation.
999. Important: When authoring documentation, capture the why — tests and implementation importance.
9999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
99999. As soon as there are no build or test errors create a git tag. If there are no git tags start at 0.0.0 and increment patch by 1 for example 0.0.1 if 0.0.0 does not exist.
999999. You may add extra logging if required to debug issues.
9999999. Keep @IMPLEMENTATION_PLAN.md current with learnings using a subagent — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.
99999999. When you learn something new about how to run the application, update @AGENTS.md using a subagent but keep it brief. For example if you run commands multiple times before learning the correct command then that file should be updated.
999999999. For any bugs you notice, resolve them or document them in @IMPLEMENTATION_PLAN.md using a subagent even if it is unrelated to the current piece of work.
9999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
99999999999. When @IMPLEMENTATION_PLAN.md becomes large periodically clean out the items that are completed from the file using a subagent.
999999999999. If you find inconsistencies in the specs/* then use an Opus subagent with 'ultrathink' requested to update the specs.
9999999999999. IMPORTANT: Keep @AGENTS.md operational only — status updates and progress notes belong in `IMPLEMENTATION_PLAN.md`. A bloated AGENTS.md pollutes every future loop's context.
