import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import OutboundPdaView from "@/components/OutboundPdaView";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export const metadata = {
  title: "PDA Scanner Outbound - MMS Molding",
  description: "Scanner Pengeluaran Stok Finish Good berbasis PDA Android",
};

export default async function PdaPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      {/* Top Mobile Bar with Quick Back to Main App */}
      <div className="max-w-2xl mx-auto flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition font-bold px-2 py-1 rounded bg-slate-900 border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Ke Dashboard Utama</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-mono text-slate-400">PDA Mode Aktif</span>
        </div>
      </div>

      <OutboundPdaView
        currentUser={user}
        isStandaloneMobile={true}
      />
    </div>
  );
}
