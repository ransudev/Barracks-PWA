# Transaction calendar follow-up

User requested transaction history as a calendar with a daily modal, then asked to enlarge that modal.

- Calendar dates and history query boundaries use Manila time. All paginated history responses for the selected month are loaded before counts appear; failed or superseded requests do not publish partial counts.
- Reference/customer and payment-method filters apply to both counts and daily rows. Busy dates paginate at 20 rows, with every loaded transaction reachable.
- The daily modal is capped at 1200px wide and viewport height minus 60px. Rows show time, customer, service, barber, full reference, method, status, amount, and receipt access. Mobile rows wrap within the dialog.
- Opening a receipt closes the daily modal to preserve a single active focus trap. Existing checkout, financial-action permissions, and confirmation logic remain in place.
- Manual browser checks on localhost:3001: October had18 transactions; October1 opened7 records; Cash filtering produced9 monthly transactions and4 on October1. October4 opened an empty-date explanation. Daniel Ong's receipt opened with the saved reference and300 peso total.
- Desktop dialog measured1200px wide; at390px mobile viewport it measured358px, with equal341px client/scroll width. Mobile calendar stayed within the page without horizontal overflow.
- Production build/TypeScript passed; Impeccable layout detector returned no findings. No automated tests or financial mutations ran.
- Calendar counts load the full filtered month using existing100-row history pages. Very large months may load more slowly; no count is silently truncated.

Captures: [desktop calendar](transactions-calendar-desktop.png), [mobile calendar](transactions-calendar-mobile.png), [large desktop modal](transactions-day-modal-desktop.png), [mobile modal](transactions-day-modal-mobile.png).
