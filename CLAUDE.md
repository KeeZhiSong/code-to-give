# Passion To Serve — Event Coordination Platform

> **Project name:** _TBD_ (brainstorm doc still reads `[Project Name]` — pick a name before submission).
> **Event:** Morgan Stanley "Code to Give" Hackathon 2026.
> **Submission deadline:** **Monday, 3 August 2026, 07:00 HKT/SGT** (hard cut-off).
> **Team:** Nickson Ho, Chermaine Chua, Girija Murugavel, + 2.

This file is the single source of truth for how we build this project. It captures the
**problem, scope, stack, and known unknowns** so any team member — or any Claude session —
can pick up work without re-reading the source PDFs. It is intentionally project-specific;
general coding/testing/git/security standards live in the global `~/.claude` rules and are
**not** repeated here.

Source material (in repo root):

- `Hackathon Brainstorming Passion to Serve.pdf` — our team's user stories & requirements.
- `Passion To Serve - Introduction v6.0 Morgan Stanley Hackathon 30 July 2026.pdf` — NGO + official challenge.
- `Passion to Serve Events List (1).pdf` — real event workflows & where coordination breaks down.

---

## 1. The Client & The Problem

**Passion To Serve (PTS)** is a Singapore-based, volunteer-run nonprofit (founded 2020, publicly
audited) that supports **migrant workers** and other disadvantaged groups. It works closely with
the Singapore Ministry of Manpower. Its work spans three pillars:

| Pillar                 | What it is                                                                                   | Example events                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Items To Serve**     | Pre-loved / new item collection & free distribution (GIFTIK), R3 (Reduce/**Reuse**/Recycle)  | GIFTIK distribution drives (~quarterly), collection drives in condos, beach cleanups |
| **Knowledge To Serve** | Digital / financial / English literacy courses, professional-level delivery w/ digital certs | Computer literacy, MS Excel, spoken English, financial literacy (interactive games)  |
| **Peace To Serve**     | Wellness & recreation                                                                        | Yoga / Zumba / meditation, health talks, national-day events (1,000–1,500 footfall)  |

**Impact to date:** 20,894 beneficiaries · 26,620 items donated · 945 student beneficiaries · 378 volunteers/educators.

### Problem statement (official)

> How might Passion to Serve create a **simple, unified way to coordinate volunteer-led events**
> so that organizers can easily track progress, manage volunteers, and execute events with confidence?

### The real pain (from the events list)

Every event runs a **Plan → Execute → Post-execution** lifecycle, but coordination is scattered
across **WhatsApp, email, Excel, giving.sg, physical notice boards, Facebook & LinkedIn**. Events are
planned months ahead, so threads for different events **interleave** — nobody can tell what's been
handled vs. what's pending. This caps how many events the team can run. Time that should go to
migrant workers is lost to logistics.

### Mission (what we build)

A **centralized event coordination tool** that lets PTS plan, manage, and execute volunteer-led
events end-to-end. Per the challenge, the solution must:

1. Centralize all coordination into a **single view per event**.
2. Give clear visibility into **responsibilities, progress, and outstanding tasks**.
3. Enable **organized communication** across volunteers, organizers, and external partners.
4. Simplify **volunteer management**: registration, communication, attendance, post-event follow-up.
5. Make key event info **easy to find, update, and share**.
6. **Reduce reliance on fragmented tools** and manual coordination.

---

## 2. Scope & Prioritisation

**We target as much of the problem statement as we can — breadth over a single polished vertical.**
We do **not** pick one stakeholder and ignore the others. If we must cut, we **prioritise within each
stakeholder**, never by dropping a stakeholder.

The three stakeholders (all in scope):

- **Organiser / Admin** — plans events, tracks tasks, manages volunteers & logistics partners, sends announcements, monitors readiness.
- **Volunteer** — discovers events, signs up, joins waitlists, gets reminders, has a good enough experience to return.
- **Beneficiary (migrant worker)** — discovers events, sees clear details, tracks course progress. _(Whether beneficiaries are an in-app stakeholder is an open question — see §6.)_

### The unifying model: the **Event lifecycle**

Every feature hangs off one event moving through three phases. Build the data model around this.

```
PLAN                          EXECUTE                    POST-EXECUTION
- initiate / assign tasks     - attendance / check-in    - certificates
- venue + schedule            - item distribution        - acknowledgements / thank-yous
- transport + warehouse       - session delivery         - social-media recap
- publicity to workers        - capture memories         - follow-up / progress update
- volunteer registration      - venue teardown
- partner coordination
```

