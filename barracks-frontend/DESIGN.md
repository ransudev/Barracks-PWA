---
name: Barracks Barbers & Shaves
description: A restrained monochrome Barracks system spanning a warm editorial public front and a dark operational workspace.
colors:
  barracks-near-black: "#0B0D0D"
  barracks-charcoal: "#0F1111"
  barracks-dark-gray: "#1C1E1F"
  barracks-elevated: "#232526"
  barracks-hover: "#292B2C"
  barracks-border: "#383A3B"
  barracks-border-strong: "#4A4C4D"
  barracks-off-white: "#F2F0EA"
  barracks-cream: "#F3F1EB"
  barracks-muted: "#B0B0AB"
  barracks-text-muted: "#7E807D"
  barracks-muted-on-paper: "#666863"
  barracks-success: "#94A18A"
  barracks-warning: "#B09A76"
  barracks-danger: "#C27676"
  public-rule: "rgba(11, 13, 13, .16)"
  public-rule-on-dark: "rgba(242, 240, 234, .2)"
typography:
  display:
    fontFamily: "Libre Baskerville, Iowan Old Style, Baskerville, Times New Roman, serif"
    fontSize: "clamp(40px, 4.4vw, 58px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-.035em"
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "9px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: ".13em"
rounded:
  none: "0"
  public-control: "1px"
  internal-sm: "7px"
  internal-md: "8px"
  internal-lg: "14px"
  pill: "999px"
spacing:
  public-nav-gutter: "28px"
  public-section-y: "84px"
  public-section-y-mobile: "64px"
  public-grid-gap: "14px"
  internal-panel: "22px"
components:
  public-primary-button:
    backgroundColor: "{colors.barracks-off-white}"
    textColor: "{colors.barracks-near-black}"
    typography: "{typography.body}"
    rounded: "{rounded.public-control}"
    padding: "0 15px"
    height: "38px"
  public-outline-button:
    backgroundColor: "transparent"
    textColor: "{colors.barracks-near-black}"
    typography: "{typography.body}"
    rounded: "{rounded.public-control}"
    padding: "0 13px"
    height: "32px"
  internal-primary-button:
    backgroundColor: "{colors.barracks-off-white}"
    textColor: "{colors.barracks-near-black}"
    typography: "{typography.body}"
    rounded: "{rounded.internal-md}"
    padding: "0 16px"
    height: "42px"
  public-service-card:
    backgroundColor: "{colors.barracks-near-black}"
    textColor: "{colors.barracks-off-white}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "19px"
  internal-panel:
    backgroundColor: "{colors.barracks-dark-gray}"
    textColor: "{colors.barracks-off-white}"
    rounded: "{rounded.internal-lg}"
    padding: "22px"
---

# Design System: Barracks

## Overview

**Creative North Star: "The Restrained Monochrome Barracks System"**

Make the whole Barracks product read as one restrained monochrome barbershop system. Hierarchy comes from neutral tonal steps, not competing accents: near-black, charcoal, warm off-white, gray, thin rules, neutral icon containers, and photography do the identity work. Muted green, amber, and red are functional status signals only.

The public landing page gives visitors a crafted Barracks identity through warm paper navigation, a black and photographic hero, grayscale imagery, and editorial pacing. Authenticated users enter near-black rooms with quiet sidebars, charcoal cards, neutral controls, and warm off-white primary actions so operational information scans without cyan or blue noise. The two surfaces differ in density and material, but share the same neutral token system and component language.

The shipped public artifact is `app/pages/public/LandingPage.tsx` with the section components in `app/pages/public/landing/*`. It keeps real Barracks facts for Davao, four branches, services, barber roster, contact, and hours. Current barber portraits are editorial placeholders pending approved Barracks photography. Existing interaction seams remain mock/local prototype behavior.

The build preserves layout, typography, components, structure, and functionality. The form is shared tokens and reusable component selectors first; it is not a layout rewrite. The finish review passed on the final public, login, and staff screenshots (`/tmp/barracks-public-neutral-final.png`, `/tmp/barracks-runtime-login-final.png`, and `/tmp/barracks-runtime-staff-final.png`).

