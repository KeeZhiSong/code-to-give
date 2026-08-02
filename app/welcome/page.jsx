// The landing page — the only Persuade surface in the product.
//
// Everything else here is Operate: an organiser completing a task, where
// density and scanability beat expression. This page has one job instead —
// someone arriving cold decides whether this is worth taking seriously. So it
// gets room, a display face, and the one piece of motion in the whole app that
// exists to be looked at.
//
// It is NOT a sign-in wall. Volunteers and beneficiaries never come here or
// anywhere else in this console; they get a WhatsApp message on the number
// they already use. Saying so on the page is the point, not a footnote.

import Link from "next/link";
import ConvergenceCanvas from "@/components/ConvergenceCanvas.jsx";
import "./landing.css";

export const metadata = {
  title: "Passion To Serve — event coordination",
  description:
    "One place to plan, run and close out a volunteer-led event. Organisers get a console; everyone else gets WhatsApp.",
};

// Published by PTS and independently audited — these are real and citable.
// Deliberately NOT the figures in the post-event thank-you, which are display
// values that don't reconcile with these.
const IMPACT = [
  { n: "20,894", l: "beneficiaries reached" },
  { n: "26,620", l: "items donated" },
  { n: "945", l: "students supported" },
  { n: "378", l: "volunteers & educators" },
];

export default function WelcomePage() {
  return (
    <div className="lp">
      <header className="lp-nav">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Passion To Serve" width={34} height={34} />
        <span className="lp-wordmark">Passion To Serve</span>
        <Link href="/" className="lp-nav-cta">
          Open the console
        </Link>
      </header>

      <section className="lp-hero">
        <h1>
          Every event lives in
          <br />
          <span className="lp-strike">six different places</span>
          <br />
          <em>Now it lives in one.</em>
        </h1>
        <p className="lp-lede">
          Passion To Serve runs donation drives, literacy classes and wellness
          sessions for migrant workers in Singapore — planned months ahead, by
          volunteers, in their spare hours. This is where those events get
          coordinated.
        </p>
        <div className="lp-actions">
          <Link href="/" className="lp-cta">
            Open the console
          </Link>
          <span className="lp-actions-note">
            For organisers. Volunteers never log in.
          </span>
        </div>
      </section>

      <section className="lp-problem">
        <h2>
          Events are planned months ahead, so their threads interleave. Nobody
          can tell what&apos;s been handled from what&apos;s still pending.
        </h2>
        <p>
          That&apos;s the real cost — not the admin itself, but the hours lost
          to finding out where things stand. Hours that were meant for the
          people PTS exists to serve.
        </p>
      </section>

      <section className="lp-converge">
        <ConvergenceCanvas />
        <p className="lp-caption">
          Tasks, headcount, broadcasts and the thank-you afterwards — in the
          same place, for every event running at once.
        </p>
      </section>

      <section className="lp-thesis">
        <h2>
          Organisers get a console.
          <br />
          Everyone else gets a WhatsApp message.
        </h2>
        <p>
          Migrant workers won&apos;t install an app, and shouldn&apos;t have to.
          So the product splits along the channel rather than the org chart:
          registration arrives through a form, invitations and polls go out over
          WhatsApp, and replies land on the organiser&apos;s roster live. The
          people being coordinated never have to show up to the software at all.
        </p>
      </section>

      <section className="lp-impact">
        <h2>What Passion To Serve has already done</h2>
        <div className="lp-figures">
          {IMPACT.map((f) => (
            <div key={f.l}>
              <div className="lp-n">{f.n}</div>
              <div className="lp-l">{f.l}</div>
            </div>
          ))}
        </div>
        <p className="lp-source">
          Figures published by Passion To Serve, a registered and publicly
          audited non-profit founded in 2020.
        </p>
      </section>

      <footer className="lp-foot">
        <Link href="/" className="lp-cta">
          Open the console
        </Link>
      </footer>
    </div>
  );
}
