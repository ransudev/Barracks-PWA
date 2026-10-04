# Restock screen remake

User rejected the prior grouped layout and requested a remake. Replaced tall stage sections with a compact list and selectable stages inside the request panel. Empty stages occupy a filter button rather than a full page section.

Rows align supplier/reference, branch/request date, items, status, and next action. Delivered requests come first, followed by shipped requests. History retains the same request details. Intermediate widths use labeled two-column rows; mobile puts status beside the supplier and stacks destination, item lines, and a full-width action.

Manual verification on localhost:3001: All active showed2 requests, Ready to receive showed1, In transit showed an empty state, Reset restored2. Receiving request2 opened the existing quantity15/unitcost250 form; cancelled without mutation. Mobile390px had pagewidth375px and no horizontal overflow. Production build/TypeScript and layout detector passed. No automated tests, receiving submission, or API changes.

Captures: [desktop](restock-remake-desktop.png), [mobile](restock-remake-mobile.png).
