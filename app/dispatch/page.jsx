'use client';

import React, { useState, useEffect, useCallback } from "react";
import {
  Package, Truck, Users, CheckCircle2, Circle, Copy, Plus, X,
  Calendar, MapPin, ArrowLeft, Trash2, ClipboardList, Stamp
} from "lucide-react";

// ---------- palette / type tokens ----------
// Aliases onto the app palette in globals.css :root. These were literal hex
// values — a fourth visual world (kraft paper + teal) alongside the console,
// the .pf-* dashboards and the shift board. Inline styles resolve var(), so
// the whole page re-themes from one place without touching its markup.
const C = {
  paper: "var(--bg)",
  paperDark: "var(--sunken)",
  ink: "var(--ink)",
  inkSoft: "var(--muted)",
  kraft: "var(--accent)",
  kraftDark: "var(--accent-ink)",
  teal: "var(--yes)",
  tealDark: "var(--yes)",
  tealLight: "var(--yes-tint)",
  stamp: "var(--no)",
  line: "var(--line)",
  white: "var(--card)",
};

const FONTS = `
/* Fonts come from the app palette (globals.css) — Public Sans, Big Shoulders
   and IBM Plex Mono are embedded as base64 in pts-features.css, so there is
   nothing to fetch at runtime and no flash of unstyled text. */
`;

const uid = () => Math.random().toString(36).slice(2, 10);

const CATEGORIES = ["Items To Serve (R3)", "Knowledge To Serve", "Peace To Serve", "Other"];

