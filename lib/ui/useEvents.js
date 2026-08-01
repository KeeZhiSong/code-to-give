"use client";

// Events data hook — list, create, edit, delete.
//
// Lives here rather than in a page so every route under /events/[id] reads the
// same shape, instead of each one re-implementing the fetch.

import { useCallback, useEffect, useState } from "react";

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      fetch("/api/events")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return setError(d.error);
          setEvents(d.events || []);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (form, editingId) => {
      const res = await fetch(
        editingId ? `/api/events/${editingId}` : "/api/events",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await load();
      return data.event;
    },
    [load]
  );

  const remove = useCallback(
    async (id) => {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await load();
    },
    [load]
  );

  return { events, loading, error, setError, reload: load, save, remove };
}

/** One event, for the pages nested under /events/[id]. */
export function useEvent(id) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    return fetch("/api/events")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        setEvent((d.events || []).find((e) => e.id === id) || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { event, loading, error, reload: load };
}