**Key Characteristics:**

- Thesis: one restrained monochrome Barracks system; hierarchy comes from tonal steps rather than accent competition.
- Own-world: near-black, charcoal, warm off-white, gray, thin rules, neutral icon containers, and photography; status colors are functional only.
- Story: crafted public identity and quiet authenticated operations without cyan/blue noise.
- First viewport: warm paper navigation with a black/photographic public hero; near-black login and staff rooms with charcoal cards and warm off-white actions.
- Form: shared tokens and reusable component selectors with no layout or functionality changes.
- Typography: Libre Baskerville for public display headings; Geist and Geist Mono for body, interface, metadata, and operational data.
- Finish: review complete, verdict PASS, and the shipped system is recorded here.

## Colors

The palette is intentionally narrow: warm paper and photography carry the public identity while one neutral charcoal ramp carries the internal product. Blue/cyan and decorative red are not visual-system colors; muted green, amber, and red appear only where they communicate a real state.

### Primary

- **Near-Black Room** (`{colors.barracks-near-black}`): Main application background, public hero/copy blocks, dark service bodies, barber section, final CTA, and near-black primary action surfaces.
- **Warm Off-White** (`{colors.barracks-off-white}`): Primary text, public display text, focus outline, and primary action fill against dark surfaces.

### Secondary

- **Muted Green** (`{colors.barracks-success}`): Success and healthy operational state only.
- **Muted Amber** (`{colors.barracks-warning}`): Attention, time, or pending state only.
- **Muted Red** (`{colors.barracks-danger}`): Error, destructive action, critical inventory, or real risk only.

### Tertiary

- **Secondary Gray** (`{colors.barracks-muted}`): Supporting text, times, links, trend copy, and ordinary metadata through the shared neutral `text-soft` role.
- **Muted Gray** (`{colors.barracks-text-muted}`): Low-emphasis labels, placeholders, and supporting copy through the shared `text-muted` role.

### Neutral

- **Sidebar / Deep Surface** (`{colors.barracks-charcoal}`): Sidebar, deep shell surfaces, public supporting ink, and the darkest card step after the room.
- **Primary Card** (`{colors.barracks-dark-gray}`): Shared panels, cards, fields, and the main operational surface.
- **Elevated Card** (`{colors.barracks-elevated}`): Controls, popovers, raised cards, and one-step elevation above a primary card.
- **Hover / Selected** (`{colors.barracks-hover}`): Neutral interaction feedback for hover, selected, active, and focused containers.
- **Border** (`{colors.barracks-border}`) and **Strong Border** (`{colors.barracks-border-strong}`): Thin structural rules, selected outlines, controls, and table separation.
- **Warm Paper** (`{colors.barracks-cream}`): Public canvas and light navigation surface; the public-specific paper aliases remain scoped to `.public-site`.
- **Paper Muted** (`{colors.barracks-muted-on-paper}`): Low-emphasis labels and metadata on warm paper.
- **Public Rules** (`{colors.public-rule}`) and (`{colors.public-rule-on-dark}`): Quiet translucent separators for light and dark public chapters.

**The Monochrome-First Rule.** Let ivory, near-black, charcoal, gray, borders, elevation, and photography do the branding work. Color should communicate a real state, not decorate a component.

**The Neutral Interaction Rule.** Icons, links, avatars, trend text, times, active states, selected states, and ordinary buttons use the neutral ramp. The compatibility aliases named `blue`, `public-blue`, and `internal-blue` resolve to neutral values and must not be reintroduced as cyan or blue.

**The Functional-Status-Only Rule.** Green, amber, and red are reserved for meaningful success, attention, and risk; every status also carries a readable label or text cue.

**The Warm-Action Rule.** Primary actions use warm off-white with near-black text on dark surfaces, or near-black with warm off-white text on paper. Saturated blue, cyan, and decorative red are never default action fills.

## Typography

**Display Font:** Libre Baskerville (with Iowan Old Style, Baskerville, Times New Roman, and serif fallbacks)