const SEED_TEMPLATES = [
  {
    id: "tmpl-giftik",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Help distribute pre-loved and new items to migrant workers. You'll be on registration, packing bundles, or guiding guests through the queue — we'll match you to a role on arrival, no experience needed.",
      dress_code: "Comfortable clothes and covered shoes",
      what_to_bring: "A water bottle and a cap",
      meeting_point: "Look for the Passion To Serve banner at the main entrance",
    },
    name: "GIFTIK Distribution Drive",
    category: "Items To Serve (R3)",
    tasks: [
      "Confirm recipient list with barangay coordinator",
      "Pack relief goods into distribution bundles",
      "Set up registration & queueing tables",
      "Brief volunteers on distribution flow",
      "Coordinate traffic/crowd control on-site",
      "Photo-document distribution for report",
      "Collect signed acknowledgment receipts",
    ],
    logisticsPartners: [
      "Trucking partner — goods transport",
      "Barangay hall — venue access & permits",
      "Local police / brgy tanod — site security",
      "Packing supplier — sacks & boxes",
      "Water/food vendor — volunteer meals",
    ],
    volunteerRoles: [
      "Registration desk (2)",
      "Bundle carriers (6)",
      "Queue marshals (3)",
      "Photo/documentation (1)",
      "First aid (1)",
      "Team lead (1)",
    ],
  },
  {
    id: "tmpl-food",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Prepare and serve hot meals for migrant workers and their families. You'll be packing meals, serving at the counter, or helping guests find a seat.",
      dress_code: "Comfortable clothes, covered shoes, hair tied back",
      what_to_bring: "A water bottle",
      meeting_point: "Report to the kitchen entrance",
    },
    name: "Food To Serve",
    category: "Items To Serve (R3)",
    tasks: [
      "Confirm beneficiary count with coordinator",
      "Source and purchase food supplies",
      "Prepare and pack meals",
      "Set up serving/distribution area",
      "Brief volunteers on serving flow",
      "Photo-document the feeding session",
      "Collect attendance/acknowledgment sheet",
    ],
    logisticsPartners: [
      "Food supplier/caterer",
      "Venue host (barangay/church)",
      "Transport for food delivery",
      "Water supplier",
    ],
    volunteerRoles: ["Meal packers (4)", "Servers (4)", "Registration (2)", "Team lead (1)"],
  },
  {
    id: "tmpl-used-items",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Sort and categorise donated items so they can be redistributed. Expect light lifting and a lot of folding — good company guaranteed.",
      dress_code: "Old clothes you don't mind getting dusty, covered shoes",
      what_to_bring: "A water bottle and work gloves if you have them",
      meeting_point: "Collection point, look for the sorting tables",
    },
    name: "Used Items Collection Drive",
    category: "Items To Serve (R3)",
    tasks: [
      "Announce drive dates to community",
      "Set up collection points",
      "Sort and categorize donated items",
      "Coordinate storage/warehouse space",
      "Arrange redistribution or resale",
      "Log inventory of items collected",
    ],
    logisticsPartners: [
      "Collection point hosts",
      "Storage/warehouse provider",
      "Transport partner",
      "Recipient organizations",
    ],
    volunteerRoles: [
      "Sorters (5)",
      "Collection point attendants (3)",
      "Logistics coordinator (1)",
      "Inventory logger (1)",
    ],
  },
  {
    id: "tmpl-beach-cleanup",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Join us in clearing litter from the shoreline and sorting what we collect for recycling. A morning outdoors that visibly changes the place you're standing in.",
      dress_code: "Light clothes, covered shoes, sun protection",
      what_to_bring: "A water bottle, cap and sunscreen — gloves and bags are provided",
      meeting_point: "Gather at the car park entrance",
    },
    name: "Beach Cleanup",
    category: "Items To Serve (R3)",
    tasks: [
      "Secure permit for cleanup site",
      "Arrange trash bags, gloves, supplies",
      "Brief volunteers on safety & waste segregation",
      "Conduct the cleanup",
      "Weigh and log collected waste",
      "Arrange waste disposal/recycling",
      "Share impact report",
    ],
    logisticsPartners: [
      "Local government/barangay permit",
      "Waste disposal/recycling facility",
      "Supplies vendor",
      "Transport for volunteers",
    ],
    volunteerRoles: [
      "Cleanup crew leads (2)",
      "Waste sorters (4)",
      "Registration/safety marshal (2)",
      "Photo documentation (1)",
    ],
  },
  {
    id: "tmpl-giftik-platform",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Help run the GIFTIK online platform — matching donors with recipients, verifying details and coordinating handovers. Suits anyone comfortable working on a laptop.",
      dress_code: "Smart casual",
      what_to_bring: "Your laptop if you have one",
      meeting_point: "Ask at the front desk for the GIFTIK team",
    },
    name: "GIFTIK e-Platform Update",
    category: "Items To Serve (R3)",
    tasks: [
      "Review pending listings/requests on platform",
      "Match donors with recipients",
      "Verify recipient details",
      "Coordinate pickup/delivery logistics",
      "Update platform records post-transaction",
    ],
    logisticsPartners: ["Delivery/courier partner", "Platform tech support"],
    volunteerRoles: ["Platform moderator (1)", "Matching coordinator (1)", "Delivery liaison (1)"],
  },
  {
    id: "tmpl-academic-support",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Tutor students one-to-one or in small groups. You'll be matched to a subject you're comfortable with, and materials are prepared for you.",
      dress_code: "Smart casual",
      what_to_bring: "A pen and any teaching materials you'd like to use",
      meeting_point: "Report to the learning centre reception",
    },
    name: "Academic Support",
    category: "Knowledge To Serve",
    tasks: [
      "Identify students needing tutoring",
      "Match tutors to subjects/students",
      "Prepare learning materials",
      "Schedule tutoring sessions",
      "Track student progress",
      "Coordinate with parents/teachers",
    ],
    logisticsPartners: ["School/learning center venue", "Materials supplier", "Parent coordinators"],
    volunteerRoles: ["Subject tutors (varies)", "Session facilitator (1)", "Progress tracker (1)"],
  },
  {
    id: "tmpl-financial-literacy",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Help run a workshop on budgeting, saving and remittances. You'll be supporting the speaker, assisting participants with activities, and helping at registration.",
      dress_code: "Smart casual",
      what_to_bring: "Just yourself — all materials are provided",
      meeting_point: "Registration desk outside the seminar room",
    },
    name: "Financial Literacy Workshop",
    category: "Knowledge To Serve",
    tasks: [
      "Prepare workshop materials/slides",
      "Confirm resource speaker",
      "Set up venue & AV equipment",
      "Register participants",
      "Conduct workshop",
      "Distribute certificates/handouts",
      "Collect feedback forms",
    ],
    logisticsPartners: ["Venue host", "Resource speaker/bank partner", "AV equipment provider"],
    volunteerRoles: ["Registration (2)", "Facilitator (1)", "Materials distribution (2)"],
  },
  {
    id: "tmpl-digital-literacy",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Sit alongside learners as they build everyday digital skills — email, online forms, staying safe online. Patience matters more than technical expertise.",
      dress_code: "Smart casual",
      what_to_bring: "Your laptop if you have one; devices are otherwise provided",
      meeting_point: "Computer lab, ask for the Passion To Serve session",
    },
    name: "Digital Literacy Workshop",
    category: "Knowledge To Serve",
    tasks: [
      "Prepare workshop materials/slides",
      "Confirm resource speaker/trainer",
      "Arrange computers/devices & internet",
      "Register participants",
      "Conduct hands-on sessions",
      "Distribute certificates",
      "Collect feedback",
    ],
    logisticsPartners: ["Venue with computers", "Device/laptop provider", "Internet/telco partner", "Resource trainer"],
    volunteerRoles: ["Registration (2)", "Facilitator/trainer (1-2)", "Tech support (2)"],
  },
  {
    id: "tmpl-env-literacy",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Run hands-on demonstrations of composting, upcycling and waste reduction. Practical, messy and genuinely fun.",
      dress_code: "Clothes you don't mind getting dirty",
      what_to_bring: "A water bottle — all materials are provided",
      meeting_point: "Workshop area, follow the signs",
    },
    name: "Environmental Literacy — DIY Waste Reduction",
    category: "Knowledge To Serve",
    tasks: [
      "Prepare waste-reduction demo materials",
      "Confirm resource speaker",
      "Set up venue",
      "Register participants",
      "Conduct DIY workshop (composting, upcycling)",
      "Distribute take-home materials",
      "Collect feedback",
    ],
    logisticsPartners: ["Venue host", "Materials/supplies vendor", "Resource speaker/environmental group"],
    volunteerRoles: ["Registration (2)", "Facilitator (1)", "Materials prep (2)"],
  },
  {
    id: "tmpl-ai-coding",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Teach or assist in beginner coding and AI sessions. You'll be walking learners through exercises and troubleshooting alongside them — you don't need to be an expert, just a step ahead.",
      dress_code: "Smart casual",
      what_to_bring: "Your laptop and charger",
      meeting_point: "Computer lab, ask for the coding session",
    },
    name: "Specific Enrichment — AI & Coding",
    category: "Knowledge To Serve",
    tasks: [
      "Prepare curriculum/lesson plan",
      "Confirm coding instructor/volunteer",
      "Arrange laptops/devices",
      "Register participants",
      "Conduct sessions",
      "Track student output/projects",
      "Distribute certificates",
    ],
    logisticsPartners: ["Venue with devices", "Laptop/device provider", "Internet/telco partner", "Coding instructor/partner org"],
    volunteerRoles: ["Instructor/facilitator (1-2)", "Registration (2)", "Tech support (2)"],
  },
  {
    id: "tmpl-art-crafts",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Facilitate a craft session — helping participants with materials, demonstrating techniques and keeping the table stocked.",
      dress_code: "Clothes you don't mind getting paint on",
      what_to_bring: "An apron if you have one; materials are provided",
      meeting_point: "Activity hall, look for the craft tables",
    },
    name: "Art & Crafts",
    category: "Knowledge To Serve",
    tasks: [
      "Plan craft activity & materials list",
      "Purchase/prepare art supplies",
      "Set up venue",
      "Register participants",
      "Facilitate craft-making session",
      "Display/share finished works",
      "Collect feedback",
    ],
    logisticsPartners: ["Venue host", "Art supplies vendor"],
    volunteerRoles: ["Facilitator (1-2)", "Registration (2)", "Materials prep (2)"],
  },
  {
    id: "tmpl-health-talk",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Support a health talk on nutrition and preventive care. You'll help at registration, hand out materials, and assist participants during the Q&A.",
      dress_code: "Smart casual",
      what_to_bring: "Just yourself — all materials are provided",
      meeting_point: "Registration desk outside the seminar room",
    },
    name: "Health Talk — Nutrition, Cancer Prevention",
    category: "Knowledge To Serve",
    tasks: [
      "Confirm resource speaker/medical partner",
      "Prepare health education materials",
      "Set up venue & AV",
      "Register participants",
      "Conduct health talk & Q&A",
      "Distribute health materials/handouts",
      "Collect feedback",
    ],
    logisticsPartners: ["Venue host", "Medical resource speaker/hospital partner", "AV equipment provider"],
    volunteerRoles: ["Registration (2)", "Facilitator/host (1)", "Materials distribution (2)"],
  },
  {
    id: "tmpl-happiness",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Spend the session running games, conversation and light activities with our guests. The point is company — bring your energy.",
      dress_code: "Comfortable clothes",
      what_to_bring: "A water bottle",
      meeting_point: "Main hall, look for the Passion To Serve banner",
    },
    name: "Happiness Sessions",
    category: "Peace To Serve",
    tasks: [
      "Plan session theme/activities",
      "Confirm facilitator",
      "Set up venue",
      "Register participants",
      "Conduct session",
      "Collect feedback/reflections",
    ],
    logisticsPartners: ["Venue host", "Facilitator/counselor partner"],
    volunteerRoles: ["Facilitator (1)", "Registration (1)", "Session support (2)"],
  },
  {
    id: "tmpl-recreation",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Help run recreational games and sports. You'll be setting up, refereeing, and making sure everyone gets a turn.",
      dress_code: "Sports attire and covered shoes",
      what_to_bring: "A water bottle and a towel",
      meeting_point: "Sports hall entrance",
    },
    name: "Recreation",
    category: "Peace To Serve",
    tasks: [
      "Plan recreational activities/games",
      "Arrange venue/sports equipment",
      "Register participants",
      "Brief volunteers on activity flow",
      "Conduct recreation activities",
      "Distribute refreshments/prizes",
      "Collect feedback",
    ],
    logisticsPartners: ["Venue/sports facility", "Equipment supplier", "Refreshments vendor"],
    volunteerRoles: ["Activity leads (3)", "Registration (2)", "Photo documentation (1)"],
  },
  {
    id: "tmpl-yoga",
    // Volunteer-facing copy — carried into the event on clone and sent
    // ahead of the RSVP poll (see lib/eventMessage.js).
    details: {
      description: "Assist at a yoga and mindfulness session — laying out mats, guiding latecomers, and supporting the instructor throughout.",
      dress_code: "Comfortable stretchy clothes",
      what_to_bring: "A water bottle; mats are provided",
      meeting_point: "Studio entrance, please arrive 15 minutes early",
    },
    name: "Yoga / Mindfulness",
    category: "Peace To Serve",
    tasks: [
      "Confirm yoga/mindfulness instructor",
      "Arrange venue & mats",
      "Register participants",
      "Conduct session",
      "Distribute refreshments/handouts",
      "Collect feedback",
    ],
    logisticsPartners: ["Venue host", "Instructor/wellness partner", "Mats/equipment provider"],
    volunteerRoles: ["Instructor (1)", "Registration (1)", "Session support (1)"],
  },
];

