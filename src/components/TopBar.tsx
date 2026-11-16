"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Menu,
  Factory,
  CalendarDays,
  QrCode,
  Boxes,
  PackageMinus,
  Camera,
  Activity,
  BarChart3,
  Database,
  Clock,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { NavTab, UserProfile } from "./Sidebar";
import { handleLogout } from "@/app/login/actions";

interface TopBarProps {
  activeTab: NavTab;
  currentUser: UserProfile;
  serverTimeOffset?: number;
  onToggleMobileSidebar: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

const TAB_TITLES: Record<
  NavTab,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  machines: {
    title: "Lantai Mesin Produksi",
    subtitle: "Status 15 Unit Mesin Injection Molding & Kontrol Operasional",
    icon: Factory,
  },
  planning: {
    title: "Perencanaan Produksi (PPIC)",
    subtitle: "Penjadwalan Job, Target Kuantiti & Penugasan Operator",
    icon: CalendarDays,
  },
  traceability: {
    title: "Traceability QR & Riwayat Lot",
    subtitle: "Pelacakan Trolly, Riwayat Scan & Silsilah Komponen",
    icon: QrCode,
  },
  stock: {
    title: "Stok Finish Good",
    subtitle: "Monitoring Persediaan Part & Kuantiti Siap Kirim",
    icon: Boxes,
  },
  outbound: {
    title: "Scan Pengeluaran Trolly (PDA)",
    subtitle: "Verifikasi Pengiriman Trolly ke Proses Lanjutan / Painting / Warehouse",
    icon: PackageMinus,
  },
  counter: {
    title: "Counter Part & Audit Fisik",
    subtitle: "Perhitungan Manual & Verifikasi Fisik Komponen",
    icon: Camera,
  },
  dashboard: {
    title: "Dashboard & Metrik KPI",
    subtitle: "Ringkasan Efisiensi, Kuantiti Output & Tingkat Reject",
    icon: Activity,
  },
  reports: {
    title: "Laporan Harian & Pareto",
    subtitle: "Rekapitulasi Shift, Sebab Stop Mesin & Analisis Cacat",
    icon: BarChart3,
  },
  master: {
    title: "Master Data Pabrik",
    subtitle: "Spesifikasi Part Cetak, Relasi Mesin, Alasan Stop & Karyawan",
    icon: Database,
  },
};

export default function TopBar({
  activeTab,
  currentUser,
  serverTimeOffset = 0,
  onToggleMobileSidebar,
  isCompact = false,
  onToggleCompact,
}: TopBarProps) {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date(Date.now() + serverTimeOffset);
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " WIB"
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [serverTimeOffset]);

  const currentTabInfo = TAB_TITLES[activeTab] || TAB_TITLES.machines;
  const ActiveIcon = currentTabInfo.icon;

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "bg-rose-950 text-rose-300 border-rose-800";
      case "SUPERVISOR":
        return "bg-indigo-950 text-indigo-300 border-indigo-800";
      case "PLANNER":
        return "bg-amber-950 text-amber-300 border-amber-800";
      default:
        return "bg-emerald-950 text-emerald-300 border-emerald-800";
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-20 shadow-xs">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Hamburger (Mobile) / Compact Toggle (Desktop) & Active Page Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Menu Hamburger */}
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 cursor-pointer active:scale-95"
            aria-label="Buka Menu Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop Compact Toggle */}
          {onToggleCompact && (
            <button
              onClick={onToggleCompact}
              className="hidden lg:flex p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 cursor-pointer transition active:scale-95"
              title={isCompact ? "Lebarkan Sidebar" : "Ciutkan Sidebar (Compact Mode)"}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Current Section Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden sm:flex w-8 h-8 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/80 items-center justify-center shrink-0">
              <ActiveIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="hidden md:inline font-medium">MMS Molding</span>
                <ChevronRight className="hidden md:inline w-3 h-3 text-slate-600" />
                <span className="font-bold text-white text-sm sm:text-base truncate">
                  {currentTabInfo.title}
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-400 truncate">
                {currentTabInfo.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Server Clock & User Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Live Server Clock */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="tabular-numbers font-semibold text-emerald-400">{currentTime}</span>
          </div>

          {/* User Profile Mini Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white truncate max-w-[120px]">
                {currentUser?.name || "User"}
              </p>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-bold inline-block ${getRoleBadge(
                  currentUser?.role
                )}`}
              >
                {currentUser?.role || "OPERATOR"}
              </span>
            </div>

            {/* Logout Shortcut */}
            <button
              onClick={() => {
                startTransition(async () => {
                  await handleLogout();
                });
              }}
              disabled={isPending}
              title="Keluar (Logout)"
              className="p-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-950/60 border border-rose-900/40 bg-rose-950/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

