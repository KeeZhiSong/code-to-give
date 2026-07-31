# Passion To Serve — Event Coordination Tool (MVP)

*Code to Give Asia 2026 · Morgan Stanley*

---

## One-liner

A lightweight web console that lets a Passion To Serve organiser broadcast event
messages to volunteers over WhatsApp and see who's coming — without asking anyone
to install an app, migrate off WhatsApp, or leave the spreadsheets they already use.

## The problem we're solving

Coordination is scattered across WhatsApp, email, giving.sg, notice boards, and
Excel. Event threads interleave, so organisers can't tell what's handled vs.
pending, and time that should go to migrant workers goes to chasing logistics.

## Guiding principle: meet them where they already are

We do **not** replace WhatsApp or force a migration. Volunteers keep using WhatsApp;
the NGO keeps using spreadsheets. Our tool sits on top and does the coordination.
That "we didn't ask anyone to change their behaviour" story is the pitch.

---

## Architecture

```
Google Form ──▶ Google Sheet ─┐   (signup + database — zero build)
                              │
        Website (organiser) ──┼──▶ GreenAPI ──▶ Volunteers' WhatsApp
     compose / segment / send │                        │
                              │                        │ they reply / vote
        Responses tab  ◀──────┴──── webhook ◀──────────┘
       (roster fills up)          (inbound capture)
```

- **Google Forms + Sheets** = signup form and database. No custom auth, no DB to build.
- **Website** = broadcast console. Reads recipients from the Sheet, sends via GreenAPI.
- **GreenAPI** = WhatsApp gateway (QR-connected on a normal number, no Meta approval).
- **Inbound path** = poll votes / replies flow back and land in a Responses tab so the
  organiser sees the roster fill. This return arrow is what makes it a *coordination
  tool* and not just a megaphone.

---

## MVP scope — what's IN

### 1. Signup (no build)
- A Google Form collects: name, WhatsApp number (with country code), language(s),
  optional skills.
- Responses land in a Google Sheet that acts as the volunteer database.
- One consent line on the form: *"We'll use your details only to coordinate
  volunteering. Reply STOP anytime to opt out."* (PDPA.)

### 2. Broadcast console (the website)
- **Read recipients** from the Google Sheet.
- **Segment**: send to everyone, or filter by a column (e.g. language, event interest).
- **Compose** a text message, with `{name}` personalisation merged from the Sheet.
- **Send a Yes/No poll** (not just text) to a segment — the RSVP mechanism.
- **Send server-side** through GreenAPI, one message per recipient, with a delay
  between sends (ban-safety) and a WhatsApp-existence check per number.
- **Result feedback**: after sending, show "X sent / Y failed" and which numbers failed.

### 3. Response capture (the loop-closer)
- Incoming poll votes / replies are written to a **Responses tab** in the Sheet.
- The console shows a simple **roster**: who's going, who isn't, headcount.
- An automatic confirmation reply goes back to each volunteer who RSVPs.

---

## Explicitly OUT of scope (resist these)

These are tempting but will sink the timeline. Note them as "future", don't build them.

- Full event CRUD / calendar / multi-event management
- Conversational multi-step onboarding bot (Forms handles signup instead)
- Volunteer accounts, logins, dashboards for volunteers
- External-partner portals (partners are tracked, not users)
- Skill-based auto-matching, gamification, certificates
- Attendance QR check-in, scheduled sends, message history
- Course / learner tracking

If there's time left after the loop works, the **highest-value stretch** is
personalised message templates (reminder / thank-you) — nothing else.

---

## Data model (Google Sheet)

**`Volunteers` tab**

| Timestamp | Name | Phone | Languages | Skills | OptedOut |
|-----------|------|-------|-----------|--------|----------|

- `Phone` stored with country code, digits only (e.g. `6591234567`); the app appends
  `@c.us` to form the GreenAPI chatId.
- `OptedOut` flips to TRUE on a "STOP" reply; those numbers are skipped on send.

**`Responses` tab** (written by the app)

| Timestamp | Phone | Name | Campaign | Response |
|-----------|-------|------|----------|----------|

---

## Key user flows

**Organiser**
1. Opens the console → sees volunteer list pulled from the Sheet.
2. Writes a message or picks "send RSVP poll", chooses a segment.
3. Clicks send → messages go out → sees the sent/failed count.
4. Watches the roster fill as volunteers respond.

**Volunteer**
1. Scans a QR / opens the Google Form once → submitted, they're in the database.
2. Receives a WhatsApp poll: *"Join Sunday's GIFTIK drive? Yes / No"*.
3. Taps an option → gets a confirmation reply → their name appears on the organiser's roster.

---

## Tech stack

- **Frontend + API**: Next.js (React). All GreenAPI calls happen **server-side** in
  API routes so the token never reaches the browser.
- **Database**: Google Sheets, via the Google Sheets API (service account).
- **WhatsApp**: GreenAPI (Developer/free tier for the build; a single QR-linked number).
- **Runtime**: Node 18+ (built-in `fetch`, no extra deps for the GreenAPI calls).
- **Deploy**: Vercel — or run locally for the demo if venue wifi is reliable.

---

## Build sequence

| Milestone | Deliverable |
|-----------|-------------|
| **M0 ✅** | GreenAPI send + receive proven (done) |
| **M1** | Google Form live → Sheet populated → website reads recipients |
| **M2** | Compose + send **text** broadcast server-side, with delay + result count |
| **M3** | Send **poll** to a segment |
| **M4** | Capture votes/replies → Responses tab → roster view in the console |
| **M5** | (Stretch) `{name}` merge + saved templates |
| **Polish** | Seed real-looking data; **record a demo video as fallback** |

Target: M1–M4 is a complete, demoable loop. Everything else is optional.

---

## Demo plan (50% of the score)

1. **Open on the pain (15s)**: a chaotic WhatsApp thread + a monster spreadsheet.
2. **Persona**: "Meet Priya — she runs GIFTIK drives and spent 11 hours last month
   chasing volunteers across 6 chats."
3. **Show the tool**: Priya opens the console, picks the volunteer segment, sends the
   RSVP poll. Cut to a phone: a volunteer taps **Yes**. Back on the console, the
   roster ticks up live.
4. **Close on mission**: "378 volunteers. Save 5 hours an event, and that time goes
   back to serving migrant workers." End on the mission, not the tech.

**Demo insurance**: record the full WhatsApp flow the night before — live sends depend
on wifi + an un-banned number + GreenAPI uptime, none of which you control on stage.

---

## Risks & gotchas

- **Number ban**: only message opted-in volunteers, add a delay between sends, use a
  spare number — never a personal one. A banned number mid-hackathon is unrecoverable.
- **Buttons vs polls**: use **polls** for Yes/No; WhatsApp interactive buttons render
  unreliably on QR-connected instances.
- **Queue hygiene**: delete each notification after handling, or you'll re-read it forever.
- **Linked phone online**: GreenAPI syncs through the linked phone — keep it awake.
