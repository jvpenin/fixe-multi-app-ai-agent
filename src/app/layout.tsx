import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Land.ai — New city. Make it yours.",
  description: "Moving for a new semester, a new job, or a fresh start? Land.ai plans your first 72 hours around your address, taste, and budget.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
