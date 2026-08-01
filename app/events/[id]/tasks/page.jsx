"use client";

// Tasks — what's outstanding for this event.
//
// The task board and the logistics partners sit together because they're the
// same question ("what still needs doing before we can run this?") and they
// feed the readiness score identically.

import { use } from "react";
import TaskBoard from "@/components/TaskBoard.jsx";
import LogisticsPartners from "@/components/LogisticsPartners.jsx";

export default function TasksPage({ params }) {
  const { id } = use(params);

  return (
    <>
      <TaskBoard eventId={id} />
      <LogisticsPartners eventId={id} />
    </>
  );
}
