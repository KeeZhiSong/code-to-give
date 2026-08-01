"use client";

// Overview — the first question an organiser opens the tool to answer:
// is this event ready to run?

import { use } from "react";
import ReadinessScore from "@/components/ReadinessScore.jsx";
import HeadcountDashboard from "@/components/HeadcountDashboard.jsx";

export default function OverviewPage({ params }) {
  const { id } = use(params);

  return (
    <>
      <HeadcountDashboard eventId={id} />
      {/* Suggested actions link through to Broadcast rather than acting here —
          nothing goes out without an organiser reviewing it first. */}
      <ReadinessScore eventId={id} />
    </>
  );
}