### MVP definition of done (all stakeholders, thin but complete)

1. **Organiser single pane of glass** — one board per event: tasks with owner + deadline + status,
   live volunteer & participant headcount, a readiness signal, and **broadcast** (no 1-by-1 messaging).
2. **WhatsApp registration & broadcast** — volunteers/beneficiaries register via a **Google Form**
   (phone number → Google Sheet); organisers **compose / edit / delete / send** broadcast messages from a
   website, which fans them out to recipients over **GreenAPI**. See **§3.1**.
3. **Volunteer journey** — browse all events (list **and** calendar), one-click signup (no repeat forms),
   **waitlist → auto-promote + notify** on drop-out, pre-event reminders.
4. **Beneficiary-facing** — clear event details (what it is, what to bring); course **progress / history**
   for Knowledge-To-Serve courses (resume where you left off).
5. **Cross-cutting** — replace the Excel + scattered-chat status-tracking with one queryable source of truth.

Anything beyond this is **stretch** (see §5).

---

## 3. Tech Stack

**Decision: Next.js full-stack on Vercel** (single repo, single deploy target — least setup for a 3-day build).

| Layer    | Choice                                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | **Next.js 16 (App Router)** + **React 19** + **TypeScript (strict)** + **Tailwind CSS 4**                                                                                                                         |
| Backend  | Next.js **Route Handlers** / **Server Actions** (no separate API server)                                                                                                                                          |
| Database | **Google Sheets** for the broadcast feature (Recipients + Broadcasts tabs) via service-account `googleapis`. Postgres via Vercel Marketplace remains an option for other features but is **not** provisioned yet. |
| ORM      | None for Sheets. Prisma schema exists but is **parked** (see §3.1) — no client generated, no migrations run                                                                                                       |
| Auth     | Auth.js (NextAuth) or the DB provider's auth — role-based: organiser / volunteer / beneficiary. **Not yet built**; the broadcast Send endpoint is currently unauthenticated (see §8).                             |
| Deploy   | **Vercel** — every PR gets a preview URL                                                                                                                                                                          |

### Stack rules

- **App Router + Server Components by default.** Client components only where interactivity needs them.
- **Do NOT use `runtime = 'edge'`.** Default Node.js (Fluid Compute) — streaming/SSE work without it.
- **Provision real integrations via the Vercel Marketplace skill** before writing any provider code.
  Never hardcode a provider SDK for storage/DB/email/auth.
- **No new dependencies without flagging first.** Prefer battle-tested libraries over hand-rolled utilities.
- Consistent API envelope: `{ status, data, error, meta? }`. Validate all input at the boundary (Zod).
- Follow the global `~/.claude` rules for immutability, error handling, file size (<800 lines), naming, testing (80%+), and security.

### 3.1 WhatsApp registration & broadcast (committed MVP #2)

**Goal:** kill the organisers' #1 pain — messaging every volunteer/beneficiary one-by-one on WhatsApp.
Participants **register via a Google Form**; organisers **compose and broadcast** messages from a website;
recipients receive them on WhatsApp via **GreenAPI**. Committed deliverable, not a stretch idea.

**Architecture (team-agreed; supersedes the earlier Meta Cloud API + FSM design):**

```
 Google Form ──▶ Google Sheet ──▶ Organizer Website ──▶ GreenAPI ──▶ recipients' WhatsApp
 (volunteers/    (Recipients tab:   (Broadcasts tab:      (send)      (real WA account,
  beneficiaries   phone + role)      compose/edit/                     no Meta verification)
  submit phone)                      delete/send)
```

- **Registration = Google Form → Google Sheet.** A user taps a link, fills the Form (incl. phone number),
  and the row lands in a Google Sheet `Recipients` tab. No branching bot, no inbound webhook. (Form + Sheet
  population are owned by teammates.)
