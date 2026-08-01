# Volunteer Loyalty Programme + Beneficiary VIP Pass

What this is, how it works, and what's still open — for anyone on the team
picking this up.

## What it does

- **Volunteers**: every event they're logged as attending earns points,
  tracked over time (`volunteers.loyalty_points`).
- **Beneficiaries**: same idea, but crossing **4 logged attendances** (more
  than 3) grants a **VIP Pass** — priority access at GIFTIK distribution
  events, which otherwise see queues into the hundreds.
- Both trigger a WhatsApp message with a branded image attached (a
  certificate-style PNG — see "Poster images" below).

## How attendance gets logged — it rides on the RSVP reply

There's **no separate "mark attended" step**. Replying **"YES"** to an
event's WhatsApp poll (handled in `lib/handleWebhook.js`, part of the RSVP
bot being built alongside this) *is* the attendance signal — points/VIP get
logged the moment that reply lands. Replying **"NO"** after a "YES" — or
retracting a poll vote — reverses it, so a changed mind doesn't leave
phantom points or an unearned VIP flag behind.

## What changed / what's new

**Database** (`supabase/005_loyalty_vip.sql` — run once in the Supabase SQL
editor, safe to re-run):
- `events.points_value` — how many points an event is worth (default 1,
  editable per event in the console's event form).
- `volunteer_event_log` / `beneficiary_activity_log` — one row per
  (person, event) attended, so we know *when* and *how much*, not just *that*
  it happened.
- `volunteers.loyalty_points`, `volunteers.loyalty_tier` (cached).
- `beneficiaries.loyalty_points`, `beneficiaries.vip_status` (cached — this
  is what a door-side VIP check reads, no join needed).

**Code**:
- `lib/loyalty.js` (new) — `markAttended()` / `unmarkAttended()`. Looks up
  whether a phone is a volunteer or beneficiary, logs/un-logs the
  attendance, recomputes cached totals, and fires the WhatsApp image+text
  for a volunteer thank-you or a beneficiary crossing into VIP.
- `lib/handleWebhook.js` — calls `markAttended`/`unmarkAttended` right where
  RSVP replies are already recorded (yes → mark, no/retracted → unmark).
- `lib/poster.jsx` (new) — renders the two branded PNGs (navy/gold
  certificate look) using Next's built-in `ImageResponse` (`next/og`) — no
  new dependency.
- `lib/greenapi.js` — new `sendImage()`, using GreenAPI's `sendFileByUpload`
  (posts the image bytes directly, no public URL/storage bucket needed).
- `lib/events.js` + `app/page.jsx` — `points_value` is now a field on the
  event form, so any event can be worth more than 1 point.

## Known limitations / open items

- **No volunteer tier ladder yet** (Bronze/Silver/Gold, "invite to Executive
  team," etc.) — points accumulate correctly, but there's no threshold, so a
  volunteer gets a thank-you message on every logged attendance rather than
  a milestone-gated one. Give real tier numbers whenever they're decided.
- **`GREENAPI_TOKEN` must be set** for the WhatsApp image/text to actually
  send — without it, points/VIP status still save correctly, but the send
  silently fails (by design: a WhatsApp hiccup must never roll back data
  already written).
- Attendance is only as trustworthy as the RSVP reply — there's no
  physical check-in. Fine for volunteers; worth keeping in mind for VIP
  specifically since it's a scarce, valuable privilege.

## Tested (2026-08-01)

Migration applied to the live Supabase project and verified column-by-column.
Full flow tested end-to-end using throwaway test data (fake volunteer/
beneficiary/events, all deleted afterward — never touched real team member
records): points accumulate correctly across different events, don't
double-count on a repeat, VIP flips exactly on the 4th attendance and
reverses correctly if undone, and the real `/api/webhook` route correctly
triggers/reverses loyalty tracking from a simulated "YES"/"NO" reply.
