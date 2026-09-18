# Operational module redesign plan

The operational modules will share the completed Inventory Management interaction language while keeping their existing workflows and API contracts.

| Module | Everyday card view | Dense/list view | Drawer focus |
| --- | --- | --- | --- |
| Customers | Contact, loyalty, and barber preference cards | Searchable customer records | Profile editing, contact/preference details, deactivation |
| Barbers | Availability and performance cards | Sortable roster list | Profile editing, commission/rating context, roster actions |
| Staff | Role and access state cards | Account management list | Identity editing, verification/blocking, deactivation |
| Suppliers | Supplier coverage and account cards | Contact/status list | Profile, supplied inventory, login and deactivation actions |
| Restocks | Workflow-oriented request cards | Supplier/branch/status list | Request lines, delivery confirmation, receiving workflow |
| Bookings | Schedule cards grouped by status | Scan-friendly booking list | Appointment editing, completion, cancellation, deletion |
| Queue | Live queue cards with quick state cues | Fast scanning list | Assignment, state changes, remove action |

Shared primitives live in `barracks-pwa/app/components/operations/OperationalPrimitives.tsx`: view toggle, filter toolbar, card shell, action menu, responsive table shell, and accessible responsive detail drawer. Module-specific forms and API calls remain in their existing page files.
