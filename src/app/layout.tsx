import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MMS - Molding Management System",
  description: "Sistem Pencatatan Produksi Injection Molding LAN Touch-First",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900">
        {children}
      </body>
    </html>
  );
}
