"use client";

// People — who's registered, and who has replied.
//
// The two halves of the same question, side by side: the recipient list is
// everyone who could come, the roster is everyone who has answered. Read-only
// on purpose; picking who to message happens on Broadcast.

import { use, useMemo } from "react";
import RecipientList from "@/components/RecipientList.jsx";
import RosterPanel from "@/components/RosterPanel.jsx";
import { useEvent } from "@/lib/ui/useEvents";
import {
  useRecipients,
  useRecipientFilters,
  useRoster,
} from "@/lib/ui/useRecipients";

export default function PeoplePage({ params }) {
  const { id } = use(params);
  const { event } = useEvent(id);
  const recipients = useRecipients();
  const filters = useRecipientFilters(recipients.people);
  const { roster, reload: reloadRoster } = useRoster(event?.name);

  const peopleByPhone = useMemo(() => {
    const map = new Map();
    recipients.people.forEach((p) => map.set(p.phone, p));
    return map;
  }, [recipients.people]);

  // Awaiting = registered people who haven't answered this event's poll.
  const answered = new Set(
    [...roster.going, ...roster.notGoing].map((r) => r.phone)
  );
  const awaiting = recipients.people.filter(
    (p) => !p.optedOut && !answered.has(p.phone)
  ).length;

  return (
    <div className="grid">
      <div>
        <RecipientList
          people={recipients.people}
          filters={filters}
          source={recipients.source}
          needsSync={recipients.needsSync}
          syncResult={recipients.syncResult}
          onSync={recipients.sync}
          syncing={recipients.syncing}
          loading={recipients.loading}
        />
        {recipients.error && <div className="err">{recipients.error}</div>}
      </div>

      <RosterPanel
        roster={roster}
        event={event}
        awaiting={awaiting}
        peopleByPhone={peopleByPhone}
        onAttendanceMarked={async () => {
          await recipients.reload();
          reloadRoster();
        }}
      />
    </div>
  );
}
