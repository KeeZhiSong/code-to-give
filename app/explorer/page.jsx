'use client';import React, { useState, useMemo, useCallback } from "react";import {
  Package, BookOpen, Wind, Sprout, LifeBuoy, MapPin, Calendar,
  Users, User, Baby, Accessibility, Armchair, SlidersHorizontal,
  X, ChevronRight, Navigation, Search, ArrowLeft, Check, Repeat, ChevronDown,
} from "lucide-react";/* ------------------------------------------------------------------ *//*  Tokens & fonts                                                   *//* ------------------------------------------------------------------ */const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');`;const COLORS = {
  paper: "#EEF1EA",
  paperRaised: "#F7F8F4",
  pureWhite: "#FFFFFF",
  ink: "#1C2A22",
  inkSoft: "#5C6B60",
  line: "#D9D5C8",
  gold: "#C98A3B",
  urgent: "#AD4B3C",
  volunteer: "#2F6F5E",
  volunteerSoft: "#DCEAE4",
  beneficiary: "#8A4B6B",
  beneficiarySoft: "#F0DEE6",
};/* ------------------------------------------------------------------ *//*  Mock data                                                        *//* ------------------------------------------------------------------ */const REGION_COORDS = {
  Central: { lat: 1.3048, lng: 103.8318 },
  North: { lat: 1.436, lng: 103.7865 },
  South: { lat: 1.27, lng: 103.82 },
  East: { lat: 1.3236, lng: 103.9273 },
  West: { lat: 1.341, lng: 103.707 },
};const VOLUNTEER_EVENTS = [
  { id: "v1", title: "Community Pantry Sort & Pack", venue: "Bukit Merah CC", pillar: "items", commitment: "one-time", region: "Central", date: "2026-08-08", time: "9:00 AM – 12:00 PM", spotsLeft: 4, spotsTotal: 12 },
  { id: "v2", title: "Digital Literacy Buddy for Seniors", venue: "Tampines Regional Library", pillar: "knowledge", commitment: "recurring", frequency: "Weekly, Tue", region: "East", date: "2026-08-04", time: "3:00 PM – 5:00 PM", spotsLeft: 2, spotsTotal: 6 },
  { id: "v3", title: "Beach & Park Clean-Up", venue: "East Coast Park, Area C", pillar: "items", commitment: "one-time", region: "East", date: "2026-08-09", time: "7:30 AM – 10:00 AM", spotsLeft: 15, spotsTotal: 40 },
  { id: "v4", title: "Mindfulness Circle Facilitator", venue: "Toa Payoh Community Hub", pillar: "peace", commitment: "recurring", frequency: "Biweekly, Thu", region: "Central", date: "2026-08-06", time: "6:30 PM – 7:30 PM", spotsLeft: 3, spotsTotal: 8 },
  { id: "v5", title: "Grocery Delivery Run for Homebound Elderly", venue: "Woodlands Neighbourhood", pillar: "items", commitment: "one-time", region: "North", date: "2026-08-15", time: "9:00 AM – 1:00 PM", spotsLeft: 6, spotsTotal: 10 },
  { id: "v6", title: "Tuition Buddy: Primary Maths", venue: "Jurong West CC", pillar: "knowledge", commitment: "recurring", frequency: "Weekly, Thu", region: "West", date: "2026-08-06", time: "4:00 PM – 5:30 PM", spotsLeft: 1, spotsTotal: 4 },
  { id: "v7", title: "Chair Yoga Session Lead", venue: "Bukit Merah Senior Centre", pillar: "peace", commitment: "one-time", region: "South", date: "2026-08-12", time: "10:00 AM – 11:00 AM", spotsLeft: 5, spotsTotal: 12 },
  { id: "v8", title: "Warehouse Stock Sorting", venue: "Jurong Logistics Hub", pillar: "items", commitment: "one-time", region: "West", date: "2026-08-14", time: "1:00 PM – 5:00 PM", spotsLeft: 20, spotsTotal: 25 },
  { id: "v9", title: "English Conversation Circle", venue: "Bras Basah Complex", pillar: "knowledge", commitment: "recurring", frequency: "Weekly, Mon", region: "Central", date: "2026-08-03", time: "7:00 PM – 8:30 PM", spotsLeft: 4, spotsTotal: 10 },
  { id: "v10", title: "Art Therapy Companion", venue: "Bedok Family Service Centre", pillar: "peace", commitment: "one-time", region: "East", date: "2026-08-16", time: "2:00 PM – 4:00 PM", spotsLeft: 2, spotsTotal: 6 },
  { id: "v11", title: "Food Bank Delivery Driver", venue: "Yishun Distribution Point", pillar: "items", commitment: "recurring", frequency: "Weekly, Fri", region: "North", date: "2026-08-07", time: "5:30 PM – 7:30 PM", spotsLeft: 3, spotsTotal: 8 },
  { id: "v12", title: "Story-time Reading for Kids", venue: "Sentosa Cove CC", pillar: "knowledge", commitment: "one-time", region: "South", date: "2026-08-22", time: "10:00 AM – 11:00 AM", spotsLeft: 7, spotsTotal: 15 },
];const BENEFICIARY_EVENTS = [
  { id: "b1", title: "Weekly Grocery Collection", venue: "Central Distribution Point", category: "items", audience: ["myself"], accessibility: ["wheelchair"], commitment: "recurring", frequency: "Weekly, Tue", region: "Central", date: "2026-08-04", time: "10:00 AM – 1:00 PM", spotsLeft: 18, spotsTotal: 30 },
  { id: "b2", title: "Free Digital Skills Class", venue: "Bedok Community Library", category: "education", audience: ["myself"], accessibility: ["seated"], commitment: "recurring", frequency: "Weekly, Wed", region: "East", date: "2026-08-05", time: "2:00 PM – 3:30 PM", spotsLeft: 5, spotsTotal: 12 },
  { id: "b3", title: "Kids Homework Support Drop-in", venue: "Jurong West Learning Hub", category: "education", audience: ["child"], accessibility: [], commitment: "recurring", frequency: "Weekly, Sat", region: "West", date: "2026-08-08", time: "10:00 AM – 12:00 PM", spotsLeft: 8, spotsTotal: 20 },
  { id: "b4", title: "Community Wellness & Stretch Class", venue: "Bukit Merah Wellness Corner", category: "wellness", audience: ["family"], accessibility: ["seated", "wheelchair"], commitment: "recurring", frequency: "Weekly, Fri", region: "South", date: "2026-08-07", time: "9:00 AM – 10:00 AM", spotsLeft: 6, spotsTotal: 15 },
  { id: "b5", title: "School Uniform & Supplies Giveaway", venue: "Woodlands Civic Plaza", category: "items", audience: ["child"], accessibility: [], commitment: "one-time", region: "North", date: "2026-08-08", time: "9:00 AM – 3:00 PM", spotsLeft: 40, spotsTotal: 60 },
  { id: "b6", title: "Free Eye Screening", venue: "Central Health Outreach Van", category: "wellness", audience: ["myself"], accessibility: ["wheelchair"], commitment: "one-time", region: "Central", date: "2026-08-09", time: "9:00 AM – 12:00 PM", spotsLeft: 3, spotsTotal: 25 },
  { id: "b7", title: "Family Cooking & Nutrition Workshop", venue: "Tampines Kitchen Studio", category: "education", audience: ["family"], accessibility: [], commitment: "one-time", region: "East", date: "2026-08-15", time: "11:00 AM – 1:00 PM", spotsLeft: 10, spotsTotal: 20 },
  { id: "b8", title: "Emergency Food Parcel Pickup", venue: "Jurong Relief Point", category: "items", audience: ["myself"], accessibility: ["wheelchair"], commitment: "recurring", frequency: "Daily", region: "West", date: "2026-08-02", time: "10:00 AM – 4:00 PM", spotsLeft: 25, spotsTotal: 50 },
  { id: "b9", title: "Music & Movement for Toddlers", venue: "Sentosa Family Pavilion", category: "wellness", audience: ["child"], accessibility: [], commitment: "recurring", frequency: "Weekly, Thu", region: "South", date: "2026-08-06", time: "9:30 AM – 10:15 AM", spotsLeft: 4, spotsTotal: 10 },
  { id: "b10", title: "Mental Wellness Peer Support Circle", venue: "Central Wellness Room", category: "wellness", audience: ["myself"], accessibility: ["seated"], commitment: "recurring", frequency: "Biweekly", region: "Central", date: "2026-08-05", time: "6:00 PM – 7:00 PM", spotsLeft: 2, spotsTotal: 8 },
  { id: "b11", title: "Financial Literacy Basics Class", venue: "Yishun Resource Centre", category: "education", audience: ["myself"], accessibility: [], commitment: "one-time", region: "North", date: "2026-08-14", time: "7:00 PM – 8:30 PM", spotsLeft: 12, spotsTotal: 20 },
  { id: "b12", title: "Family Fun Day: Games & Resources Fair", venue: "Bedok Stadium Grounds", category: "items", audience: ["family"], accessibility: ["wheelchair"], commitment: "one-time", region: "East", date: "2026-08-23", time: "10:00 AM – 4:00 PM", spotsLeft: 35, spotsTotal: 80 },
];const PILLAR_META = {
  items: { label: "Items To Serve", icon: Package },
  knowledge: { label: "Knowledge To Serve", icon: BookOpen },
  peace: { label: "Peace To Serve", icon: Wind },
};const CATEGORY_META = {
  items: { label: "Daily Items & Groceries", icon: Package },
  education: { label: "Education & Classes", icon: BookOpen },
  wellness: { label: "Wellness & Recreation", icon: Wind },
};const AUDIENCE_META = {
  myself: { label: "For Myself", icon: User },
  child: { label: "For My Child", icon: Baby },
  family: { label: "Family-friendly", icon: Users },
};const ACCESS_META = {
  wheelchair: { label: "Wheelchair Accessible", icon: Accessibility },
  seated: { label: "Seated Activities", icon: Armchair },
};const REGIONS = ["North", "South", "East", "West", "Central"];/* ------------------------------------------------------------------ *//*  Helpers                                                          *//* ------------------------------------------------------------------ */function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}function isWeekendDay(dateStr) {
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}function toggleInSet(set, value) {
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next;
}function intersects(fieldArrOrVal, selectedSet) {
  if (selectedSet.size === 0) return true;
  if (Array.isArray(fieldArrOrVal)) return fieldArrOrVal.some((v) => selectedSet.has(v));
  return selectedSet.has(fieldArrOrVal);
}/* ------------------------------------------------------------------ *//*  Small building blocks                                            *//* ------------------------------------------------------------------ */function Logomark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="16" cy="16" r="11" fill={COLORS.volunteer} opacity="0.85" />
      <circle cx="24" cy="16" r="11" fill={COLORS.gold} opacity="0.8" />
      <circle cx="20" cy="25" r="11" fill={COLORS.beneficiary} opacity="0.75" />
    </svg>
  );
}function DropdownFilter({ label, count, isOpen, onToggle, accent, children }) {
  return (
    <div className="relative min-w-[180px]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2.5 px-4 py-3 rounded-xl text-sm transition-all duration-150 border shadow-sm"
        style={{
          backgroundColor: count > 0 ? (accent === COLORS.volunteer ? COLORS.volunteerSoft : COLORS.beneficiarySoft) : COLORS.pureWhite,
          borderColor: count > 0 ? accent : COLORS.line,
          color: COLORS.ink,
          fontFamily: "'Work Sans', sans-serif",
          fontWeight: 500,
        }}
      >
        <span>{label}</span>
        {count > 0 && (
          <span
            className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            {count}
          </span>
        )}
        <ChevronDown size={15} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} style={{ color: COLORS.inkSoft }} />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-64 rounded-2xl border p-3.5 shadow-xl z-30 flex flex-col gap-1.5"
          style={{ backgroundColor: COLORS.pureWhite, borderColor: COLORS.line }}
        >
          {children}
        </div>
      )}
    </div>
  );
}function DropdownItem({ active, onClick, icon: Icon, children, accent }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left"
      style={{
        backgroundColor: active ? (accent === COLORS.volunteer ? COLORS.volunteerSoft : COLORS.beneficiarySoft) : "transparent",
        color: active ? accent : COLORS.ink,
        fontFamily: "'Work Sans', sans-serif",
        fontWeight: active ? 600 : 400,
      }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={15} strokeWidth={2} style={{ color: active ? accent : COLORS.inkSoft }} />}
        <span>{children}</span>
      </div>
      {active && <Check size={14} style={{ color: accent }} />}
    </button>
  );
}function CapacityGauge({ left, total, accent }) {
  const ratio = left / total;
  const urgent = ratio <= 0.2;
  const dotColor = urgent ? COLORS.urgent : accent;

  if (total <= 24) {
    const dots = Array.from({ length: total }, (_, i) => i < total - left);
    return (
      <div>
        <div className="flex flex-wrap gap-[3px] mb-1.5">
          {dots.map((filled, i) => (
            <span
              key={i}
              className="block w-[7px] h-[7px] rounded-[1.5px]"
              style={{ backgroundColor: filled ? COLORS.line : dotColor }}
            />
          ))}
        </div>
        <p
          className="text-xs"
          style={{ color: urgent ? COLORS.urgent : COLORS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", fontWeight: urgent ? 500 : 400 }}
        >
          {left} of {total} spots left{urgent ? " · filling fast" : ""}
        </p>
      </div>
    );
  }

  const filledPercentage = ((total - left) / total) * 100;
  return (
    <div>
      <div className="w-full h-[7px] rounded-[1.5px] mb-1.5 overflow-hidden" style={{ backgroundColor: COLORS.line }}>
        <div 
          className="h-full rounded-[1.5px]" 
          style={{ width: `${filledPercentage}%`, backgroundColor: dotColor }} 
        />
      </div>
      <p
        className="text-xs"
        style={{ color: urgent ? COLORS.urgent : COLORS.inkSoft, fontFamily: "'IBM Plex Mono', monospace", fontWeight: urgent ? 500 : 400 }}
      >
        {left} of {total} spots left{urgent ? " · filling fast" : ""}
      </p>
    </div>
  );
}/* ------------------------------------------------------------------ *//*  Gateway                                                          *//* ------------------------------------------------------------------ */function RoleGateway({ onSelect }) {
  const cards = [
    {
      role: "volunteer",
      icon: Sprout,
      title: "I'm looking to volunteer",
      desc: "Give your time across groceries, tutoring, and wellbeing programmes near you.",
      accent: COLORS.volunteer,
      soft: COLORS.volunteerSoft,
    },
    {
      role: "beneficiary",
      icon: LifeBuoy,
      title: "I'm looking for support",
      desc: "Find grocery runs, classes, and wellness sessions open to you and your family.",
      accent: COLORS.beneficiary,
      soft: COLORS.beneficiarySoft,
    },
  ];
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{ backgroundColor: COLORS.paper }}>
      <div className="max-w-3xl w-full text-center">
        <div className="flex justify-center mb-6">
          <Logomark size={44} />
        </div>
        <p
          className="text-xs uppercase tracking-widest mb-3"
          style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif", fontWeight: 600, letterSpacing: "0.16em" }}
        >
          Kampung Serve
        </p>
        <h1
          className="text-4xl sm:text-5xl mb-4"
          style={{ color: COLORS.ink, fontFamily: "'Fraunces', serif", fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          Where do you fit today?
        </h1>
        <p className="text-base mb-12 max-w-md mx-auto" style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>
          Tell us which side of the table you're on, and we'll bring you the right events across the island.
        </p>
        <div className="grid sm:grid-cols-2 gap-5">
          {cards.map(({ role, icon: Icon, title, desc, accent, soft }) => (
            <button
              key={role}
              onClick={() => onSelect(role)}
              className="group text-left p-7 rounded-2xl border transition-all duration-200 hover:-translate-y-1 shadow-sm"
              style={{ backgroundColor: COLORS.paperRaised, borderColor: COLORS.line }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = accent)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.line)}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-5"
                style={{ backgroundColor: soft }}
              >
                <Icon size={22} color={accent} strokeWidth={2} />
              </div>
              <h2 className="text-xl mb-2" style={{ color: COLORS.ink, fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
                {title}
              </h2>
              <p className="text-sm mb-5" style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>
                {desc}
              </p>
              <span
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: accent, fontFamily: "'Work Sans', sans-serif" }}
              >
                Continue
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}/* ------------------------------------------------------------------ *//*  Event card                                                       *//* ------------------------------------------------------------------ */function EventCard({ event, role, accent, meta }) {
  const Icon = meta.icon;
  return (
    <div
      className="rounded-2xl border p-6 flex flex-col justify-between gap-5 shadow-sm transition-all hover:shadow-md"
      style={{ backgroundColor: COLORS.pureWhite, borderColor: COLORS.line, borderLeftWidth: "4px", borderLeftColor: accent }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
            style={{ backgroundColor: role === "volunteer" ? COLORS.volunteerSoft : COLORS.beneficiarySoft, color: accent, fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}
          >
            <Icon size={13} strokeWidth={2.2} />
            {meta.label}
          </span>
          {event.commitment === "recurring" && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>
              <Repeat size={12} /> {event.frequency}
            </span>
          )}
        </div>

        <h3 className="text-lg leading-snug" style={{ color: COLORS.ink, fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
          {event.title}
        </h3>

        <div className="flex flex-col gap-2 text-sm" style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>
          <div className="flex items-center gap-2.5">
            <Calendar size={15} style={{ color: accent }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.82rem" }}>
              {formatDate(event.date)} · {event.time}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin size={15} style={{ color: accent }} />
            <span>{event.venue} · {event.region}</span>
          </div>
        </div>

        {role === "beneficiary" && (event.audience?.length > 0 || event.accessibility?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {event.audience?.map((a) => (
              <span key={a} className="text-xs px-2.5 py-1 rounded-full border bg-[#F7F8F4]" style={{ borderColor: COLORS.line, color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>
                {AUDIENCE_META[a].label}
              </span>
            ))}
            {event.accessibility?.map((a) => (
              <span key={a} className="text-xs px-2.5 py-1 rounded-full border bg-[#F7F8F4]" style={{ borderColor: COLORS.line, color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}>
                {ACCESS_META[a].label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 pt-3 border-t" style={{ borderColor: COLORS.line }}>
        <CapacityGauge left={event.spotsLeft} total={event.spotsTotal} accent={accent} />

        <button
          className="w-full py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-95 shadow-sm"
          style={{ backgroundColor: accent, color: "#fff", fontFamily: "'Work Sans', sans-serif" }}
        >
          View Details & Register
        </button>
      </div>
    </div>
  );
}/* ------------------------------------------------------------------ *//*  Main explorer                                                    *//* ------------------------------------------------------------------ */const emptyVolunteerFilters = { pillars: new Set(), commitment: new Set(), availability: new Set(), regions: new Set() };const emptyBeneficiaryFilters = { categories: new Set(), audience: new Set(), accessibility: new Set(), regions: new Set(), nearMe: false };export default function EventsExplorer() {
  const [role, setRole] = useState(null);
  const [search, setSearch] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [vFilters, setVFilters] = useState(emptyVolunteerFilters);
  const [bFilters, setBFilters] = useState(emptyBeneficiaryFilters);
  const [geo, setGeo] = useState({ status: "idle", coords: null });

  const requestGeo = useCallback(() => {
    if (bFilters.nearMe) {
      setBFilters((f) => ({ ...f, nearMe: false }));
      return;
    }
    if (!navigator.geolocation) {
      setGeo({ status: "error", coords: null });
      return;
    }
    setGeo({ status: "locating", coords: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ status: "found", coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setBFilters((f) => ({ ...f, nearMe: true }));
      },
      () => setGeo({ status: "error", coords: null }),
      { timeout: 8000 }
    );
  }, [bFilters.nearMe]);

  const accent = role === "volunteer" ? COLORS.volunteer : COLORS.beneficiary;

  const filteredEvents = useMemo(() => {
    if (!role) return [];
    const q = search.trim().toLowerCase();

    if (role === "volunteer") {
      let list = VOLUNTEER_EVENTS.filter((e) => {
        if (q && !e.title.toLowerCase().includes(q) && !e.venue.toLowerCase().includes(q)) return false;
        if (!intersects(e.pillar, vFilters.pillars)) return false;
        if (!intersects(e.commitment, vFilters.commitment)) return false;
        if (!intersects(e.region, vFilters.regions)) return false;
        if (vFilters.availability.size > 0) {
          const du = daysUntil(e.date);
          const matches = [...vFilters.availability].some((tag) => {
            if (tag === "weekend") return du >= 0 && du <= 8 && isWeekendDay(e.date);
            if (tag === "week") return du >= 0 && du <= 7;
            if (tag === "month") return du >= 0 && du <= 31;
            return false;
          });
          if (!matches) return false;
        }
        return true;
      });
      return list.sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    }

    let list = BENEFICIARY_EVENTS.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q) && !e.venue.toLowerCase().includes(q)) return false;
      if (!intersects(e.category, bFilters.categories)) return false;
      if (!intersects(e.audience, bFilters.audience)) return false;
      if (!intersects(e.accessibility, bFilters.accessibility)) return false;
      if (!intersects(e.region, bFilters.regions)) return false;
      return true;
    });

    if (bFilters.nearMe && geo.coords) {
      list = [...list].sort((a, b) => {
        const da = haversine(geo.coords, REGION_COORDS[a.region]);
        const db = haversine(geo.coords, REGION_COORDS[b.region]);
        return da - db;
      });
    } else {
      list = [...list].sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    }
    return list;
  }, [role, search, vFilters, bFilters, geo]);

  const activeFilterCount = useMemo(() => {
    if (role === "volunteer") {
      return vFilters.pillars.size + vFilters.commitment.size + vFilters.availability.size + vFilters.regions.size;
    }
    if (role === "beneficiary") {
      return bFilters.categories.size + bFilters.audience.size + bFilters.accessibility.size + bFilters.regions.size + (bFilters.nearMe ? 1 : 0);
    }
    return 0;
  }, [role, vFilters, bFilters]);

  const clearFilters = () => {
    if (role === "volunteer") setVFilters(emptyVolunteerFilters);
    if (role === "beneficiary") { setBFilters(emptyBeneficiaryFilters); setGeo({ status: "idle", coords: null }); }
    setOpenDropdown(null);
  };

  if (!role) return (
    <>
      <style>{FONT_IMPORT}</style>
      <RoleGateway onSelect={setRole} />
    </>
  );

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: COLORS.paper }} onClick={() => setOpenDropdown(null)}>
      <style>{FONT_IMPORT}</style>

      {/* Header */}
      <header className="sticky top-0 z-25 border-b backdrop-blur shadow-sm" style={{ backgroundColor: "rgba(238,241,234,0.95)", borderColor: COLORS.line }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logomark size={30} />
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, color: COLORS.ink }} className="text-xl">Kampung Serve</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full font-medium"
              style={{ backgroundColor: role === "volunteer" ? COLORS.volunteerSoft : COLORS.beneficiarySoft, color: accent, fontFamily: "'Work Sans', sans-serif" }}
            >
              {role === "volunteer" ? <Sprout size={13} /> : <LifeBuoy size={13} />}
              {role === "volunteer" ? "Volunteering" : "Seeking Support"}
            </span>
            <button
              onClick={() => setRole(null)}
              className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl border transition-colors shadow-sm"
              style={{ borderColor: COLORS.line, backgroundColor: COLORS.pureWhite, color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }}
            >
              <ArrowLeft size={14} /> Switch Role
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 pt-10">
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, color: COLORS.ink }} className="text-3xl sm:text-4xl mb-2">
              {role === "volunteer" ? "Upcoming volunteering events" : "Upcoming support events"}
            </h1>
            <p style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }} className="text-base">
              Showing <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: COLORS.ink }}>{filteredEvents.length}</span> event{filteredEvents.length !== 1 ? "s" : ""} across Singapore
            </p>
          </div>
        </div>

        

        {/* Toolbar Section (Search + Filter Dropdowns) */}
        <div className="rounded-2xl border p-6 mb-16 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8" style={{ backgroundColor: COLORS.pureWhite, borderColor: COLORS.line }} onClick={(e) => e.stopPropagation()}>
          <div className="relative flex-1 max-w-lg">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event title or venue..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border text-sm outline-none transition-all shadow-sm"
              style={{ borderColor: COLORS.line, backgroundColor: COLORS.paperRaised, color: COLORS.ink, fontFamily: "'Work Sans', sans-serif" }}
            />
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-1">
            {role === "volunteer" ? (
              <>
                <DropdownFilter
                  label="Pillar"
                  count={vFilters.pillars.size}
                  isOpen={openDropdown === "pillar"}
                  onToggle={() => setOpenDropdown(openDropdown === "pillar" ? null : "pillar")}
                  accent={accent}
                >
                  {Object.entries(PILLAR_META).map(([key, m]) => (
                    <DropdownItem
                      key={key}
                      icon={m.icon}
                      active={vFilters.pillars.has(key)}
                      accent={accent}
                      onClick={() => setVFilters((f) => ({ ...f, pillars: toggleInSet(f.pillars, key) }))}
                    >
                      {m.label}
                    </DropdownItem>
                  ))}
                </DropdownFilter>

                <DropdownFilter
                  label="Commitment Type"
                  count={vFilters.commitment.size}
                  isOpen={openDropdown === "commitment"}
                  onToggle={() => setOpenDropdown(openDropdown === "commitment" ? null : "commitment")}
                  accent={accent}
                >
                  {["one-time", "recurring"].map((key) => (
                    <DropdownItem
                      key={key}
                      active={vFilters.commitment.has(key)}
                      accent={accent}
                      onClick={() => setVFilters((f) => ({ ...f, commitment: toggleInSet(f.commitment, key) }))}
                    >
                      {key === "one-time" ? "One-time Event" : "Recurring Class"}
                    </DropdownItem>
                  ))}
                </DropdownFilter>

                <DropdownFilter
                  label="Availability"
                  count={vFilters.availability.size}
                  isOpen={openDropdown === "availability"}
                  onToggle={() => setOpenDropdown(openDropdown === "availability" ? null : "availability")}
                  accent={accent}
                >
                  {[
                    { key: "weekend", label: "This Weekend" },
                    { key: "week", label: "Next 7 Days" },
                    { key: "month", label: "This Month" },
                  ].map((opt) => (
                    <DropdownItem
                      key={opt.key}
                      active={vFilters.availability.has(opt.key)}
                      accent={accent}
                      onClick={() => setVFilters((f) => ({ ...f, availability: toggleInSet(f.availability, opt.key) }))}
                    >
                      {opt.label}
                    </DropdownItem>
                  ))}
                </DropdownFilter>

                <DropdownFilter
                  label="Location"
                  count={vFilters.regions.size}
                  isOpen={openDropdown === "location"}
                  onToggle={() => setOpenDropdown(openDropdown === "location" ? null : "location")}
                  accent={accent}
                >
                  {REGIONS.map((r) => (
                    <DropdownItem
                      key={r}
                      icon={MapPin}
                      active={vFilters.regions.has(r)}
                      accent={accent}
                      onClick={() => setVFilters((f) => ({ ...f, regions: toggleInSet(f.regions, r) }))}
                    >
                      {r}
                    </DropdownItem>
                  ))}
                </DropdownFilter>
              </>
            ) : (
              <>
                <DropdownFilter
                  label="Support Category"
                  count={bFilters.categories.size}
                  isOpen={openDropdown === "category"}
                  onToggle={() => setOpenDropdown(openDropdown === "category" ? null : "category")}
                  accent={accent}
                >
                  {Object.entries(CATEGORY_META).map(([key, m]) => (
                    <DropdownItem
                      key={key}
                      icon={m.icon}
                      active={bFilters.categories.has(key)}
                      accent={accent}
                      onClick={() => setBFilters((f) => ({ ...f, categories: toggleInSet(f.categories, key) }))}
                    >
                      {m.label}
                    </DropdownItem>
                  ))}
                </DropdownFilter>

                <DropdownFilter
                  label="Target Audience"
                  count={bFilters.audience.size}
                  isOpen={openDropdown === "audience"}
                  onToggle={() => setOpenDropdown(openDropdown === "audience" ? null : "audience")}
                  accent={accent}
                >
                  {Object.entries(AUDIENCE_META).map(([key, m]) => (
                    <DropdownItem
                      key={key}
                      icon={m.icon}
                      active={bFilters.audience.has(key)}
                      accent={accent}
                      onClick={() => setBFilters((f) => ({ ...f, audience: toggleInSet(f.audience, key) }))}
                    >
                      {m.label}
                    </DropdownItem>
                  ))}
                </DropdownFilter>

                <DropdownFilter
                  label="Accessibility"
                  count={bFilters.accessibility.size}
                  isOpen={openDropdown === "accessibility"}
                  onToggle={() => setOpenDropdown(openDropdown === "accessibility" ? null : "accessibility")}
                  accent={accent}
                >
                  {Object.entries(ACCESS_META).map(([key, m]) => (
                    <DropdownItem
                      key={key}
                      icon={m.icon}
                      active={bFilters.accessibility.has(key)}
                      accent={accent}
                      onClick={() => setBFilters((f) => ({ ...f, accessibility: toggleInSet(f.accessibility, key) }))}
                    >
                      {m.label}
                    </DropdownItem>
                  ))}
                </DropdownFilter>

                <DropdownFilter
                  label="Location"
                  count={bFilters.regions.size + (bFilters.nearMe ? 1 : 0)}
                  isOpen={openDropdown === "location"}
                  onToggle={() => setOpenDropdown(openDropdown === "location" ? null : "location")}
                  accent={accent}
                >
                  {REGIONS.map((r) => (
                    <DropdownItem
                      key={r}
                      icon={MapPin}
                      active={bFilters.regions.has(r)}
                      accent={accent}
                      onClick={() => setBFilters((f) => ({ ...f, regions: toggleInSet(f.regions, r) }))}
                    >
                      {r}
                    </DropdownItem>
                  ))}
                  <div className="pt-2 mt-1 border-t" style={{ borderColor: COLORS.line }}>
                    <button
                      onClick={requestGeo}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors text-left"
                      style={{
                        backgroundColor: bFilters.nearMe ? COLORS.beneficiarySoft : "transparent",
                        color: bFilters.nearMe ? COLORS.beneficiary : COLORS.ink,
                        fontFamily: "'Work Sans', sans-serif",
                        fontWeight: bFilters.nearMe ? 600 : 400,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <Navigation size={15} color={COLORS.beneficiary} />
                        <span>{geo.status === "locating" ? "Finding you…" : bFilters.nearMe ? "Sorted by distance" : "Sort by nearest"}</span>
                      </div>
                      {bFilters.nearMe && <Check size={14} style={{ color: COLORS.beneficiary }} />}
                    </button>
                    {geo.status === "error" && (
                      <p className="text-xs px-3 py-1" style={{ color: COLORS.urgent, fontFamily: "'Work Sans', sans-serif" }}>
                        Location access failed.
                      </p>
                    )}
                  </div>
                </DropdownFilter>
              </>
            )}

            {activeFilterCount > 0 && (
              <button 
                onClick={clearFilters} 
                className="text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all shadow-sm flex items-center gap-1.5"
                style={{ borderColor: COLORS.line, color: accent, backgroundColor: COLORS.paperRaised, fontFamily: "'Work Sans', sans-serif" }}
              >
                <X size={14} /> Clear all ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* Results Grid with clear separation gap */}
        <main className="mt-16">
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border p-12 text-center shadow-sm" style={{ borderColor: COLORS.line, backgroundColor: COLORS.pureWhite }}>
              <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, color: COLORS.ink }} className="text-xl mb-2">
                No events match your criteria
              </p>
              <p style={{ color: COLORS.inkSoft, fontFamily: "'Work Sans', sans-serif" }} className="text-base mb-6">
                Try loosening your filters or resetting your search to see available events.
              </p>
              <button 
                onClick={clearFilters} 
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90 shadow-sm"
                style={{ backgroundColor: accent, color: "#fff", fontFamily: "'Work Sans', sans-serif" }}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  role={role}
                  accent={accent}
                  meta={role === "volunteer" ? PILLAR_META[event.pillar] : CATEGORY_META[event.category]}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}