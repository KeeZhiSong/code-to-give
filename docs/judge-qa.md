# Judge Q&A prep

Answers grounded in what was actually built. Where something is a known gap it
says so — a judge who finds an unacknowledged hole trusts nothing else you said.

---

## 1. Problem & product fit

**Why WhatsApp instead of an app or a portal?**
Migrant workers won't install an app for a charity they see four times a year,
and PTS's volunteers are unpaid people doing this in spare hours. WhatsApp is
already on every phone and already how PTS communicates. So we split the
product along the channel rather than the org chart: organisers get a web
console, everyone else gets a message on the number they already use. Nobody
outside the organising team ever creates an account.

**Who is this actually for?**
The organiser. One non-technical volunteer coordinating events that are planned
months ahead, whose threads currently interleave across WhatsApp, email, Excel,
giving.sg and physical notice boards. The problem isn't admin — it's that
nobody can tell what's handled from what's pending.

**What does it replace?**
The scattering. Not Excel specifically — the fact that the state of an event
lives in six places at once and none of them agree.

**Why should PTS trust the numbers on screen?**
Every count comes from a database query, not from anything a model or a human
typed. The one exception is the impact figure in the post-event thank-you,
which is a display value — an organiser counts a GIFTIK queue on paper and that
number has never reached the system. It's labelled as such in the code and
would need a real headcount field before it went to a live volunteer.

---

## 2. Architecture

**Walk me through the stack.**
One Next.js 15 app on Vercel. Three layers: pages the organiser sees, ~23 API
endpoints that translate HTTP into function calls, and a `lib/` layer holding
all the rules. Supabase (managed Postgres) for storage. GreenAPI as the bridge
to WhatsApp in both directions. Google Forms for intake.

**Why separate `lib/` from the API routes?**
Because the same rules need to run from more than one entry point.
`handleWebhook` is called by both the deployed webhook and a local Node script
with no web server at all — if that logic lived in the route file we'd have
written it twice and the demo would drift from production. Same reason
`markEventAttended` is the only function that credits attendance: points, tiers
and VIP status physically cannot disagree.

**Why Supabase?**
Our data is genuinely relational — events, registrations, volunteers and an
attendance ledger that reference each other. We use Postgres features rather
than just storing JSON: `on delete cascade` means removing an event cleans up
its RSVPs and points history; `unique(volunteer_id, event_id)` makes crediting
attendance idempotent at the database level, not in our code. It's also managed,
so there's no server to run, and the client goes over HTTP so serverless
functions can't exhaust a connection pool.

**How does an RSVP actually get from a phone to the screen?**
The volunteer taps an option on a WhatsApp poll. GreenAPI calls our
`/api/webhook` endpoint — that direction is inbound, the service calling us.
`handleWebhook` resolves which event the vote belongs to using the poll's
`stanzaId`, records it, and sends a confirmation. The roster polls every three
seconds, so it appears within moments.

**How do you know which event a vote belongs to when several are running?**
When a poll is sent we record its message id against the event
(`poll_prompts`). The vote comes back carrying that same id, so the match is
exact. There are two fallbacks — matching the question text, then the
configured default — so a vote lands somewhere rather than vanishing.

---

## 3. WhatsApp / GreenAPI

**Is this the official WhatsApp Business API?**
No. GreenAPI drives a real WhatsApp account paired by QR code, like WhatsApp
Web. We chose it because the official API needs Meta business verification and
template approval, which we couldn't complete in three days. The trade-off is
real and we designed around it.

**What's the risk with that?**
Bulk sending from an unofficial number gets it blocked. So sends are sequential
with a delay between each, recipients are capped, and we use a burner number.
For production you'd move to the official Business API with a branded sender —
the code path is one module (`lib/greenapi.js`), so swapping it is contained.

**Did it ever break?**
Yes, and it's worth knowing. The free tier limits you to three distinct
correspondents per month. On 1 August the counter reset and the first three
numbers we messaged locked in the allowlist — a fourth tester's vote was
rejected at the gateway and never reached our app. That's a tariff limit, not a
code fault, but it's exactly the kind of thing that bites in a live demo.

**Can it handle a real broadcast to hundreds of people?**
Not on this tier, and not from an unofficial number. The architecture supports
it — sends are already queued and rate-limited — but production volume needs the
official API. We'd rather say that than claim a scale we haven't tested.

