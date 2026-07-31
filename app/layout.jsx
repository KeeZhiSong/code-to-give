import "./globals.css";

export const metadata = {
  title: "Passion To Serve — Event Console",
  description: "Broadcast to volunteers over WhatsApp and see who's coming.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
