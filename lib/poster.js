// Generates the two branded images the WhatsApp notifications carry as an
// attachment (see lib/loyalty.js) — a classic, simple certificate/pass look,
// rendered server-side with Next's built-in ImageResponse (Satori under the
// hood, same engine as Vercel OG images). No external assets: default font,
// an emoji glyph for the badge, CSS shapes for the border — nothing to
// bundle or fetch, which matters for a hackathon build.
//
// Both exports return raw PNG bytes (a Buffer), not a Response — the caller
// (lib/greenapi.js's sendImage) posts those bytes straight to GreenAPI's
// sendFileByUpload, so nothing needs to be publicly hosted first.
//
// Plain React.createElement, not JSX: this module is imported by
// scripts/listen.js, which runs under plain `node` — Next.js transpiles JSX
// automatically for the web app, but a standalone script has no JSX
// transform at all, so a .jsx file here would crash it with
// ERR_UNKNOWN_FILE_EXTENSION. Written once as createElement calls, both
// callers get the same behaviour with no build step required.

import React from "react";
// Explicit ".js" extension, not the bare "next/og": Next's own bundler
// resolves the extensionless specifier fine, but this module also loads
// under plain `node` (scripts/listen.js), whose native ESM resolver has no
// exports map to fall back on and won't auto-append an extension — the
// bare specifier 404s there even though the file exists.
import { ImageResponse } from "next/og.js";

const e = React.createElement;

const NAVY = "#0f2c46";
const NAVY_SOFT = "#3a5570";
const GOLD = "#b8902e";
const CREAM = "#fdfbf6";

const WIDTH = 1200;
const HEIGHT = 630;

function formatDate(d = new Date()) {
  return d.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Shared certificate frame: a navy outer rule, a gold inner rule, a centered
// badge circle, name, a label pill, a body line, and a footer row. The two
// exports below only ever change what goes into these slots.
function Frame({ badgeEmoji, name, label, body, footerLeft, footerRight }) {
  return e(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: CREAM,
        border: `10px solid ${NAVY}`,
        padding: "36px",
      },
    },
    e(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          border: `2px solid ${GOLD}`,
          padding: "48px 64px",
        },
      },
      e(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
        e(
          "div",
          { style: { fontSize: 26, letterSpacing: 6, color: NAVY_SOFT, fontWeight: 600 } },
          "PASSION TO SERVE"
        ),
        e("div", { style: { width: 120, height: 3, backgroundColor: GOLD, marginTop: 14 } })
      ),
      e(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "center" } },
        e(
          "div",
          {
            style: {
              width: 110,
              height: 110,
              borderRadius: 55,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `4px solid ${GOLD}`,
              backgroundColor: "#fff",
              fontSize: 56,
              marginBottom: 24,
            },
          },
          badgeEmoji
        ),
        e(
          "div",
          { style: { fontSize: 56, fontWeight: 700, color: NAVY, textAlign: "center" } },
          name
        ),
        e(
          "div",
          {
            style: {
              marginTop: 14,
              fontSize: 24,
              letterSpacing: 4,
              fontWeight: 700,
              color: "#fff",
              backgroundColor: GOLD,
              padding: "8px 28px",
              borderRadius: 999,
            },
          },
          label
        ),
        e(
          "div",
          {
            style: {
              marginTop: 22,
              fontSize: 26,
              color: NAVY_SOFT,
              textAlign: "center",
              maxWidth: 780,
            },
          },
          body
        )
      ),
      e(
        "div",
        {
          style: {
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: NAVY_SOFT,
          },
        },
        e("div", null, footerLeft),
        e("div", null, footerRight)
      )
    )
  );
}

async function toBuffer(element) {
  const response = new ImageResponse(element, { width: WIDTH, height: HEIGHT });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Beneficiary VIP Pass — priority GIFTIK access, granted at the crossing attendance. */
export async function renderVipPassImage({ name, attendanceCount }) {
  return toBuffer(
    e(Frame, {
      badgeEmoji: "⭐",
      name: name || "Valued Beneficiary",
      label: "VIP PASS",
      body: "Priority access at our next GIFTIK Distribution Event — thank you for being part of our journey.",
      footerLeft: `Issued ${formatDate()}`,
      footerRight: `${attendanceCount} attendance${attendanceCount === 1 ? "" : "s"} logged`,
    })
  );
}

/** Volunteer milestone — sent alongside the points thank-you on every logged attendance. */
export async function renderVolunteerMilestoneImage({ name, points, eventName }) {
  return toBuffer(
    e(Frame, {
      badgeEmoji: "🏅",
      name: name || "Valued Volunteer",
      label: "VOLUNTEER MILESTONE",
      body: `In recognition of ${points} point${points === 1 ? "" : "s"} earned volunteering with Passion To Serve.`,
      footerLeft: `Issued ${formatDate()}`,
      footerRight: eventName ? `Latest: ${eventName}` : "",
    })
  );
}
