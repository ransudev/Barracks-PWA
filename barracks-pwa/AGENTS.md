<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## README synchronization

For every code, configuration, dependency, database, API, or architecture change made in this project, update the repository root `../README.md` in the same change.

Keep the README's system overview accurate and beginner-friendly. Update the relevant sections when a change affects the project structure, request flow, API routes, database layer, validation, authorization, environment variables, dependencies, implemented features, or unfinished work.

Before finishing a task, verify that the README describes the resulting system and that no new behavior is left undocumented.

## Git Branch Workflow

- Treat `main` as the stable branch.
- Do not implement new features directly on `main`.
- Before starting a new feature, create a dedicated branch from the latest `main`.
- Use branch names such as:
  - `feature/<name>`
  - `fix/<name>`
  - `refactor/<name>`
  - `test/<name>`
- Commit each completed logical milestone.
- Keep unrelated work out of the feature branch.
- Run tests and checks before considering the branch complete.
- Do not merge into `main` automatically unless explicitly instructed.
- Prefer merging through a Pull Request so changes can be reviewed first.

## Git Commit and Savepoint Rules

After every meaningful code change, create a Git commit so there is always a restore point.

### Required workflow

1. Before making changes, check the current Git status.
2. Make only one logical change at a time.
3. After completing the change:
   - Review the modified files.
   - Run the relevant tests, linting, type checking, or build if available.
   - Stage only the files related to that change.
   - Create a Git commit immediately.
4. Do not combine unrelated changes into one commit.
5. Continue to the next task only after the previous change has been committed.

### Commit messages

Use clear and descriptive commit messages following this format:

`type: short description`

Examples:

- `feat: add barber availability validation`
- `fix: prevent duplicate booking submissions`
- `refactor: simplify booking service logic`
- `ui: improve booking form layout`
- `test: add booking conflict tests`
- `chore: update dependencies`

### Savepoint commits

If a large task requires several steps, create intermediate savepoint commits after each working milestone.

Example:
```yaml
feat: add booking time slot calculation
feat: add barber availability filtering
feat: connect availability to booking form
test: add booking availability tests
```

Do not wait until the entire task is finished before committing.

### Safety rules

- Never use `git push --force`.
- Never rewrite existing Git history unless explicitly instructed.
- Never delete or reset existing user changes.
- Do not use `git reset --hard` unless explicitly instructed.
- Do not commit secrets, `.env` files, API keys, tokens, credentials, or generated sensitive data.
- Do not commit unrelated existing changes made by the user.
- If the working tree already contains unrelated changes, leave them untouched and stage only files related to the current task.
- Do not automatically push commits to the remote repository unless explicitly instructed.

### Before each commit

Verify:
```
git status
git diff
```

Then stage only the relevant files:
```
git add <relevant-files>
```

Commit:
```sql
git commit -m "type: description"
```

### Goal

Git history should act as a series of safe restore points. Every completed logical change should have its own commit so the project can easily be rolled back to the state before that change.
