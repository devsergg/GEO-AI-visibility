import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GEO Command Center",
  description:
    "AI-visibility intelligence — measure and improve how your brand appears in ChatGPT, Perplexity, Gemini, and Google AI answers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-canvas text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
