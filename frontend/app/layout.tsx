import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF OCR POC",
  description: "Upload PDF, see OCR boxes overlaid on pages",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
