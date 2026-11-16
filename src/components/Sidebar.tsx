"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Factory,
  Activity,
  BarChart3,
  Database,
  CalendarDays,
  Boxes,
  LogOut,
  QrCode,
  PackageMinus,
  Camera,
  X,
  Clock,
  Layers,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { handleLogout } from "@/app/login/actions";

export type NavTab =
  | "machines"
  | "planning"
  | "traceability"
  | "stock"
  | "outbound"
  | "counter"
  | "dashboard"
  | "reports"
  | "master";

export interface UserProfile {
  id: number;
  name: string;
  employeeId: string;
  role: string;
}

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUser: UserProfile;
  serverTimeOffset?: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

interface MenuItem {
  id: NavTab;
  label: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor?: string;
  visible: boolean;
}

interface MenuGroup {
  groupName: string;
  items: MenuItem[];
}

export default function Sidebar({
  activeTab,
  onTabChange,
  currentUser,
  serverTimeOffset = 0,
  isMobileOpen,
  onCloseMobile,
  isCompact = false,
  onToggleCompact,
}: SidebarProps) {
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

  const userRole = currentUser?.role?.toUpperCase() || "OPERATOR";
  const isOperator = userRole === "OPERATOR";
  const isPlanner = userRole === "PLANNER";

  const getRoleBadge = (role: string) => {
    switch (role) {
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

  const menuGroups: MenuGroup[] = [
    {
      groupName: "Operasional Lantai Pabrik",
      items: [
        {
          id: "machines",
          label: "Lantai Mesin",
          badge: "15 Unit",
          icon: Factory,
          visible: true,
        },
        {
          id: "outbound",
          label: "Scan Keluar (PDA)",
          badge: "Logistik",
          icon: PackageMinus,
          visible: true,
        },
        {
          id: "counter",
          label: "Counter Part",
          badge: "Audit",
          icon: Camera,
          visible: true,
        },
      ],
    },
    {
      groupName: "Perencanaan & Material",
      items: [
        {
          id: "planning",
          label: "Rencana Job (PPIC)",
          badge: "PPIC",
          icon: CalendarDays,
          visible: !isOperator,
        },
        {
          id: "traceability",
          label: "Traceability QR",
          icon: QrCode,
          visible: true,
        },
        {
          id: "stock",
          label: "Stok Finish Good",
          icon: Boxes,
          visible: true,
        },
      ],
    },
    {
      groupName: "Analisis & Laporan",
      items: [
        {
          id: "dashboard",
          label: "Dashboard KPI",
          icon: Activity,
          visible: !isOperator,
        },
        {
          id: "reports",
          label: "Laporan & Pareto",
          icon: BarChart3,
          visible: !isOperator,
        },
      ],
    },
    {
      groupName: "Pengaturan & Sistem",
      items: [
        {
          id: "master",
          label: "Master Data & Kanban",
          icon: Database,
          visible: !isOperator && !isPlanner,
        },
      ],
    },
  ];

  const handleItemClick = (tab: NavTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  const renderSidebarContent = (compactMode: boolean) => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className={`${compactMode ? "p-3" : "p-4"} border-b border-slate-800 bg-slate-950/50`}>
        {compactMode ? (
          // Compact Header
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleCompact}
              className="w-10 h-10 rounded-xl bg-linear-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-900/30 hover:scale-105 transition cursor-pointer group relative"
              title="Klik untuk Melebarkan Sidebar"
            >
              <Factory className="w-5 h-5 group-hover:hidden" />
              <ChevronRight className="w-5 h-5 hidden group-hover:block" />
            </button>
            <div
              className="flex items-center justify-center text-slate-400 hover:text-emerald-400 cursor-help"
              title={`Waktu Server: ${currentTime}`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        ) : (
          // Expanded Header
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-900/30">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-lg tracking-tight text-white">MMS</span>
                    <span className="bg-sky-950 text-sky-300 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-sky-800">
                      LAN v0.1
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">Molding Management System</p>
                </div>
              </div>

              {/* Desktop Collapse Button */}
              {onToggleCompact && (
                <button
                  onClick={onToggleCompact}
                  className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  title="Ciutkan Sidebar (Compact Mode)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}

              {/* Mobile Close Button */}
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Server Clock */}
            <div className="mt-3 flex items-center justify-between text-xs font-mono bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] text-slate-400">Server:</span>
              </div>
              <span className="font-semibold text-emerald-300 tabular-numbers">{currentTime}</span>
            </div>
          </>
        )}
      </div>

      {/* Navigation Groups */}
      <nav
        className={`flex-1 overflow-y-auto ${compactMode ? "px-2 py-3 space-y-3" : "px-3 py-4 space-y-6"}`}
        aria-label="Menu Utama Sidebar"
      >
        {menuGroups.map((group, gIdx) => {
          const visibleItems = group.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={gIdx} className="space-y-1">
              {compactMode ? (
                // Compact separator
                gIdx > 0 && <div className="border-t border-slate-800/80 my-2 mx-1" />
              ) : (
                // Expanded group title
                <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                  {group.groupName}
                </div>
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  if (compactMode) {
                    return (
                      <div key={item.id} className="relative group flex justify-center">
                        <button
                          onClick={() => handleItemClick(item.id)}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                            isActive
                              ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                              : "text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                          aria-label={item.label}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                        </button>

                        {/* Hover Tooltip in Compact Mode */}
                        <div className="hidden group-hover:flex items-center gap-2 absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-3 py-1.5 bg-slate-950 text-white text-xs font-bold rounded-lg whitespace-nowrap shadow-2xl border border-slate-700 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                          <span>{item.label}</span>
                          {item.badge && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                        isActive
                          ? "bg-sky-600 text-white shadow-md shadow-sky-900/30 font-bold"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isActive
                              ? "text-white scale-110"
                              : "text-slate-400 group-hover:text-sky-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {item.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold uppercase ${
                              isActive
                                ? "bg-sky-700/80 text-sky-100 border border-sky-400/40"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-sky-200" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Profile & Logout Footer */}
      <div className={`${compactMode ? "p-2" : "p-3"} border-t border-slate-800 bg-slate-950/60 space-y-2`}>
        {compactMode ? (
          // Compact User Profile & Logout
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-9 h-9 rounded-full bg-linear-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-inner cursor-help relative group"
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              {/* Tooltip on user avatar */}
              <div className="hidden group-hover:flex flex-col absolute left-full bottom-0 ml-2.5 p-2 bg-slate-950 text-white text-xs font-bold rounded-lg whitespace-nowrap shadow-2xl border border-slate-700 z-50 pointer-events-none">
                <span>{currentUser?.name || "User"}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  [{currentUser?.employeeId || "-"}] • {userRole}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                startTransition(async () => {
                  await handleLogout();
                });
              }}
              disabled={isPending}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-400 hover:text-rose-200 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-900/50 transition cursor-pointer disabled:opacity-50"
              title="Keluar (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Expanded User Profile & Logout
          <>
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser?.name || "User"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {currentUser?.employeeId || "-"}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-bold shrink-0 ${getRoleBadge(
                      userRole
                    )}`}
                  >
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                startTransition(async () => {
                  await handleLogout();
                });
              }}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-900/50 transition cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>{isPending ? "Keluar..." : "Keluar (Logout)"}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Docked with smooth transition between Compact and Expanded) */}
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 z-30 transition-all duration-200 ease-in-out ${
          isCompact ? "w-16 xl:w-18" : "w-64 xl:w-72"
        }`}
      >
        {renderSidebarContent(isCompact)}
      </aside>

      {/* Mobile Sidebar Overlay (Slide Drawer - Always Expanded for ease of touch) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false)}
          </div>
        </div>
      )}
    </>
  );
}