---

## 4. Data & privacy

**You're handling migrant workers' phone numbers. How is that protected?**
Phone numbers are masked to the last four digits everywhere in the UI and never
written to logs in full. Row-level security is on for every table with no
policies at all — deny by default — so access only happens server-side with a
service key; a leaked public key reads nothing. All demo data is synthetic.

**What if someone doesn't want messages any more?**
They text STOP and are opted out immediately; opt-outs are checked before every
send, including the warm ones like the thank-you message. They can text START
to come back, and an organiser can re-add someone who asks in person.

**Is there authentication on the console?**
No — and that's the biggest gap. It's a hackathon build behind an unlisted URL
with synthetic data. Before this touched real beneficiary data it needs
organiser auth on every route, and the send endpoint especially.

**Where does beneficiary data come from?**
Registered in person by an organiser at a distribution queue or a class
sign-in, on the beneficiaries page. There's no beneficiary-facing form yet.

---

## 5. AI

**Where is AI used?**
One place, deliberately. When a WhatsApp reply isn't a recognisable yes/no —
a real question, or another language — a model classifies it and, if it's a
question, drafts an answer using **only that event's own fields**. If those
facts don't cover it, it says so and points at a human rather than guessing.

**How do you stop it inventing event details?**
It's given the event row as its entire knowledge base and the response is
schema-constrained to a fixed shape. It's never trusted to state a phone number
— that string is built by our code. And every failure mode falls back to the
behaviour from before it existed: ignore quietly.

**Why not more AI?**
Because the rest of the product is counting and scheduling, and a model that
guesses a headcount is worse than a query that knows it. We were explicit about
this: no number an organiser reads comes from a model.

---

## 6. Production readiness — the honest list

**What would you fix first?**

1. **Authentication.** No login today.
2. **Official WhatsApp Business API** instead of an unofficial number.
3. **A migration runner.** Schema changes are `.sql` files applied by hand in
   the Supabase dashboard. One sat unapplied for a day because it arrived with
   a merged branch and nobody noticed. `supabase db push` in CI fixes it.
4. **Real impact figures** — replace the display values with an organiser-entered
   headcount.
5. **Reconcile two overlapping mechanisms** — the event waitlist and the shift
   standby queue both answer "someone dropped out, who's next" and don't share
   data. One of them should win.

**What's the weakest part of the code?**
The task board's drag-and-drop uses the HTML5 API, which has no touch support —
so on a phone at a venue you can't move a task. A status dropdown would fix it
without gesture engineering.

**What did you get wrong and fix?**
Two mechanisms were crediting attendance independently, so points and the
re-invite list could disagree. We collapsed it to one writer. Separately, the
waitlist promoted the wrong person on a cancellation — the FIFO split is
computed live, so asking "who's waiting" *after* the write always answers
"nobody". It now peeks before and notifies after.

---

## 7. Adoption

**Would PTS actually use this?**
The intake is a Google Form and the participant channel is WhatsApp — both
things they already use. The only new surface is the organiser console, and
only for the handful of people who coordinate. That's the smallest possible
behaviour change.

**How long to onboard an organiser?**
The console is five screens with no jargon. The harder part is migrating
existing event history, which today would be a CSV import.

**What happens if the tool goes down mid-event?**
WhatsApp keeps working — messages already sent are already delivered. The
console going down costs visibility, not communication.

---

## 8. Hostile questions

**Isn't this just a CRUD app with a WhatsApp integration?**
The integration *is* the product. The hard part isn't storing an event, it's
that the people you're coordinating will never open your software — so every
piece of state has to be reachable and updatable through a channel you don't
control. The roster updating live from a poll vote is that idea working.

**Why should this win over a team that built more features?**
We'd rather show five things that work end to end on a real WhatsApp account
than fifteen that work in a mock. Every number on screen came from the database
during this demo.

**What if WhatsApp bans your number tomorrow?**
Then the console still works and the sending module gets swapped for the
official API. It's one file. We designed for that because we knew the tier we
were on.

**Did AI write this?**
Yes, with the team directing it — and the interesting part is what it caught:
two conflicting attendance writers, a waitlist that congratulated the person
cancelling, and a dashboard shipping a database key to the browser. Those were
review findings, not generated features.
