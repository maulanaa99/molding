"use client";

import React, { useState, useTransition } from "react";
import { Factory, Lock, UserCheck, ShieldCheck, ChevronRight, AlertCircle, Sparkles, KeyRound } from "lucide-react";
import { quickLoginAction, loginAction } from "./actions";

interface DemoAccount {
  employeeId: string;
  name: string;
  role: string;
  badgeColor: string;
  desc: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    employeeId: "OPR01",
    name: "Ahmad Dani",
    role: "OPERATOR",
    badgeColor: "bg-emerald-950 text-emerald-300 border-emerald-800",
    desc: "Operasional mesin injection, input NG reject, & scan kanban produksi",
  },
  {
    employeeId: "PLN01",
    name: "Rian Planner (PPIC)",
    role: "PLANNER",
    badgeColor: "bg-amber-950 text-amber-300 border-amber-800",
    desc: "Perencanaan jadwal job produksi, alokasi mesin, & mutasi stok Finish Good",
  },
  {
    employeeId: "SPV01",
    name: "Budi Santoso",
    role: "SUPERVISOR",
    badgeColor: "bg-indigo-950 text-indigo-300 border-indigo-800",
    desc: "Oversight shift, dashboard performa OEE, investigasi stop, & laporan",
  },
  {
    employeeId: "ADM01",
    name: "Admin MMS",
    role: "ADMIN",
    badgeColor: "bg-rose-950 text-rose-300 border-rose-800",
    desc: "Akses penuh sistem, manajemen master mesin, part, kanban, & import data",
  },
];

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleQuickSelect = (acc: DemoAccount) => {
    setEmployeeId(acc.employeeId);
    setPin("1234");
    setErrorMessage(null);

    startTransition(async () => {
      const res = await quickLoginAction(acc.employeeId, "1234");
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!employeeId.trim()) {
      setErrorMessage("Silakan masukkan NIK / ID Karyawan.");
      return;
    }
    if (!pin.trim()) {
      setErrorMessage("Silakan masukkan PIN keamanan.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("employeeId", employeeId);
      formData.set("pin", pin);
      const res = await loginAction(null, formData);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-sky-600 text-white rounded-xl shadow-lg border border-sky-500">
            <Factory className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">MMS Authentication</h1>
          <p className="text-xs text-slate-400">
            Molding Management System &middot; Otentikasi Role Karyawan Plant
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          {/* Quick Role Tester */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                Pilih Role untuk Uji Coba:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">PIN: 1234</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = employeeId === acc.employeeId;
                return (
                  <button
                    key={acc.employeeId}
                    type="button"
                    onClick={() => handleQuickSelect(acc)}
                    disabled={isPending}
                    className={`text-left p-2.5 rounded-lg border transition-all text-xs cursor-pointer tap-target flex flex-col justify-between ${
                      isSelected
                        ? "border-sky-500 bg-sky-950/40 ring-1 ring-sky-500"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-slate-200">{acc.name}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold ${acc.badgeColor}`}
                      >
                        {acc.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{acc.desc}</p>
                    <div className="mt-2 text-[10px] text-sky-400 font-mono flex items-center gap-1">
                      <span>Masuk sebagai {acc.role}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-mono absolute">
              atau ketik manual
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-lg text-xs flex items-start gap-2.5"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-tight">{errorMessage}</div>
            </div>
          )}

          {/* Form Manual Login */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="employeeId" className="block text-xs font-semibold text-slate-300 mb-1">
                NIK / ID Karyawan
              </label>
              <div className="relative">
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  placeholder="Contoh: ADM01, SPV01, OPR01, PLN01"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  disabled={isPending}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="block text-xs font-semibold text-slate-300 mb-1">
                PIN Keamanan
              </label>
              <div className="relative">
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  placeholder="Masukkan PIN (Default: 1234)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={isPending}
                  maxLength={10}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono tracking-widest"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors cursor-pointer tap-target flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Masuk ke MMS</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-500">
          Sistem Produksi Molding &bull; Keamanan Berbasis Session Cookie & Role Authorization
        </p>
      </div>
    </div>
  );
}
