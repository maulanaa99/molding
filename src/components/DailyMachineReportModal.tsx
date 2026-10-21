"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Download,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Check,
} from "lucide-react";
import {
  getDailyMachineReportData,
  exportDailyMachineReportExcel,
  DailyMachineReportData,
} from "@/lib/actions";

interface DailyMachineReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: number;
  initialDate?: string; // YYYY-MM-DD
  machinesList?: Array<{ id: number; code: string; tonnage: number }>;
}

export default function DailyMachineReportModal({
  isOpen,
  onClose,
  machineId: initialMachineId,
  initialDate,
  machinesList = [],
}: DailyMachineReportModalProps) {
  const [selectedMachineId, setSelectedMachineId] = useState<number>(initialMachineId);
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [report, setReport] = useState<DailyMachineReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approval Signatures State (Editable on Screen)
  const [operatorName, setOperatorName] = useState("");
  const [inspector1, setInspector1] = useState("");
  const [inspector2, setInspector2] = useState("");
  const [leader, setLeader] = useState("");
  const [deptHead, setDeptHead] = useState("");
  
  // Hourly QC Inspector overrides: { [hour]: { shortName, fullName, employeeId } }
  const [inspectorOverrides, setInspectorOverrides] = useState<
    Record<number, { shortName: string; fullName: string; employeeId: string }>
  >({});
  const [editingHour, setEditingHour] = useState<number | null>(null);
  const [customInspectorName, setCustomInspectorName] = useState("");

  // Sync state if initialMachineId changes
  useEffect(() => {
    setSelectedMachineId(initialMachineId);
  }, [initialMachineId]);

  // Load report data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDailyMachineReportData(selectedMachineId, selectedDate);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || "Gagal memuat data laporan.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, selectedMachineId, selectedDate]);

  // Sync approval names whenever report data changes
  useEffect(() => {
    if (report) {
      setOperatorName(report.operators[0] || "");
      setInspector1(report.inspectors?.inspector1 || "");
      setInspector2(report.inspectors?.inspector2 || "");
      setLeader(report.leader || "");
      setDeptHead(report.deptHead || "");

      // Initialize inspector overrides from report.hourly
      const initialMap: Record<number, { shortName: string; fullName: string; employeeId: string }> = {};
      for (const [hStr, hData] of Object.entries(report.hourly)) {
        if (hData.inspector) {
          initialMap[Number(hStr)] = {
            shortName: hData.inspector.shortName,
            fullName: hData.inspector.fullName,
            employeeId: hData.inspector.employeeId || "",
          };
        }
      }
      setInspectorOverrides(initialMap);
    }
  }, [report]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadExcel = async () => {
    if (!report) return;
    setIsDownloading(true);
    try {
      const res = await exportDailyMachineReportExcel(
        selectedMachineId,
        selectedDate,
        {
          operatorName: operatorName.trim() || undefined,
          inspector1: inspector1.trim() || undefined,
          inspector2: inspector2.trim() || undefined,
          leader: leader.trim() || undefined,
          deptHead: deptHead.trim() || undefined,
        },
        inspectorOverrides
      );
      if (!res.success || !res.base64) {
        alert(res.error || "Gagal mengunduh file Excel");
        setIsDownloading(false);
        return;
      }

      // Convert base64 to binary blob
      const byteCharacters = atob(res.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename || `Laporan_Harian_Molding_${report.machine.code}_${selectedDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengunduh file Excel";
      alert(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  // Hour slots order from Excel form: 7 to 6 (24 hours)
  const hourSlots = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];

  // Stop reason legend mapping
  const stopLegends = [
    { sym: "A", name: "Cek sheet harian/mingguan" },
    { sym: "B", name: "Kerusakan Auto Loader" },
    { sym: "C", name: "Meeting" },
    { sym: "D", name: "Pengangkutan" },
    { sym: "E", name: "Material Habis" },
    { sym: "F", name: "Masalah Qualitas" },
    { sym: "G", name: "Kerusakan Mold" },
    { sym: "H", name: "Kerusakan Mesin" },
    { sym: "I", name: "Kerusakan Robot" },
    { sym: "J", name: "Ganti Material" },
    { sym: "K", name: "Ganti Dies/Setting Robot" },
    { sym: "L", name: "Kerusakan Dryer" },
    { sym: "M", name: "Kondisi Lain" },
    { sym: "N", name: "Dies Belum diganti" },
    { sym: "Q", name: "5S" },
    { sym: "R", name: "Meeting , Training" },
    { sym: "S", name: "Pengecekan alat" },
    { sym: "T", name: "Tidak ada trolly" },
    { sym: "U", name: "Makan" },
    { sym: "V", name: "Trial" },
    { sym: "W", name: "Sesuai Intruksi" },
    { sym: "X", name: "Listrik mati" },
    { sym: "Y", name: "Pengecekan Qualitas" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Print isolation stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm 4mm;
          }
          html, body {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .report-print-sheet, .report-print-sheet * {
            visibility: visible !important;
          }
          .report-print-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 290mm !important;
            max-width: 290mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-print-sheet input {
            border: none !important;
            background: transparent !important;
          }
        }
      `}} />

      {/* Container Dialog */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col max-h-[96vh] overflow-hidden border border-slate-300 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none">
        {/* Sticky Control Bar (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-600 rounded-lg text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-wide uppercase flex items-center gap-2">
                <span>Formulir Laporan Harian Mesin Molding</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-800 text-sky-200">
                  FO/MLD/009 Rev.08
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Format standar industri: Catatan proses & penanganan abnormal
              </p>
            </div>
          </div>

          {/* Machine & Date Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {machinesList.length > 0 && (
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-bold focus:border-sky-500"
              >
                {machinesList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} ({m.tonnage}T)
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            {/* Action Buttons */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !report}
              className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Print PDF (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isLoading || isDownloading || !report}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? "Memproses..." : "Unduh Excel (.xlsx)"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Content Area */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-100 flex-1 print:p-0 print:bg-white print:overflow-visible">
          {isLoading && (
            <div className="py-24 text-center text-slate-500 font-bold text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
              <span>Menyusun formulir laporan harian...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && report && (
            /* Printable Sheet Form FO/MLD/009 Rev.08 */
            <div className="report-print-sheet print-area bg-white p-3 sm:p-5 rounded-xl border border-slate-300 shadow-md text-slate-900 font-sans text-xs max-w-5xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:rounded-none">
              {/* Header Title & Approvals */}
              <div className="grid grid-cols-12 border-2 border-slate-800 mb-1.5">
                {/* Left Header */}
                <div className="col-span-8 p-2 border-r-2 border-slate-800 flex flex-col justify-between space-y-1">
                  <div>
                    <h1 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-950">
                      Catatan Proses / Laporan Penanganan Abnormal
                    </h1>
                    <div className="mt-1 text-xs font-black font-mono text-slate-900">
                      Mesin Molding ( &nbsp; {report.machine.code} &nbsp;&nbsp; {report.machine.tonnage}T &nbsp; )
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-800 border-t border-slate-300 pt-1">
                    <div>
                      Tanggal &nbsp;: &nbsp;
                      <span className="font-mono font-black">{report.dateStr}</span>
                    </div>
                    <div className="font-mono">
                      Shift: <span className="font-black">{report.shift}</span>
                    </div>
                  </div>
                </div>

                {/* Right Approval Box (5 Kolom Tanda Tangan) */}
                <div className="col-span-4 grid grid-cols-5 text-center text-[9px] font-bold border-collapse">
                  <div className="border-r border-slate-400 flex flex-col justify-between py-1 bg-white">
                    <span className="border-b border-slate-400 pb-0.5 text-[8.5px]">Disetujui</span>
                    <div className="h-7 sm:h-8 flex items-center justify-center px-0.5">
                      <input
                        type="text"
                        value={deptHead}
                        onChange={(e) => setDeptHead(e.target.value)}
                        placeholder="Dept Head..."
                        title="Klik untuk mengisi nama Dept Head"
                        className="w-full text-center text-[8.5px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none print:border-none print:placeholder-transparent"
                      />
                    </div>
                    <span className="text-[8px] text-slate-400">Dept Head</span>
                  </div>
                  <div className="border-r border-slate-400 flex flex-col justify-between py-1 bg-white">
                    <span className="border-b border-slate-400 pb-0.5 text-[8.5px]">Diperiksa</span>
                    <div className="h-7 sm:h-8 flex items-center justify-center px-0.5">
                      <input
                        type="text"
                        value={leader}
                        onChange={(e) => setLeader(e.target.value)}
                        placeholder="Leader..."
                        title="Klik untuk mengisi nama Leader"
                        className="w-full text-center text-[8.5px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none print:border-none print:placeholder-transparent"
                      />
                    </div>
                    <span className="text-[8px] text-slate-400">Leader</span>
                  </div>
                  <div className="border-r border-slate-400 flex flex-col justify-between py-1 bg-white">
                    <span className="border-b border-slate-400 pb-0.5 text-[8.5px]">Inspektor 1</span>
                    <div className="h-7 sm:h-8 flex items-center justify-center px-0.5">
                      <input
                        type="text"
                        value={inspector1}
                        onChange={(e) => setInspector1(e.target.value)}
                        placeholder="QC 1..."
                        title="Klik untuk mengisi nama Inspektor QC 1"
                        className="w-full text-center text-[8.5px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none print:border-none print:placeholder-transparent"
                      />
                    </div>
                    <span className="text-[8px] text-slate-500">QC</span>
                  </div>
                  <div className="border-r border-slate-400 flex flex-col justify-between py-1 bg-white">
                    <span className="border-b border-slate-400 pb-0.5 text-[8.5px]">Inspektor 2</span>
                    <div className="h-7 sm:h-8 flex items-center justify-center px-0.5">
                      <input
                        type="text"
                        value={inspector2}
                        onChange={(e) => setInspector2(e.target.value)}
                        placeholder="QC 2..."
                        title="Klik untuk mengisi nama Inspektor QC 2"
                        className="w-full text-center text-[8.5px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none print:border-none print:placeholder-transparent"
                      />
                    </div>
                    <span className="text-[8px] text-slate-500">QC</span>
                  </div>
                  <div className="flex flex-col justify-between py-1 bg-sky-50/50">
                    <span className="border-b border-slate-400 pb-0.5 text-[8.5px] text-slate-900">Dibuat</span>
                    <div className="h-7 sm:h-8 flex items-center justify-center px-0.5">
                      <input
                        type="text"
                        value={operatorName}
                        onChange={(e) => setOperatorName(e.target.value)}
                        placeholder="Operator..."
                        title="Klik untuk mengisi nama Operator"
                        className="w-full text-center text-[8.5px] font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none print:border-none print:placeholder-transparent text-slate-900"
                      />
                    </div>
                    <span className="text-[8px] text-sky-800">Operator</span>
                  </div>
                </div>
              </div>

              {/* Table 1: Part Production Table (Rows 1-7) */}
              <div className="overflow-x-auto border-2 border-slate-800 mb-1.5">
                <table className="w-full text-[9px] border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-800 font-black uppercase text-slate-900">
                      <th rowSpan={2} className="border-r border-slate-400 px-1 py-0.5 w-6">No</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1.5 py-0.5 w-24">Part No</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1.5 py-0.5">Part Name</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1 py-0.5 w-12">Jumlah (Pcs)</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1 py-0.5 w-10">Waktu (Jam)</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1 py-0.5 w-16">Material</th>
                      <th colSpan={3} className="border-r border-slate-400 px-1 py-0.5">Setting</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1 py-0.5 w-14">Total Waktu (Jam)</th>
                      <th rowSpan={2} className="border-r border-slate-400 px-1 py-0.5 w-12">Stop (Jam)</th>
                      <th rowSpan={2} className="border-r-2 border-slate-800 px-1 py-0.5 w-12 bg-emerald-50">Part OK</th>
                      <th colSpan={7} className="border-r-2 border-slate-800 px-1 py-0.5 bg-rose-50 text-rose-950">
                        Jumlah Part NG
                      </th>
                      <th colSpan={2} className="px-1 py-0.5 bg-amber-50 text-amber-950">
                        Produk NG
                      </th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-800 font-bold text-[8px] text-slate-700">
                      <th className="border-r border-slate-300 px-1 py-0.25">Awal</th>
                      <th className="border-r border-slate-300 px-1 py-0.25">Akhir</th>
                      <th className="border-r border-slate-400 px-1 py-0.25">TRY</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-rose-50/50">Sute Short</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-rose-50/50">Silver</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-rose-50/50">Short</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-rose-50/50">Weld</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-rose-50/50">Cekung</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-rose-50/50">Benda Asing</th>
                      <th className="border-r-2 border-slate-800 px-0.5 py-0.25 bg-rose-50/50">Scratch</th>
                      <th className="border-r border-slate-300 px-0.5 py-0.25 bg-amber-50/50">Buang</th>
                      <th className="px-0.5 py-0.25 bg-amber-50/50">Repair</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-mono text-[9px]">
                    {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                      const p = report.parts[idx] || null;
                      return (
                        <tr key={idx} className="h-5 hover:bg-slate-50">
                          <td className="border-r border-slate-300 font-bold">{idx + 1}</td>
                          <td className="border-r border-slate-300 font-bold text-left px-1 text-slate-900 truncate">
                            {p ? p.partNo : ""}
                          </td>
                          <td className="border-r border-slate-300 text-left px-1 text-slate-800 font-sans truncate">
                            {p ? p.partName : ""}
                          </td>
                          <td className="border-r border-slate-300 font-bold text-right px-1">
                            {p && p.qty > 0 ? p.qty.toLocaleString("id-ID") : ""}
                          </td>
                          <td className="border-r border-slate-300 text-right px-1">
                            {p && p.waktuJam > 0 ? p.waktuJam.toFixed(2) : ""}
                          </td>
                          <td className="border-r border-slate-300 text-center font-sans">
                            {p ? p.material : ""}
                          </td>
                          <td className="border-r border-slate-200 text-center font-mono text-[9px] text-slate-800">
                            {p ? p.settingAwal : ""}
                          </td>
                          <td className="border-r border-slate-200 text-center font-mono text-[9px] text-slate-800">
                            {p ? p.settingAkhir : ""}
                          </td>
                          <td className="border-r border-slate-300 text-center font-mono text-[9px] font-bold text-slate-800">
                            {p ? (p.settingTry || "-") : ""}
                          </td>
                          <td className="border-r border-slate-300 text-right px-1 font-bold">
                            {p ? p.totalWaktu.toFixed(2) : ""}
                          </td>
                          <td className="border-r border-slate-300 text-right px-1 font-bold text-rose-700">
                            {p ? p.stopJam.toFixed(2) : ""}
                          </td>
                          <td className="border-r-2 border-slate-800 font-black text-right px-1 bg-emerald-50/50 text-emerald-950">
                            {p && p.partOk > 0 ? p.partOk.toLocaleString("id-ID") : ""}
                          </td>
                          <td className="border-r border-slate-200 text-rose-700">
                            {p && p.suteShort > 0 ? p.suteShort : ""}
                          </td>
                          <td className="border-r border-slate-200 text-rose-700">
                            {p && p.silver > 0 ? p.silver : ""}
                          </td>
                          <td className="border-r border-slate-200 text-rose-700">
                            {p && p.short > 0 ? p.short : ""}
                          </td>
                          <td className="border-r border-slate-200 text-rose-700">
                            {p && p.weld > 0 ? p.weld : ""}
                          </td>
                          <td className="border-r border-slate-200 text-rose-700">
                            {p && p.cekung > 0 ? p.cekung : ""}
                          </td>
                          <td className="border-r border-slate-200 text-rose-700">
                            {p && p.bendaAsing > 0 ? p.bendaAsing : ""}
                          </td>
                          <td className="border-r-2 border-slate-800 text-rose-700">
                            {p && p.scratch > 0 ? p.scratch : ""}
                          </td>
                          <td className="border-r border-slate-300 text-amber-800 font-bold">
                            {p && p.buang > 0 ? p.buang : ""}
                          </td>
                          <td className="text-amber-800 font-bold">
                            {p && p.repair > 0 ? p.repair : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table 2: 24-Hour Timeline Bar & QC Breakdown */}
              <div className="overflow-x-auto border-2 border-slate-800 mb-1.5">
                <table className="w-full text-[8.5px] border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-800 font-black text-slate-900">
                      <th className="border-r border-slate-400 px-1.5 py-0.5 text-left w-28">
                        Jam Operasi:
                      </th>
                      {hourSlots.map((h) => (
                        <th key={h} className="border-r border-slate-300 px-0.5 py-0.5 font-mono w-7">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-mono text-[8px]">
                    {/* Waktu Produksi (Menit jalan) - Progress Bar Visual */}
                    <tr className="bg-emerald-50/20 h-5">
                      <td className="border-r border-slate-400 px-1.5 py-0.5 font-bold text-left text-slate-900 font-sans text-[8px]">
                        Waktu Produksi (m)
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const runM = hData?.runMinutes || 0;
                        const stopM = hData?.stopMinutes || 0;
                        const delayM = hData?.delayMinutes || 0;
                        const hasActivity = runM > 0 || stopM > 0 || delayM > 0;

                        return (
                          <td key={h} className="border-r border-slate-200 p-0.5">
                            {hasActivity ? (
                              <div
                                className="w-full h-3.5 rounded-xs overflow-hidden relative border border-slate-300 bg-slate-100 shadow-2xs"
                                title={`Jam ${h}:00 - Jalan: ${runM}m, Stop: ${stopM}m, Delay: ${delayM}m`}
                              >
                                {hData?.segments && hData.segments.length > 0 ? (
                                  hData.segments.map((seg, sIdx) => {
                                    const leftPct = (seg.startMin / 60) * 100;
                                    const widthPct = ((seg.endMin - seg.startMin) / 60) * 100;
                                    const duration = seg.endMin - seg.startMin;
                                    const bgClass =
                                      seg.type === "RUN"
                                        ? "bg-emerald-500 text-white"
                                        : seg.type === "STOP"
                                        ? "bg-rose-500 text-white"
                                        : "bg-amber-400 text-slate-950";

                                    return (
                                      <div
                                        key={sIdx}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        className={`absolute top-0 bottom-0 ${bgClass} flex items-center justify-center text-[6px] font-bold transition-all overflow-hidden`}
                                        title={`${seg.type}: ${duration}m (${String(seg.startMin).padStart(2, "0")} - ${String(seg.endMin).padStart(2, "0")})`}
                                      >
                                        {duration >= 18 ? `${duration}m` : ""}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="flex w-full h-full">
                                    {runM > 0 && (
                                      <div
                                        style={{ width: `${(runM / 60) * 100}%` }}
                                        className="bg-emerald-500 h-full flex items-center justify-center text-[6.5px] font-bold text-white transition-all overflow-hidden"
                                      >
                                        {runM >= 20 ? `${runM}m` : ""}
                                      </div>
                                    )}
                                    {stopM > 0 && (
                                      <div
                                        style={{ width: `${(stopM / 60) * 100}%` }}
                                        className="bg-rose-500 h-full flex items-center justify-center text-[6.5px] font-bold text-white transition-all overflow-hidden"
                                      >
                                        {stopM >= 20 ? `${stopM}m` : ""}
                                      </div>
                                    )}
                                    {delayM > 0 && (
                                      <div
                                        style={{ width: `${(delayM / 60) * 100}%` }}
                                        className="bg-amber-400 h-full flex items-center justify-center text-[6.5px] font-bold text-slate-950 transition-all overflow-hidden"
                                      >
                                        {delayM >= 20 ? `${delayM}m` : ""}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-[8px] font-normal">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Keterlambatan (Menit delay) */}
                    <tr className="bg-amber-50/30 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-amber-900 font-sans">
                        Keterlambatan (m)
                      </td>
                      {hourSlots.map((h) => {
                        const d = report.hourly[String(h)]?.delayMinutes || 0;
                        return (
                          <td key={h} className="border-r border-slate-200 font-bold text-amber-800">
                            {d > 0 ? d : ""}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Simbol Sebab Lambat (Q - Y) */}
                    <tr className="bg-amber-50/50 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-amber-950 font-sans">
                        Penyebab Lambat (Simbol)
                      </td>
                      {hourSlots.map((h) => {
                        const sym = report.hourly[String(h)]?.delaySymbol || "";
                        return (
                          <td key={h} className="border-r border-slate-200 font-black text-amber-950">
                            {sym}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Berhenti (Menit stop) */}
                    <tr className="bg-rose-50/30 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-rose-900 font-sans">
                        Berhenti (m)
                      </td>
                      {hourSlots.map((h) => {
                        const s = report.hourly[String(h)]?.stopMinutes || 0;
                        return (
                          <td key={h} className="border-r border-slate-200 font-bold text-rose-800">
                            {s > 0 ? s : ""}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Simbol Sebab Stop (A - N) */}
                    <tr className="bg-rose-50/50 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-rose-950 font-sans">
                        Penyebab Stop (Simbol)
                      </td>
                      {hourSlots.map((h) => {
                        const sym = report.hourly[String(h)]?.stopSymbol || "";
                        return (
                          <td key={h} className="border-r border-slate-200 font-black text-rose-950">
                            {sym}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Pengecekan Jumlah (Qty per jam) */}
                    <tr className="bg-sky-50/30 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-sky-950 font-sans">
                        Pengecekan Jumlah (Pcs)
                      </td>
                      {hourSlots.map((h) => {
                        const qty = report.hourly[String(h)]?.checkedQty || 0;
                        return (
                          <td key={h} className="border-r border-slate-200 font-bold text-sky-900">
                            {qty > 0 ? qty.toLocaleString("id-ID") : ""}
                          </td>
                        );
                      })}
                    </tr>

                    {/* QC Inspektor - Auto-fill pemegang mesin, max 5 huruf, tooltip lengkap, inline quick-change */}
                    <tr className="bg-slate-50/80 h-5">
                      <td className="border-r border-slate-400 px-1.5 py-0.5 font-bold text-left text-slate-700 font-sans text-[8px]">
                        QC Inspektor
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const insp = inspectorOverrides[h];
                        const shortName = insp?.shortName || "";
                        const fullName = insp?.fullName || "";
                        const empId = insp?.employeeId || "";
                        const isEdited =
                          insp &&
                          hData?.inspector &&
                          (insp.shortName !== hData.inspector.shortName || insp.fullName !== hData.inspector.fullName);

                        const hasRun = (hData?.runMinutes || 0) > 0 || (hData?.stopMinutes || 0) > 0 || (hData?.delayMinutes || 0) > 0;
                        const tooltip = fullName
                          ? `Jam ${h}:00 - QC Inspektor: [${empId}] ${fullName}${isEdited ? " (Manual Override)" : " (Pemegang Mesin)"} - Klik untuk ganti`
                          : `Jam ${h}:00 - Belum ada inspektor (Klik untuk tentukan)`;

                        return (
                          <td
                            key={h}
                            onClick={() => {
                              setEditingHour(editingHour === h ? null : h);
                              setCustomInspectorName(insp?.fullName || "");
                            }}
                            className={`border-r border-slate-200 p-0 text-center relative cursor-pointer select-none transition-colors group ${
                              editingHour === h
                                ? "bg-amber-100 ring-1 ring-amber-400 z-20"
                                : "hover:bg-sky-50"
                            }`}
                            title={tooltip}
                          >
                            <div className="w-full h-full min-h-[18px] flex items-center justify-center">
                              {shortName ? (
                                <span
                                  className={`text-[7.5px] font-black uppercase tracking-tight font-mono px-0.5 rounded ${
                                    isEdited
                                      ? "text-amber-800 bg-amber-200/80 underline decoration-amber-500 font-extrabold"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {shortName}
                                </span>
                              ) : hasRun ? (
                                <span className="text-[7px] text-slate-300 group-hover:text-slate-500 italic">+</span>
                              ) : (
                                <span className="text-slate-300 text-[8px] font-normal">—</span>
                              )}
                            </div>

                            {/* Floating Tooltip Indicator on hover */}
                            {shortName && (
                              <div className="hidden group-hover:block print:hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 pointer-events-none whitespace-nowrap bg-slate-900 text-white text-[9px] px-2 py-0.5 rounded shadow-lg border border-slate-700">
                                <span className="text-amber-400 font-mono font-bold mr-1">{h}:00</span>
                                <span className="font-semibold">{fullName}</span>
                                {empId && <span className="text-slate-400 ml-1">({empId})</span>}
                              </div>
                            )}

                            {/* Quick Picker Popover for Editing Hour */}
                            {editingHour === h && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-white border border-slate-400 rounded shadow-2xl p-2 z-50 text-left print:hidden"
                              >
                                <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-200">
                                  <div className="font-bold text-[9px] text-slate-800">
                                    Inspektor Jam <span className="text-amber-600 font-mono">{h}:00</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEditingHour(null)}
                                    className="text-slate-400 hover:text-slate-700 text-[10px] font-bold px-1"
                                  >
                                    ✕
                                  </button>
                                </div>

                                <div className="text-[8px] text-slate-500 mb-1 font-semibold uppercase tracking-wider">
                                  Pilih Operator:
                                </div>
                                <div className="max-h-28 overflow-y-auto space-y-0.5 divide-y divide-slate-100 mb-2">
                                  {report.availableOperators && report.availableOperators.length > 0 ? (
                                    report.availableOperators.map((op) => (
                                      <button
                                        key={op.id}
                                        type="button"
                                        onClick={() => {
                                          const first = op.name.trim().split(/\s+/)[0] || "";
                                          setInspectorOverrides((prev) => ({
                                            ...prev,
                                            [h]: {
                                              shortName: first.slice(0, 5),
                                              fullName: op.name,
                                              employeeId: op.employeeId,
                                            },
                                          }));
                                          setEditingHour(null);
                                        }}
                                        className="w-full text-left px-1.5 py-1 text-[8.5px] rounded hover:bg-amber-50 hover:text-amber-900 flex items-center justify-between transition-colors"
                                      >
                                        <span className="font-semibold text-slate-800 truncate">{op.name}</span>
                                        <span className="font-mono text-[7.5px] text-slate-500 font-bold ml-1 bg-slate-100 px-1 py-0.25 rounded">
                                          {op.shortName}
                                        </span>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="text-[8px] text-slate-400 italic">Tidak ada daftar operator</div>
                                  )}
                                </div>

                                {/* Custom manual input if replacement is not in operator list */}
                                <div className="pt-1.5 border-t border-slate-200">
                                  <div className="text-[8px] text-slate-500 mb-0.5 font-semibold">Atau ketik nama:</div>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={customInspectorName}
                                      onChange={(e) => setCustomInspectorName(e.target.value)}
                                      placeholder="Nama pengganti..."
                                      className="flex-1 text-[8.5px] px-1 py-0.5 border border-slate-300 rounded font-sans focus:outline-none focus:border-amber-500"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && customInspectorName.trim()) {
                                          const first = customInspectorName.trim().split(/\s+/)[0] || "";
                                          setInspectorOverrides((prev) => ({
                                            ...prev,
                                            [h]: {
                                              shortName: first.slice(0, 5),
                                              fullName: customInspectorName.trim(),
                                              employeeId: "CUSTOM",
                                            },
                                          }));
                                          setEditingHour(null);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (customInspectorName.trim()) {
                                          const first = customInspectorName.trim().split(/\s+/)[0] || "";
                                          setInspectorOverrides((prev) => ({
                                            ...prev,
                                            [h]: {
                                              shortName: first.slice(0, 5),
                                              fullName: customInspectorName.trim(),
                                              employeeId: "CUSTOM",
                                            },
                                          }));
                                          setEditingHour(null);
                                        }
                                      }}
                                      className="bg-amber-600 text-white font-bold text-[8px] px-1.5 py-0.5 rounded hover:bg-amber-700"
                                    >
                                      OK
                                    </button>
                                  </div>
                                </div>

                                {/* Reset to original machine operator button */}
                                {hData?.inspector && (
                                  <div className="mt-1.5 pt-1 border-t border-slate-100 flex justify-between">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInspectorOverrides((prev) => ({
                                          ...prev,
                                          [h]: {
                                            shortName: hData.inspector!.shortName,
                                            fullName: hData.inspector!.fullName,
                                            employeeId: hData.inspector!.employeeId || "",
                                          },
                                        }));
                                        setEditingHour(null);
                                      }}
                                      className="text-[7.5px] text-sky-600 hover:underline font-medium"
                                    >
                                      ↺ Reset ke pemegang mesin
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInspectorOverrides((prev) => {
                                          const copy = { ...prev };
                                          delete copy[h];
                                          return copy;
                                        });
                                        setEditingHour(null);
                                      }}
                                      className="text-[7.5px] text-rose-600 hover:underline font-medium"
                                    >
                                      Kosongkan
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Defect Rows per Hour */}
                    {["suteShort", "silver", "short", "weld", "cekung", "bendaAsing", "scratch"].map((defKey) => {
                      const labels: Record<string, string> = {
                        suteShort: "Sute Short",
                        silver: "Silver",
                        short: "Short",
                        weld: "Weld",
                        cekung: "Cekung",
                        bendaAsing: "Benda Asing",
                        scratch: "Scratch",
                      };
                      return (
                        <tr key={defKey} className="h-3.5">
                          <td className="border-r border-slate-400 px-1.5 py-0.25 text-left text-slate-700 font-sans">
                            {labels[defKey]}
                          </td>
                          {hourSlots.map((h) => {
                            const ngVal = (report.hourly[String(h)]?.ng as any)?.[defKey] || 0;
                            return (
                              <td key={h} className="border-r border-slate-200 text-rose-700 font-bold">
                                {ngVal > 0 ? ngVal : ""}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Section: Split Abnormal Notes & Stop Legend */}
              <div className="grid grid-cols-12 gap-1.5 border-2 border-slate-800 p-1.5">
                {/* Left (Col 1-7): Catatan Masalah & Penanganan Abnormal */}
                <div className="col-span-7 flex flex-col justify-between space-y-1">
                  <div>
                    <h3 className="font-black uppercase text-[9.5px] text-slate-900 mb-0.5">
                      Kondisi Actual / Item Masalah / Catatan Penanganan Abnormal:
                    </h3>
                    <div className="p-1.5 rounded border border-slate-300 bg-slate-50 min-h-[60px] max-h-[75px] overflow-hidden text-[9px] font-medium leading-snug whitespace-pre-line text-slate-800 font-sans">
                      {report.abnormalNotes || "Tidak ada catatan abnormalitas pada periode ini."}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[8.5px] text-slate-500 font-mono pt-0.5 border-t border-slate-300">
                    <span>MMS Digital Sheet | Data Terkoneksi Real-Time</span>
                    <span className="font-bold text-slate-800">
                      Dokumen No: {report.formCode}
                    </span>
                  </div>
                </div>

                {/* Right (Col 8-12): Legenda Simbol Sebab Stop (A - Y) dalam 3 Kolom Kompak */}
                <div className="col-span-5 border-l border-slate-400 pl-1.5">
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-900 mb-0.5">
                    Simbol &amp; Sebab Stop / Lambat:
                  </div>
                  <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 text-[7.5px] leading-tight font-sans">
                    {stopLegends.map((item) => (
                      <div key={item.sym} className="flex items-start gap-0.5 truncate" title={item.name}>
                        <span className="font-mono font-black text-slate-950 shrink-0 w-2.5 text-center">
                          {item.sym}
                        </span>
                        <span className="text-slate-700 truncate">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
