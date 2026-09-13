import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Landing — A softer start in a new city",
  description: "AI relocation agent for the first 72 hours in a new city.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
