# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the event organiser at Passion To Serve (PTS)** — a Singapore
nonprofit that is entirely volunteer-run. They are not technical, they are not
paid, and coordinating events is not their day job. Today they run events out
of WhatsApp threads, email, Excel, giving.sg, and physical notice boards, with
threads for different events interleaving so nobody can tell what is handled
and what is pending.

They work in two distinct situations, and the console has to hold both:

- **At a desk, before and after an event** — planning, drafting broadcasts,
  reviewing who replied, assigning shifts. Laptop, unhurried, information-rich.
- **On a phone, on the day** — standing at a GIFTIK distribution queue or a
  classroom door, marking who turned up, sending thanks, checking a headcount.
  One-handed, often outdoors, frequently interrupted.

**Not users of this console:** volunteers and beneficiaries. They never log in
and have no account. Everything addressed to them leaves over WhatsApp. This is
a deliberate product boundary, not an unbuilt feature — see Positioning.

## Product Purpose

Give PTS one place to plan, run, and close out a volunteer-led event, so that
coordination stops being spread across half a dozen tools. Success is an
organiser being able to answer "what is the state of this event?" from one
screen instead of scrolling chat history — and time that went into logistics
going to migrant workers instead.

## Positioning

**The console is organiser-only; the participant channel is WhatsApp.**

Volunteers and migrant workers already live in WhatsApp and will not install or
log into anything. So the product refuses the obvious shape — a portal with
three roles — and splits along the channel instead: organisers get a web
console, everyone else gets messages on the number they already use. Registration
arrives via a Google Form, invitations and polls go out over WhatsApp, replies
come back through a webhook and land on the roster live.

A competitor could copy the screens. What they could not truthfully copy is that
the people being coordinated never have to show up to the software at all.

## Operating Context

- **Event lifecycle** is the organising spine: Plan → Execute → Post-execution.
  Every screen belongs to a phase of one event.
- **Three PTS pillars** all events fall under: Items To Serve (donation drives,
  GIFTIK distribution), Knowledge To Serve (digital, financial, English
  literacy), Peace To Serve (wellness and recreation).
- Events are planned **months ahead and overlap**, which is the root cause of the
  coordination problem this product exists to solve.
- Outbound WhatsApp goes through an unofficial gateway on a real number, so sends
  are **sequential with a delay** and capped. This is a permanent shape
  constraint, not a tuning parameter: bulk-blasting gets the number banned.
- Attendance, loyalty points, and the beneficiary VIP Pass are **organiser
  decisions made after the event**, never derived from an RSVP.

## Capabilities and Constraints

Confirmed and built:

- Events with capacity, schedule, venue, and briefing details; templates for
  repeat events.
- WhatsApp invitations and polls; live roster of yes / can't / awaiting.
- Broadcast composer with audience tabs for volunteers vs beneficiaries.
- Waitlist with automatic promotion when a confirmed volunteer drops out.
- Volunteer loyalty points and tiers; beneficiary VIP Pass after four visits.
- Beneficiary register with languages, courses, and attendance.
- Shift coverage with standby queues.
- Post-event impact thank-you.

Constraints future work must preserve:

- **No participant-facing screens.** If a volunteer or beneficiary needs to see
  it, it goes out over WhatsApp.
- **Phone numbers are masked to the last four digits** everywhere in the UI, and
  never logged in full.
- **Sequential, delayed, capped sends** — never parallelise outbound messaging.
- Attendance has **one writer**; points, tiers, and VIP status are recomputed
  from the ledger rather than incremented in place.

Undecided: whether the shift roster and the event waitlist remain two separate
mechanisms or converge. Both currently exist and do not share data.

## Brand Commitments

`public/logo.png` is the only binding asset. Palette, typography, layout, and
motion are open.

Voice, as established in the WhatsApp copy and worth carrying into the UI: warm,
plain-spoken, brief. Written like a real volunteer coordinator, not a corporate
tool. No jargon.

## Evidence on Hand

- Real seeded events across all three pillars, and a real volunteer roster.
- Working end-to-end WhatsApp loop: invitation → poll → reply → roster.
- Impact figures shown in the post-event thank-you are **display values, not
  measurements**, and do not reconcile with the numbers PTS publishes. Future
  work must not present them as audited.
- PTS's published impact to date: 20,894 beneficiaries, 26,620 items donated,
  945 student beneficiaries, 378 volunteers and educators. These are real and
  may be cited.
- No testimonials, case studies, press, or pricing exist. Do not fabricate any.

## Product Principles

1. **One event, one view.** An organiser should never cross-reference a chat to
   learn the state of an event.
2. **The console is for organisers; WhatsApp is for everyone else.** Any feature
   that would put a volunteer or beneficiary in front of this UI is the wrong
   shape.
3. **Built for a volunteer, not an operator.** The person using this is
   non-technical and doing it in spare hours. Fewer screens, obvious flows,
   sensible defaults.
4. **Works at a desk and in a queue.** The same screen gets used on a laptop
   while planning and on a phone while standing at an event.
5. **Never state a number the system cannot stand behind.** Counts come from
   queries; anything illustrative is labelled as such.

## Accessibility & Inclusion

- On-the-day use is one-handed, on a phone, sometimes in direct sunlight —
  touch targets and contrast are functional requirements, not compliance.
- Organisers are non-technical volunteers of a wide age range.

## Near-term Context

The immediate deliverable is a **hackathon demo on Monday 3 August 2026,
07:00 SGT** (Morgan Stanley "Code to Give"). For work done before then, the
demo path is what matters and boldness pays; screens outside it can wait. This
is a scheduling fact, not a product principle — the constraints and principles
above outlive it.
