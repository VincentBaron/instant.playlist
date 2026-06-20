import type { Metadata } from "next";
import { Archivo, Space_Mono } from "next/font/google";
import "./globals.css";

// Display = the human-curated poster (festival name, artist names).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// Mono = the machine (wordmark, counts, track titles, durations, status).
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "instant.playlist",
  description:
    "Scan a festival poster → a public, shareable, playable lineup of long DJ sets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