export default function EventDispatchBoard() {
  const [templates, setTemplates] = useState([]);
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("gallery"); // gallery | clone | detail | newTemplate
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [activeEventId, setActiveEventId] = useState(null);
  const [cloneForm, setCloneForm] = useState({ date: "", venue: "" });
  // Result of also creating the clone as a real event in the database.
  const [cloneStatus, setCloneStatus] = useState(null);
  const [newTmpl, setNewTmpl] = useState({ name: "", category: CATEGORIES[0], tasks: "", partners: "", roles: "" });
  const [saveError, setSaveError] = useState(false);

  // ---------- persistence ----------
  const persist = useCallback((nextTemplates, nextEvents) => {
    try {
      window.localStorage.setItem(
        "giftik-dispatch-data",
        JSON.stringify({ templates: nextTemplates, events: nextEvents })
      );
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    try {
      const res = window.localStorage.getItem("giftik-dispatch-data");
      if (res) {
        const parsed = JSON.parse(res);
        setTemplates(parsed.templates && parsed.templates.length ? parsed.templates : SEED_TEMPLATES);
        setEvents(parsed.events || []);
      } else {
        setTemplates(SEED_TEMPLATES);
        setEvents([]);
      }
    } catch (e) {
      setTemplates(SEED_TEMPLATES);
      setEvents([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) persist(templates, events);
  }, [templates, events, loaded, persist]);

  // ---------- derived ----------
  const activeTemplate = templates.find((t) => t.id === activeTemplateId);
  const activeEvent = events.find((e) => e.id === activeEventId);
  const eventsForTemplate = (tid) =>
    events.filter((e) => e.templateId === tid).sort((a, b) => (a.date < b.date ? 1 : -1));

  const groupedTemplates = CATEGORIES.map((cat) => ({
    category: cat,
    items: templates.filter((t) => (t.category || "Other") === cat),
  })).filter((g) => g.items.length > 0);

  // ---------- actions ----------
  function openClone(templateId) {
    setActiveTemplateId(templateId);
    setCloneStatus(null);
    setCloneForm({ date: "", venue: "" });
    setView("clone");
  }

  async function confirmClone() {
    if (!cloneForm.date || !cloneForm.venue) return;
    const tmpl = templates.find((t) => t.id === activeTemplateId);

    const newEvent = {
      id: uid(),
      templateId: tmpl.id,
      templateName: tmpl.name,
      date: cloneForm.date,
      venue: cloneForm.venue,
      tasks: tmpl.tasks.map((label) => ({ id: uid(), label, done: false })),
      logisticsPartners: tmpl.logisticsPartners.map((label) => ({ id: uid(), label, confirmed: false })),
      volunteerRoles: tmpl.volunteerRoles.map((label) => ({ id: uid(), label, filled: false })),
    };
    setEvents((prev) => [...prev, newEvent]);
    setActiveEventId(newEvent.id);
    setView("detail");

    // Also create it for real, so the clone appears on the events index with
    // its checklist already on the task board — a template that only produces
    // a local card isn't duplication, it's a note to self.
    setCloneStatus({ state: "saving", message: "Creating event…" });
    try {
      const res = await fetch("/api/events/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: tmpl.name,
          category: tmpl.category,
          date: cloneForm.date,
          venue: cloneForm.venue,
          tasks: tmpl.tasks,
          partners: tmpl.logisticsPartners,
          details: tmpl.details || {},
        }),
      });
      const data = await res.json();
      if (data.error) {
        setCloneStatus({ state: "error", message: data.error });
        return;
      }
      setCloneStatus({
        state: "done",
        message: `Created "${data.event.name}" with ${data.taskCount} tasks and ${data.partnerCount} partners.`,
        href: `/events/${data.event.id}`,
      });
    } catch (e) {
      setCloneStatus({ state: "error", message: e.message });
    }
  }

  function toggleItem(section, itemId) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEventId) return e;
        const key = section === "tasks" ? "done" : section === "logisticsPartners" ? "confirmed" : "filled";
        return {
          ...e,
          [section]: e[section].map((it) => (it.id === itemId ? { ...it, [key]: !it[key] } : it)),
        };
      })
    );
  }

  function addItemToEvent(section, label) {
    if (!label.trim()) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEventId) return e;
        const key = section === "tasks" ? "done" : section === "logisticsPartners" ? "confirmed" : "filled";
        return {
          ...e,
          [section]: [...e[section], { id: uid(), label: label.trim(), [key]: false }],
        };
      })
    );
  }

  function removeItemFromEvent(section, itemId) {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== activeEventId) return e;
        return {
          ...e,
          [section]: e[section].filter((it) => it.id !== itemId),
        };
      })
    );
  }

  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setView("gallery");
  }

  function createTemplate() {
    if (!newTmpl.name.trim()) return;
    const toList = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);
    const tmpl = {
      id: uid(),
      name: newTmpl.name.trim(),
      category: newTmpl.category || "Other",
      tasks: toList(newTmpl.tasks),
      logisticsPartners: toList(newTmpl.partners),
      volunteerRoles: toList(newTmpl.roles),
    };
    setTemplates((prev) => [...prev, tmpl]);
    setNewTmpl({ name: "", category: CATEGORIES[0], tasks: "", partners: "", roles: "" });
    setView("gallery");
  }

  function deleteTemplate(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setEvents((prev) => prev.filter((e) => e.templateId !== id));
  }

  // ---------- shared bits ----------
  const Perforation = () => (
    <div style={{ display: "flex", gap: 6, padding: "0 4px" }}>
      {Array.from({ length: 26 }).map((_, i) => (
        <div key={i} style={{ width: 4, height: 4, borderRadius: 999, background: C.paper, border: `1px solid ${C.line}` }} />
      ))}
    </div>
  );

  const StampBadge = ({ text = "CLONE", rotate = -10 }) => (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        border: `2px solid ${C.stamp}`,
        color: C.stamp,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 2,
        padding: "3px 10px",
        borderRadius: 4,
        transform: `rotate(${rotate}deg)`,
        opacity: 0.75,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </div>
  );

  const CATEGORY_ACCENT = {
    "Items To Serve (R3)": C.stamp,
    "Knowledge To Serve": C.teal,
    "Peace To Serve": C.kraftDark,
    "Other": C.inkSoft,
  };

  if (!loaded) {
    return (
      <div style={{ padding: 40, fontFamily: "var(--font-sans)", color: C.inkSoft }}>Loading dispatch board…</div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: "100%", fontFamily: "var(--font-sans)", color: C.ink }}>
      <style>{FONTS}</style>

      {/* header */}
      <div style={{ background: C.ink, color: C.paper, padding: "22px 28px", borderBottom: `6px solid ${C.kraft}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ClipboardList size={22} color={C.kraft} />
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Dispatch Board
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#C9C3AE", marginTop: 4, fontFamily: "var(--font-mono)" }}>
          Passion To Serve — Items · Knowledge · Peace — one clone per next occurrence
        </div>
      </div>

      {saveError && (
        <div style={{ background: "#F6E3DB", color: C.stamp, padding: "8px 28px", fontSize: 13, fontFamily: "var(--font-mono)" }}>
          Storage unavailable right now — changes won't be saved between visits.
        </div>
      )}

      {/* ---------------- GALLERY ---------------- */}
      {view === "gallery" && (
        <div style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <button
              onClick={() => setView("newTemplate")}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: C.teal, color: C.white,
                border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 600, cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: 13,
              }}
            >
              <Plus size={15} /> New template
            </button>
          </div>

          {groupedTemplates.map((group) => (
            <div key={group.category} style={{ marginBottom: 30 }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                  fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
                  textTransform: "uppercase", letterSpacing: 1, color: CATEGORY_ACCENT[group.category] || C.ink,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: CATEGORY_ACCENT[group.category] || C.ink, display: "inline-block" }} />
                {group.category}
                <span style={{ flex: 1, borderBottom: `1px dashed ${C.line}`, marginLeft: 6 }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
                {group.items.map((t) => {
                  const inst = eventsForTemplate(t.id);
                  const last = inst[0];
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden",
                        boxShadow: "0 1px 0 rgba(0,0,0,0.04)", position: "relative",
                      }}
                    >
                      <div style={{ background: C.kraft, color: "var(--accent-ink)", padding: "10px 14px", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                        {t.name}
                      </div>
                      <Perforation />
                      <div style={{ padding: "14px" }}>
                        <div style={{ display: "flex", gap: 14, fontSize: 12, color: C.inkSoft, fontFamily: "var(--font-mono)", marginBottom: 12 }}>
                          <span>{t.tasks.length} tasks</span>
                          <span>{t.logisticsPartners.length} partners</span>
                          <span>{t.volunteerRoles.length} roles</span>
                        </div>
                        {last ? (
                          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12 }}>
                            Last run: {last.date || "—"} · {last.venue || "—"}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 12, fontStyle: "italic" }}>
                            No occurrences yet
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => openClone(t.id)}
                            style={{
                              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                              background: C.tealLight, color: C.tealDark, border: `1px solid ${C.teal}`, borderRadius: 6,
                              padding: "8px 10px", fontWeight: 600, cursor: "pointer", fontSize: 13,
                            }}
                          >
                            <Copy size={14} /> Clone for next event
                          </button>
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            title="Delete template"
                            style={{ border: `1px solid ${C.line}`, background: "transparent", borderRadius: 6, padding: "8px 10px", cursor: "pointer", color: C.inkSoft }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {inst.length > 0 && (
                          <div style={{ marginTop: 12, borderTop: `1px dashed ${C.line}`, paddingTop: 10 }}>
                            {inst.slice(0, 3).map((ev) => (
                              <div
                                key={ev.id}
                                onClick={() => { setActiveEventId(ev.id); setView("detail"); }}
                                style={{ fontSize: 12, padding: "4px 0", cursor: "pointer", color: C.teal, display: "flex", justifyContent: "space-between" }}
                              >
                                <span>{ev.date || "undated"} · {ev.venue || "no venue"}</span>
                                <span>{ev.tasks.filter((x) => x.done).length}/{ev.tasks.length} done</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- CLONE MODAL ---------------- */}
      {view === "clone" && activeTemplate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(35,38,32,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 10, width: 380, maxWidth: "100%", overflow: "hidden", position: "relative" }}>
            <div style={{ background: C.ink, color: C.paper, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>New occurrence</div>
              <X size={18} style={{ cursor: "pointer" }} onClick={() => setView("gallery")} />
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>
                Cloning <strong>{activeTemplate.name}</strong> — task list, logistics checklist, and volunteer roles carry over as-is.
              </div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: C.inkSoft }}>
                <Calendar size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Date
              </label>
              <input
                type="date"
                value={cloneForm.date}
                onChange={(e) => setCloneForm((f) => ({ ...f, date: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 14, fontFamily: "var(--font-sans)" }}
              />
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: C.inkSoft }}>
                <MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> Venue
              </label>
              <input
                type="text"
                placeholder="e.g. Barangay Covered Court"
                value={cloneForm.venue}
                onChange={(e) => setCloneForm((f) => ({ ...f, venue: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 18, fontFamily: "var(--font-sans)" }}
              />
              <button
                onClick={confirmClone}
                disabled={!cloneForm.date || !cloneForm.venue}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  background: (!cloneForm.date || !cloneForm.venue) ? "#CFC9AE" : C.stamp, color: C.white, border: "none",
                  borderRadius: 6, padding: "12px", fontWeight: 700, letterSpacing: 1, cursor: (!cloneForm.date || !cloneForm.venue) ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 13,
                }}
              >
                <Stamp size={15} /> Stamp &amp; clone
              </button>

              {/* Whether the clone became a real event, not just a local card. */}
              {cloneStatus && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    fontFamily: "var(--font-sans)",
                    color: cloneStatus.state === "error" ? C.stamp : C.teal,
                  }}
                >
                  {cloneStatus.message}
                  {cloneStatus.href && (
                    <>
                      {" "}
                      <a href={cloneStatus.href} style={{ color: C.teal, fontWeight: 600 }}>
                        Open it →
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- NEW TEMPLATE ---------------- */}
      {view === "newTemplate" && (
        <div style={{ padding: 28, maxWidth: 640 }}>
          <button onClick={() => setView("gallery")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.teal, cursor: "pointer", marginBottom: 16, fontSize: 13, padding: 0 }}>
            <ArrowLeft size={15} /> Back to templates
          </button>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>New event template</div>
          <input
            placeholder="Template name (e.g. Coastal Cleanup Day)"
            value={newTmpl.name}
            onChange={(e) => setNewTmpl((f) => ({ ...f, name: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 14, fontFamily: "var(--font-display)", fontWeight: 700 }}
          />
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: C.inkSoft }}>Pillar</label>
          <select
            value={newTmpl.category}
            onChange={(e) => setNewTmpl((f) => ({ ...f, category: e.target.value }))}
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 14, fontFamily: "var(--font-sans)", background: C.white }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {[
            { key: "tasks", label: "Task list", icon: <ClipboardList size={13} /> },
            { key: "partners", label: "Logistics-partner checklist", icon: <Truck size={13} /> },
            { key: "roles", label: "Volunteer roles", icon: <Users size={13} /> },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 4, color: C.inkSoft }}>
                {f.icon} {f.label} <span style={{ fontWeight: 400 }}>(one per line)</span>
              </label>
              <textarea
                rows={4}
                value={newTmpl[f.key]}
                onChange={(e) => setNewTmpl((s) => ({ ...s, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 13, resize: "vertical" }}
              />
            </div>
          ))}
          <button
            onClick={createTemplate}
            disabled={!newTmpl.name.trim()}
            style={{
              background: !newTmpl.name.trim() ? "#CFC9AE" : C.teal, color: C.white, border: "none", borderRadius: 6,
              padding: "10px 18px", fontWeight: 600, cursor: !newTmpl.name.trim() ? "not-allowed" : "pointer",
            }}
          >
            Save template
          </button>
        </div>
      )}

      {/* ---------------- EVENT DETAIL ---------------- */}
      {view === "detail" && activeEvent && (
        <div style={{ padding: 28 }}>
          <button onClick={() => setView("gallery")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.teal, cursor: "pointer", marginBottom: 16, fontSize: 13, padding: 0 }}>
            <ArrowLeft size={15} /> Back to templates
          </button>

          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 10, padding: 22, position: "relative", marginBottom: 20 }}>
            <StampBadge />
            <div style={{ fontSize: 12, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-mono)" }}>
              cloned from {activeEvent.templateName}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, margin: "4px 0 8px" }}>
              {activeEvent.templateName}
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13, color: C.inkSoft }}>
              <span><Calendar size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{activeEvent.date}</span>
              <span><MapPin size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{activeEvent.venue}</span>
            </div>
            <button
              onClick={() => deleteEvent(activeEvent.id)}
              style={{ position: "absolute", bottom: 18, right: 18, border: `1px solid ${C.line}`, background: "transparent", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: C.inkSoft, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
            >
              <Trash2 size={13} /> Delete this occurrence
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            <ChecklistCard
              title="Task list" icon={<ClipboardList size={15} />}
              items={activeEvent.tasks} doneKey="done"
              onToggle={(id) => toggleItem("tasks", id)}
              onAdd={(label) => addItemToEvent("tasks", label)}
              onRemove={(id) => removeItemFromEvent("tasks", id)}
              C={C}
            />
            <ChecklistCard
              title="Logistics-partner checklist" icon={<Truck size={15} />}
              items={activeEvent.logisticsPartners} doneKey="confirmed"
              onToggle={(id) => toggleItem("logisticsPartners", id)}
              onAdd={(label) => addItemToEvent("logisticsPartners", label)}
              onRemove={(id) => removeItemFromEvent("logisticsPartners", id)}
              C={C}
            />
            <ChecklistCard
              title="Volunteer roles" icon={<Users size={15} />}
              items={activeEvent.volunteerRoles} doneKey="filled"
              onToggle={(id) => toggleItem("volunteerRoles", id)}
              onAdd={(label) => addItemToEvent("volunteerRoles", label)}
              onRemove={(id) => removeItemFromEvent("volunteerRoles", id)}
              C={C}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistCard({ title, icon, items, doneKey, onToggle, onAdd, onRemove, C }) {
  const [newItemText, setNewItemText] = useState("");
  const doneCount = items.filter((i) => i[doneKey]).length;

  const handleAdd = () => {
    if (newItemText.trim()) {
      onAdd(newItemText);
      setNewItemText("");
    }
  };

  return (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ background: C.tealLight, color: C.tealDark, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 13 }}>
          {icon} {title}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{doneCount}/{items.length}</div>
      </div>
      
      <div style={{ padding: "6px 0", flex: 1 }}>
        {items.length === 0 && (
          <div style={{ padding: "12px 14px", fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Nothing listed</div>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px",
              borderBottom: `1px solid ${C.paperDark}`, color: it[doneKey] ? C.inkSoft : C.ink,
            }}
          >
            <div 
              onClick={() => onToggle(it.id)} 
              style={{ 
                display: "flex", alignItems: "center", gap: 10, cursor: "pointer", 
                textDecoration: it[doneKey] ? "line-through" : "none", flex: 1 
              }}
            >
              {it[doneKey] ? <CheckCircle2 size={16} color={C.teal} /> : <Circle size={16} color={C.line} />}
              <span style={{ fontSize: 13 }}>{it.label}</span>
            </div>
            <button
              onClick={() => onRemove(it.id)}
              style={{ background: "transparent", border: "none", color: "#C9BE9C", cursor: "pointer", padding: "4px" }}
              title="Remove item"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* New Input Bar */}
      <div style={{ background: C.paper, padding: "10px 14px", borderTop: `1px solid ${C.line}`, display: "flex", gap: 8 }}>
        <input 
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`Add to ${title.toLowerCase()}...`}
          style={{ flex: 1, padding: "6px 10px", border: `1px solid ${C.line}`, borderRadius: 4, fontSize: 12, fontFamily: "var(--font-sans)" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newItemText.trim()}
          style={{ 
            background: newItemText.trim() ? C.teal : "#CFC9AE", 
            color: C.white, border: "none", borderRadius: 4, padding: "0 10px", 
            cursor: newItemText.trim() ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}