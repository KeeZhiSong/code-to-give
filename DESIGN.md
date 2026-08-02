---
name: Passion To Serve — Event Console
description: Operate-mode organiser dashboard for a Singapore migrant-worker nonprofit — warm neutral ground, one teal action color, gold reserved exclusively for VIP status.
colors:
  navy-ink: "#0E2A3B"
  teal-action: "#1C6B5E"
  ivory-ground: "#FAF7F0"
  gold-vip: "#C9A24B"
  card-surface: "#FFFFFA"
  line-hairline: "#E2DDCF"
  muted-text: "#56707D"
  status-confirmed: "#4F7A5B"
  status-pending: "#A67C43"
  status-withdrawn: "#8B4B3E"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.375rem, 2.4vw, 1.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label-mono:
    fontFamily: "IBM Plex Mono, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal-action}"
    textColor: "{colors.ivory-ground}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "#175A4F"
  button-secondary:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  status-pill-vip:
    backgroundColor: "{colors.gold-vip}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Passion To Serve — Event Console

## Overview

**Creative North Star: "The Organiser's Desk Ledger"**

This console is where one non-technical, often-standing-up organiser checks whether Sunday's
GIFTIK drive is actually ready — not a marketing surface, not a place anyone lingers for pleasure.
It reads like a well-kept ledger on a nonprofit's own desk: warm paper instead of clinical white,
navy ink instead of corporate blue, and exactly one color — a muted teal already in Passion To
Serve's own brand — doing every bit of "click here" work. Everything else stays quiet on purpose,
so the one moment the system needs to shout — a beneficiary crossing into VIP status, a volunteer
hitting Gold — has a color nobody has spent anywhere else: a muted gold that means one thing only.

This is an Operate surface, not a Persuade one. Nobody needs to be convinced to use it; they need
to find the number they came for in under two seconds, from a phone, standing at a venue. Density
and legibility outrank expression. Brand lives in restraint and in precise detail — a hairline
rule, a mono numeral, a name for a color — not in ornament.

Confirmed visual rejection: no marketing gradients, no glassmorphism, no drop shadows standing in
for hierarchy, no second accent color competing with teal for attention, and no reuse of the
existing scoped "marigold / civic-signage" identity (`app/pts-features.css`) — this system replaces
it project-wide.

**Two registers, one system (added after the first build read as too flat):** the Events index is
the front door — the one moment allowed real compositional confidence, oversized type, a
decorative moment, a card grid instead of a thin list. Everything *inside* an event (Overview,
People, Broadcast, Tasks, Settings) stays in the quieter Operate register described above, because
that's where the actual task-completion happens. Same palette and type throughout — the front door
just gets more room to make an entrance. Decoration earns its place by carrying real data (a
readiness ring, not a stock icon) rather than by being purely ornamental.

**Key Characteristics:**
- Warm, paper-like neutral ground (ivory, not white) under navy ink
- Exactly one interactive accent color (teal) — restrained-strategy, not committed or drenched
- Gold is a single-purpose signal, not a palette color — VIP/Gold-tier only, everywhere else forbidden
- Flat by default; depth comes from tonal layering and hairline rules, not shadows
- An editorial serif for titles, a plain workhorse sans for everything read at length, a mono face wherever a number is live system output

## Colors

Warm and restrained: one neutral family carries the page, one accent carries every action, and two
special-purpose colors are locked to a single meaning each.

### Primary
- **Navy Ink** (`#0E2A3B`): Passion To Serve's own existing brand color, from their logo and
  slide decks. Carries page titles, body ink, the sidebar, and every structural dark surface. Used
  here specifically so this console reads as *their* product, not a dashboard designed in a vacuum.

### Secondary
- **Teal Action** (`#1C6B5E`): Passion To Serve's own secondary brand color. The single
  interactive accent — every button, link, active tab, and focus ring. Nothing else on the page
  competes with it for "this is clickable."

### Tertiary
- **Gold VIP** (`#C9A24B`): locked exclusively to the Gold volunteer tier and the Beneficiary VIP
  Pass. Never a general highlight, warning, "pending," or decorative color.

### Neutral
- **Ivory Ground** (`#FAF7F0`): the page background. Chosen over white specifically because this
  product serves a humanitarian nonprofit — pure white/dashboard-blue reads corporate and cold.
- **Card Surface** (`#FFFFFA`): a hair off pure white, still warm-leaning, for panels sitting on
  the ivory ground — enough separation to read as a layer without introducing a second hue.
- **Hairline** (`#E2DDCF`): borders and dividers, warm enough to sit quietly against ivory.
- **Muted Text** (`#56707D`): secondary copy, timestamps' surrounding labels, placeholder text — a
  desaturated navy-grey, not a generic grey.
