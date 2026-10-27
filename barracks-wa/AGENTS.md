<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

## Purpose

This file defines the rules that AI coding agents must follow when working in this repository.

The main goals are:

- Keep main stable.
- Use feature branches for new work.
- Make small, meaningful commits that act as savepoints.
- Avoid losing or overwriting existing work.
- Create or run tests and validation commands only when the user explicitly requests them in a prompt.
- Keep Git history clean and easy to understand.

## 1. General Development Rules

Before changing code:

1. Inspect the existing implementation first.
2. Understand the current architecture and patterns.
3. Reuse existing components, services, utilities, and conventions when possible.
4. Do not redesign working modules unless the task requires it.
5. Avoid unnecessary changes outside the requested scope.
6. Do not modify unrelated files just for cleanup or formatting.
7. Preserve existing behavior unless the requested change intentionally replaces it.

Prefer small, focused changes over large rewrites.

## 2. Git Branch Rules

### main is the stable branch

Treat main as production-ready or stable code.

Do not implement new features, fixes, refactors, or experiments directly on main.

Before starting new work:

```bash
git checkout main
git pull
git status
```

The working tree should be clean before creating a new branch.

### Create a dedicated branch

Create one branch for one logical piece of work.

Examples:

- `feature/booking-system`
- `feature/inventory-module`
- `feature/supplier-profile`
- `fix/booking-conflict`
- `fix/customer-login`
- `refactor/booking-service`
- `ui/dashboard-redesign`
- `test/booking-workflow`

Example:

```bash
git checkout -b feature/booking-system
```

Do not use vague branch names such as:

- changes
- update
- new
- test123
- my-branch

## 3. Never Automatically Merge Into main

Agents must not automatically merge a feature branch into main.

When implementation is complete:

1. Run only checks explicitly requested by the user; otherwise review the code and diff.
2. Review the changes.
3. Ensure all work is committed.
4. Report that the branch is ready for review.
5. Let the user decide when to merge or create a Pull Request.

Do not run:

```bash
git checkout main
git merge <branch>
```

unless the user explicitly asks for the merge.

## 4. Commit and Savepoint Rules

Create a Git commit after every meaningful completed change.

Commits are used as restore points.

Do not wait until the entire feature is finished before committing.

Good commit sequence

```
feat: add booking database fields
feat: add barber availability service
feat: expose availability through booking api
feat: connect availability to booking form
test: add booking availability tests (only when explicitly requested)
```

Bad commit sequence

```
update stuff
more changes
final
fix
fix again
```

Each commit should represent one logical change.

Do not create a separate commit for every edited line or tiny formatting change.

## 5. Commit Message Format

Use:

```
type: short description
```

Recommended types:

- `feat:` new feature
- `fix:` bug fix
- `refactor:` internal code improvement
- `ui:` interface or styling change
- `test:` tests
- `docs:` documentation
- `chore:` maintenance
- `perf:` performance improvement

Examples:

- `feat: add barber availability validation`
- `fix: prevent duplicate booking submissions`
- `refactor: simplify booking service logic`
- `ui: improve booking form layout`
- `test: add booking conflict tests`
- `docs: document booking workflow`

Keep commit messages short but descriptive.

## 6. Required Workflow for Every Change

For each logical implementation step:

### Step 1: Inspect

Before changing anything:

```bash
git status
```

Review relevant files and understand the current implementation.

### Step 2: Implement

Make one focused logical change.

Avoid mixing unrelated changes.

### Step 3: Review

Review the changes before staging:

```bash
git diff
git status
```

Check for:

- accidental file changes
- debug code
- temporary files
- secrets
- unrelated formatting changes
- unintended deletions

### Step 4: Validate

Tests and validation commands are opt-in. Do not create, modify, or run tests unless the user explicitly requests that work in a prompt. Do not run lint, type checks, builds, browser validation, or other validation suites unless the user explicitly requests them either.

