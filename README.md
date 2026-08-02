# Passion Console

**One place to run volunteer events. Organisers get a console; everyone else gets WhatsApp.**

Built for [Passion To Serve](https://passiontoserve.org), a volunteer-run Singapore nonprofit
supporting migrant workers, for the Morgan Stanley *Code to Give* Hackathon 2026.

---

## The problem

Passion To Serve runs donation drives, literacy classes and wellness sessions — planned months
in advance, by volunteers, in whatever hours they can spare.

The coordination for those events lives in six places at once: WhatsApp threads, email chains,
Excel trackers, giving.sg, Facebook, and a physical notice board. Because events are planned so
far ahead, their threads interleave — so nobody can tell what has been handled from what is
still pending without scrolling back through months of chat.

The cost isn't the admin. It's the hours spent reconstructing where things stand, and the
ceiling that puts on how many events the team can run at all.

## The decision everything follows from

Migrant workers won't install an app for a charity they see four times a year, and unpaid
volunteers won't either. So the product splits along the **channel** rather than the org chart:

> **Organisers get a web console. Everyone else gets a WhatsApp message on the number they
> already use.** Nobody being coordinated ever creates an account.

A competitor could copy the screens. What they couldn't copy is that the people being
coordinated never have to show up to the software at all.

---

## How it works

1. **Volunteers sign up once** through a Google Form. Name and number land in the console.
2. **An organiser describes the event in one sentence** — *"GIFTIK drive at Kranji next Sunday
   9am–1pm, bring a reusable bag"* — and the form fills itself in, ready to correct and save.
3. **One click sends the invite**: the full briefing and a Yes / Can't-make-it poll, over WhatsApp.
4. **Volunteers reply in their own words, in their own language.** The roster updates on screen
   within seconds, and if someone drops out the next person on the waitlist is promoted and told.
5. **After the event, one click closes it out.** Attendance is recorded, points and beneficiary
   VIP passes update, and everyone gets a thank-you showing what their hours amounted to.

---

## Features

**Planning**
- One view per event: tasks with owners and deadlines, live headcount, readiness score
- Templates for repeating events, with their task list and logistics partners
- Shift coverage with standby queues
- Logistics partner directory

**Reaching people**
- WhatsApp invitations, polls and broadcasts, with audience tabs for volunteers vs beneficiaries
- Capacity-aware waitlist that promotes and notifies automatically on a cancellation
- Automated backup-volunteer alerts when an event is short close to the day
- STOP / START opt-out honoured on every send, including the warm ones

**After the event**
- Attendance recorded once, by an organiser, from the roster
- Volunteer loyalty points and tiers; beneficiary VIP Pass
- Post-event thank-you showing a volunteer their own share of the outcome

---

## AI

Three features, all narrow, all grounded in real event data.

**1. Free-text WhatsApp replies.** No keywords. *"yes ok lah i can come"* RSVPs someone;
*"sorry cannot, working that day"* marks them unavailable. Questions are answered **only from
that event's own fields** — and answered in whichever language they were asked in. If the facts
don't cover it, the model says so and the app appends a real human's contact details.

**2. Event drafting.** A sentence of shorthand becomes a filled-in event form.

**3. Shift handover briefs.** The outgoing shift's logs become a three-bullet brief for the
volunteer taking over. *(Built; on the `Aditi` branch, not merged.)*

### The rules we gave it

- **It never invents.** *"beach cleanup"* on its own fills four fields and leaves eight blank. A
  blank costs an organiser five seconds; a wrong venue costs a volunteer a wasted trip.
- **It never states a phone number.** The model writes the apology; the app appends the contact.
- **It never does arithmetic.** Every headcount, point, tier and VIP status comes from a database
  query. No number on screen is produced by a model.
- **It drafts; it never sends unreviewed.**
- **It fails closed, and fast.** Hard timeouts on every model call. If the model is slow or down,
  the product behaves exactly as it did before AI existed.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React, plain JavaScript |
| Hosting | Vercel, `sin1` (Singapore), with a daily cron |
| Database | Supabase (managed Postgres), RLS on with no policies |
| WhatsApp | GreenAPI — send and receive, both directions |
| Intake | Google Forms → published CSV |
| AI | Gemini (`@google/genai`) |

Three layers inside the app: `app/` pages, `app/api/` route handlers that translate HTTP into
function calls, and `lib/` which holds every rule. The split matters — `lib/handleWebhook.js` is
called by both the deployed webhook and a local Node listener with no web server at all, so the
demo path and production can't drift.

---

## Running it locally

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

Apply the migrations in `supabase/` in numerical order, in the Supabase SQL editor. They're all
safe to run more than once.

### Environment

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database. Server-side only. |
| `GREENAPI_API_URL`, `GREENAPI_ID_INSTANCE`, `GREENAPI_TOKEN` | WhatsApp gateway |
| `SHEET_CSV_URL` | Published Google Form responses |
| `GEMINI_API_KEY` | AI features. Unset simply disables them. |
| `CAMPAIGN` | Default event for messages that carry no poll id |
| `SEND_DELAY_MS` | Gap between sends. **Do not set to 0** — see below. |
| `DEFAULT_CONTACT_PHONE` | Fallback human contact. No default; unset drops the line. |

### Receiving replies

Point GreenAPI's `webhookUrl` at `https://<your-domain>/api/webhook`, with `incomingWebhook`
and `pollMessageWebhook` both `yes`.

For local development without a public URL, `npm run listen` polls the same queue and feeds the
same handler. **Don't run both at once** — GreenAPI hands each notification out once, so a local
listener will steal votes from the deployed site.

---

## Things worth knowing before you build on this

- **There is no authentication.** This is a hackathon build behind an unlisted URL with synthetic
  data. Organiser auth on every route is the first thing production needs.
- **WhatsApp goes through an unofficial number.** Bulk sending gets it blocked, which is why sends
  are sequential with a delay and recipient counts are capped. Production means the official
  Business API — contained to `lib/greenapi.js`.
- **Impact figures in the thank-you message are display values.** They do not reconcile with the
  figures PTS publishes. Replace them with a real headcount before this reaches a live volunteer.
- **Migrations are applied by hand.** There's no runner, and one sat unapplied for a day because
  it arrived with a merged branch. `supabase db push` in CI fixes it.
- **Two overlapping mechanisms** answer "someone dropped out, who's next": the event waitlist and
  the shift standby queue. They don't share data. One should win.
- **All demo data is synthetic.** Treat any real volunteer or beneficiary phone number as
  sensitive: masked to last-4 in the UI, never logged in full.

---

## Team

Nickson Ho · Chermaine Chua · Girija Murugavel · Aditi · Zhi Song
