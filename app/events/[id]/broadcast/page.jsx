"use client";

// Broadcast — pick a segment, compose, send.
//
// The one screen that messages real people, so it gets its own route rather
// than a scroll position: you arrive here deliberately.
//
// `?segment=past-volunteers` is how the Readiness Score's "re-invite N past
// volunteers" suggestion hands off. The list is fetched from the readiness
// endpoint rather than passed in the URL — phone numbers have no business in
// browser history or server logs.

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RecipientList from "@/components/RecipientList.jsx";
import ComposePanel from "@/components/ComposePanel.jsx";
import { useEvent } from "@/lib/ui/useEvents";
import { useRecipients, useRecipientFilters, useRoster } from "@/lib/ui/useRecipients";

export default function BroadcastPage({ params }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const segment = searchParams.get("segment");

  const { event } = useEvent(id);
  const recipients = useRecipients();
  const filters = useRecipientFilters(recipients.people);
  const { reload: reloadRoster } = useRoster(event?.name);

  const [selected, setSelected] = useState(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [note, setNote] = useState("");

  // Default to everyone who hasn't opted out — unless we arrived with a
  // segment, in which case that wins.
  useEffect(() => {
    if (seeded || recipients.people.length === 0) return;
    if (segment) return;
    setSelected(
      new Set(recipients.people.filter((p) => !p.optedOut).map((p) => p.phone))
    );
    setSeeded(true);
  }, [recipients.people, seeded, segment]);

  // Resolve the handoff: ask readiness who it meant, then preselect exactly
  // those people so the organiser can review before sending.
  useEffect(() => {
    if (segment !== "past-volunteers" || seeded) return;
    let cancelled = false;
    fetch(`/api/events/${id}/readiness`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const suggestion = (d.suggestions || []).find((s) => s.recipients);
        const phones = (suggestion?.recipients || []).map((r) => r.phone);
        if (phones.length > 0) {
          setSelected(new Set(phones));
          setNote(
            `Preselected ${phones.length} past volunteer${phones.length === 1 ? "" : "s"} who haven't replied yet. Review before sending.`
          );
        } else {
          setNote("No past volunteers left to re-invite for this event.");
        }
        setSeeded(true);
      })
      .catch(() => setSeeded(true));
    return () => {
      cancelled = true;
    };
  }, [segment, seeded, id]);

  const chosen = filters.visible.filter((p) => selected.has(p.phone));

  return (
    <div className="grid">
      <div>
        {note && <div className="ok" style={{ marginTop: 0 }}>{note}</div>}
        <RecipientList
          people={recipients.people}
          filters={filters}
          source={recipients.source}
          needsSync={recipients.needsSync}
          syncResult={recipients.syncResult}
          onSync={recipients.sync}
          syncing={recipients.syncing}
          loading={recipients.loading}
          onRejoin={async (phone) => {
            await fetch("/api/optouts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone, optedOut: false }),
            });
            await recipients.reload();
          }}
          selected={selected}
          onToggle={(phone) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(phone)) next.delete(phone);
              else next.add(phone);
              return next;
            })
          }
          onSelectAll={(selectable, allSelected) =>
            setSelected((prev) => {
              const next = new Set(prev);
              // Only ever touch what's on screen, so a filtered "select all"
              // can't silently include the people you filtered out.
              selectable.forEach((p) =>
                allSelected ? next.delete(p.phone) : next.add(p.phone)
              );
              return next;
            })
          }
        />
        {recipients.error && <div className="err">{recipients.error}</div>}
      </div>

      <ComposePanel
        event={event}
        recipients={chosen}
        onSent={reloadRoster}
      />
    </div>
  );
}
