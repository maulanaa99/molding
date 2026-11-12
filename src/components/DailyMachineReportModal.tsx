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
import { printDailyMachineReport } from "@/lib/printDailyReport";

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

  // Selected Delay Detail for Interactive Modal / Timeline
  const [selectedDelayDetail, setSelectedDelayDetail] = useState<{
    hour: number;
    minutes: number;
    symbol: string;
    reason: string;
    segments?: Array<{ startMin: number; endMin: number }>;
  } | null>(null);

  // Selected Stop Detail for Interactive Modal / Timeline
  const [selectedStopDetail, setSelectedStopDetail] = useState<{
    hour: number;
    minutes: number;
    symbol: string;
    reason: string;
    segments?: Array<{ startMin: number; endMin: number }>;
  } | null>(null);

  // Dictionary Sebab Keterlambatan Standar (Q - Y) - Warna Kuning
  const DELAY_SYMBOLS_DICT: Record<string, string> = {
    Q: "5S",
    R: "Meeting , Training",
    S: "Pengecekan alat",
    T: "Tidak ada trolly",
    U: "Makan",
    V: "Trial",
    W: "Sesuai Intruksi",
    X: "Listrik mati",
    Y: "Pengecekan Qualitas",
  };

  // Dictionary Sebab Berhenti Mesin Standar (A - N) - Warna Merah
  const STOP_SYMBOLS_DICT: Record<string, string> = {
    A: "Cek sheet harian/mingguan",
    B: "Kerusakan Auto Loader",
    C: "Meeting",
    D: "Pengangkutan",
    E: "Material Habis",
    F: "Masalah Qualitas",
    G: "Kerusakan Mold",
    H: "Kerusakan Mesin",
    I: "Kerusakan Robot",
    J: "Ganti Material",
    K: "Ganti Dies/Setting Robot",
    L: "Kerusakan Dryer",
    M: "Kondisi Lain",
    N: "Dies Belum diganti",
  };

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
    if (!report) return;
    const docTitle = `Catatan_Proses_FO_MLD_009_${report.machine.code}_${selectedDate}`;
    printDailyMachineReport("daily-machine-report-sheet", { title: docTitle });
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
        @page {
          size: A4 landscape;
          margin: 4mm 5mm;
        }
        @page {
          size: landscape;
          margin: 4mm 5mm;
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 4mm 5mm;
          }
          @page {
            size: landscape;
            margin: 4mm 5mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
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
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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
              <span>Cetak / Print PDF (A4 Landscape)</span>
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
            <div
              id="daily-machine-report-sheet"
              className="report-print-sheet bg-white p-3 sm:p-5 rounded-xl border border-slate-300 shadow-md text-slate-900 font-sans text-xs max-w-5xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none print:rounded-none"
            >
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
                    {/* 1. Waktu Produksi (Menit jalan) - Progress Bar Visual Hijau (RUN SAJA) */}
                    <tr className="bg-emerald-50/20 h-5">
                      <td className="border-r border-slate-400 px-1.5 py-0.5 font-bold text-left text-emerald-950 font-sans text-[8px]">
                        Waktu Produksi (m)
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const runM = hData?.runMinutes || 0;
                        const runSegs = (hData?.segments || []).filter(
                          (seg) => seg.type === "RUN"
                        );

                        return (
                          <td key={h} className="border-r border-slate-200 p-0.5">
                            {runM > 0 ? (
                              <div
                                className="w-full h-3.5 rounded-xs overflow-hidden relative border border-emerald-300 bg-emerald-50 shadow-2xs"
                                title={`Jam ${String(h).padStart(2, "0")}:00 - Waktu Produksi (Jalan): ${runM} Menit`}
                              >
                                {runSegs.length > 0 ? (
                                  runSegs.map((seg, sIdx) => {
                                    const leftPct = (seg.startMin / 60) * 100;
                                    const widthPct = ((seg.endMin - seg.startMin) / 60) * 100;
                                    const duration = seg.endMin - seg.startMin;

                                    return (
                                      <div
                                        key={sIdx}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        className="absolute top-0 bottom-0 bg-emerald-500 text-white flex items-center justify-center text-[6px] font-bold transition-all overflow-hidden border-x border-emerald-600/30"
                                        title={`Produksi Jalan: ${duration}m (${String(seg.startMin).padStart(2, "0")} - ${String(seg.endMin).padStart(2, "0")})`}
                                      >
                                        {duration >= 18 ? `${duration}m` : duration >= 10 ? `${duration}` : ""}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div
                                    style={{ width: `${(runM / 60) * 100}%` }}
                                    className="bg-emerald-500 h-full flex items-center justify-center text-[6.5px] font-bold text-white transition-all overflow-hidden"
                                  >
                                    {runM >= 18 ? `${runM}m` : runM >= 10 ? `${runM}` : ""}
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

                    {/* Keterlambatan (Menit delay) - Progress Bar Visual Kuning */}
                    <tr className="bg-amber-50/20 h-5">
                      <td className="border-r border-slate-400 px-1.5 py-0.5 font-bold text-left text-amber-950 font-sans text-[8px]">
                        Keterlambatan (m)
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const d = hData?.delayMinutes || 0;
                        const sym = hData?.delaySymbol || (d > 0 ? "W" : "");
                        const reason =
                          hData?.delayReason ||
                          (sym === "W"
                            ? "Sesuai Intruksi (Menunggu Mulai Shift 1)"
                            : DELAY_SYMBOLS_DICT[sym] || "Keterlambatan");
                        const delaySegs = (hData?.segments || []).filter(
                          (seg) => seg.type === "DELAY"
                        );

                        return (
                          <td key={h} className="border-r border-slate-200 p-0.5">
                            {d > 0 ? (
                              <div
                                onClick={() =>
                                  setSelectedDelayDetail({
                                    hour: h,
                                    minutes: d,
                                    symbol: sym,
                                    reason,
                                    segments: delaySegs.map((s) => ({
                                      startMin: s.startMin,
                                      endMin: s.endMin,
                                    })),
                                  })
                                }
                                className="w-full h-3.5 rounded-xs overflow-hidden relative border border-amber-300 bg-amber-50 shadow-2xs cursor-pointer hover:border-amber-500 hover:ring-1 hover:ring-amber-400 transition-all"
                                title={`Jam ${String(h).padStart(2, "0")}:00 - Keterlambatan ${d}m | Simbol: ${sym} (${reason}) - Klik untuk rincian`}
                              >
                                {delaySegs.length > 0 ? (
                                  delaySegs.map((seg, sIdx) => {
                                    const leftPct = (seg.startMin / 60) * 100;
                                    const widthPct = ((seg.endMin - seg.startMin) / 60) * 100;
                                    const duration = seg.endMin - seg.startMin;

                                    return (
                                      <div
                                        key={sIdx}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        className="absolute top-0 bottom-0 bg-amber-400 text-slate-950 flex items-center justify-center text-[6px] font-black transition-all overflow-hidden border-x border-amber-500/30"
                                      >
                                        {duration >= 18 ? `${duration}m` : duration >= 10 ? `${duration}` : ""}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div
                                    style={{ width: `${(d / 60) * 100}%` }}
                                    className="bg-amber-400 h-full flex items-center justify-center text-[6.5px] font-black text-slate-950 transition-all overflow-hidden"
                                  >
                                    {d >= 18 ? `${d}m` : d >= 10 ? `${d}` : ""}
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

                    {/* Simbol Sebab Lambat (Q - Y) */}
                    <tr className="bg-amber-50/50 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-amber-950 font-sans text-[8px]">
                        Penyebab Lambat (Simbol)
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const sym = hData?.delaySymbol || "";
                        const d = hData?.delayMinutes || 0;
                        const reason =
                          hData?.delayReason ||
                          (sym === "W"
                            ? "Sesuai Intruksi (Menunggu Mulai Shift 1)"
                            : DELAY_SYMBOLS_DICT[sym] || "Keterlambatan");

                        return (
                          <td
                            key={h}
                            onClick={() => {
                              if (d > 0 || sym) {
                                setSelectedDelayDetail({
                                  hour: h,
                                  minutes: d,
                                  symbol: sym || "W",
                                  reason,
                                  segments: (hData?.segments || []).filter((s) => s.type === "DELAY"),
                                });
                              }
                            }}
                            className={`border-r border-slate-200 font-black text-amber-950 ${
                              d > 0 || sym ? "cursor-pointer hover:bg-amber-200/50" : ""
                            }`}
                            title={sym ? `${sym} - ${DELAY_SYMBOLS_DICT[sym] || reason}` : ""}
                          >
                            {sym}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 3. Berhenti (Menit stop) - Progress Bar Visual Merah (STOP) */}
                    <tr className="bg-rose-50/20 h-5">
                      <td className="border-r border-slate-400 px-1.5 py-0.5 font-bold text-left text-rose-950 font-sans text-[8px]">
                        Berhenti (m)
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const stopM = hData?.stopMinutes || 0;
                        const sym = hData?.stopSymbol || "";
                        const reason = hData?.stopReason || STOP_SYMBOLS_DICT[sym] || "Berhenti";
                        const stopSegs = (hData?.segments || []).filter(
                          (seg) => seg.type === "STOP"
                        );

                        return (
                          <td key={h} className="border-r border-slate-200 p-0.5">
                            {stopM > 0 ? (
                              <div
                                onClick={() =>
                                  setSelectedStopDetail({
                                    hour: h,
                                    minutes: stopM,
                                    symbol: sym,
                                    reason,
                                    segments: stopSegs.map((s) => ({
                                      startMin: s.startMin,
                                      endMin: s.endMin,
                                    })),
                                  })
                                }
                                className="w-full h-3.5 rounded-xs overflow-hidden relative border border-rose-300 bg-rose-50 shadow-2xs cursor-pointer hover:border-rose-500 hover:ring-1 hover:ring-rose-400 transition-all"
                                title={`Jam ${String(h).padStart(2, "0")}:00 - Berhenti ${stopM}m | Simbol: ${sym || "-"} (${reason}) - Klik untuk rincian`}
                              >
                                {stopSegs.length > 0 ? (
                                  stopSegs.map((seg, sIdx) => {
                                    const leftPct = (seg.startMin / 60) * 100;
                                    const widthPct = ((seg.endMin - seg.startMin) / 60) * 100;
                                    const duration = seg.endMin - seg.startMin;

                                    return (
                                      <div
                                        key={sIdx}
                                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                        className="absolute top-0 bottom-0 bg-rose-500 text-white flex items-center justify-center text-[6px] font-black transition-all overflow-hidden border-x border-rose-600/30"
                                      >
                                        {duration >= 18 ? `${duration}m` : duration >= 10 ? `${duration}` : ""}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div
                                    style={{ width: `${(stopM / 60) * 100}%` }}
                                    className="bg-rose-500 h-full flex items-center justify-center text-[6.5px] font-black text-white transition-all overflow-hidden"
                                  >
                                    {stopM >= 18 ? `${stopM}m` : stopM >= 10 ? `${stopM}` : ""}
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

                    {/* Simbol Sebab Stop (A - N) */}
                    <tr className="bg-rose-50/50 h-3.5">
                      <td className="border-r border-slate-400 px-1.5 py-0.25 font-bold text-left text-rose-950 font-sans text-[8px]">
                        Penyebab Stop (Simbol A-N)
                      </td>
                      {hourSlots.map((h) => {
                        const hData = report.hourly[String(h)];
                        const sym = hData?.stopSymbol || "";
                        const stopM = hData?.stopMinutes || 0;
                        const reason = hData?.stopReason || STOP_SYMBOLS_DICT[sym] || "Berhenti";

                        return (
                          <td
                            key={h}
                            onClick={() => {
                              if (stopM > 0 || sym) {
                                setSelectedStopDetail({
                                  hour: h,
                                  minutes: stopM,
                                  symbol: sym,
                                  reason,
                                  segments: (hData?.segments || []).filter((s) => s.type === "STOP"),
                                });
                              }
                            }}
                            className={`border-r border-slate-200 font-black text-rose-950 ${
                              stopM > 0 || sym ? "cursor-pointer hover:bg-rose-200/50" : ""
                            }`}
                            title={sym ? `${sym} - ${STOP_SYMBOLS_DICT[sym] || reason}` : ""}
                          >
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

                {/* Right (Col 8-12): Legenda Simbol Sebab Stop (A - N) & Lambat (Q - Y) dalam 3 Kolom Kompak */}
                <div className="col-span-5 border-l border-slate-400 pl-1.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[8.5px] font-black uppercase tracking-wider text-slate-900 mb-0.5 border-b border-slate-300 pb-0.5">
                    <span>Simbol &amp; Sebab:</span>
                    <div className="flex items-center gap-2 text-[7.5px] font-bold">
                      <span className="flex items-center gap-1 text-rose-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                        Stop (A - N)
                      </span>
                      <span className="flex items-center gap-1 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Lambat (Q - Y)
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 text-[7.5px] leading-tight font-sans">
                    {stopLegends.map((item) => {
                      const isStop = item.sym >= "A" && item.sym <= "N";
                      return (
                        <div key={item.sym} className="flex items-start gap-0.5 truncate" title={item.name}>
                          <span
                            className={`font-mono font-black shrink-0 w-2.5 text-center ${
                              isStop ? "text-rose-700" : "text-amber-800"
                            }`}
                          >
                            {item.sym}
                          </span>
                          <span className="text-slate-700 truncate">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Interaktif: Rincian Keterlambatan (Delay Detail Popover/Modal) */}
      {selectedDelayDetail && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedDelayDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-amber-300 max-w-md w-full overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-amber-400 px-5 py-3.5 flex items-center justify-between text-slate-950 border-b border-amber-500/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/40 border border-amber-600/30 flex items-center justify-center font-black text-lg">
                  {selectedDelayDetail.symbol || "W"}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    Rincian Keterlambatan (Delay)
                  </h3>
                  <p className="text-[11px] font-mono text-amber-950/80">
                    Jam {String(selectedDelayDetail.hour).padStart(2, "0")}:00 s/d{" "}
                    {String((selectedDelayDetail.hour + 1) % 24).padStart(2, "0")}:00
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDelayDetail(null)}
                className="w-7 h-7 rounded-lg hover:bg-amber-500/40 flex items-center justify-center transition-colors text-slate-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Progress Visual Bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Visualisasi Menit Terlambat:</span>
                  <span className="font-bold font-mono text-amber-700">
                    {selectedDelayDetail.minutes} Menit ({Math.round((selectedDelayDetail.minutes / 60) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-md border border-slate-200 overflow-hidden relative">
                  <div
                    style={{ width: `${Math.min(100, (selectedDelayDetail.minutes / 60) * 100)}%` }}
                    className="h-full bg-amber-400 border-r border-amber-500 transition-all flex items-center justify-end pr-1.5"
                  >
                    <span className="text-[9px] font-black text-slate-950 font-mono">
                      {selectedDelayDetail.minutes}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Sebab Keterlambatan */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 block mb-0.5">
                  Sebab Keterlambatan (Simbol {selectedDelayDetail.symbol})
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedDelayDetail.symbol}: {DELAY_SYMBOLS_DICT[selectedDelayDetail.symbol] || selectedDelayDetail.reason}
                </p>
                {selectedDelayDetail.reason &&
                  selectedDelayDetail.reason !== DELAY_SYMBOLS_DICT[selectedDelayDetail.symbol] && (
                    <p className="text-xs text-slate-600 mt-1 italic">
                      Catatan: {selectedDelayDetail.reason}
                    </p>
                  )}
              </div>

              {/* Segmen Timeline Menit (jika ada) */}
              {selectedDelayDetail.segments && selectedDelayDetail.segments.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                    Timeline Menit Aktual:
                  </span>
                  <div className="space-y-1">
                    {selectedDelayDetail.segments.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs font-mono bg-slate-50 border border-slate-200 px-3 py-1.5 rounded"
                      >
                        <span className="font-semibold text-slate-700">
                          {String(selectedDelayDetail.hour).padStart(2, "0")}:{String(s.startMin).padStart(2, "0")} -{" "}
                          {String(selectedDelayDetail.hour).padStart(2, "0")}:{String(s.endMin).padStart(2, "0")}
                        </span>
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                          {s.endMin - s.startMin} Menit
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Button Delay Modal */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedDelayDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interaktif: Rincian Berhenti (Stop Detail Popover/Modal) */}
      {selectedStopDetail && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedStopDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-rose-300 max-w-md w-full overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-rose-600 px-5 py-3.5 flex items-center justify-between text-white border-b border-rose-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-700 border border-rose-400/40 flex items-center justify-center font-black text-lg">
                  {selectedStopDetail.symbol || "!"}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    Rincian Berhenti (Stop Mesin)
                  </h3>
                  <p className="text-[11px] font-mono text-rose-100">
                    Jam {String(selectedStopDetail.hour).padStart(2, "0")}:00 s/d{" "}
                    {String((selectedStopDetail.hour + 1) % 24).padStart(2, "0")}:00
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStopDetail(null)}
                className="w-7 h-7 rounded-lg hover:bg-rose-700 flex items-center justify-center transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Progress Visual Bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                  <span>Visualisasi Menit Berhenti:</span>
                  <span className="font-bold font-mono text-rose-700">
                    {selectedStopDetail.minutes} Menit ({Math.round((selectedStopDetail.minutes / 60) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-md border border-slate-200 overflow-hidden relative">
                  <div
                    style={{ width: `${Math.min(100, (selectedStopDetail.minutes / 60) * 100)}%` }}
                    className="h-full bg-rose-500 border-r border-rose-600 transition-all flex items-center justify-end pr-1.5"
                  >
                    <span className="text-[9px] font-black text-white font-mono">
                      {selectedStopDetail.minutes}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Sebab Berhenti */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3">
                <span className="text-[10px] uppercase tracking-wider font-bold text-rose-800 block mb-0.5">
                  Sebab Berhenti (Simbol {selectedStopDetail.symbol || "A - N"})
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedStopDetail.symbol ? `${selectedStopDetail.symbol}: ` : ""}
                  {STOP_SYMBOLS_DICT[selectedStopDetail.symbol] || selectedStopDetail.reason}
                </p>
                {selectedStopDetail.reason &&
                  selectedStopDetail.reason !== STOP_SYMBOLS_DICT[selectedStopDetail.symbol] && (
                    <p className="text-xs text-slate-600 mt-1 italic">
                      Catatan: {selectedStopDetail.reason}
                    </p>
                  )}
              </div>

              {/* Segmen Timeline Menit (jika ada) */}
              {selectedStopDetail.segments && selectedStopDetail.segments.length > 0 && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                    Timeline Menit Aktual:
                  </span>
                  <div className="space-y-1">
                    {selectedStopDetail.segments.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs font-mono bg-slate-50 border border-slate-200 px-3 py-1.5 rounded"
                      >
                        <span className="font-semibold text-slate-700">
                          {String(selectedStopDetail.hour).padStart(2, "0")}:{String(s.startMin).padStart(2, "0")} -{" "}
                          {String(selectedStopDetail.hour).padStart(2, "0")}:{String(s.endMin).padStart(2, "0")}
                        </span>
                        <span className="font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded text-[11px]">
                          {s.endMin - s.startMin} Menit
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStopDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
