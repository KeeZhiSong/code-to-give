import "./globals.css";

export const metadata = {
  title: "Passion To Serve",
  description: "Event console and explorer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}