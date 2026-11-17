"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  Play,
  Square,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  History,
  FileText,
  Calendar,
  FileSpreadsheet,
  Gauge,
  Trophy,
  Zap,
  Target,
} from "lucide-react";
import { MachineData } from "./MachineCard";
import DailyMachineReportModal from "./DailyMachineReportModal";

interface DashboardOverviewData {
  machineCounts: {
    total: number;
    running: number;
    down: number;
    idle: number;
  };
  productionToday: {
    totalRuns: number;
    totalTrolly: number;
    totalPcsOk: number;
    totalPcsReject: number;
    efficiency: number;
    rejectRate: number;
  };
  oee?: {
    oee: number;
    availability: number;
    performance: number;
    quality: number;
    operatingMinutes: number;
    downtimeMinutes: number;
    worldClassTarget: {
      oee: number;
      availability: number;
      performance: number;
      quality: number;
    };
  };
}

interface SupervisorDashboardProps {
  machines: MachineData[];
  overview: DashboardOverviewData;
  onRefresh: () => Promise<void>;
  onSelectMachine: (machine: MachineData) => void;
  onForceStop: (runId: number, stopReasonId: number) => Promise<{ success: boolean; error?: string }>;
  stopReasons: Array<{ id: number; code?: string | null; category: string; reason: string }>;
}

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

