# Broadcast Feature — Session Summary

_Date: 2026-07-31 · Scope: organizer broadcast website (compose / edit / delete / send)_

This document summarizes the work completed on the WhatsApp **broadcast** feature and the
supporting scaffold. It is a hand-off / review aid — not a spec. The authoritative spec lives in
`CLAUDE.md` §3.1.

---

## 1. What this feature does

Lets an organizer compose a message once and broadcast it to every registered recipient over
WhatsApp, instead of messaging people one-by-one.

```
Google Form ──▶ Google Sheet ──▶ /broadcasts website ──▶ GreenAPI ──▶ recipients' WhatsApp
 (teammates)    Recipients tab    compose/edit/delete/     (send)
                Broadcasts tab    send  (OUR SCOPE)
```

- **Recipients tab** — phone list, populated by teammates via a Google Form (we only read it).
- **Broadcasts tab** — our draft store: `id | message | status | createdAt | updatedAt | sentAt | sentCount | failedCount`, `status ∈ draft|sent|deleted` (soft-delete).
- **GreenAPI** — third-party gateway driving a real WhatsApp account (no Meta verification, no 24h-window rule).

---

## 2. Architecture (layered, dependency-injected)

Every network/timer/credential dependency is injected, so the whole stack is unit-testable with
**zero live credentials**.

```
app/broadcasts/page.tsx            Server Component — lists drafts
  └─ components/BroadcastComposer.tsx   Client — compose/edit/delete/send + confirm dialog
        │ fetch()
        ▼
app/api/broadcasts/route.ts             GET (list) · POST (create)
app/api/broadcasts/[id]/route.ts        PUT (edit) · DELETE (soft-delete)
app/api/broadcasts/[id]/send/route.ts   POST (send) → read Recipients → GreenAPI fan-out
        │
        ├─ lib/broadcasts/service.ts   composition root (wires repos + sender from env)
        ├─ lib/greenapi/*              chatId + HTTP client + throttled fan-out
        ├─ lib/sheets/*                service-account client + Recipient/Broadcast repos
        ├─ lib/api/*                   { status, data, error, meta? } envelope + Zod schemas
        └─ lib/errors.ts               shared getErrorCode()
```

---

## 3. Work done this session (review-fix batch, TDD)

The prior session built the feature end-to-end. This session ran the mandatory **code-review** +
**security-review** agents (non-author), then applied the consolidated findings via RED → GREEN → refactor.

### Correctness / robustness

| File                               | Change                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/greenapi/broadcast.ts`        | Split phone-parse vs send into separate `try` blocks. A malformed cell (e.g. a stray `"N/A"`) is isolated as an `INVALID_PHONE` failure — with delay + `continue` — instead of aborting the whole fan-out or being mislabeled `SEND_FAILED`.                                                   |
| `lib/broadcasts/service.ts`        | Extracted testable `sendBroadcastWith(deps, id, params)`. Added a **resend guard before fan-out** (`BroadcastAlreadySentError`) so a double-click / retry / second tab cannot re-blast a `sent` broadcast. Added `markSentWithRetry` so a failed status write doesn't invite a duplicate send. |
| `lib/api/respond.ts`               | Error responses now surface a message only for **recognized typed codes**; everything else is logged generically and **digit-redacted** (no PII / URL / token leak). Added `409` mapping for already-sent.                                                                                     |
| `lib/api/schemas.ts`               | Exported `MAX_MESSAGE_LENGTH` (single source of truth); reject C0/C1 control characters (defence-in-depth on the WhatsApp payload).                                                                                                                                                            |
| `components/BroadcastComposer.tsx` | Send button is disabled + relabeled **"Sent"** when `status === "sent"` (mirrors the server guard in the UI); imports the shared `MAX_MESSAGE_LENGTH` instead of a local literal.                                                                                                              |
| `lib/errors.ts` _(new)_            | Shared `getErrorCode(error)` — consolidated two duplicated inline helpers (DRY).                                                                                                                                                                                                               |
| `lib/sheets/mapping.ts`            | Removed dead `BROADCAST_COLUMN_COUNT` constant.                                                                                                                                                                                                                                                |

### Test-infrastructure fix (root-caused this session)

**`vitest.config.mts` _(new)_** — Vitest does **not** read `paths` from `tsconfig.json`, so any test
importing an `@/…` module silently failed to load. This is why `lib/broadcasts/service.test.ts`
reported "0 tests". Added a scoped `@/*` alias mirror. Surfacing the real coverage picture then let
me add genuine unit tests for the pure env parsers:

- `greenApiConfigFromEnv` — reads vars / throws `NOT_CONFIGURED` on missing.
- `sheetsEnv` — reads vars / restores `\n` in the private key / throws `SHEETS_NOT_CONFIGURED`.
- `broadcastConfig` — defaults / overrides / non-numeric-int fallback.

The one genuine network boundary (`getSheetsApi`, the googleapis wiring) is marked
`/* v8 ignore */` — it is verified only by the end-to-end run, by design.

---

## 4. Verification gate — all green

| Step                       | Result                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Typecheck (`tsc --noEmit`) | exit 0, no errors                                                                                    |
| Tests (`vitest run`)       | **69 passed / 69** across 11 suites                                                                  |
| Coverage                   | **90.04% stmts · 83.47% branch · 91.42% lines** · funcs 78.78%                                       |
| Build (`next build`)       | clean — all 6 routes emitted                                                                         |
| Lint (`eslint`)            | 0 errors                                                                                             |
| Security scan              | no hardcoded secrets · no stray `console.log` · `.env` gitignored · `.env.example` placeholders only |

> **Function coverage (78.78%) is ~1.2 pts under the 80% target** — accepted for the demo. The gap is
> the thin composition-root delegators in `service.ts` (`listBroadcasts` / `createBroadcast` /
> `editBroadcast` / `deleteBroadcast` + repo/sender factories) that only wire env-bound collaborators
> and delegate to already-tested code. Statements, branches, and lines all clear 80%.

---

## 5. Open items (require a decision before "done")

1. **No commits yet.** The repo was `git init`'d on branch `develop` but the initial commit was never
   made — so committing this is the **initial commit of the whole scaffold + feature**, not a
   feature commit on top of history. No remote is configured (no Vercel preview wired yet).

2. **Auth (C1) — still open.** `POST /api/broadcasts/[id]/send` is **unauthenticated**. Current
   guardrails are the recipient cap + the confirm dialog only. Options:
   - (1) leave as-is for the demo,
   - (2) add a minimal `ORGANISER_API_KEY` shared-secret guard now,
   - (3) wait for the team's real role-based auth.
     This decision gates whether the remaining security items (rate limiting, security headers,
     `npm audit fix`) land now or in a follow-up PR.

3. **Live credentials needed to run end-to-end** (not for unit tests): GreenAPI instance ID/token,
   Google service-account email + private key, spreadsheet ID. All are `.env`-only
   (`.env.example` has placeholders). This is the flagged "external website APIs needed" pause point.

---

## 6. Security & PII invariants (upheld)

- Phone numbers never stored in the `Broadcasts` tab, never logged (masked to last-4 in failure records).
- Recipients sheet stays private (shared only with the service-account email).
- GreenAPI token lives in the request URL path → never echoed into any thrown error or log.
- Synthetic data only in all tests/fixtures.
- Ban-risk mitigations: sequential throttled send (`BROADCAST_SEND_DELAY_MS`), recipient cap
  (`BROADCAST_MAX_RECIPIENTS`), confirm dialog before dispatch.
