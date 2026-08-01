"use client";

// Recipients (volunteers + beneficiaries) and the live roster.
//
// Both are per-event concerns that more than one route needs: People shows
// them, Broadcast sends to them, Overview counts them.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ANY } from "./format";

/** How often the roster re-polls. The count ticking up live is the demo moment. */
const ROSTER_POLL_MS = 3000;

export function useRecipients() {
  const [people, setPeople] = useState([]);
  const [source, setSource] = useState("");
  const [needsSync, setNeedsSync] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const load = useCallback(
    () =>
      fetch("/api/volunteers")
        .then((r) => r.json())
        .then((d) => {
          if (d.error) return setError(d.error);
          setPeople(d.volunteers || []);
          setSource(d.source);
          setNeedsSync(Boolean(d.needsSync));
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      const res = await fetch("/api/volunteers/sync", { method: "POST" });
      const d = await res.json();
      if (d.error) return setError(d.error);
      setSyncResult(d);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [load]);

  return {
    people,
    source,
    needsSync,
    loading,
    error,
    setError,
    reload: load,
    sync,
    syncing,
    syncResult,
  };
}

/** Filter options are derived from the data, so whatever labels the Google
 *  Form uses (emoji and all) just work — nothing to keep in sync. */
export function useRecipientFilters(people) {
  const [pillar, setPillar] = useState(ANY);
  const [role, setRole] = useState(ANY);
  const [type, setType] = useState(ANY);
  const [language, setLanguage] = useState(ANY);
  const [course, setCourse] = useState(ANY);

  // Options are derived per audience, so the Volunteers tab doesn't offer a
  // course nobody on it is taking, and vice versa.
  const options = useMemo(() => {
    const pillars = new Set();
    const roles = new Set();
    const types = new Set();
    const languages = new Set();
    const courses = new Set();
    people.forEach((p) => {
      (p.pillars || []).forEach((x) => pillars.add(x));
      (p.roles || []).forEach((x) => roles.add(x));
      (p.languages || []).forEach((x) => languages.add(x));
      (p.courses || []).forEach((x) => courses.add(x));
      if (p.type) types.add(p.type);
    });
    return {
      pillars: [...pillars].sort(),
      roles: [...roles].sort(),
      types: [...types].sort(),
      languages: [...languages].sort(),
      courses: [...courses].sort(),
    };
  }, [people]);

  const visible = useMemo(
    () =>
      people.filter(
        (p) =>
          (type === ANY || p.type === type) &&
          (pillar === ANY || (p.pillars || []).includes(pillar)) &&
          (role === ANY || (p.roles || []).includes(role)) &&
          (language === ANY || (p.languages || []).includes(language)) &&
          (course === ANY || (p.courses || []).includes(course))
      ),
    [people, type, pillar, role, language, course]
  );

  const active =
    pillar !== ANY || role !== ANY || language !== ANY || course !== ANY;

  /** Clears the secondary filters. The audience tab is navigation, not a
   *  filter to be swept away with the rest. */
  const clear = () => {
    setPillar(ANY);
    setRole(ANY);
    setLanguage(ANY);
    setCourse(ANY);
  };

  /**
   * Switching audience drops filters that don't apply to it — a pillar left
   * set from the Volunteers tab would otherwise hide every beneficiary and
   * look like an empty list.
   */
  const setAudience = (next) => {
    setType(next);
    setPillar(ANY);
    setRole(ANY);
    setLanguage(ANY);
    setCourse(ANY);
  };

  return {
    pillar,
    setPillar,
    role,
    setRole,
    type,
    setType,
    setAudience,
    language,
    setLanguage,
    course,
    setCourse,
    options,
    visible,
    active,
    clear,
  };
}

export function useRoster(campaign) {
  const [roster, setRoster] = useState({ going: [], notGoing: [], total: 0 });

  const load = useCallback(() => {
    if (!campaign) return;
    fetch(`/api/roster?campaign=${encodeURIComponent(campaign)}`)
      .then((r) => r.json())
      .then((d) => !d.error && setRoster(d))
      .catch(() => {
        // A dropped poll isn't worth surfacing — the next tick retries.
      });
  }, [campaign]);

  useEffect(() => {
    load();
    const timer = setInterval(load, ROSTER_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { roster, reload: load };
}
