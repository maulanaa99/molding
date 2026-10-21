"use client";

import React, { useState, useEffect } from "react";
import { Play, Square, AlertTriangle, Layers, User, Clock, CheckCircle2, History, CalendarDays, ArrowRight } from "lucide-react";

export interface MachineDailyEvent {
  type: "RUN" | "STOP";
  runId?: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  partNo?: string;
  partName?: string;
  qtyOk?: number;
  qtyReject?: number;
  operatorName?: string;
  shift?: string;
  stopReason?: string;
  stopCategory?: string;
}

export interface ProductionPlanItem {
  id: number;
  machineId: number;
  partId: number;
  operatorId?: number | null;
  operatorName?: string | null;
  operatorEmployeeId?: string | null;
  targetQty: number;
  priority: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  scheduledDate?: string | null;
  moldMode?: string | null;
  part: {
    id: number;
    partNo: string;
    name: string;
    cycleTimeSec: number;
    cavity: number;
    qtyPerTrolly: number;
    nextProcess?: string | null;
    pairPartId?: number | null;
    pairPart?: { id: number; partNo: string; name: string; cavity?: number } | null;
  };
}

export interface MachineData {
  id: number;
  code: string;
  model: string | null;
  tonnage: number;
  status: "RUNNING" | "DOWN" | "IDLE";
  activePlan?: ProductionPlanItem | null;
  nextPlans?: ProductionPlanItem[];
  todayPlans?: ProductionPlanItem[];
  latestRun: {
    id: number;
    planId?: number | null;
    planTargetQty?: number | null;
    status: string;
    startTime: string;
    stopTime: string | null;
    moldMode?: string | null;
    pairStats?: {
      isPair: boolean;
      lhPart: { id: number; partNo: string; name: string; qtyPerTrolly: number };
      rhPart: { id: number; partNo: string; name: string; qtyPerTrolly: number };
      lhTrollyCount: number;
      lhQty: number;
      rhTrollyCount: number;
      rhQty: number;
      setsCount: number;
    } | null;
    part: {
      id: number;
      partNo: string;
      name: string;
      cycleTimeSec: number;
      cavity: number;
      qtyPerTrolly: number;
      nextProcess?: string | null;
      pairPartId?: number | null;
      pairPart?: { id: number; partNo: string; name: string; cavity?: number } | null;
    };
    operator: {
      id: number;
      name: string;
      employeeId: string;
    };
    stopReason: {
      category: string;
      reason: string;
    } | null;
    trollyCount: number;
    currentQty: number;
    qtyReject: number;
    remainderQty?: number;
    previousAccumulatedSec?: number;
    shift?: string | null;
    rejects?: Array<{
      id: number;
      defectTypeId: number;
      qty: number;
      defectType: {
        id: number;
        code: string;
        name: string;
        category: string | null;
      };
    }>;
  } | null;
  allowedParts: Array<{
    id: number;
    partNo: string;
    name: string;
    cycleTimeSec: number;
    cavity: number;
    qtyPerTrolly: number;
    nextProcess?: string | null;
    pairPart?: { id: number; partNo: string; name: string } | null;
  }>;
  dailySummary?: {
    totalRunMinutes: number;
    totalDowntimeMinutes: number;
    stopsCount: number;
    partsProduced: Array<{ partNo: string; name: string; qtyOk: number; qtyReject: number }>;
    operators: string[];
    stopReasons: Array<{ reason: string; category: string; count: number; minutes: number }>;
    timelineEvents: MachineDailyEvent[];
    narrativeSummary: string;
  };
}

interface MachineCardProps {
  machine: MachineData;
  onSelect: (machine: MachineData) => void;
  serverTimeOffset?: number; // Delta ms antara server dan browser klien untuk sinkronisasi waktu akurat
}

