# Attendance follow-up

User requested aligned toolbar controls, then a weekly attendance table instead of the full month.

- Attendance-only toolbar styles align the search, navigation buttons, and labeled inputs along their bottom edge at 42px height.
- The default matrix displays Monday–Sunday for the week containing the current Manila date. Previous/next controls move seven days; the date picker snaps the selected date to Monday.
- History queries use the displayed week's inclusive date range. Status filters retain all records for matching barbers within that week; mobile uses the same records.
- Browser verification at localhost:3001 showed Sep 28–Oct 4 with seven date columns and 28 records. Next week showed Oct 5–11 with future cells; previous restored the original week.
- Desktop matrix width matched its container (1219px). At a 390px mobile viewport all toolbar controls measured 301px wide with no horizontal page overflow.
- Production build and TypeScript passed. No automated tests ran.

Final captures: [desktop](attendance-week-desktop.png), [mobile](attendance-week-mobile.png). Earlier alignment-only captures precede the weekly update.
