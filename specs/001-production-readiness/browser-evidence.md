# Authenticated local P0 browser acceptance

E06; 2026-10-11, approximately 19:58–20:15 Asia/Manila. Production build of source commit `523a97f`, `http://127.0.0.1:3100`, separately initialized loopback PostgreSQL 17 on port 55439, database `barracks_readiness_disposable`. Synthetic fixture accounts and records only; no hosted requests or real customer/staff mutations. Random fixture credentials were kept outside the repository and are excluded from evidence.

Front Desk had Main and Second branch authority; Manager had Main only. Main/Second barber fixtures had schedules and hours covering the test interval. Manager fixtures included local, shared Main/Second, foreign Second, and unassigned staff.

| Workflow | Rendered result | Screenshot |
| --- | --- | --- |
| Attendance and availability | Unmarked initially Available; Mark Absent changed Available to 0 and showed Absent today after refresh | [Absent](browser-evidence/floor-absent.png) |
| Branch switch | Main to Second cleared prior counts immediately, showed loading, then Second barber and its current attendance | Included in recorded interaction; no old Main values after switch |
| Suggested walk-in | Create accountless Browser Guest, Next Customer, explicit assign confirmation, Ready, Start Service produced In progress | [Active mobile floor](browser-evidence/floor-active-mobile.png) |
| Active clock-out | Available 0/In service 1; clock-out disabled with Complete the active service before clocking out | Same active floor screenshot |
| Completion and clock-out | Complete walk-in removed active queue entry; floor clock-out succeeded and showed Clocked out/Available 0 | [Completed queue](browser-evidence/queue-completed-desktop.png), [Clocked out](browser-evidence/floor-clocked-out-desktop.png) |
| Scoped Manager roster | Exactly three overlapping staff; foreign/unassigned fixtures absent. Shared drawer read-only with Administrator-management explanation | [Desktop](browser-evidence/staff-shared-desktop.png), [Mobile](browser-evidence/staff-shared-mobile.png) |
| Authorized staff edit | Local account edit permitted; saved Local Updated persisted after refresh | [Tablet](browser-evidence/staff-updated-tablet.png) |
| Explicit create branches | Only Main checkbox available, initially unchecked; Create disabled until checked. Required fields still validated | Interaction observed; no account created |
| Appointment denial | Checked-in Main booking Start Service while barber absent returned Barber is marked absent today; booking remained Checked In | [Denied](browser-evidence/appointment-absent-denial.png) |
| Appointment own reservation | Clock In Main, retry Start Service succeeded as In Progress with its immutable 45-minute duration; Complete then succeeded | [Started](browser-evidence/appointment-started.png), [Completed](browser-evidence/appointment-completed.png) |

Viewport samples: desktop 1280x900, tablet 768x1024, mobile 390x844. Staff drawer/roster at tablet/mobile and active floor at mobile had no horizontal document overflow. Keyboard checks covered labelled staff fields, Tab progression, Escape drawer dismissal, and focus returning to the originating staff card. Screenshots retain surrounding application context. Staff shared-mobile, completion/clock-out and appointment screenshots were checked against the final production build.

This is changed-P0 local browser evidence only. It does not prove full WCAG compliance, every loading/error state, all role workflows on all viewports, hosted Data API containment, staging operational acceptance, or backup recovery. Those release gates remain unchecked. The temporary browser tab was closed and viewport override reset after capture.