**Body Font:** Geist (with system sans fallbacks)

**Label/Mono Font:** Geist Mono (with ui-monospace and monospace fallbacks)

**Character:** Libre Baskerville gives the public landing page a restrained, high-contrast editorial voice without turning operational copy into decoration. Geist keeps navigation, body copy, controls, facts, prices, and the internal workspace neutral and quick to scan. Geist Mono is reserved for notation, numbering, times, metadata, and compact system labels.

### Hierarchy

- **Display** (400, `clamp(40px, 3.5vw, 54px)` in the hero and up to `clamp(42px, 4.4vw, 58px)` for public section heads, approximately 1.0 line-height): Public hero, section headings, service names, barber names, branch names, and the CTA headline.
- **Headline** (400, approximately 25–29px, 1.04 line-height): Service cards, barber roster entries, branches, and internal page titles where a crafted serif cue is useful.
- **Title** (600–750, approximately 15–18px, compact line-height): Internal panel headings, table titles, and action labels; use Geist for scanability.
- **Body** (400, 13–14px, 1.45–1.7 line-height): Public descriptions, About copy, branch details, and internal operational copy. Keep longer public paragraphs comfortably narrow.
- **Label** (600, 8–10px, `.08em`–`.15em` tracking, often uppercase): Public notation, section stamps, hours, prices, table headers, and metadata. Use Geist Mono when the label is index-like or time-like.

**The Display-For-Meaning Rule.** Use Libre Baskerville to mark a meaningful editorial heading or identity moment. Do not use it for dense tables, controls, or long operational copy.

## Layout

The public landing page is a paced editorial read with strong tonal transitions rather than a single dashboard grid. On desktop, the public navigation and first light/dark surfaces use a centered 1240px frame with 28px gutters. The hero is a 44/56 split: a near-black copy block on the left and a large monochrome haircut image on the right, with a compact light navbar above it. The tools-and-haircut collage follows immediately in a two-column, 270px-high band.

The public sequence is intentional: compact light navigation → split hero → immediate two-image monochrome collage → light Services with three poster-style cards → full-width dark Barbers roster → light Branches grid → light Paper Depth About image/details → dark CTA → dark footer. Services use three equal columns with a compact gap; Barbers use a featured chair image beside a vertically indexed roster; Branches use quiet top rules and a two-column grid; About uses a two-column image/text pairing. The CTA and footer are full-bleed dark closes.

At the 760px breakpoint, the public layout becomes a single reading column with 18px outer gutters: the hero stacks copy above media, the collage becomes two full-width image rows, service cards stack, the barber feature precedes the roster, branches become one column, About stacks image above details, and the footer keeps a simple two-column contact/social arrangement. The mobile navigation replaces links and Login with a square menu toggle. The internal application remains desktop-first with a 238px persistent sidebar, sticky context bar, page header, metrics row, panel grids, and readable tables; it collapses to a mobile shell at the existing responsive breakpoint.

Spacing is editorial and breathable in public sections (`84px` desktop vertical padding, `64px` mobile) with 1px rules between tonal chapters. Internal spacing is denser and grouped around panel padding, tables, filters, and metrics so staff can scan and act quickly.

## Elevation & Depth

Public pages are flat by default. Depth comes from near-black versus ivory/paper-depth blocks, grayscale photography, quiet borders, cropping, and the contrast between full-bleed bands and centered content. Do not add gradients or floating-card shadows to the public composition. Public image hover may use a restrained crop/contrast shift, and controls may invert or underline on interaction. The internal workspace uses tonal layering and soft structural shadows: panels sit on the mineral room, controls sit one step above panels, and modals/toasts may use the existing ambient shadow vocabulary.

### Shadow Vocabulary

- **Internal panel separation:** Use borders and grouped space first; the existing panel shadow is a soft `0 12px 30px rgba(0, 0, 0, .12)` treatment.
- **Internal modal/toast elevation:** The existing ambient shadow is `0 18px 42px rgba(0, 0, 0, .28)` and is reserved for overlays and transient feedback.
- **Public rest state:** No shadow. Use tonal contrast, rules, and image composition instead.