A request to implement, fix, refactor, commit, push, or prepare a Pull Request does not by itself authorize tests or validation commands. Do not ask for permission to run them as a routine step; proceed with code and diff review and report that they were not run.

When the user explicitly requests validation, run only the requested checks using scripts that actually exist in the project. Do not invent unsupported commands or expand a narrow check into a full suite.

### Step 5: Stage Only Relevant Files

Prefer:

```bash
git add path/to/file1 path/to/file2
```

instead of blindly using:

```bash
git add .
```

when unrelated changes are present.

### Step 6: Commit

Example:

```bash
git commit -m "feat: add booking availability service"
```

### Step 7: Continue

Only move to the next logical implementation step after the previous step has been committed.

## 7. Existing User Changes Must Be Protected

Never overwrite or discard changes that existed before the current task.

If `git status` shows files already modified before the agent starts:

- Treat them as user-owned changes.
- Do not reset them.
- Do not revert them.
- Do not include them in a commit unless they are clearly part of the requested task.

Stage only files relevant to the current work.

Never use destructive commands to clean the repository without explicit permission.

## 8. Prohibited Git Commands

Do not use the following unless the user explicitly requests them and understands the consequences:

```bash
git reset --hard
git clean -fd
git push --force
git push --force-with-lease
git rebase -i
git checkout -- .
git restore .
```

Never rewrite shared Git history automatically.

Never delete branches unless the user explicitly requests it or the branch has already been safely merged and branch cleanup was requested.

## 9. Pushing to Remote

Do not automatically push commits unless the user explicitly instructs you to push.

Local commits should normally be created first as savepoints.

If pushing is requested:

```bash
git push -u origin <branch-name>
```

Do not force push.

## 10. Pull Request Workflow

Preferred workflow:

```
main
  ↓
feature branch
  ↓
small commits
  ↓
requested tests and validation (if any)
  ↓
push branch
  ↓
Pull Request
  ↓
review
  ↓
merge into main
```

Before declaring a branch ready for a Pull Request:

- Working tree should be clean.
- Tests should pass if explicitly requested.
- Build should pass if explicitly requested.
- Unrequested tests and validation commands must be skipped and reported as not run.
- No secrets should be included.
- No unrelated files should be changed.
- Commits should have meaningful messages.

## 11. Updating a Feature Branch

If main changes while working on a feature branch, update carefully.

Preferred safe approach for collaborative work:

```bash
git checkout main
git pull

git checkout <feature-branch>
git merge main
```

Resolve conflicts carefully.

Do not automatically choose one side of a conflict without understanding both versions.

Do not use destructive conflict resolution.

## 12. Large Features

For large modules, split implementation into milestones.

Example:

```
feature/inventory-module

commit 1:
feat: add inventory schema

commit 2:
feat: add inventory service

commit 3:
feat: add inventory api routes

commit 4:
feat: add inventory management interface

optional commit 5 (only when explicitly requested):
test: add inventory workflow tests
```

Each milestone should leave the repository in a reasonably working state when possible.

## 13. Bug Fix Workflow

For bug fixes:

1. Understand and reproduce the bug when possible.
2. Identify the root cause.
3. Make the smallest reasonable fix.
4. Review the affected workflow in the code; test it only when explicitly requested.
5. Review for regressions; run regression checks only when explicitly requested.
6. Commit the fix.

Example:

```
fix: prevent double booking for the same time slot
```

Avoid unrelated refactors inside a bug-fix commit.

## 14. Refactoring Rules

A refactor should not intentionally change application behavior.

Before refactoring:

- Understand the current behavior.
- Inspect existing tests if useful; create, modify, or run them only when explicitly requested.
- Keep refactors focused.

Separate refactoring from new feature implementation when practical.

Example:

```
refactor: extract booking validation service
```

Then later:

```
feat: add booking conflict validation
```

## 15. Database Changes

Database changes must be handled carefully.

Before modifying schemas:

- Inspect the existing schema.
- Check relationships and foreign keys.
- Consider existing data.
- Use the project's existing migration system.

