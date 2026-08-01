-- Migration 008 — event details and editable RSVP replies
-- Run in the Supabase SQL editor. Safe to run more than once.
--
-- The console is organiser-facing, so WhatsApp is the ONLY channel a volunteer
-- has. Until now the invite was a bare poll question — people were asked to
-- give up a Sunday with no date, venue, or idea what to bring, even though the
-- events table already knew most of it.
--
-- Everything here is optional. A blank column simply omits that line from the
-- message, so a half-filled event still sends exactly as it does today.

alter table events
  -- What the event actually is, in a sentence.
  add column if not exists description   text,
  -- "A water bottle and a cap."
  add column if not exists what_to_bring text,
  -- "Comfortable clothes, covered shoes."
  add column if not exists dress_code    text,
  -- Separate from `venue` on purpose: the venue gets you to the right
  -- postcode, the meeting point gets you to the right people.
  add column if not exists meeting_point text,
  -- Lets the invite say "9:00am – 1:00pm" rather than just a start time.
  add column if not exists ends_at       timestamptz,
  -- The automatic reply after someone votes. Null falls back to the wording in
  -- lib/eventMessage.js, so existing events keep today's behaviour.
  add column if not exists confirm_yes   text,
  add column if not exists confirm_no    text;