**The Flat-Public Rule.** Public surfaces are flat at rest. A new shadow must explain a real overlay or state; it must not make the editorial cards look like a SaaS component library.

## Shapes

The public world is intentionally square and print-like. Navigation booking, hero booking, service booking, branch booking, and CTA controls use a 1px radius or a clean rectangle. Public service cards, branch rows, image blocks, and footer columns have no rounded container treatment. Thin rules and hard image crops provide structure.

The internal world retains the existing softened operational language: controls and tabs use approximately 7–8px corners, panels use a 14px radius, avatars/status marks are circular, and badges, toggles, and progress tracks use pill geometry. Borders stay restrained 1px lines. Do not carry the internal pill/radius language into the public editorial surface unless the element is genuinely a status indicator.

## Components

### Public Navigation

- **Character:** Compact, light, quiet, and reference-led.
- **Surface:** Warm Ivory Paper with a 1px public rule and a 70px desktop height; the logo is dark and the links use low-contrast neutral sans text.
- **States:** The active/hover link receives a short neutral underline or brightness change; Login remains a plain text action; the booking control is a small near-black outline that inverts on hover. At mobile width, links collapse into a square menu toggle and a paper dropdown.

### Public Buttons & Editorial Links

- **Primary:** Neutral warm off-white fill with near-black text on dark public blocks; compact height and square corners. The shared internal primary uses the same off-white/dark pairing. Primary buttons are not bright blue.
- **Outline:** Transparent with a 1px dark or light border, used for service, branch, roster, and navigation booking actions.
- **Editorial link:** Geist text with a small arrow and a warm off-white/ink hover cue; it should read as an invitation, not a pill button.
- **Hover / Focus:** Use inversion, a quiet border/color change, or a small arrow shift. Focus uses neutral contrast rather than a bright accent.

### Hero & Editorial Image Blocks

- **Hero:** A 44/56 split composition with a dark copy block, restrained serif display headline, compact facts, and a large monochrome haircut image. The hero image carries the emotional weight; copy and controls remain sparse.
- **Collage:** Two monochrome tools/haircut images immediately after the hero, with no intervening marketing panel. Crops should feel like an editorial contact sheet.
- **Treatment:** Use grayscale or near-monochrome photography with controlled contrast and a very light dark image wash. Avoid decorative gradients, stickers, or stock-photo color casts.

### Service Cards

- **Character:** Three equal editorial poster cards on a light Services section.
- **Structure:** Image-led top with small index and duration notation; compact body with Libre Baskerville service title, factual description, pricing/availability, and an outline booking action.
- **Tone:** The three bodies may step through near-black, charcoal, and Paper Depth to preserve the reference-led rhythm. Pricing uses muted gray; service data remains factual and branch availability is not overstated.
- **State:** Cards are square and flat. Interaction is conveyed by a restrained border/action inversion, not a floating lift or shadow.

### Barbers Roster

- **Character:** Full-width dark section with a featured barber image beside an indexed list of additional barbers.
- **Content:** Show branch, role, price tier, day off, and booking action from the real landing roster data. Portraits must be labeled as editorial placeholders until approved Barracks photography is supplied.
- **State:** Roster rows can receive a subtle dark hover wash or neutral border cue. The roster note must keep branch availability confirmation and the placeholder status visible.

### Branch & About Details

- **Branches:** Light paper surface with four factual branch entries across Davao. Use numbered HQ metadata, address, landmark, named barber grouping, `View branch`, and `Book here` actions. Keep the cards as ruled editorial rows rather than rounded containers.
- **About:** Paper Depth image/text pairing with the Davao origin story, opening hours, phone, email, and a link back to branches. Contact and hours are real product facts, not placeholder copy.

### CTA & Footer

- **CTA:** Full-width near-black close with a restrained serif prompt, factual booking note, and ivory booking button.
- **Footer:** Darkest public surface with centered Barracks identity, Davao contact, hours, social links, staff login, copyright, and the 10-minute booking grace-period note. Use muted white text and gray section labels; do not add a bright accent action.

