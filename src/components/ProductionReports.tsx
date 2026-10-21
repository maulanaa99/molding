"use client";

import React, { useState } from "react";
import {
  BarChart3,
  Download,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

export interface ReportRow {
  id: number;
  machineCode: string;
  machineModel: string;
  partNo: string;
  partName: string;
  operatorName: string;
  shift: string;
  status: string;
  startTime: string;
  stopTime: string | null;
  durationSec: number;
  trollyCount: number;
  qtyOk: number;
  qtyReject: number;
  targetQty: number;
  efficiency: number;
  rejectRate: number;
  stopReason: string;
}

export interface ParetoItem {
  category: string;
  reason: string;
  count: number;
  totalMinutes: number;
  cumulativePercent: number;
}

interface ProductionReportsProps {
  initialRows: ReportRow[];
  initialPareto: ParetoItem[];
  machinesList: Array<{ id: number; code: string }>;
  partsList: Array<{ id: number; partNo: string }>;
  onApplyFilters: (filters: {
    machineId?: number;
    partId?: number;
    startDate?: string;
    endDate?: string;
  }) => Promise<{ rows: ReportRow[]; pareto: ParetoItem[] }>;
}

function formatDurationHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

export default function ProductionReports({
  initialRows,
  initialPareto,
  machinesList,
  partsList,
  onApplyFilters,
}: ProductionReportsProps) {
  const [rows, setRows] = useState<ReportRow[]>(initialRows);
  const [pareto, setPareto] = useState<ParetoItem[]>(initialPareto);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showFormulaGuide, setShowFormulaGuide] = useState(false);

  const handleFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await onApplyFilters({
      machineId: selectedMachineId ? Number(selectedMachineId) : undefined,
      partId: selectedPartId ? Number(selectedPartId) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setRows(res.rows);
    setPareto(res.pareto);
    setIsLoading(false);
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;

    const headers = [
      "ID Run",
      "Mesin",
      "Model Mesin",
      "Part No",
      "Nama Part",
      "Operator",
      "Shift",
      "Status",
      "Waktu Mulai",
      "Waktu Selesai",
      "Durasi (Detik)",
      "Durasi Format",
      "Jumlah Trolly",
      "Qty OK (Pcs)",
      "Qty Reject (Pcs)",
      "Target Qty (Pcs)",
      "Efisiensi (%)",
      "Reject Rate (%)",
      "Alasan Stop",
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.id,
          `"${r.machineCode}"`,
          `"${r.machineModel}"`,
          `"${r.partNo}"`,
          `"${r.partName}"`,
          `"${r.operatorName}"`,
          `"${r.shift}"`,
          `"${r.status}"`,
          `"${new Date(r.startTime).toLocaleString("id-ID")}"`,
          r.stopTime ? `"${new Date(r.stopTime).toLocaleString("id-ID")}"` : `""`,
          r.durationSec,
          `"${formatDurationHms(r.durationSec)}"`,
          r.trollyCount,
          r.qtyOk,
          r.qtyReject,
          r.targetQty,
          r.efficiency,
          r.rejectRate,
          `"${r.stopReason}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Laporan_Produksi_MMS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Aggregated totals
  const totalQtyOk = rows.reduce((acc, r) => acc + r.qtyOk, 0);
  const totalQtyReject = rows.reduce((acc, r) => acc + r.qtyReject, 0);
  const totalTrolly = rows.reduce((acc, r) => acc + r.trollyCount, 0);
  const totalTarget = rows.reduce((acc, r) => acc + r.targetQty, 0);
  const avgEfficiency = totalTarget > 0 ? Math.round((totalQtyOk / totalTarget) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Filter and Export Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-sky-600" />
              Laporan Produksi & Analisis Downtime Pareto
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Data historis hasil produksi, efisiensi cycle time, dan frekuensi downtime.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFormulaGuide(!showFormulaGuide)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Rumus Perhitungan</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-extrabold transition cursor-pointer shadow-2xs tap-target"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV (Excel)</span>
            </button>
          </div>
        </div>

        {/* Formula Guide Toggle */}
        {showFormulaGuide && (
          <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl text-xs space-y-2 text-sky-950 font-medium">
            <p className="font-extrabold text-sm text-sky-900">
              Rumus Standar Perhitungan Produksi & Downtime (PRD Bagian 5.5):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px]">
              <p>• Durasi run = stopTime - startTime</p>
              <p>• Target qty = (durasi run ÷ cycle time standar) × cavity</p>
              <p>• Qty aktual (OK) = (jumlah scan trolly × standar per trolly) + sisa pcs</p>
              <p>• Efisiensi (%) = (qty aktual ÷ target qty) × 100%</p>
              <p>• Reject rate (%) = (qty reject ÷ (qty OK + qty reject)) × 100%</p>
              <p>• Downtime = startTime run berikutnya - stopTime run sebelumnya</p>
            </div>
          </div>
        )}

        {/* Filter Form */}
        <form onSubmit={handleFilter} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label htmlFor="filter-machine" className="block text-xs font-bold text-slate-700 mb-1">
              Filter Mesin:
            </label>
            <select
              id="filter-machine"
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Semua Mesin (IMM-01 s/d IMM-15)</option>
              {machinesList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-part" className="block text-xs font-bold text-slate-700 mb-1">
              Filter Part:
            </label>
            <select
              id="filter-part"
              value={selectedPartId}
              onChange={(e) => setSelectedPartId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            >
              <option value="">Semua Part</option>
              {partsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.partNo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-start" className="block text-xs font-bold text-slate-700 mb-1">
              Dari Tanggal:
            </label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            />
          </div>

          <div>
            <label htmlFor="filter-end" className="block text-xs font-bold text-slate-700 mb-1">
              Sampai Tanggal:
            </label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer tap-target"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{isLoading ? "Memfilter..." : "Terapkan Filter"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Total Run Tercatat</p>
          <p className="text-2xl font-black text-slate-900 font-mono tabular-numbers mt-1">
            {rows.length}
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Total Qty OK (Pcs)</p>
          <p className="text-2xl font-black text-emerald-700 font-mono tabular-numbers mt-1">
            {totalQtyOk}{" "}
            <span className="text-xs font-normal text-slate-500">
              ({totalTrolly} trolly)
            </span>
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Target Akumulasi</p>
          <p className="text-2xl font-black text-slate-800 font-mono tabular-numbers mt-1">
            {totalTarget} pcs
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-300 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase">Rata-rata Efisiensi</p>
          <p className="text-2xl font-black text-sky-700 font-mono tabular-numbers mt-1">
            {avgEfficiency}%
          </p>
        </div>
      </div>

      {/* Pareto Downtime Analysis Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Analisis Downtime Pareto (Alasan Stop Terbanyak)
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Memetakan 80% masalah penyebab mesin berhenti untuk prioritas perbaikan Kaizen.
          </p>
        </div>

        {pareto.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Alasan Stop</th>
                  <th className="py-2.5 px-3">Frekuensi</th>
                  <th className="py-2.5 px-3">Persentase Kumulatif</th>
                  <th className="py-2.5 px-3">Grafik Pareto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pareto.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-700">{item.category}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.reason}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-700 tabular-numbers">
                      {item.count} kali
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-800 tabular-numbers">
                      {item.cumulativePercent}%
                    </td>
                    <td className="py-2.5 px-3 w-48">
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-sky-600 h-2.5 rounded-full"
                          style={{ width: `${item.cumulativePercent}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-lg text-xs">
            Belum ada data downtime stop reason pada rentang filter ini.
          </div>
        )}
      </div>

      {/* Production Run Detail Table */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">
            Daftar Detail Run Produksi
          </h3>
          <span className="text-xs font-mono text-slate-500">{rows.length} Baris Data</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Run ID</th>
                <th className="py-3 px-3">Mesin</th>
                <th className="py-3 px-3">Part</th>
                <th className="py-3 px-3">Shift</th>
                <th className="py-3 px-3">Waktu Mulai - Selesai</th>
                <th className="py-3 px-3">Durasi</th>
                <th className="py-3 px-3">Trolly</th>
                <th className="py-3 px-3">Qty OK</th>
                <th className="py-3 px-3">Target</th>
                <th className="py-3 px-3">Efisiensi</th>
                <th className="py-3 px-3">Reject</th>
                <th className="py-3 px-3">Alasan Stop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length > 0 ? (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">#{r.id}</td>
                    <td className="py-3 px-3 font-black text-slate-900">{r.machineCode}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{r.partNo}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{r.partName}</p>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700">{r.shift}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      <p>{new Date(r.startTime).toLocaleTimeString("id-ID")}</p>
                      <p className="text-[10px] text-slate-400">
                        {r.stopTime ? new Date(r.stopTime).toLocaleTimeString("id-ID") : "Berjalan"}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 tabular-numbers">
                      {formatDurationHms(r.durationSec)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-sky-700 tabular-numbers">
                      {r.trollyCount}
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-emerald-700 tabular-numbers">
                      {r.qtyOk}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 tabular-numbers">
                      {r.targetQty}
                    </td>
                    <td className="py-3 px-3 font-mono font-black tabular-numbers">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          r.efficiency >= 85
                            ? "bg-emerald-100 text-emerald-800"
                            : r.efficiency >= 70
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {r.efficiency}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-rose-700 tabular-numbers">
                      {r.qtyReject} ({r.rejectRate}%)
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-700 font-medium">
                      {r.stopReason}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
                    Tidak ada data run produksi ditemukan untuk filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
