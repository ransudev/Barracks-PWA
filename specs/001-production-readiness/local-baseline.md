# Local implementation baseline

2026-10-11, Asia/Manila. Authorized by the user's `/goal implement this production-readiness spec kit` request, with subagents authorized as necessary. Per the kit, the execution scope is local P0 stages 0–5. P1, hosted actions, push and merge remain separately authorized.

- Starting branch: `feature/barber-payroll`; starting commit: `59502acf15ccc6ae8ef0e1253ef2300380002723`.
- Implementation branch: `codex/production-readiness`.
- Pre-existing changes: modified `barracks-pwa/AGENTS.md`, untracked `auditspec.md`, untracked `specs/`. Preserve these; the spec kit evidence is updated as part of execution.
- Applicable guidance: `barracks-pwa/AGENTS.md`; root has no AGENTS file. Read installed Next route-handler documentation before API edits. Focused tests are explicitly required by this kit.
- Database target: a separate PostgreSQL 17 cluster bound to `127.0.0.1:55439`, database `barracks_readiness_disposable`. No hosted tests/seeding. Database security subagent owns setup and target guards.
- F02 source reproduction: staff list queries all staff globally; routes check target roles before mutation but user-service transactions do not check actor/target memberships.
- F03/F04 source reproduction: operational eligibility checks a single clock instant with no attendance lookup; manual starts call this guard; suggestions separately load current catalog duration. Queue entries snapshot price/name but do not snapshot duration.
- D01/D02 confirmed by owner: "Adopt both draft policies". Implemented scoped global staff mutations, Unmarked eligibility, explicit absence/clock-out denial, and active-service clock-out rejection.
- Local runtime: fresh disposable schema migrations including new duration snapshot migration executed successfully, then schema removed. This proves SQL application only; security and operational tests have separate evidence.

No credentials, hashes, tokens, hosted rows, or backup data belong in this evidence.