- **Google Sheet is the datastore.** `Recipients` tab (teammate-owned; the site reads phone numbers) and a
  `Broadcasts` tab (the site's own draft store: `id | message | status | createdAt | updatedAt | sentAt |
sentCount | failedCount`, `status ∈ draft|sent|deleted`, soft-delete). No Postgres for this feature.
- **Organizer website (our scoped deliverable)** at `/broadcasts`: compose / edit / delete / **send** broadcast
  messages. On Send, the site reads the `Recipients` numbers and fans out via GreenAPI with a per-recipient
  success/fail summary. Route Handlers under `app/api/broadcasts/**`; Server Components for the list, one
  Client Component for the composer.
- **Sheets access = service account on a private sheet.** Phone numbers stay non-public; the sheet is shared
  with a service-account email. Read numbers + read/write drafts through `googleapis` (`sheets_v4`).

**WhatsApp provider — GreenAPI:**

- **GreenAPI** drives a **real WhatsApp account** (QR-paired like WhatsApp Web). **No Meta business
  verification and no 24-hour-window / template-approval rule** — messages are free-form. This removes the
  top schedule risk of the old design.
- Send endpoint: `POST {apiUrl}/waInstance{idInstance}/sendMessage/{apiTokenInstance}` with body
  `{ chatId: "<digits>@c.us", message }` → `{ idMessage }`. Instance ID + API token are secrets (env only).
- **⚠️ Ban risk (design around this):** GreenAPI uses an unofficial number; bulk sends can get it blocked.
  Send **sequentially with a delay** between messages (`BROADCAST_SEND_DELAY_MS`), cap recipients for the
  demo (`BROADCAST_MAX_RECIPIENTS`), allowlist the GreenAPI Developer-tier test recipients, and use a burner
  number. GreenAPI also has a server-side send queue + delay parameter.

**Identity & data (synthetic data only; treat phone/name as sensitive PII):**

- **Phone number is the routing key** → converted to GreenAPI `chatId` (`"<digits>@c.us"`, default SG cc `65`).
- **Never store phone numbers in the `Broadcasts` tab, never log them** (mask to last-4 in any failure record),
  keep the `Recipients` sheet private.
- **Parked from the earlier design (kept on disk, not wired):** the channel-agnostic FSM engine in
  `lib/conversation/*` and the Postgres `prisma/schema.prisma`. Registration is a Google Form now, so neither
  is on the critical path; revisit only if we move registration back in-app.

---

## 4. User Story Backlog

From the brainstorm doc. `**` = **pending team review** (not yet confirmed in/out of scope). ~~strikethrough~~ = deprioritised.

### Organiser

- Know how many participants **and** volunteers are coming (visible to the logistics team too) → plan manpower.
- See **all tasks for an event on one board** with beneficiaries + deadlines — no chat-hunting.
- **One-click announcements** to all volunteers (no email/text 1-by-1).
- Auto-message **backup volunteers** when headcount falls short (no manual chasing).
- Tool suggests a **next action when the readiness score is low** (e.g. re-invite past volunteers).
- **Templates for repeating events** — reuse the same actions/checklist.
- `**` (pending review) **Feasible date/time selection** (calendar / when2meet UX) for 25–30-volunteer events.
- `**` (pending review) **Move off Excel** into a centralised DB as manpower & event count grow.
- **Logistics-partner template** per event type — a consolidated "who to contact" view.

### Volunteer

- Be **notified of events** I can join.
- Join a **waitlist**; auto-added + notified when a spot opens.
- **View all available events on one page**; also in **calendar** format.
- **One-click signup** (skip the repeat form each time).
- **Pre-event reminder** so I don't miss it.
- **Register via a Google Form** (phone number → Google Sheet) and **receive broadcasts on WhatsApp** — committed, see §3.1.
- Get **event suggestions I'm likely to enjoy** (ML) instead of scrolling generic broadcasts.
- ~~Positive experience → keep volunteering~~ · ~~New-volunteer onboarding guidance~~ _(deprioritised)_

### Beneficiary (migrant worker)

- `**` (pending review) Be **notified of events** I can join.
- Join a **waitlist**; auto-added + notified when a spot opens.
- `**` (pending review) A **support group** to reach out to.
- **Resume reminders** for educational modules — continue where I left off (course history).
- **View events with clear details** on an app (what it's about, what to bring).

---

## 5. Stretch / Future (do NOT build in MVP)

- **CV defect detection** — auto-flag defective donated items (organiser story, tagged CV).
- **ML event recommendations** for volunteers/beneficiaries.
- **Deep course-dependency tracking** for skill enhancement (prerequisites across courses) —
  PTS explicitly calls this an _unsolved_ problem; a simple attended/completed history is enough for MVP.
- **Broadcast scale-out** beyond the demo — official WhatsApp Business API / branded number, larger recipient
  volumes, number-warming to avoid bans. The **core broadcast feature is committed** (§3.1); only production scale is stretch.
- **In-app conversational registration** — reviving the parked FSM engine (`lib/conversation/*`) as an
  alternative to the Google Form, should the team decide to bring registration back in-house.
- **Multilingual broadcasts** (Tamil / Bengali / Mandarin) — wire translations post-MVP.

---

## 6. Open Questions & Working Assumptions

We sent the clarifications below to the organising team and are **awaiting answers**. Until they reply,
build against the **working assumption** so nobody is blocked. Revisit each when answered.

| #   | Question to organisers                                                                                                                         | Working assumption (build against this)                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How central is **WhatsApp**? Is it primary because workers are comfortable with it? Open to a different platform, or keep WhatsApp?            | **Committed:** WhatsApp is the worker/volunteer-facing channel — registration via Google Form → Google Sheet, broadcasts out via GreenAPI (§3.1). Organiser coordination stays in-app. |
| 2   | Must the solution treat **migrant workers** specifically as an in-app stakeholder?                                                             | Assume **yes** — beneficiary role exists, but keep their surface minimal (view events, course progress) in case they're de-scoped.                                                     |
| 3   | **Mobile app or web** for team & volunteers day-to-day?                                                                                        | Assume **responsive web** (PWA-friendly). Lowest friction, one codebase, installable.                                                                                                  |
| 4   | What's actually wrong with **Excel** — manual entry, Excel's limits, or missing features?                                                      | Assume the pain is **shared state + status tracking across events**, not spreadsheets per se. Replace with a queryable single source of truth.                                         |
| 5   | Beyond venue licensing/booking, what else in the **donation drive** eats time?                                                                 | Assume **collection→transport→warehouse→distribution** coordination + volunteer chasing are the hot spots.                                                                             |
| 6   | **Self-contained** (chat + info + coordination in one place) or **integrate** with existing tools (WhatsApp, Excel)?                           | Assume **self-contained core** with **import/export + integration hooks** so adoption is gradual, not forced.                                                                          |
| 7   | How does a **drive unfold on the day** (do workers browse freely; total duration)? Do we design the on-the-ground flow or just setup/teardown? | Assume we focus on **setup + teardown + attendance/distribution tracking**, not choreographing the browsing itself.                                                                    |
| 8   | For courses, **sign-up vs completion** numbers, and what causes **drop-off**?                                                                  | Assume drop-off matters → support **reminders + resume-where-you-left-off**; keep completion analytics lightweight.                                                                    |
| 9   | Biggest **logistics-partner** coordination pain — reaching them, consolidating multi-partner info, or aligning a time?                         | Assume **consolidating info + scheduling** → partner directory per event type + shared availability/when2meet.                                                                         |

> When an answer arrives: update the assumption row, adjust scope in §2/§4, and note the change in the commit.

---

## 7. Design Priorities

- **Simplicity first.** The client is volunteer-run and non-technical. Fewer screens, obvious flows, sensible defaults.
- **One event, one view.** Never make an organiser cross-reference chats to know event status.
- **Low-friction for volunteers.** One-click actions; no repeat data entry.
- **Accessible & mobile-friendly.** Volunteers act on phones; follow the a11y rules in the global ruleset.
- **Demo-ready.** Seed realistic data (a GIFTIK drive, a wellness session, a literacy course) so the whole lifecycle is visible in a demo.

---

## 8. Constraints & Reminders

- **Deadline is fixed:** 3 Aug 2026, 07:00 SGT. Scope to what ships and demos, not what's complete.
- **Top risks for the broadcast feature (§3.1):** (a) GreenAPI number **ban on bulk sends** — mitigate with a
  per-message delay, a small recipient cap, allowlisted test recipients, and a burner number; (b) the **Send
  endpoint is currently unauthenticated** — cap recipients and add organiser-only auth before it's real.
- **Broadcast secrets** — GreenAPI (`GREENAPI_ID_INSTANCE`, `GREENAPI_API_TOKEN`, `GREENAPI_API_URL`) and Google
  Sheets service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SHEETS_SPREADSHEET_ID`) live in
  env vars only — `.env.example` placeholders, never commit real values.
- No hardcoded secrets; `.env.example` with placeholders only; never commit `.env`.
- No direct commits to `main`; PRs get Vercel preview URLs.
- Handle real NGO-adjacent data carefully — treat any beneficiary/volunteer PII (phone, name, dietary/health)
  as sensitive; **synthetic data only** in fixtures and demos. Never store phone numbers in the `Broadcasts`
  tab; never log raw numbers (mask to last-4); keep the `Recipients` sheet private.
- Keep this file current: when scope, stack, or an open question changes, edit `CLAUDE.md` in the same PR.
