"use client";

// The recipient list, with filters. Two modes:
//   selectable  — Broadcast, where you pick who a message goes to
//   read-only   — People, where you're just looking at who's registered
//
// Never renders a full phone number: masked to last-4 in both modes.

import { ANY, initials, maskPhone } from "@/lib/ui/format";

export default function RecipientList({
  people,
  filters,
  source,
  needsSync,
  syncResult,
  onSync,
  syncing,
  loading,
  // Selection is optional — omit these and the list renders read-only.
  selected,
  onToggle,
  onSelectAll,
  onRejoin,
  onBackupToggle,
}) {
  const { options, visible } = filters;
  const selectable = visible.filter((p) => !p.optedOut);
  const isSelectable = Boolean(selected && onToggle);
  const allSelected =
    isSelectable &&
    selectable.length > 0 &&
    selectable.every((p) => selected.has(p.phone));
  const chosenCount = isSelectable
    ? visible.filter((p) => selected.has(p.phone)).length
    : 0;
  const hiddenSelected = isSelectable ? selected.size - chosenCount : 0;

  // Which secondary filters apply to the audience currently selected.
  const isBeneficiaryTab = /^benef/i.test(filters.type || "");
  const isVolunteerTab = /^volunt/i.test(filters.type || "");
  const showVolunteerFilters = !isBeneficiaryTab;
  const showBeneficiaryFilters = !isVolunteerTab;

  const showFilters =
    (showVolunteerFilters &&
      (options.pillars.length > 0 || options.roles.length > 0)) ||
    (showBeneficiaryFilters &&
      (options.languages.length > 0 || options.courses.length > 0));

  // "Beneficiary" + "s" is "Beneficiarys". Enough of a rule for the two words
  // this ever sees, without pulling in a pluralisation library.
  const plural = (word) =>
    /y$/i.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;

  return (
    <section className="card">
      <div className="between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Recipients</h2>
        <span className="row">
          <span className="muted">{source}</span>
          {onSync && (
            <button onClick={onSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync from form"}
            </button>
          )}
        </span>
      </div>

      {loading && <p className="muted">Loading contacts…</p>}

      {/* Reading the sheet directly means Google's CDN can lag several minutes
          behind a new signup — say so rather than let it look like a bug. */}
      {needsSync && (
        <div className="ok" style={{ marginTop: 0, marginBottom: 10 }}>
          Reading the Google Sheet directly, which can lag a few minutes behind
          new signups. Sync to load them into the database.
        </div>
      )}

      {syncResult && (
        <div className="ok" style={{ marginTop: 0, marginBottom: 10 }}>
          Synced — {syncResult.added} added · {syncResult.updated} updated ·{" "}
          {syncResult.unchanged} unchanged
          {syncResult.skipped > 0 &&
            ` · ${syncResult.skipped} skipped (no usable phone)`}
        </div>
      )}

      {!loading && people.length === 0 && (
        <p className="muted">
          No signups yet. Responses appear here as people submit the Google
          Form.
        </p>
      )}

      {people.length > 0 && (
        <>
          {/* Audience tabs. Volunteers and beneficiaries are different groups
              who need different messages — a Tamil literacy class and a
              logistics drive shouldn't go to the same list. Only shown once
              both kinds actually exist. */}
          {options.types.length > 1 && (
            <div
              className="seg"
              role="group"
              aria-label="Audience"
              style={{ marginBottom: 10 }}
            >
              <button
                type="button"
                className={filters.type === ANY ? "on" : ""}
                aria-pressed={filters.type === ANY}
                onClick={() => filters.setAudience(ANY)}
              >
                Everyone
              </button>
              {options.types.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={filters.type === t ? "on" : ""}
                  aria-pressed={filters.type === t}
                  onClick={() => filters.setAudience(t)}
                >
                  {plural(t)}
                </button>
              ))}
            </div>
          )}

          {showFilters && (
            <div className="row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              {/* Pillars and roles describe volunteers; courses and languages
                  describe beneficiaries. Show whichever the current audience
                  can actually be filtered by. */}
              {showVolunteerFilters && options.pillars.length > 0 && (
                <select
                  value={filters.pillar}
                  onChange={(e) => filters.setPillar(e.target.value)}
                  aria-label="Filter by pillar"
                >
                  <option value={ANY}>All pillars</option>
                  {options.pillars.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
              {showVolunteerFilters && options.roles.length > 0 && (
                <select
                  value={filters.role}
                  onChange={(e) => filters.setRole(e.target.value)}
                  aria-label="Filter by preferred role"
                >
                  <option value={ANY}>All roles</option>
                  {options.roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
              {showBeneficiaryFilters && options.languages.length > 0 && (
                <select
                  value={filters.language}
                  onChange={(e) => filters.setLanguage(e.target.value)}
                  aria-label="Filter by language"
                >
                  <option value={ANY}>All languages</option>
                  {options.languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {showBeneficiaryFilters && options.courses.length > 0 && (
                <select
                  value={filters.course}
                  onChange={(e) => filters.setCourse(e.target.value)}
                  aria-label="Filter by course"
                >
                  <option value={ANY}>All courses</option>
                  {options.courses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              {filters.active && <button onClick={filters.clear}>Clear</button>}
            </div>
          )}

          <div className="between" style={{ marginBottom: 6 }}>
            {isSelectable ? (
              <label className="row" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onSelectAll(selectable, allSelected)}
                />
                <span className="muted">Select all</span>
              </label>
            ) : (
              <span className="muted">{visible.length} registered</span>
            )}
            <span className="muted">
              {isSelectable
                ? `${chosenCount} of ${visible.length} selected`
                : `${people.length} total`}
              {visible.length !== people.length &&
                isSelectable &&
                ` (${people.length} total)`}
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="muted">No one matches this filter.</p>
          ) : (
            <div className="list">
              {visible.map((p) => {
                const profile = [...(p.pillars || []), ...(p.roles || [])]
                  .filter(Boolean)
                  .join(" · ");
                const row = (
                  <>
                    {isSelectable && (
                      <input
                        type="checkbox"
                        checked={selected.has(p.phone)}
                        disabled={p.optedOut}
                        onChange={() => onToggle(p.phone)}
                      />
                    )}
                    <span className="avatar" aria-hidden="true">{initials(p.name)}</span>
                    <span className="nm">
                      {p.name || "—"}
                      {profile && <span className="sub">{profile}</span>}
                    </span>
                    {/* A returning volunteer is who you re-invite when
                        headcount is short — worth seeing at a glance.
                        Gold Exclusivity Rule (DESIGN.md): the solid-gold
                        treatment is reserved for Gold tier and VIP only —
                        Bronze/Silver keep the ordinary loyalty tint. */}
                    {p.loyaltyPoints > 0 && (
                      <span
                        className={`tag pts${p.loyaltyTier === "Gold" ? " gold" : ""}`}
                        title={`${p.loyaltyTier || "Loyalty"}: ${p.loyaltyPoints} points`}
                      >
                        {p.loyaltyTier ? `${p.loyaltyTier} · ` : ""}
                        {p.loyaltyPoints} pts
                      </span>
                    )}
                    {p.vipStatus && <span className="tag vip">VIP</span>}
                    {/* Whether this is their first event — the signal for
                        skipping a repeat welcome/intro message in Compose. */}
                    {Array.isArray(p.eventsAttended) &&
                      p.eventsAttended.length === 0 && (
                        <span className="tag">New</span>
                      )}
                    {/* Standby volunteers the backup-alert cron can message
                        when a confirmed headcount falls short close to an
                        event — organiser-toggled, not self-declared. */}
                    {onBackupToggle && !p.optedOut && (
                      <label
                        className="row"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(p.isBackup)}
                          onChange={(e) =>
                            onBackupToggle(p.phone, e.target.checked)
                          }
                        />
                        <span className="muted">Backup</span>
                      </label>
                    )}
                    {p.optedOut && (
                      <>
                        <span className="tag">opted out</span>
                        {/* Someone can ask to come back in person, where the
                            WhatsApp keyword never reaches us. */}
                        {onRejoin && (
                          <button
                            type="button"
                            className="tiny"
                            onClick={(e) => {
                              e.preventDefault();
                              onRejoin(p.phone);
                            }}
                          >
                            Add back
                          </button>
                        )}
                      </>
                    )}
                    <span className="ph">{maskPhone(p.phone)}</span>
                  </>
                );
                return isSelectable ? (
                  <label
                    key={p.phone}
                    className={`person${p.optedOut ? " out" : ""}`}
                  >
                    {row}
                  </label>
                ) : (
                  <div
                    key={p.phone}
                    className={`person${p.optedOut ? " out" : ""}`}
                    style={{ cursor: "default" }}
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          )}

          {hiddenSelected > 0 && (
            <p className="muted" style={{ marginTop: 6 }}>
              {hiddenSelected} more selected outside this filter — they
              won&apos;t be sent to.
            </p>
          )}
        </>
      )}
    </section>
  );
}