### Internal Workspace Shell & Panels

- **Shell:** `AppShell` retains a 238px persistent sidebar, sticky context bar, role-aware navigation, page header, metrics row, panel grids, tables, and clear operational action zones.
- **Surface:** Dark mineral layers use `internal-ink`, `internal-surface`, and raised surfaces with restrained borders and soft internal shadows.
- **Primitives:** Shared UI patterns remain in `app/components/ui/index.tsx`: logo, avatar, buttons, metrics, headers, panels, inputs, selects, badges, tabs, progress bars, modal, empty state, toggle, and toast. The stroke icon language remains in `app/components/ui/icons.tsx`.
- **Neutral interaction:** Icons, links, avatars, trend text, times, active states, selected states, and ordinary buttons stay within the charcoal/warm off-white ramp. The shared `blue`/`violet` compatibility roles resolve to neutral values.
- **Operational states:** Neutral surfaces handle ordinary context. Muted green, amber, and red cover only meaningful success, attention, and risk states; each status must include a readable label or text cue and never rely on color alone.

### Inputs, Filters & Local Interaction

- **Internal fields:** Dark raised backgrounds, 1px mineral rules, approximately 7px corners, and a visible focus treatment. Search, filters, row actions, modal forms, settings, restocks, payment completion, and exports use the existing shared language.
- **Prototype behavior:** Navigation, tabs, search, filters, row actions, modal forms, status changes, restocks, payment completion, notification/profile menus, exports, and settings controls are interactive in-browser. Mutable operational data is retained in browser storage through `app/hooks/usePersistentState.ts`, with clear seams for later authentication, persistence, payments, APIs, and business rules.

## Do's and Don'ts

### Do:

- **Do** use Libre Baskerville for public display headings and the Barracks wordmark; use Geist for interface/body copy and Geist Mono for notation, times, prices, and metadata.
- **Do** let warm ivory, near-black, charcoal, gray, thin rules, neutral icon containers, and monochrome photography carry the identity; keep status colors rare and purposeful.
- **Do** preserve the public landing route’s real Barracks facts: Davao, four branches, service data, barber roster, contact, and hours.
- **Do** keep current barber portraits explicitly described as editorial placeholders pending approved Barracks photography.
- **Do** retain the dark shop-floor ledger workspace and its operational UI language for authenticated customer/staff/admin views.
- **Do** keep semantic controls, visible keyboard focus, readable contrast, clear status labels, and text alongside color-coded state.
- **Do** preserve the mock/local prototype seams. Seed customer, staff, barber, service, inventory, revenue, and transaction data is expected to be replaced by verified production data later.
- **Do** keep open replacement work explicit: replace seed data with verified production data, replace editorial placeholder/stock imagery with approved Barracks photography or brand assets when available, and connect authentication, persistence, payments, and business rules in a later backend pass.

### Don't:

- **Don't** reintroduce cyan/blue icons, links, avatars, trend text, times, active states, or buttons; those compatibility roles are neutralized in the shipped system.
- **Don't** use saturated red or unrelated gold/orange as a primary action, dominant fill, or decorative brand surface.
- **Don't** turn the public landing page into a dark dashboard, a generic SaaS card grid, or a gradient-heavy marketing template.
- **Don't** add large rounded cards, pill buttons, decorative shadows, or loud accent fills to the public editorial composition.
- **Don't** present placeholder barber portraits as approved Barracks photography or invent testimonials, production claims, or unverified branch/service facts.
- **Don't** replace the retained internal ledger with the public light editorial treatment; the two modes intentionally have different density and interaction language.
- **Don't** imply that authentication, APIs, persistence, payments, or server-side business rules are complete. Existing interaction seams are local prototype behavior.
- **Don't** remove the finish contract: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and `DESIGN.md`.

**Direction contract:** Public form is `Persuade / Reference-Led Chair`; authenticated form remains `Operate / Shop-Floor Ledger`.

**FINISH:** Unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and `DESIGN.md`.