export default function SupervisorDashboard({
  machines,
  overview,
  onRefresh,
  onSelectMachine,
  onForceStop,
  stopReasons,
}: SupervisorDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forceStopRunId, setForceStopRunId] = useState<number | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<number>(stopReasons[0]?.id || 1);
  const [isForceStopping, setIsForceStopping] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "narrative">("narrative");
  const [selectedReportMachineId, setSelectedReportMachineId] = useState<number | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Polling 5 seconds when autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      await onRefresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleConfirmForceStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forceStopRunId) return;

    setIsForceStopping(true);
    const res = await onForceStop(forceStopRunId, selectedReasonId);
    setIsForceStopping(false);

    if (res.success) {
      setForceStopRunId(null);
      await onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-300 shadow-2xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-600" />
            Dashboard Monitoring Supervisor
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Pemantauan langsung status mesin, ringkasan kronologi shift, dan efisiensi lantai pabrik.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg cursor-pointer border border-slate-200">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
            />
            <span>Auto Refresh (5s)</span>
          </label>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold transition cursor-pointer tap-target shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedReportMachineId(machines[0]?.id || 1);
              setIsReportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer tap-target shadow-2xs"
            title="Buka Formulir Catatan Proses / Laporan Penanganan Abnormal (FO/MLD/009 Rev.08)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Formulir Standar (FO/MLD/009)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Machine Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Mesin</span>
            <span className="w-3 h-3 rounded-full bg-slate-400" />
          </div>
          <p className="text-3xl font-black text-slate-900 font-mono tabular-numbers mt-2">
            {overview.machineCounts.total}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Mesin Terdaftar</p>
        </div>

        <div className="bg-emerald-50/60 p-4 rounded-xl border-2 border-emerald-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase">RUNNING (Aktif)</span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-3xl font-black text-emerald-700 font-mono tabular-numbers mt-2">
            {overview.machineCounts.running}
          </p>
          <p className="text-[11px] text-emerald-800 mt-1">
            {Math.round((overview.machineCounts.running / (overview.machineCounts.total || 1)) * 100)}% utilitas jalan
          </p>
        </div>

        <div className="bg-rose-50/60 p-4 rounded-xl border-2 border-rose-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase">DOWN (Berhenti)</span>
            <span className="w-3 h-3 rounded-full bg-rose-500" />
          </div>
          <p className="text-3xl font-black text-rose-700 font-mono tabular-numbers mt-2">
            {overview.machineCounts.down}
          </p>
          <p className="text-[11px] text-rose-800 mt-1">Downtime tercatat</p>
        </div>

        <div className="bg-amber-50/60 p-4 rounded-xl border-2 border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase">IDLE (Siap)</span>
            <span className="w-3 h-3 rounded-full bg-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-700 font-mono tabular-numbers mt-2">
            {overview.machineCounts.idle}
          </p>
          <p className="text-[11px] text-amber-800 mt-1">Belum ada run</p>
        </div>
      </div>

      {/* OEE Metric Section (Overall Equipment Effectiveness & 3 Pillars) */}
      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Gauge className="w-4 h-4 text-sky-600" />
              Overall Equipment Effectiveness (OEE) Shift Hari Ini
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Efektivitas menyeluruh lantai produksi: Availability × Performance × Quality
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Target World Class:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-black text-xs">
              ≥ 85.0%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main OEE Overall Score Card */}
          <div
            className={`p-4 rounded-xl border-2 flex flex-col justify-between ${
              (overview.oee?.oee || 0) >= 85
                ? "bg-emerald-50/70 border-emerald-400 text-emerald-950"
                : (overview.oee?.oee || 0) >= 70
                ? "bg-sky-50/70 border-sky-400 text-sky-950"
                : (overview.oee?.oee || 0) > 0
                ? "bg-amber-50/70 border-amber-400 text-amber-950"
                : "bg-slate-50/70 border-slate-300 text-slate-900"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider">Total OEE Pabrik</span>
                {(overview.oee?.oee || 0) >= 85 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                    <Trophy className="w-3 h-3" /> WORLD CLASS
                  </span>
                ) : (overview.oee?.oee || 0) >= 70 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-600 text-white">
                    <CheckCircle2 className="w-3 h-3" /> BAIK
                  </span>
                ) : (overview.oee?.oee || 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-600 text-white">
                    <AlertTriangle className="w-3 h-3" /> PERBAIKAN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-400 text-white">
                    IDLE
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-black font-mono tracking-tight tabular-numbers">
                  {overview.oee?.oee ?? 0}%
                </span>
              </div>
              <p className="text-[11px] font-semibold opacity-80 mt-1">
                Kondisi Operasional Shift Aktif
              </p>
            </div>

            {/* Formula Micro Ribbon */}
            <div className="mt-3 pt-3 border-t border-current/20 font-mono text-[11px] font-bold flex items-center justify-between">
              <span title="Availability">A: {overview.oee?.availability ?? 0}%</span>
              <span>×</span>
              <span title="Performance">P: {overview.oee?.performance ?? 0}%</span>
              <span>×</span>
              <span title="Quality">Q: {overview.oee?.quality ?? 0}%</span>
            </div>
          </div>

          {/* Pillar 1: Availability */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Availability (A)
                </span>
                <span
                  className={`font-mono font-black text-sm ${
                    (overview.oee?.availability || 0) >= 90 ? "text-emerald-700" : "text-slate-800"
                  }`}
                >
                  {overview.oee?.availability ?? 0}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Ketersediaan waktu mesin beroperasi
              </p>

              <div className="mt-2.5 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-500 font-semibold">
                  <span>Realisasi</span>
                  <span>Target ≥90%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (overview.oee?.availability || 0) >= 90 ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(100, overview.oee?.availability || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[11px] font-medium text-slate-600 flex justify-between font-mono">
              <span>Jalan: {formatHoursMinutes(overview.oee?.operatingMinutes || 0)}</span>
              <span>Stop: {formatHoursMinutes(overview.oee?.downtimeMinutes || 0)}</span>
            </div>
          </div>

          {/* Pillar 2: Performance */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  Performance (P)
                </span>
                <span
                  className={`font-mono font-black text-sm ${
                    (overview.oee?.performance || 0) >= 95 ? "text-emerald-700" : "text-slate-800"
                  }`}
                >
                  {overview.oee?.performance ?? 0}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Kecepatan aktual vs standar Cycle Time
              </p>

              <div className="mt-2.5 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-500 font-semibold">
                  <span>Realisasi</span>
                  <span>Target ≥95%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (overview.oee?.performance || 0) >= 95 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, overview.oee?.performance || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[11px] font-medium text-slate-600 flex justify-between font-mono">
              <span>Total: {overview.productionToday.totalPcsOk + overview.productionToday.totalPcsReject} pcs</span>
              <span>Efisiensi: {overview.productionToday.efficiency}%</span>
            </div>
          </div>

          {/* Pillar 3: Quality */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  Quality (Q)
                </span>
                <span
                  className={`font-mono font-black text-sm ${
                    (overview.oee?.quality || 0) >= 99.9 ? "text-emerald-700" : "text-slate-800"
                  }`}
                >
                  {overview.oee?.quality ?? 0}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Rasio produk bebas cacat / reject
              </p>

              <div className="mt-2.5 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-500 font-semibold">
                  <span>Realisasi</span>
                  <span>Target ≥99.9%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (overview.oee?.quality || 0) >= 99.9 ? "bg-emerald-500" : "bg-emerald-600"
                    }`}
                    style={{ width: `${Math.min(100, overview.oee?.quality || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[11px] font-medium text-slate-600 flex justify-between font-mono">
              <span className="text-emerald-700 font-bold">OK: {overview.productionToday.totalPcsOk} pcs</span>
              <span className="text-rose-700 font-bold">Reject: {overview.productionToday.totalPcsReject} pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Summary Metrics Today */}
      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-2xs space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
          Akumulasi Produksi Shift Hari Ini
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Total Run</p>
            <p className="text-xl font-black text-slate-900 font-mono tabular-numbers mt-1">
              {overview.productionToday.totalRuns}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Trolly Dihasilkan</p>
            <p className="text-xl font-black text-sky-700 font-mono tabular-numbers mt-1">
              {overview.productionToday.totalTrolly}{" "}
              <span className="text-xs font-normal text-slate-500">trolly</span>
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Total Qty OK</p>
            <p className="text-xl font-black text-emerald-700 font-mono tabular-numbers mt-1">
              {overview.productionToday.totalPcsOk}{" "}
              <span className="text-xs font-normal text-slate-500">pcs</span>
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Rata-rata Efisiensi</p>
            <p
              className={`text-xl font-black font-mono tabular-numbers mt-1 ${
                overview.productionToday.efficiency >= 85
                  ? "text-emerald-700"
                  : overview.productionToday.efficiency >= 70
                  ? "text-amber-600"
                  : "text-slate-800"
              }`}
            >
              {overview.productionToday.efficiency}%
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 uppercase">Reject Rate</p>
            <p className="text-xl font-black text-rose-700 font-mono tabular-numbers mt-1">
              {overview.productionToday.rejectRate}%{" "}
              <span className="text-xs font-normal text-slate-500">
                ({overview.productionToday.totalPcsReject} pcs)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* View Switcher: Rekap & Kronologi Harian (Mudah Dibaca) vs Tabel Status */}
      <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl border border-slate-300">
        <div className="flex gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode("narrative")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer tap-target ${
              viewMode === "narrative"
                ? "bg-white text-sky-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-sky-600" />
            <span>Rekap & Kronologi Harian (Mudah Dibaca)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer tap-target ${
              viewMode === "table"
                ? "bg-white text-sky-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Tabel Status Singkat Real-time</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: REKAP & KRONOLOGI HARIAN (YANG SANGAT MUDAH DIBACA) */}
      {viewMode === "narrative" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <History className="w-4 h-4 text-sky-600" />
              Laporan Progress Harian Setiap Mesin (Hari Ini)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {machines.length} Mesin
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {machines.map((m) => {
              const daily = m.dailySummary;
              const isRunning = m.status === "RUNNING";
              const isDown = m.status === "DOWN";

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-xl border-2 border-slate-300 p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Machine Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {m.code}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700">
                          {m.tonnage}T
                        </span>
                      </div>
                      <div>
                        {isRunning && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            RUNNING
                          </span>
                        )}
                        {isDown && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white">
                            DOWN
                          </span>
                        )}
                        {!isRunning && !isDown && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                            IDLE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Narasi Harian yang Jelas dan Mudah Dipahami */}
                    <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-3 text-xs leading-relaxed text-sky-950 font-medium">
                      {daily?.narrativeSummary || "Belum ada catatan aktivitas hari ini."}
                    </div>

                    {/* Progress Stats Box with OEE */}
                    {daily && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Total Jalan</p>
                            <p className="font-mono font-extrabold text-emerald-700 text-sm mt-0.5">
                              {formatHoursMinutes(daily.totalRunMinutes)}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Total Stop</p>
                            <p className="font-mono font-extrabold text-rose-700 text-sm mt-0.5">
                              {formatHoursMinutes(daily.totalDowntimeMinutes)}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Frekuensi</p>
                            <p className="font-mono font-extrabold text-amber-700 text-sm mt-0.5">
                              {daily.stopsCount}x Stop
                            </p>
                          </div>
                          <div
                            className={`p-2 rounded-lg border flex flex-col justify-center ${
                              (daily.oee?.oee || 0) >= 85
                                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                                : (daily.oee?.oee || 0) >= 70
                                ? "bg-sky-50 border-sky-300 text-sky-950"
                                : (daily.oee?.oee || 0) > 0
                                ? "bg-amber-50 border-amber-300 text-amber-950"
                                : "bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            <p className="text-[10px] font-black uppercase opacity-75">OEE</p>
                            <p className="font-mono font-black text-sm mt-0.5">
                              {daily.oee?.oee ?? 0}%
                            </p>
                          </div>
                        </div>

                        {/* OEE 3-Pillar Breakdown Chips */}
                        {daily.oee && daily.oee.oee > 0 && (
                          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px] font-mono font-bold text-slate-700">
                            <span>
                              A: <strong className="text-blue-700">{daily.oee.availability}%</strong>
                            </span>
                            <span>•</span>
                            <span>
                              P: <strong className="text-amber-700">{daily.oee.performance}%</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Q: <strong className="text-emerald-700">{daily.oee.quality}%</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mini Visual Bar Timeline */}
                    {daily && (daily.totalRunMinutes + daily.totalDowntimeMinutes > 0) && (
                      <div className="space-y-1">
                        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{
                              width: `${
                                (daily.totalRunMinutes /
                                  (daily.totalRunMinutes + daily.totalDowntimeMinutes)) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="bg-rose-500 h-full"
                            style={{
                              width: `${
                                (daily.totalDowntimeMinutes /
                                  (daily.totalRunMinutes + daily.totalDowntimeMinutes)) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tombol Aksi Detail Mesin */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReportMachineId(m.id);
                        setIsReportModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer tap-target"
                      title="Lihat Formulir Laporan Harian FO/MLD/009"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>FO/MLD/009</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectMachine(m)}
                      className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1.5 cursor-pointer tap-target"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Kronologi Lengkap</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: TABEL STATUS SINGKAT */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Tabel Status Mesin Real-time
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {machines.length} Mesin Terdaftar
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Mesin</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Part</th>
                  <th className="py-3 px-4">Trolly / Qty</th>
                  <th className="py-3 px-4" title="Availability (Ketersediaan)">A (Avail)</th>
                  <th className="py-3 px-4" title="Performance (Kinerja Kecepatan)">P (Perf)</th>
                  <th className="py-3 px-4" title="Quality (Kualitas)">Q (Qual)</th>
                  <th className="py-3 px-4" title="Overall Equipment Effectiveness">OEE</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Keterangan / Alasan Stop</th>
                  <th className="py-3 px-4 text-right">Aksi Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {machines.map((m) => {
                  const isRunning = m.status === "RUNNING";
                  const isDown = m.status === "DOWN";
                  const run = m.latestRun;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-black text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{m.code}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {m.tonnage}T
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">{m.model}</p>
                      </td>

                      <td className="py-3 px-4">
                        {isRunning && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-600 text-white">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            RUNNING
                          </span>
                        )}
                        {isDown && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-600 text-white">
                            DOWN
                          </span>
                        )}
                        {!isRunning && !isDown && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                            IDLE
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {run ? (
                          <div>
                            <p className="font-extrabold text-slate-900">{run.part.partNo}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {run.part.name}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">Siap produksi</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {run ? (
                          <div>
                            <p className="font-bold text-sky-700 tabular-numbers">
                              {run.trollyCount} trolly
                            </p>
                            <p className="text-[10px] text-emerald-700 font-bold tabular-numbers">
                              {run.currentQty} pcs OK
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {m.dailySummary?.oee?.availability ?? 0}%
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {m.dailySummary?.oee?.performance ?? 0}%
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {m.dailySummary?.oee?.quality ?? 0}%
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-black inline-block ${
                            (m.dailySummary?.oee?.oee || 0) >= 85
                              ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                              : (m.dailySummary?.oee?.oee || 0) >= 70
                              ? "bg-sky-100 text-sky-950 border border-sky-300"
                              : (m.dailySummary?.oee?.oee || 0) > 0
                              ? "bg-amber-100 text-amber-950 border border-amber-300"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {m.dailySummary?.oee?.oee ?? 0}%
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {run ? (
                          <div>
                            <p className="font-semibold text-slate-800">{run.operator.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{run.operator.employeeId}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {isDown && run?.stopReason ? (
                          <div>
                            <p className="font-bold text-rose-900">{run.stopReason.reason}</p>
                            <p className="text-[10px] text-slate-500">{run.stopReason.category}</p>
                          </div>
                        ) : isRunning ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Normal Running
                          </span>
                        ) : (
                          <span className="text-slate-400">Menunggu start</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectMachine(m)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1 cursor-pointer tap-target shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </button>

                          {/* Force Stop Action (FR-23: Tutup paksa run jika operator lupa stop) */}
                          {isRunning && run && (
                            <button
                              type="button"
                              onClick={() => setForceStopRunId(run.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition flex items-center gap-1 cursor-pointer tap-target shadow-2xs"
                              title="Tutup paksa run yang lupa di-STOP"
                            >
                              <Square className="w-3 h-3 fill-white" />
                              <span>Force Stop</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Force Stop Modal */}
      {forceStopRunId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmForceStop}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-300"
          >
            <div className="flex items-center gap-2 text-rose-800 font-extrabold text-base">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Konfirmasi Force Stop (Supervisor)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan menghentikan run produksi yang aktif secara paksa (misal operator
              lupa menekan tombol STOP saat pergantian shift).
            </p>

            <div>
              <label htmlFor="reason-select" className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Alasan Stop:
              </label>
              <select
                id="reason-select"
                value={selectedReasonId}
                onChange={(e) => setSelectedReasonId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
              >
                {stopReasons.map((sr) => (
                  <option key={sr.id} value={sr.id}>
                    {sr.code ? `[${sr.code}] ` : ""}{sr.category}: {sr.reason}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setForceStopRunId(null)}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isForceStopping}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isForceStopping ? "Memproses..." : "Tutup Paksa Run"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Formulir Standar Laporan Harian Molding (FO/MLD/009 Rev.08) */}
      {isReportModalOpen && selectedReportMachineId !== null && (
        <DailyMachineReportModal
          key={`report-sup-${selectedReportMachineId}`}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          machineId={selectedReportMachineId}
          machinesList={machines.map((m) => ({
            id: m.id,
            code: m.code,
            tonnage: m.tonnage,
          }))}
        />
      )}
    </div>
  );
}
