"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Factory,
  Activity,
  BarChart3,
  Database,
  User,
  Clock,
  CalendarDays,
  Boxes,
  LogOut,
  ShieldCheck,
  ChevronDown,
  QrCode,
  PackageMinus,
  Lock,
  Camera,
} from "lucide-react";
import { handleLogout } from "@/app/login/actions";

export type NavTab = "machines" | "planning" | "traceability" | "stock" | "outbound" | "counter" | "dashboard" | "reports" | "master";

export interface UserProfile {
  id: number;
  name: string;
  employeeId: string;
  role: string;
}

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUser: UserProfile;
  onUserChange?: (user: UserProfile) => void;
  usersList?: UserProfile[];
  serverTimeOffset?: number;
}

export default function Navbar({
  activeTab,
  onTabChange,
  currentUser,
  serverTimeOffset = 0,
}: NavbarProps) {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
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

  const isOperator = currentUser?.role?.toUpperCase() === "OPERATOR";
  const isPlanner = currentUser?.role?.toUpperCase() === "PLANNER";

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 py-3">
        {/* Brand & Identity */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 text-white p-2 rounded-lg flex items-center justify-center shadow-inner">
              <Factory className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">MMS</span>
                <span className="bg-sky-950 text-sky-300 text-xs px-2 py-0.5 rounded font-mono border border-sky-800">
                  LAN v0.1
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${getRoleBadge(
                    currentUser?.role
                  )}`}
                >
                  {currentUser?.role || "OPERATOR"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Molding Management System</p>
            </div>
          </div>

          {/* Clock for mobile */}
          <div className="flex md:hidden items-center gap-1.5 text-xs text-slate-300 font-mono bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="tabular-numbers">{currentTime}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0" aria-label="Main Navigation">
          {/* Machines Tab - Available for all */}
          <button
            onClick={() => onTabChange("machines")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "machines"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <Factory className="w-4 h-4" />
            <span>Mesin (15 Unit)</span>
          </button>

          {/* Planning Tab - Only for Planner, Spv, Admin (Hidden for Operator) */}
          {!isOperator && (
            <button
              onClick={() => onTabChange("planning")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "planning"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Rencana Job (PPIC)</span>
            </button>
          )}

          {/* Traceability Tab - Available for all roles */}
          <button
            onClick={() => onTabChange("traceability")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "traceability"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Traceability QR</span>
          </button>

          {/* Stock Tab */}
          <button
            onClick={() => onTabChange("stock")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "stock"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Stok Finish Good</span>
          </button>

          {/* Outbound PDA Scanner Tab - Available for all roles */}
          <button
            onClick={() => onTabChange("outbound")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "outbound"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <PackageMinus className="w-4 h-4 text-amber-400" />
            <span>Scan Keluar (PDA)</span>
          </button>

          {/* Counter Part Tab - Available for all roles */}
          <button
            onClick={() => onTabChange("counter")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "counter"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span>Counter Part</span>
          </button>

          {/* Dashboard Tab - Hidden for Operator */}
          {!isOperator && (
            <button
              onClick={() => onTabChange("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "dashboard"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
            >
              <Activity className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          )}

          {/* Reports Tab - Hidden for Operator */}
          {!isOperator && (
            <button
              onClick={() => onTabChange("reports")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "reports"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Laporan & Pareto</span>
            </button>
          )}

          {/* Master Tab - Only for Admin & Supervisor */}
          {!isOperator && !isPlanner && (
            <button
              onClick={() => onTabChange("master")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-semibold text-sm transition-colors cursor-pointer tap-target ${activeTab === "master"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
            >
              <Database className="w-4 h-4" />
              <span>Master & Kanban</span>
            </button>
          )}
        </nav>

        {/* Right Section: Time & Authenticated User Profile */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* User Account / Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              disabled={isPending}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition cursor-pointer tap-target disabled:opacity-50"
              aria-expanded={showUserDropdown}
              aria-haspopup="true"
            >
              <div className="w-6 h-6 rounded-full bg-sky-700 text-sky-100 flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0) : "U"}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-tight">{currentUser?.name || "User"}</p>
                <p className="text-[10px] text-slate-400 font-mono leading-none">
                  {currentUser?.role || "OPERATOR"} ({currentUser?.employeeId || "-"})
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50">
                {/* Current User Header */}
                <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-950/60 rounded-t-xl">
                  <p className="text-[11px] font-medium text-slate-400">Akun Aktif Saat Ini:</p>
                  <p className="text-sm font-bold text-white">{currentUser?.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-slate-300">NIK: {currentUser?.employeeId}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold ${getRoleBadge(
                        currentUser?.role
                      )}`}
                    >
                      {currentUser?.role}
                    </span>
                  </div>
                </div>

                {/* Notice: Must logout to switch accounts */}
                <div className="px-3 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Untuk berganti operator atau peran, silakan keluar (logout) terlebih dahulu.
                  </p>
                </div>

                {/* Logout Option */}
                <div className="pt-2 px-2">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      startTransition(async () => {
                        await handleLogout();
                      });
                    }}
                    disabled={isPending}
                    className="w-full text-left px-3 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 rounded-lg flex items-center justify-between transition cursor-pointer border border-rose-900/50 bg-rose-950/20 active:translate-y-0.5 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Keluar (Logout)</span>
                    </div>
                    <span className="text-[10px] text-rose-400 font-mono">Ke Layar Login &rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