function formatDurationWithOffset(
  startTimeIso: string,
  offsetMs: number = 0,
  baseOffsetSec: number = 0
): string {
  const start = new Date(startTimeIso).getTime();
  // Menggunakan jam server yang disinkronkan ke seluruh device ditambah durasi akumulasi sesi sebelumnya
  const nowSynchronized = Date.now() + offsetMs;
  const currentDiffSec = Math.max(0, Math.floor((nowSynchronized - start) / 1000));
  const diffSec = currentDiffSec + (baseOffsetSec || 0);

  const hours = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}j`;
  return `${h}j ${m}m`;
}

export default function MachineCard({ machine, onSelect, serverTimeOffset = 0 }: MachineCardProps) {
  const [elapsed, setElapsed] = useState<string>("");

  useEffect(() => {
    if (machine.status === "RUNNING" && machine.latestRun) {
      const update = () => {
        setElapsed(
          formatDurationWithOffset(
            machine.latestRun!.startTime,
            serverTimeOffset,
            machine.latestRun!.previousAccumulatedSec || 0
          )
        );
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [machine.status, machine.latestRun, serverTimeOffset]);

  const isRunning = machine.status === "RUNNING";
  const isDown = machine.status === "DOWN";
  const isIdle = machine.status === "IDLE";
  const daily = machine.dailySummary;

  return (
    <div
      onClick={() => onSelect(machine)}
      className={`rounded-xl border-2 transition-all shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between overflow-hidden bg-white ${
        isRunning
          ? "border-emerald-500 hover:border-emerald-600 ring-1 ring-emerald-500/20"
          : isDown
          ? "border-rose-400 hover:border-rose-500 ring-1 ring-rose-500/20"
          : "border-slate-300 hover:border-slate-400"
      }`}
    >
      {/* Top Header Card */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          isRunning
            ? "bg-emerald-50 border-emerald-200"
            : isDown
            ? "bg-rose-50 border-rose-200"
            : "bg-slate-100 border-slate-200"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{machine.code}</h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-white text-slate-700 border border-slate-300 shadow-2xs">
              {machine.tonnage}T
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium truncate max-w-[170px]">
            {machine.model || "Injection Molding"}
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              RUNNING
            </span>
          )}
          {isDown && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
              <Square className="w-3 h-3 fill-white" />
              DOWN
            </span>
          )}
          {isIdle && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs">
              IDLE
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {isRunning && machine.latestRun ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Part Berjalan:</p>
              <p className="text-base font-extrabold text-slate-900 leading-tight">
                {machine.latestRun.part.partNo}
              </p>
              <p className="text-xs text-slate-600 truncate">{machine.latestRun.part.name}</p>
            </div>

            {/* Metrics Counter: Family Mold (SET) or Standard Trolly & Pcs */}
            {machine.latestRun.pairStats && (machine.latestRun.moldMode === "SET" || !machine.latestRun.moldMode) ? (
              <div className="bg-indigo-50/70 border border-indigo-200 p-2.5 rounded-lg space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-indigo-900">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-600" /> Mode 1 Set (LH + RH)
                  </span>
                  <span className="bg-indigo-200/90 text-indigo-950 px-1.5 py-0.5 rounded font-mono font-black">
                    {machine.latestRun.pairStats.setsCount} Set Selesai
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className="bg-white p-1.5 rounded border border-indigo-100 shadow-2xs">
                    <p className="text-[10px] font-extrabold text-slate-500 truncate">LH: {machine.latestRun.pairStats.lhPart.partNo}</p>
                    <p className="font-mono font-black text-sky-800 text-sm mt-0.5">
                      {machine.latestRun.pairStats.lhQty} <span className="text-[10px] font-normal text-slate-500">pcs ({machine.latestRun.pairStats.lhTrollyCount} Trl)</span>
                    </p>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-indigo-100 shadow-2xs">
                    <p className="text-[10px] font-extrabold text-slate-500 truncate">RH: {machine.latestRun.pairStats.rhPart.partNo}</p>
                    <p className="font-mono font-black text-indigo-800 text-sm mt-0.5">
                      {machine.latestRun.pairStats.rhQty} <span className="text-[10px] font-normal text-slate-500">pcs ({machine.latestRun.pairStats.rhTrollyCount} Trl)</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Trolly Full</p>
                  <p className="text-lg font-black text-sky-700 tabular-numbers">
                    {machine.latestRun.trollyCount} <span className="text-xs font-medium text-slate-600">trolly</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Total Qty OK</p>
                  <p className="text-lg font-black text-emerald-700 tabular-numbers">
                    {machine.latestRun.currentQty} <span className="text-xs font-medium text-slate-600">pcs</span>
                  </p>
                </div>
              </div>
            )}

            {/* Live Server Timer & Operator */}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1 font-mono font-bold text-emerald-800">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="tabular-numbers">{elapsed}</span>
              </span>
              <span className="flex items-center gap-1 text-slate-700 font-medium">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate max-w-[100px]">{machine.latestRun.operator.name}</span>
              </span>
            </div>
            {/* Next Queued Plan Preview while Running */}
            {machine.nextPlans && machine.nextPlans.length > 0 && (
              <div className="bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px] text-sky-950">
                <span className="flex items-center gap-1 font-bold">
                  <CalendarDays className="w-3 h-3 text-sky-600" /> Antrean Job Berikutnya:
                </span>
                <span className="font-mono font-black text-sky-900">
                  {machine.nextPlans[0].part.partNo} ({machine.nextPlans[0].targetQty} pcs)
                </span>
              </div>
            )}
          </div>
        ) : isDown && machine.latestRun ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Alasan Stop:
              </p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {machine.latestRun.stopReason
                  ? machine.latestRun.stopReason.reason
                  : "Mesin Berhenti"}
              </p>
              <p className="text-xs text-slate-500">
                Kategori: {machine.latestRun.stopReason?.category || "Umum"}
              </p>
            </div>

            <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 text-xs text-slate-700">
              <p className="font-semibold text-rose-900">Part Terakhir: {machine.latestRun.part.partNo}</p>
              <p className="text-slate-600">
                Hasil: {machine.latestRun.currentQty} pcs | Reject: {machine.latestRun.qtyReject} pcs
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            {(machine.activePlan || (machine.nextPlans && machine.nextPlans.length > 0)) ? (
              <div className="bg-sky-50/80 border border-sky-300 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-900 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5 text-sky-600" /> Antrean Job PPIC ({(machine.activePlan ? 1 : 0) + (machine.nextPlans?.length || 0)} Part):
                  </span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-200 text-sky-950 font-mono">
                    Siap Jalan
                  </span>
                </div>

                {/* Job Utama #1 */}
                {(() => {
                  const firstPlan = machine.activePlan || machine.nextPlans?.[0];
                  if (!firstPlan) return null;
                  return (
                    <div className="bg-white p-2.5 rounded-lg border border-sky-200 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-slate-900 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-black shrink-0">1</span>
                          <span>{firstPlan.part.partNo}</span>
                        </span>
                        <span className="font-mono font-black text-sky-900">
                          {firstPlan.targetQty.toLocaleString("id-ID")}{" "}
                          {(firstPlan.moldMode === "SET" || !firstPlan.moldMode) && Boolean(firstPlan.part.pairPart)
                            ? "Set"
                            : "pcs"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 pl-5">
                        {firstPlan.part.name}
                      </p>
                    </div>
                  );
                })()}

                {/* Antrean Lanjutan (Part B dst) */}
                {(() => {
                  const queues = machine.activePlan ? (machine.nextPlans || []) : (machine.nextPlans?.slice(1) || []);
                  if (queues.length === 0) return null;
                  return (
                    <div className="space-y-1 pt-1 border-t border-sky-200/60">
                      <p className="text-[10px] font-bold text-sky-800 uppercase">Part Berikutnya:</p>
                      {queues.slice(0, 2).map((q, idx) => (
                        <div key={q.id} className="flex items-center justify-between text-[11px] text-slate-700 bg-sky-100/50 px-2 py-1 rounded">
                          <span className="truncate">
                            <strong>{idx + 2}. {q.part.partNo}</strong> - {q.part.name}
                          </span>
                          <span className="font-mono font-bold text-sky-950 ml-1 shrink-0">
                            {q.targetQty} pcs
                          </span>
                        </div>
                      ))}
                      {queues.length > 2 && (
                        <p className="text-[10px] text-slate-500 italic">
                          +{queues.length - 2} antrean part lainnya
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-700 mb-1">Part yang Diizinkan:</p>
                <div className="flex flex-wrap gap-1">
                  {machine.allowedParts.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className="bg-white text-slate-700 text-[11px] px-2 py-0.5 rounded border border-slate-300 font-mono"
                    >
                      {p.partNo}
                    </span>
                  ))}
                  {machine.allowedParts.length > 3 && (
                    <span className="text-[11px] text-slate-600 font-semibold self-center">
                      +{machine.allowedParts.length - 3} lainnya
                    </span>
                  )}
                  {machine.allowedParts.length === 0 && (
                    <span className="text-slate-400">Belum ada part di-assign</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* REKAP HARIAN MESIN (DAILY PROGRESS RINGKAS) */}
        {daily && (
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-sky-600" /> Rekap Hari Ini:
              </span>
              <span className="font-mono text-slate-800">
                {formatHoursMinutes(daily.totalRunMinutes)} jalan | {formatHoursMinutes(daily.totalDowntimeMinutes)} stop
              </span>
            </div>

            {/* Visual Mini Timeline Bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
              {daily.totalRunMinutes + daily.totalDowntimeMinutes > 0 ? (
                <>
                  <div
                    className="bg-emerald-500 h-full"
                    style={{
                      width: `${
                        (daily.totalRunMinutes / (daily.totalRunMinutes + daily.totalDowntimeMinutes)) * 100
                      }%`,
                    }}
                    title={`Jalan: ${daily.totalRunMinutes} menit`}
                  />
                  <div
                    className="bg-rose-500 h-full"
                    style={{
                      width: `${
                        (daily.totalDowntimeMinutes / (daily.totalRunMinutes + daily.totalDowntimeMinutes)) * 100
                      }%`,
                    }}
                    title={`Stop: ${daily.totalDowntimeMinutes} menit`}
                  />
                </>
              ) : (
                <div className="bg-slate-300 w-full h-full" title="Belum ada aktivitas hari ini" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer Button */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <button
          type="button"
          className={`w-full py-2.5 px-3 rounded-lg text-sm font-extrabold flex items-center justify-center gap-2 transition cursor-pointer tap-target ${
            isRunning
              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              : isDown
              ? "bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
              : "bg-slate-800 hover:bg-slate-900 text-white shadow-xs"
          }`}
        >
          {isRunning ? (
            <>
              <Layers className="w-4 h-4" />
              <span>Kelola & Scan Kanban</span>
            </>
          ) : isDown ? (
            <>
              <Play className="w-4 h-4" />
              <span>Mulai Run Baru</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Pilih Part & START</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