Do not delete tables, columns, or production data unless explicitly requested.

Keep schema changes in their own logical commit when possible.

Example:

```
feat: add barber_id to bookings
```

## 16. API Changes

When changing APIs:

- Preserve existing contracts unless the change explicitly requires breaking them.
- Validate input.
- Handle expected errors.
- Respect authentication and authorization.
- Avoid exposing sensitive information.

Update related frontend code when necessary. Update tests only when explicitly requested.

## 17. Role and Permission Rules

Never bypass existing role or permission checks just to make a feature work.

When adding functionality:

- Identify which roles may access it.
- Reuse the existing authorization system.
- Review backend access enforcement; test unauthorized access only when explicitly requested.
- Do not rely only on hiding frontend buttons.

Authorization should also be enforced on the backend when applicable.

## 18. Testing Expectations

Do not create, modify, or run any tests unless the user explicitly requests them in a prompt. This includes functional, workflow, validation, edge-case, regression, role and permission, UI, and integration tests.

Do not run lint, type checks, builds, browser validation, or other validation suites unless explicitly requested. This rule applies to features, bug fixes, refactors, database changes, API changes, and Pull Request preparation, and takes precedence over any general testing or validation expectation elsewhere in this file.

Use focused code inspection and diff review by default to keep tasks fast and conserve usage. Do not add tests or run checks merely to satisfy a completion checklist.

When tests or checks are requested, keep them within the requested scope. Do not claim something is tested unless the relevant check was actually performed. Otherwise report: "Tests and validation commands were not run because they were not requested."

## 19. Secrets and Sensitive Files

Never commit:

- `.env`
- `.env.local`
- `.env.production`
- API keys
- access tokens
- passwords
- private keys
- database credentials
- authentication secrets

Before committing, inspect staged changes:

```bash
git diff --cached
```

If sensitive information appears, remove it before committing.

## 20. Generated and Temporary Files

Do not commit temporary or generated files unless the repository intentionally tracks them.

Examples that usually should not be committed:

- `node_modules/`
- `dist/`
- `build/`
- `coverage/`
- `*.log`
- temporary screenshots
- debug files

Follow the existing `.gitignore`.

## 21. Definition of Done

A task is complete only when:

- The requested feature or fix is implemented.
- Existing architecture was respected where reasonable.
- Explicitly requested tests/checks were run; unrequested tests/checks were skipped and reported.
- No known unrelated functionality was broken.
- No secrets were introduced.
- Changes were reviewed using `git diff`.
- All intended work was committed.
- The working tree is clean or any remaining changes are explained.
- The branch has not been merged into main unless explicitly requested.

## 22. Final Agent Report

After finishing a task, report:

```text
Branch:
feature/example

Commits:
- abc1234 feat: add example service
- def5678 feat: add example api
- ghi9012 test: add example tests

Validation:
- Tests and validation commands: not run (not requested)
- If explicitly requested, list each performed check and its actual result.

Status:
Ready for review / Pull Request.
```

If a check was not run, say so.

Never report a test as passing unless it actually passed.

## Core Rule

The repository should always have safe restore points.

The expected workflow is:

```
main
  ↓
create feature branch
  ↓
make one logical change
  ↓
review
  ↓
requested tests/checks only (if any)
  ↓
commit savepoint
  ↓
repeat
  ↓
final code/diff review and any explicitly requested validation
  ↓
Pull Request
  ↓
merge only with user approval
```

Keep main stable, keep commits meaningful, and never destroy existing work.

## README synchronization

For every code, configuration, dependency, database, API, or architecture change made in this project, update the repository root `../README.md` in the same change.

Keep the README's system overview accurate and beginner-friendly. Update the relevant sections when a change affects the project structure, request flow, API routes, database layer, validation, authorization, environment variables, dependencies, implemented features, or unfinished work.

Before finishing a task, verify that the README describes the resulting system and that no new behavior is left undocumented.