- **Status Confirmed** (`#4F7A5B`), **Status Pending** (`#A67C43`), **Status Withdrawn**
  (`#8B4B3E`): a separate, desaturated status vocabulary for operational state (RSVP confirmed /
  awaiting / declined, partner confirmed / not yet). Deliberately distinct in hue and saturation
  from both Teal Action and Gold VIP, so operational status and loyalty status can never be
  mistaken for one another at a glance.

### Named Rules
**The Gold Exclusivity Rule.** Gold appears in exactly two places in the entire product: the Gold
volunteer tier and the Beneficiary VIP Pass. Gold on anything else — a "pending" chip, a highlight,
a decorative flourish — is a bug, not a style choice.

**The One Accent Rule.** Teal is the only color in the system that means "actionable." A second
accent color anywhere breaks the rule the palette exists to enforce.

## Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Body Font:** Inter (with -apple-system, Segoe UI fallback)
**Label/Mono Font:** IBM Plex Mono (with Consolas, monospace fallback)

**Character:** An editorial serif for the handful of places a page genuinely announces itself
(page titles, an event's name), a plain humanist sans for everything actually read at length, and
a mono face that exists for exactly one reason — to mark a number as live system output rather
than decoration.

### Hierarchy
- **Hero** (600, `clamp(2rem, 5vw, 3.25rem)`, 1.05): Fraunces. Reserved for the Events index front
  door — the one headline on the whole site allowed to be this large.
- **Display** (600, `clamp(1.375rem, 2.4vw, 1.75rem)`, 1.15): Fraunces. Every other page title
  (`AppHeader` h1) and an event's own name.
- **Title** (600, 15px, 1.3): Inter. Section headings inside a card/panel (`Recipients`, `Roster`,
  `Task Board`).
- **Body** (400, 15px, 1.55): Inter. Everything else — list rows, form labels, descriptions,
  buttons. Comfortable at 65–75ch where copy runs long.
- **Label** (600, 11px, uppercase, 0.06em tracking): Inter. Small eyebrow labels, filter selects,
  form field captions.
- **Mono Data** (500, 13px, 1.3): IBM Plex Mono. Inline live-data — a timestamp, a masked phone
  number, a percentage, a status/tier word. `font-variant-numeric: tabular-nums` throughout so
  columns of digits align.
- **Figure** (700, 28px, 1): IBM Plex Mono. A large standalone count someone reads from across the
  room — the Going/Can't/Awaiting roster tallies, a headcount tile. Same mono rationale as Mono
  Data, sized for the numbers that ARE the point of the tile rather than sitting inline in a
  sentence.
- **Figure Hero** (600, 44px, 1): IBM Plex Mono. Reserved for the single number a whole screen
  exists to show — the Event Readiness percentage. One size larger than Figure specifically so it
  reads as the one thing on the page, not another tile among tiles.

### Named Rules
**The Live-Output Rule.** If a number changes because the database changed — a headcount, a
readiness percentage, a points total, a "last seen" time — it is set in IBM Plex Mono. If a
person typed it as a label, it's Inter. The mono face is a signal, not decoration.

## Layout

Single-column content capped at a comfortable reading/scanning width (max ~1100px), with a
persistent left sidebar (collapsing to a horizontal strip on mobile — organisers act from a
phone at a venue). Panels stack in a loose two-column grid on wide viewports (~1.25fr/1fr) and
collapse to one column under ~860px. Spacing runs on an 8px rhythm (`spacing.xs` through `xl`);
more space sits above a heading than below it. Tables/lists that could overflow (the recipient
list, the roster) scroll within their own container rather than widening the page.

## Elevation & Depth

Flat by default. No box-shadows. Depth comes from tonal layering — Ivory Ground under Card
Surface under a hairline border — and from the single Navy Ink sidebar reading as a fixed,
grounded plane against everything that scrolls beside it.

### Named Rules
**The Flat-By-Default Rule.** A shadow appearing anywhere in this system is a bug unless it's
directly answering user input (e.g. a dragged Kanban card lifting mid-drag). At rest, everything
is flat.

## Motion

Flat-by-default (see Elevation & Depth) doesn't mean motionless. Motion is used, but every instance
must be motivated — hierarchy, feedback, or sequencing a list an organiser is about to scan, never
"it looked cool." Spring-based, never linear-eased. Durations short (120–220ms) — this is a tool
someone uses dozens of times a day, not a one-time impression.

- **Tactile feedback**: every button/card gets a small `:active` press (`scale(0.98)` or a 1px
  translate), so clicking feels physical.
- **List entry**: cards and rows in a freshly-loaded list stagger in (short delay per item,
  capped low) — confirms "this just loaded," not decoration for its own sake.
- **Respect `prefers-reduced-motion`** everywhere motion is added, no exceptions.

### Named Rules
**The Demo-vs-Daily-Use Rule.** A landing page is judged on the first 10 seconds; this console is
judged on the thousandth use. Motion that would impress a judge once and slow down an organiser
every day after is a net loss — reject it here even if it would be right on a marketing page.

## Shapes

Gently curved corners throughout (10px on cards and panels, 6px on buttons/inputs/chips, a full
pill on status badges), hairline 1px borders in Hairline (`#E2DDCF`), no heavy strokes, no
asymmetric corners.

## Components

Every component reads as quiet and precise — Operate-mode discipline, not expressive chrome.
Nothing here competes with Teal Action for attention except Gold VIP in its two locked contexts.

### Buttons
- **Shape:** 6px radius, 9px/16px padding.
- **Primary:** Teal Action background, Ivory Ground text — every "send," "add," "save," "create."
- **Secondary/Ghost:** Card Surface background, Navy Ink text, Hairline border — every "cancel,"
  filter toggle, and non-destructive secondary action.
- **Hover/Focus:** primary darkens ~10% (`#175A4F`); focus ring is a 2px Teal Action outline,
  inset so it never shifts layout.

### Status Pills
- **Style:** pill radius, small mono-weight label, a low-opacity tint of the status color as
  background with the full-strength color as text/dot — never a solid fill (that's reserved for
  the VIP pill).
- **VIP/Gold Pill:** the one exception — solid Gold VIP background, Navy Ink text. Its solidity is
  what makes it read as special versus every other pill's tint treatment.

### Cards / Panels
- **Corner:** 10px radius.
- **Background:** Card Surface on Ivory Ground.
- **Border:** 1px Hairline.
- **Shadow:** none (see Elevation).
- **Internal Padding:** `spacing.md`–`spacing.lg`.

### Stat Tiles
- **Style:** eyebrow label in small-caps Inter, the figure itself large and set in IBM Plex Mono,
  an optional thin progress bar underneath in Status Confirmed/Withdrawn depending on whether the
  ratio is healthy.

### Inputs / Fields
- **Style:** 6px radius, 1px Hairline border, Card Surface background.
- **Focus:** 2px Teal Action outline, inset.
- **Error:** Status Withdrawn border + a small Status Withdrawn message beneath, never a red
  outside this system's own status vocabulary.

### Navigation (Sidebar + Event Tabs)
- **Sidebar:** Navy Ink background, Ivory Ground text, active item filled with Teal Action.
  Collapses to a horizontal scroll strip under ~760px.
- **Event Tabs:** underline style — Muted Text at rest, Navy Ink + Teal Action underline when
  active. No pill/button tab treatment; tabs are wayfinding, not actions.

### Kanban Cards (Task Board)
- **Style:** Card Surface, 10px radius, 1px Hairline, owner initials in a small Navy Ink circle,
  deadline chip in mono type using the status vocabulary (Status Pending when due soon, Status
  Confirmed when done).

## Do's and Don'ts

### Do:
- **Do** use Teal Action for every clickable primary action and nothing else.
- **Do** set every live/computed number in IBM Plex Mono with tabular figures.
- **Do** use Ivory Ground, never pure white, as the page background.
- **Do** keep the whole system flat; convey layering with Card Surface + Hairline, not shadows.

### Don't:
- **Don't** use Gold VIP (`#C9A24B`) anywhere except the Gold volunteer tier and the Beneficiary
  VIP Pass — not as a highlight, not as a "pending" or "warning" color, not decoratively.
- **Don't** introduce a second accent color; Restrained strategy means neutrals plus exactly one.
- **Don't** reuse or extend the old "marigold / civic-signage" identity scoped to Headcount/Tasks —
  this system replaces it everywhere.
- **Don't** reach for a drop shadow to express hierarchy; use tonal layering instead.

### One documented exception: the WhatsApp preview
`.wa-preview` in Compose (`app/globals.css`) uses WhatsApp's own real colors — header teal
`#075E54`, bubble green `#DCF8C6`, chat background `#E5DDD5`, text `#111b21` — none of which are
project tokens. This is deliberate: the component's entire job is showing an organiser exactly
what a message looks like on the real surface it's about to land on, so it has to look like real
WhatsApp, not like our app pretending. Confined to that one component; never reused as an accent
anywhere else. If this component's colors show up in a design-system audit, that's expected —
they're not drift, they're the point.
