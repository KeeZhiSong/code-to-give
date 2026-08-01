import "./globals.css";
// Required by the dashboards, task board and the public share page — they're
// styled entirely with .pf-* classes. Dropping this import renders them
// unstyled, which is easy to miss because the console itself still looks fine.
import "./pts-features.css";

export const metadata = {
  title: "Passion To Serve",
  description: "Coordinate volunteer-led events over WhatsApp.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* Explorer/dispatch/volunteer pages compute values during render that
          can differ between server and client; suppress the resulting noise. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
