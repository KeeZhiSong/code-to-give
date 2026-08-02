import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
// Required by the dashboards, task board and the public share page — they're
// styled entirely with .pf-* classes. Dropping this import renders them
// unstyled, which is easy to miss because the console itself still looks fine.
import "./pts-features.css";
import Sidebar from "@/components/Sidebar.jsx";

// Editorial serif for headings, Inter for body copy, IBM Plex Mono reserved
// for stats/timestamps/status labels — a deliberate signal that a number is
// live system output, not decoration. Self-hosted via next/font so there's
// no runtime call to a font CDN.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
  style: ["normal"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata = {
  title: "Passion To Serve",
  description: "Coordinate volunteer-led events over WhatsApp.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}
    >
      {/* The dispatch and operations pages compute values during render that
          can differ between server and client; suppress the resulting noise. */}
      <body suppressHydrationWarning>
        <div className="shell">
          <Sidebar />
          <main className="shell-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
