"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  Download,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Edit2,
  Check,
  X,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  SlidersHorizontal,
  Info,
  Scale,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  PackageMinus,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import {
  getMonthlyStockMatrix,
  recordStockOut,
  updatePartNextProcess,
  saveStockAdjustment,
  getOutboundRecapReports,
  OutboundRecapItem,
  MonthlyStockMatrixRow,
  MonthlyStockMatrixResponse,
  FinishGoodStockItem,
} from "@/lib/actions";

interface FinishGoodStockViewProps {
  initialStock?: FinishGoodStockItem[];
  onRefresh?: () => Promise<FinishGoodStockItem[]>;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const COMMON_PROCESSES = [
  "PAINTING 1",
  "PAINTING 2",
  "PLATING",
  "ASSEMBLY",
  "SUB ASSY",
  "PAINTING",
  "DELIVERY",
  "GUDANG FG",
];

export default function FinishGoodStockView({
  initialStock,
  onRefresh,
}: FinishGoodStockViewProps) {
  const now = new Date();
  const currentDayStr = now.getDate().toString();

  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [matrixData, setMatrixData] = useState<MonthlyStockMatrixResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProcess, setFilterProcess] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Modal Input Pengeluaran (Out)
  const [isOutModalOpen, setIsOutModalOpen] = useState(false);
  const [outForm, setOutForm] = useState({
    partId: 0,
    day: currentDayStr,
    qty: 50,
    destination: "PAINTING",
    notes: "",
  });
  const [isSubmittingOut, setIsSubmittingOut] = useState(false);

  // Modal / Penyesuaian Stok Awal (Stok Opname)
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    partId: 0,
    initialStock: 0,
    notes: "",
  });
  const [isSubmittingAdj, setIsSubmittingAdj] = useState(false);

  // Modal / Rekapitulasi Selisih Opname (Audit)
  const [isVarianceModalOpen, setIsVarianceModalOpen] = useState(false);

  // Modal / Rekapitulasi Pengeluaran Trolly (Outbound Recap Next Process)
  const [isOutboundRecapOpen, setIsOutboundRecapOpen] = useState(false);
  const [outboundLogs, setOutboundLogs] = useState<OutboundRecapItem[]>([]);
  const [isLoadingOutboundLogs, setIsLoadingOutboundLogs] = useState(false);
  const [outboundDateFilter, setOutboundDateFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [outboundDeptFilter, setOutboundDeptFilter] = useState<string>("ALL");

  const loadOutboundRecap = async () => {
    setIsLoadingOutboundLogs(true);
    const res = await getOutboundRecapReports({
      startDate: outboundDateFilter,
      endDate: outboundDateFilter,
      department: outboundDeptFilter,
    });
    if (res.success && res.data) {
      setOutboundLogs(res.data);
    }
    setIsLoadingOutboundLogs(false);
  };

  useEffect(() => {
    if (isOutboundRecapOpen) {
      loadOutboundRecap();
    }
  }, [isOutboundRecapOpen, outboundDateFilter, outboundDeptFilter]);

  // Modal / Inline Edit Next Process
  const [editingPart, setEditingPart] = useState<{ id: number; partNo: string; nextProcess: string } | null>(null);
  const [nextProcInput, setNextProcInput] = useState("");
  const [isSavingProc, setIsSavingProc] = useState(false);

  // Load monthly matrix data
  const loadMatrix = async (m = selectedMonth, y = selectedYear) => {
    setIsLoading(true);
    const res = await getMonthlyStockMatrix(m, y);
    if (res.success && res.data) {
      setMatrixData(res.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMatrix(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Handle month change
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Day columns (1 s.d. jumlah hari pada bulan bersangkutan)
  const dayColumns = useMemo(() => {
    if (matrixData?.dayColumns && matrixData.dayColumns.length > 0) {
      return matrixData.dayColumns;
    }
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
  }, [matrixData, selectedYear, selectedMonth]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!matrixData) return [];
    let list = matrixData.rows;

    if (filterProcess !== "ALL") {
      list = list.filter((r) => r.nextProcess === filterProcess);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.partNo.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.nextProcess.toLowerCase().includes(q)
      );
    }

    return list;
  }, [matrixData, searchQuery, filterProcess]);

  // Distinct process list for filter
  const availableProcesses = useMemo(() => {
    if (!matrixData) return [];
    const set = new Set<string>();
    matrixData.rows.forEach((r) => {
      if (r.nextProcess) set.add(r.nextProcess);
    });
    return Array.from(set);
  }, [matrixData]);

  // Daftar part yang memiliki penyesuaian opname di bulan ini
  const adjustedRows = useMemo(() => {
    return matrixData?.rows.filter((r) => r.isAdjusted) || [];
  }, [matrixData]);

  // Daftar part yang diopname di awal bulan berikutnya (ketika melihat bulan lalu)
  const forwardAdjustedRows = useMemo(() => {
    return matrixData?.rows.filter((r) => r.nextMonthAdjusted) || [];
  }, [matrixData]);

  // Open Stock Opname Modal
  const handleOpenAdjModal = (partId?: number, currentVal?: number, currentNotes?: string | null) => {
    const defaultPartId = partId || (matrixData?.rows[0]?.partId ?? 0);
    const partRow = matrixData?.rows.find((r) => r.partId === defaultPartId);
    setAdjForm({
      partId: defaultPartId,
      initialStock: currentVal ?? (partRow?.initialStock || 0),
      notes: currentNotes || "",
    });
    setIsAdjModalOpen(true);
  };

  // Submit Stock Opname / Adjustment
  const handleSubmitAdj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.partId) return;

    setIsSubmittingAdj(true);
    const res = await saveStockAdjustment({
      partId: adjForm.partId,
      year: selectedYear,
      month: selectedMonth,
      initialStock: Math.max(0, Number(adjForm.initialStock) || 0),
      notes: adjForm.notes.trim(),
    });

    if (res.success) {
      setIsAdjModalOpen(false);
      await loadMatrix(selectedMonth, selectedYear);
      if (onRefresh) onRefresh();
    } else {
      alert("Gagal menyimpan penyesuaian stok: " + res.error);
    }
    setIsSubmittingAdj(false);
  };

  // Handle Submit Out
  const handleSubmitOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outForm.partId || outForm.qty <= 0) return;

    setIsSubmittingOut(true);
    const targetDate = new Date(selectedYear, selectedMonth - 1, parseInt(outForm.day, 10), 12, 0, 0);

    const res = await recordStockOut({
      partId: outForm.partId,
      qty: outForm.qty,
      outDate: targetDate.toISOString(),
      destination: outForm.destination,
      notes: outForm.notes,
    });

    if (res.success) {
      setIsOutModalOpen(false);
      setOutForm({
        partId: 0,
        day: currentDayStr,
        qty: 50,
        destination: "PAINTING",
        notes: "",
      });
      await loadMatrix(selectedMonth, selectedYear);
      if (onRefresh) onRefresh();
    } else {
      alert("Gagal mencatat pengeluaran: " + res.error);
    }
    setIsSubmittingOut(false);
  };

  // Handle Save Next Process
  const handleSaveNextProcess = async () => {
    if (!editingPart || !nextProcInput.trim()) return;
    setIsSavingProc(true);
    const res = await updatePartNextProcess(editingPart.id, nextProcInput.trim());
    if (res.success) {
      setEditingPart(null);
      await loadMatrix(selectedMonth, selectedYear);
    } else {
      alert("Gagal memperbarui proses: " + res.error);
    }
    setIsSavingProc(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!matrixData) return;

    const headers = [
      "No",
      "No Part",
      "Nama Part",
      "Next Process",
      "Status",
      "Stok Awal",
      ...dayColumns,
      "Total In",
      "Total Out",
      "Stok Saat Ini",
    ];

    const csvRows: string[] = [headers.join(",")];

    filteredRows.forEach((row) => {
      // Row In
      const inValues = dayColumns.map((d) => row.inDays[d] || 0);
      const rowIn = [
        row.no,
        `"${row.partNo}"`,
        `"${row.name}"`,
        `"${row.nextProcess}"`,
        "In",
        row.initialStock,
        ...inValues,
        row.totalIn,
        "",
        row.endingStock,
      ];
      csvRows.push(rowIn.join(","));

      // Row Out
      const outValues = dayColumns.map((d) => row.outDays[d] || 0);
      const rowOut = [
        "",
        "",
        "",
        "",
        "Out",
        "",
        ...outValues,
        "",
        row.totalOut,
        "",
      ];
      csvRows.push(rowOut.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Stok_Finish_Good_${matrixData.monthName}_${selectedYear}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-6 h-6 text-emerald-600" />
              Trolly & Finish Good Stock Control
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              Live Real-Time
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Perhitungan stok finish good harian: barang masuk (<strong>In</strong>) otomatis
            terhitung saat operator men-scan kanban trolly di mesin molding, dan barang keluar (
            <strong>Out</strong>) saat dikirim ke proses lanjutan (Painting, Sub Assy, Delivery).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month / Year Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Bulan Sebelumnya"
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-xs font-bold text-slate-900 flex items-center gap-1.5 min-w-[130px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Bulan Berikutnya"
              className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Button Penyesuaian Stok Awal / Opname */}
          <button
            type="button"
            onClick={() => handleOpenAdjModal()}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Atur atau sesuaikan stok awal / opname untuk bulan ini"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-700" />
            Penyesuaian Stok (Opname)
          </button>

          {/* Button Rekap Selisih Opname / Audit */}
          <button
            type="button"
            onClick={() => setIsVarianceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer relative"
            title="Lihat rincian perbandingan saldo sistem vs hasil fisik opname"
          >
            <Scale className="w-4 h-4 text-blue-700" />
            <span>Rekap Selisih Opname</span>
            {matrixData && matrixData.adjustedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
                {matrixData.adjustedCount}
              </span>
            )}
          </button>

          {/* Button Rekap Outbound Trolly (Next Process) */}
          <button
            type="button"
            onClick={() => setIsOutboundRecapOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Lihat rekapitulasi trolly yang dikeluarkan ke Next Process"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Rekap Outbound Trolly</span>
          </button>

          {/* Link Buka PDA Scanner Mobile */}
          <a
            href="/pda"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            title="Buka tampilan mobile PDA Scanner Android di tab baru"
          >
            <PackageMinus className="w-4 h-4 text-amber-400" />
            <span>Buka PDA Scanner</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Button Input Out */}
          <button
            type="button"
            onClick={() => {
              if (matrixData && matrixData.rows.length > 0) {
                setOutForm({
                  partId: matrixData.rows[0].partId,
                  day: currentDayStr,
                  qty: 50,
                  destination: matrixData.rows[0].nextProcess || "PAINTING 1",
                  notes: "",
                });
              }
              setIsOutModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Input Out (Keluar)
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            title="Download CSV / Excel"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>

          {/* Print View */}
          <button
            type="button"
            onClick={() => window.print()}
            title="Cetak Tabel"
            className="p-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => loadMatrix(selectedMonth, selectedYear)}
            disabled={isLoading}
            className="p-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-600" : "text-slate-500"}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Stok Awal
            </span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
              <SlidersHorizontal className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-800 font-mono">
              {(matrixData?.grandTotalInitialStock || 0).toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium text-slate-500">pcs</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              {matrixData?.adjustedCount ? `${matrixData.adjustedCount} part diopname` : "Otomatis carry-over"}
            </span>
            {matrixData && matrixData.grandTotalVariance !== 0 && (
              <span
                className={`font-mono font-bold ${
                  matrixData.grandTotalVariance > 0 ? "text-emerald-700" : "text-rose-700"
                }`}
                title={`Saldo sistem bulan lalu: ${matrixData.grandTotalSystemPreviousStock.toLocaleString("id-ID")} pcs`}
              >
                Varian: {matrixData.grandTotalVariance > 0 ? "+" : ""}
                {matrixData.grandTotalVariance.toLocaleString("id-ID")} pcs
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total In (Masuk FG)
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {(matrixData?.grandTotalIn || 0).toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium text-slate-500">pcs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Akumulasi scan trolly operator bulan ini
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Out (Keluar)
            </span>
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono">
              {(matrixData?.grandTotalOut || 0).toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium text-slate-500">pcs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Dikirim ke proses lanjutan / painting
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Stok Saat Ini (Akhir)
            </span>
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700 font-mono">
              {(matrixData?.grandTotalEndingStock || 0).toLocaleString("id-ID")}
            </span>
            <span className="text-xs font-medium text-slate-500">pcs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Stok Awal + Total In - Total Out
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-300 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No Part, Nama Part, atau Next Process..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Process Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterProcess}
              onChange={(e) => setFilterProcess(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-hidden focus:border-blue-500"
            >
              <option value="ALL">Semua Next Process</option>
              {availableProcesses.map((proc) => (
                <option key={proc} value={proc}>
                  {proc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend & Formula Ribbon */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 font-mono text-[11px]">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Rumus: <strong>Stok Saat Ini = Stok Awal + Total In - Total Out</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>Awal</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ml-1"></span>
            <span>In</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-1"></span>
            <span>Out</span>
          </div>
        </div>
      </div>

      {/* Main Stock Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[750px] relative">
          <table className="w-full text-xs text-left border-separate border-spacing-0">
            {/* Table Header */}
            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-30 shadow-xs">
              <tr>
                {/* Fixed Columns with solid bg and zero gaps */}
                <th
                  scope="col"
                  className="py-3 px-2 text-center border-r border-b border-slate-300 sticky left-0 z-40 bg-slate-100 w-12 min-w-[48px] max-w-[48px]"
                >
                  No
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 border-r border-b border-slate-300 sticky left-[48px] z-40 bg-slate-100 w-44 min-w-[176px] max-w-[176px]"
                >
                  No Part
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 border-r border-b border-slate-300 sticky left-[224px] z-40 bg-slate-100 w-56 min-w-[224px] max-w-[224px]"
                >
                  Nama Part
                </th>
                <th
                  scope="col"
                  className="py-3 px-3 text-center border-r border-b border-slate-300 sticky left-[448px] z-40 bg-slate-100 w-28 min-w-[112px] max-w-[112px]"
                >
                  Next Process
                </th>
                <th
                  scope="col"
                  className="py-3 px-2 text-center border-r-2 border-b border-slate-300 sticky left-[560px] z-40 bg-slate-100 w-16 min-w-[64px] max-w-[64px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]"
                >
                  Status
                </th>

                {/* Kolom Stok Awal */}
                <th
                  scope="col"
                  className="py-3 px-3 text-center border-r border-b border-slate-300 min-w-[95px] bg-amber-50 text-amber-950 font-black"
                >
                  Stok Awal
                </th>

                {/* Day Columns: 1, 2, 3 ... (28/30/31) */}
                {dayColumns.map((day) => {
                  const isToday =
                    day === currentDayStr &&
                    selectedMonth === now.getMonth() + 1 &&
                    selectedYear === now.getFullYear();

                  return (
                    <th
                      key={day}
                      scope="col"
                      className={`py-3 px-1.5 text-center border-r border-b border-slate-300 min-w-[42px] font-mono text-[11px] ${
                        isToday
                          ? "bg-amber-100 text-amber-900 font-black border-b-2 border-b-amber-500"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {day}
                    </th>
                  );
                })}

                {/* Total In Column */}
                <th
                  scope="col"
                  className="py-3 px-3 text-right font-black border-r border-b border-slate-300 min-w-[80px] bg-emerald-50 text-emerald-950"
                >
                  Total In
                </th>

                {/* Total Out Column */}
                <th
                  scope="col"
                  className="py-3 px-3 text-right font-black border-r border-b border-slate-300 min-w-[80px] bg-rose-50 text-rose-950"
                >
                  Total Out
                </th>

                {/* Stok Saat Ini (Akhir) Column */}
                <th
                  scope="col"
                  className="py-3 px-3 text-right font-black border-b border-slate-300 min-w-[95px] bg-blue-100 text-blue-950"
                >
                  Stok Saat Ini
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5 + 1 + dayColumns.length + 3}
                    className="py-12 text-center text-slate-500 border-b border-slate-200"
                  >
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <p className="font-medium text-xs">Memuat data matriks stok finish good...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + 1 + dayColumns.length + 3}
                    className="py-12 text-center text-slate-500 border-b border-slate-200"
                  >
                    <p className="font-bold text-sm">Tidak ada data part yang sesuai filter</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Coba ganti kata kunci pencarian atau pilih bulan lain.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? "bg-white" : "bg-slate-50/70";

                  return (
                    <React.Fragment key={row.partId}>
                      {/* ROW 1: STATUS IN */}
                      <tr className={`${rowBg} hover:bg-blue-50/40 transition group`}>
                        {/* No */}
                        <td
                          rowSpan={2}
                          className="py-2 px-2 text-center font-bold text-slate-500 border-r border-b border-slate-200 sticky left-0 z-20 bg-white group-hover:bg-slate-50 w-12 min-w-[48px] max-w-[48px]"
                        >
                          {row.no}
                        </td>

                        {/* No Part */}
                        <td
                          rowSpan={2}
                          className="py-2 px-3 font-mono font-bold text-slate-900 border-r border-b border-slate-200 sticky left-[48px] z-20 bg-white group-hover:bg-slate-50 w-44 min-w-[176px] max-w-[176px] truncate"
                          title={row.partNo}
                        >
                          {row.partNo}
                        </td>

                        {/* Nama Part */}
                        <td
                          rowSpan={2}
                          className="py-2 px-3 font-medium text-slate-800 border-r border-b border-slate-200 sticky left-[224px] z-20 bg-white group-hover:bg-slate-50 w-56 min-w-[224px] max-w-[224px]"
                        >
                          <div className="line-clamp-2 leading-tight" title={row.name}>
                            {row.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            Kapasitas: {row.qtyPerTrolly} pcs/trolly
                          </div>
                        </td>

                        {/* Next Process (Editable) */}
                        <td
                          rowSpan={2}
                          className="py-2 px-3 text-center border-r border-b border-slate-200 sticky left-[448px] z-20 bg-white group-hover:bg-slate-50 w-28 min-w-[112px] max-w-[112px]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPart({
                                id: row.partId,
                                partNo: row.partNo,
                                nextProcess: row.nextProcess,
                              });
                              setNextProcInput(row.nextProcess);
                            }}
                            title="Klik untuk mengubah Next Process"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 hover:bg-slate-300 transition border border-slate-400/40 cursor-pointer"
                          >
                            <span>{row.nextProcess}</span>
                            <Edit2 className="w-2.5 h-2.5 text-slate-500" />
                          </button>
                        </td>

                        {/* Status IN Badge */}
                        <td className="py-1.5 px-2 text-center border-r-2 border-b border-slate-300 sticky left-[560px] z-20 bg-white group-hover:bg-slate-50 w-16 min-w-[64px] max-w-[64px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]">
                          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block w-11 text-center">
                            In
                          </span>
                        </td>

                        {/* Stok Awal Cell (Rowspan 2, Clickable for Opname) */}
                        <td
                          rowSpan={2}
                          className="py-2 px-3 text-right font-mono font-bold text-xs border-r border-b border-slate-200 bg-amber-50/50 hover:bg-amber-100/60 transition"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenAdjModal(row.partId, row.initialStock, row.adjustmentNotes)}
                            title={
                              row.isAdjusted
                                ? `Stok Opname Disesuaikan: ${row.adjustmentNotes || "-"}\nSaldo Buku Sistem: ${row.systemPreviousStock.toLocaleString("id-ID")} pcs\nFisik Opname: ${row.initialStock.toLocaleString("id-ID")} pcs\nSelisih: ${row.variance >= 0 ? "+" : ""}${row.variance.toLocaleString("id-ID")} pcs`
                                : "Klik untuk atur stok opname / sesuaikan stok awal"
                            }
                            className="w-full text-right cursor-pointer group/adj"
                          >
                            <span className="text-amber-950 font-black group-hover/adj:underline tabular-numbers block">
                              {row.initialStock.toLocaleString("id-ID")}
                            </span>
                            {row.isAdjusted ? (
                              <div className="mt-0.5 flex flex-col items-end gap-0.5">
                                <span className="inline-block text-[9px] px-1 py-0.2 rounded bg-amber-200 text-amber-900 font-bold border border-amber-400">
                                  Opname
                                </span>
                                {row.variance !== 0 && (
                                  <span
                                    className={`inline-block text-[9px] px-1 py-0.2 rounded font-extrabold border ${
                                      row.variance > 0
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : "bg-rose-100 text-rose-800 border-rose-300"
                                    }`}
                                    title={`Saldo Sistem: ${row.systemPreviousStock} pcs vs Fisik: ${row.initialStock} pcs`}
                                  >
                                    {row.variance > 0 ? `+${row.variance}` : row.variance} pcs
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-400 group-hover/adj:text-amber-700">
                                + Sesuaikan
                              </span>
                            )}
                          </button>
                        </td>

                        {/* IN Day Columns */}
                        {dayColumns.map((day) => {
                          const val = row.inDays[day] || 0;
                          const isToday =
                            day === currentDayStr &&
                            selectedMonth === now.getMonth() + 1 &&
                            selectedYear === now.getFullYear();

                          return (
                            <td
                              key={`in-${day}`}
                              className={`py-1.5 px-1.5 text-center font-mono text-xs border-r border-b border-slate-200 ${
                                isToday ? "bg-amber-50/70" : ""
                              } ${val > 0 ? "font-black text-emerald-700 bg-emerald-50/60" : "text-slate-300"}`}
                            >
                              {val > 0 ? val : ""}
                            </td>
                          );
                        })}

                        {/* Total IN */}
                        <td className="py-1.5 px-3 text-right font-mono font-black text-xs text-emerald-700 bg-emerald-50/30 border-r border-b border-slate-200">
                          {row.totalIn > 0 ? row.totalIn.toLocaleString("id-ID") : "0"}
                        </td>

                        {/* Total OUT placeholder on Row 1 (Empty on top, shown in row 2) */}
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-xs text-slate-300 border-r border-b border-slate-200 bg-slate-50">
                          -
                        </td>

                        {/* Stok Saat Ini (Rowspan 2) */}
                        <td
                          rowSpan={2}
                          className="py-2 px-3 text-right font-mono font-black text-sm border-b border-slate-300 bg-blue-50/80"
                        >
                          <span
                            className={
                              row.endingStock >= 0
                                ? "text-blue-800 font-black tabular-numbers"
                                : "text-rose-600 font-black tabular-numbers"
                            }
                          >
                            {row.endingStock.toLocaleString("id-ID")}
                          </span>
                          {row.nextMonthAdjusted && (
                            <div
                              className="mt-1 flex items-center justify-end"
                              title={`Bulan depan (${MONTH_NAMES[selectedMonth % 12]} ${
                                selectedMonth === 12 ? selectedYear + 1 : selectedYear
                              }) di-opname menjadi ${(row.nextMonthInitialStock ?? 0).toLocaleString("id-ID")} pcs (Selisih: ${
                                (row.nextMonthVariance ?? 0) >= 0 ? "+" : ""
                              }${(row.nextMonthVariance ?? 0).toLocaleString("id-ID")} pcs). Catatan: ${row.nextMonthNotes || "-"}`}
                            >
                              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold leading-tight text-right">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Di-opname bln dpn
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* ROW 2: STATUS OUT */}
                      <tr className={`${rowBg} hover:bg-blue-50/40 transition group border-b border-slate-300`}>
                        {/* Status OUT Badge */}
                        <td className="py-1.5 px-2 text-center border-r-2 border-b border-slate-300 sticky left-[560px] z-20 bg-white group-hover:bg-slate-50 w-16 min-w-[64px] max-w-[64px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]">
                          <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-100 text-rose-800 border border-rose-300 inline-block w-11 text-center">
                            Out
                          </span>
                        </td>

                        {/* OUT Day Columns */}
                        {dayColumns.map((day) => {
                          const val = row.outDays[day] || 0;
                          const isToday =
                            day === currentDayStr &&
                            selectedMonth === now.getMonth() + 1 &&
                            selectedYear === now.getFullYear();

                          return (
                            <td
                              key={`out-${day}`}
                              className={`py-1.5 px-1.5 text-center font-mono text-xs border-r border-b border-slate-200 ${
                                isToday ? "bg-amber-50/70" : ""
                              } ${val > 0 ? "font-black text-rose-700 bg-rose-50/60" : "text-slate-300"}`}
                            >
                              {val > 0 ? val : ""}
                            </td>
                          );
                        })}

                        {/* Total IN placeholder on Row 2 (Empty on bottom) */}
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-xs text-slate-300 border-r border-b border-slate-200 bg-slate-50">
                          -
                        </td>

                        {/* Total OUT */}
                        <td className="py-1.5 px-3 text-right font-mono font-black text-xs text-rose-700 bg-rose-50/30 border-r border-b border-slate-300">
                          {row.totalOut > 0 ? row.totalOut.toLocaleString("id-ID") : "0"}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Daily Totals */}
            {matrixData && (
              <tfoot className="bg-slate-200 text-slate-900 font-bold sticky bottom-0 z-30 shadow-md">
                {/* Footer Row 1: Total In Per Day */}
                <tr className="border-t-2 border-slate-400">
                  <td
                    colSpan={4}
                    className="py-2 px-3 font-black text-right border-r border-b border-slate-300 sticky left-0 z-40 bg-slate-200"
                  >
                    TOTAL MASUK (IN)
                  </td>
                  <td className="py-2 px-2 text-center border-r-2 border-b border-slate-300 sticky left-[560px] z-40 bg-slate-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-emerald-200 text-emerald-900">
                      In
                    </span>
                  </td>

                  {/* Grand Total Stok Awal */}
                  <td
                    rowSpan={2}
                    className="py-2 px-3 text-right font-mono font-black text-xs border-r border-slate-400 text-amber-950 bg-amber-100"
                  >
                    <div>{matrixData.grandTotalInitialStock.toLocaleString("id-ID")}</div>
                    {matrixData.grandTotalVariance !== 0 && (
                      <div
                        className={`text-[9px] font-bold ${
                          matrixData.grandTotalVariance > 0 ? "text-emerald-800" : "text-rose-800"
                        }`}
                        title={`Total Selisih Opname Bulan Ini vs Saldo Sistem: ${
                          matrixData.grandTotalVariance > 0 ? "+" : ""
                        }${matrixData.grandTotalVariance} pcs`}
                      >
                        (Selisih: {matrixData.grandTotalVariance > 0 ? "+" : ""}{matrixData.grandTotalVariance.toLocaleString("id-ID")})
                      </div>
                    )}
                  </td>

                  {dayColumns.map((day) => {
                    const totalInDay = matrixData.totalsPerDay.in[day] || 0;
                    return (
                      <td
                        key={`tot-in-${day}`}
                        className="py-2 px-1 text-center font-mono text-[11px] font-black border-r border-b border-slate-300 text-emerald-800"
                      >
                        {totalInDay > 0 ? totalInDay : ""}
                      </td>
                    );
                  })}

                  <td className="py-2 px-3 text-right font-mono font-black text-xs text-emerald-900 bg-emerald-100 border-r border-b border-slate-400">
                    {matrixData.grandTotalIn.toLocaleString("id-ID")}
                  </td>

                  <td className="py-2 px-3 text-right font-mono font-bold text-xs text-slate-400 bg-slate-300 border-r border-b border-slate-400">
                    -
                  </td>

                  <td
                    rowSpan={2}
                    className="py-2 px-3 text-right font-mono font-black text-sm bg-blue-200 text-blue-950 border-slate-400"
                  >
                    {matrixData.grandTotalEndingStock.toLocaleString("id-ID")}
                  </td>
                </tr>

                {/* Footer Row 2: Total Out Per Day */}
                <tr className="border-t border-slate-300">
                  <td
                    colSpan={4}
                    className="py-2 px-3 font-black text-right border-r border-slate-300 sticky left-0 z-40 bg-slate-200"
                  >
                    TOTAL KELUAR (OUT)
                  </td>
                  <td className="py-2 px-2 text-center border-r-2 border-slate-300 sticky left-[560px] z-40 bg-slate-200 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)]">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-rose-200 text-rose-900">
                      Out
                    </span>
                  </td>

                  {dayColumns.map((day) => {
                    const totalOutDay = matrixData.totalsPerDay.out[day] || 0;
                    return (
                      <td
                        key={`tot-out-${day}`}
                        className="py-2 px-1 text-center font-mono text-[11px] font-black border-r border-slate-300 text-rose-800"
                      >
                        {totalOutDay > 0 ? totalOutDay : ""}
                      </td>
                    );
                  })}

                  <td className="py-2 px-3 text-right font-mono font-bold text-xs text-slate-400 bg-slate-300 border-r border-slate-400">
                    -
                  </td>

                  <td className="py-2 px-3 text-right font-mono font-black text-xs text-rose-900 bg-rose-100 border-r border-slate-400">
                    {matrixData.grandTotalOut.toLocaleString("id-ID")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal: Penyesuaian Stok Awal (Stok Opname) */}
      {isAdjModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-200 text-amber-900 rounded-xl">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Penyesuaian Stok Awal / Stok Opname
                  </h3>
                  <p className="text-xs text-slate-600">
                    Bulan: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdj} className="p-6 space-y-4">
              {/* Pilih Part */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Part <span className="text-rose-500">*</span>
                </label>
                <select
                  value={adjForm.partId}
                  onChange={(e) => {
                    const pid = parseInt(e.target.value, 10);
                    const selected = matrixData?.rows.find((r) => r.partId === pid);
                    setAdjForm((f) => ({
                      ...f,
                      partId: pid,
                      initialStock: selected?.initialStock || 0,
                      notes: selected?.adjustmentNotes || "",
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-amber-500 focus:bg-white"
                  required
                >
                  <option value={0}>-- Pilih Part --</option>
                  {matrixData?.rows.map((r) => (
                    <option key={r.partId} value={r.partId}>
                      {r.partNo} - {r.name} (Stok Awal Saat Ini: {r.initialStock} pcs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Nilai Stok Awal Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stok Awal Baru / Hasil Opname Fisik (Pcs) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjForm.initialStock}
                  onChange={(e) =>
                    setAdjForm((f) => ({
                      ...f,
                      initialStock: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan jumlah pcs riil hasil stok opname fisik di gudang finish good pada awal bulan ini.
                </p>
              </div>

              {/* Catatan / Alasan Penyesuaian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Penyesuaian / Catatan Opname
                </label>
                <input
                  type="text"
                  value={adjForm.notes}
                  onChange={(e) => setAdjForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-amber-500"
                  placeholder="Contoh: Stok opname fisik akhir September, selisih 10 pcs rusak"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdjModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdj || !adjForm.partId}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSubmittingAdj ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Penyesuaian</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Input Pengeluaran (Out) */}
      {isOutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Input Pengeluaran Finish Good (Out)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Catat part yang dikirim ke proses lanjutan (Painting / Sub Assy / Delivery)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOut} className="p-6 space-y-4">
              {/* Pilih Part */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Part <span className="text-rose-500">*</span>
                </label>
                <select
                  value={outForm.partId}
                  onChange={(e) => {
                    const pid = parseInt(e.target.value, 10);
                    const selected = matrixData?.rows.find((r) => r.partId === pid);
                    setOutForm((f) => ({
                      ...f,
                      partId: pid,
                      destination: selected?.nextProcess || f.destination,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  required
                >
                  <option value={0}>-- Pilih Part --</option>
                  {matrixData?.rows.map((r) => (
                    <option key={r.partId} value={r.partId}>
                      {r.partNo} - {r.name} (Trolly: {r.qtyPerTrolly} pcs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal & Qty */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Pengeluaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      value={outForm.day}
                      onChange={(e) => setOutForm((f) => ({ ...f, day: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    >
                      {dayColumns.map((d) => (
                        <option key={d} value={d}>
                          Tgl {d} ({MONTH_NAMES[selectedMonth - 1]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Qty Keluar (Pcs) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={outForm.qty}
                    onChange={(e) =>
                      setOutForm((f) => ({ ...f, qty: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 font-mono"
                    placeholder="Contoh: 50"
                    required
                  />
                </div>
              </div>

              {/* Destination / Next Process */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Proses Tujuan / Next Process <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outForm.destination}
                    onChange={(e) => setOutForm((f) => ({ ...f, destination: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    placeholder="Contoh: PAINTING"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMON_PROCESSES.map((proc) => (
                    <button
                      key={proc}
                      type="button"
                      onClick={() => setOutForm((f) => ({ ...f, destination: proc }))}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                    >
                      {proc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / No Surat Jalan (Opsional)
                </label>
                <input
                  type="text"
                  value={outForm.notes}
                  onChange={(e) => setOutForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                  placeholder="Contoh: Surat Jalan #SJ-2026-001 atau Line 2"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsOutModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOut}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSubmittingOut ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Pengeluaran</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ubah Next Process Part */}
      {editingPart && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-black text-slate-900">Ubah Next Process</h3>
              <button
                type="button"
                onClick={() => setEditingPart(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 font-mono font-bold">{editingPart.partNo}</p>
                <label className="block text-xs font-bold text-slate-700 mt-2 mb-1">
                  Pilih atau Ketik Proses Lanjutan:
                </label>
                <input
                  type="text"
                  value={nextProcInput}
                  onChange={(e) => setNextProcInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 uppercase focus:outline-hidden focus:border-blue-500"
                  placeholder="Contoh: PAINTING"
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {COMMON_PROCESSES.map((proc) => (
                  <button
                    key={proc}
                    type="button"
                    onClick={() => setNextProcInput(proc)}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      nextProcInput === proc
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {proc}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNextProcess}
                  disabled={isSavingProc}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSavingProc ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rekapitulasi Selisih Opname (Audit Rekonsiliasi) */}
      {isVarianceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    Rekapitulasi Selisih Opname & Audit Stok
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                      {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbandingan antara Saldo Transaksi Sistem (Buku) vs Hasil Hitung Fisik Opname di Gudang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVarianceModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Educational Explanation Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-900">
                      Bagaimana Sistem Menangani Penyesuaian Stok Opname?
                    </p>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      Ketika dilakukan opname fisik, hasil hitungan riil di gudang dicatat sebagai <strong>Stok Awal Baru</strong> pada bulan bersangkutan.
                      Transaksi historis di bulan sebelumnya <em>tidak dihapus atau diubah</em> demi menjaga integritas data audit. Selisih antara saldo buku sistem akhir bulan lalu dan stok fisik opname ditampilkan transparan di tabel bawah ini.
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards inside Modal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Part Di-Opname</span>
                  <div className="text-xl font-black font-mono text-slate-800 mt-1">
                    {adjustedRows.length}{" "}
                    <span className="text-xs font-normal text-slate-500">/ {matrixData?.rows.length || 0} part</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Saldo Buku Sistem</span>
                  <div className="text-xl font-black font-mono text-slate-700 mt-1">
                    {adjustedRows.reduce((acc, r) => acc + r.systemPreviousStock, 0).toLocaleString("id-ID")}
                    <span className="text-xs font-normal text-slate-500 ml-1">pcs</span>
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <span className="text-[11px] font-bold text-amber-800 uppercase">Fisik Opname (Riil)</span>
                  <div className="text-xl font-black font-mono text-amber-950 mt-1">
                    {adjustedRows.reduce((acc, r) => acc + r.initialStock, 0).toLocaleString("id-ID")}
                    <span className="text-xs font-normal text-amber-700 ml-1">pcs</span>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  matrixData && matrixData.grandTotalVariance > 0
                    ? "bg-emerald-50 border-emerald-200"
                    : matrixData && matrixData.grandTotalVariance < 0
                    ? "bg-rose-50 border-rose-200"
                    : "bg-slate-50 border-slate-200"
                }`}>
                  <span className="text-[11px] font-bold uppercase text-slate-600">Total Selisih Net</span>
                  <div className={`text-xl font-black font-mono mt-1 ${
                    matrixData && matrixData.grandTotalVariance > 0
                      ? "text-emerald-700"
                      : matrixData && matrixData.grandTotalVariance < 0
                      ? "text-rose-700"
                      : "text-slate-800"
                  }`}>
                    {matrixData && matrixData.grandTotalVariance > 0 ? "+" : ""}
                    {matrixData?.grandTotalVariance.toLocaleString("id-ID") || 0}
                    <span className="text-xs font-normal ml-1">pcs</span>
                  </div>
                </div>
              </div>

              {/* Table of Differences */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center justify-between">
                  <span>Daftar Part yang Memiliki Penyesuaian Opname</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    Menampilkan {adjustedRows.length} part
                  </span>
                </h4>

                {adjustedRows.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">
                      Semua Stok Bulan Ini Sesuai dengan Saldo Sistem
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Belum ada penyesuaian stok opname manual yang dimasukkan untuk bulan {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">No Part & Nama Part</th>
                          <th className="py-2.5 px-3 text-center">Next Proc</th>
                          <th className="py-2.5 px-3 text-right">Saldo Sistem (A)</th>
                          <th className="py-2.5 px-3 text-right bg-amber-50/70">Fisik Opname (B)</th>
                          <th className="py-2.5 px-3 text-right">Selisih (B - A)</th>
                          <th className="py-2.5 px-3">Catatan / Alasan</th>
                          <th className="py-2.5 px-3 text-center w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {adjustedRows.map((r, idx) => {
                          const isSurplus = r.variance > 0;
                          const isDeficit = r.variance < 0;

                          return (
                            <tr key={r.partId} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-mono font-bold text-slate-900">{r.partNo}</div>
                                <div className="text-[11px] text-slate-500">{r.name}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                                  {r.nextProcess}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {r.systemPreviousStock.toLocaleString("id-ID")} pcs
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-amber-950 bg-amber-50/50">
                                {r.initialStock.toLocaleString("id-ID")} pcs
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-black ${
                                    isSurplus
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : isDeficit
                                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {isSurplus ? `+${r.variance.toLocaleString("id-ID")}` : r.variance.toLocaleString("id-ID")} pcs
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {isSurplus ? "Surplus (Lebih)" : isDeficit ? "Defisit (Kurang)" : "Match (Klop)"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                {r.adjustmentNotes || <span className="text-slate-300 italic">-</span>}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsVarianceModalOpen(false);
                                    handleOpenAdjModal(r.partId, r.initialStock, r.adjustmentNotes);
                                  }}
                                  title="Edit data opname"
                                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Forward Adjustments Section (Jika melihat bulan lalu dan ada opname di bulan depannya) */}
              {forwardAdjustedRows.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                    <h5 className="text-xs font-black text-amber-900">
                      Informasi Opname Bulan Berikutnya ({MONTH_NAMES[selectedMonth % 12]} {selectedMonth === 12 ? selectedYear + 1 : selectedYear})
                    </h5>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Sebanyak {forwardAdjustedRows.length} part telah dilakukan penyesuaian opname di awal bulan berikutnya.
                    Oleh karena itu, <strong>Stok Saat Ini</strong> pada bulan ini berbeda dengan <strong>Stok Awal</strong> bulan berikutnya.
                  </p>
                  <div className="space-y-1 pt-1">
                    {forwardAdjustedRows.slice(0, 5).map((f) => (
                      <div key={f.partId} className="text-[11px] font-mono text-slate-800 flex items-center justify-between bg-white/70 px-2 py-1 rounded">
                        <span><strong>{f.partNo}</strong> - {f.name}</span>
                        <span>
                          Stok Akhir: <strong>{f.endingStock}</strong> → Opname Bln Depan: <strong>{f.nextMonthInitialStock ?? 0}</strong> (Selisih: {(f.nextMonthVariance ?? 0) >= 0 ? `+${f.nextMonthVariance ?? 0}` : f.nextMonthVariance ?? 0} pcs)
                        </span>
                      </div>
                    ))}
                    {forwardAdjustedRows.length > 5 && (
                      <p className="text-[10px] text-amber-700 italic">...dan {forwardAdjustedRows.length - 5} part lainnya.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Data audit ini memastikan jejak fisik gudang dan pembukuan transaksi tetap sinkron & dapat dipertanggungjawabkan.
              </span>
              <button
                type="button"
                onClick={() => setIsVarianceModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REKAPITULASI PENGELUARAN TROLLY (NEXT PROCESS DISPATCH) */}
      {isOutboundRecapOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Rekapitulasi Pengeluaran Trolly (Next Process)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daftar fisik trolly yang telah di-scan keluar oleh operator Painting, Plating, atau Assembly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOutboundRecapOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Transaksi:</label>
                  <input
                    type="date"
                    value={outboundDateFilter}
                    onChange={(e) => setOutboundDateFilter(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold focus:border-sky-600 bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Departemen Tujuan:</label>
                  <select
                    value={outboundDeptFilter}
                    onChange={(e) => setOutboundDeptFilter(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold focus:border-sky-600 bg-white"
                  >
                    <option value="ALL">Semua Departemen</option>
                    {COMMON_PROCESSES.map((proc) => (
                      <option key={proc} value={proc}>
                        {proc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (outboundLogs.length === 0) {
                        alert("Tidak ada data rekap untuk diekspor.");
                        return;
                      }
                      let csv = "ID,Tanggal Keluar,Jam,No Batch,No Lot Trolly,Departemen Tujuan,Part No,Nama Part,Qty (Pcs),Operator Pengambil,Mesin Asal,Shift\n";
                      outboundLogs.forEach((r) => {
                        const d = new Date(r.outDate);
                        const dateStr = d.toLocaleDateString("id-ID");
                        const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                        const escPartName = `"${r.part.name.replace(/"/g, '""')}"`;
                        csv += `${r.id},${dateStr},${timeStr},${r.batchNo || "-"},${r.lotNumber || "-"},${r.destination || "-"},${r.part.partNo},${escPartName},${r.qty},${r.operator?.name || "-"},${r.scanLog?.run?.machine?.code || "-"},${r.scanLog?.run?.shift || "-"}\n`;
                      });
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.setAttribute("download", `Rekap_Outbound_FG_${outboundDateFilter}_${outboundDeptFilter}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    disabled={outboundLogs.length === 0}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV</span>
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                  <span className="text-[10px] font-black uppercase text-sky-700 block">Total Trolly Keluar</span>
                  <span className="text-xl font-black text-sky-950 font-mono">{outboundLogs.length} Trolly</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-black uppercase text-emerald-700 block">Total Qty (Pcs)</span>
                  <span className="text-xl font-black text-emerald-950 font-mono">
                    {outboundLogs.reduce((acc, l) => acc + l.qty, 0).toLocaleString("id-ID")} pcs
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-black uppercase text-slate-500 block">Tanggal Dipilih</span>
                  <span className="text-sm font-bold text-slate-800">{outboundDateFilter}</span>
                </div>
              </div>

              {/* Table of Dispatched Trolleys */}
              {isLoadingOutboundLogs ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-7 h-7 animate-spin text-sky-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">Memuat rekapitulasi data pengeluaran...</p>
                </div>
              ) : outboundLogs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Tidak ada data trolly yang dikeluarkan pada tanggal ini.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Gunakan PDA Scanner di tab "Scan Keluar (PDA)" untuk memproses pengeluaran trolly.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[380px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-2.5">Waktu</th>
                        <th className="p-2.5">No. Lot Trolly</th>
                        <th className="p-2.5">Part No</th>
                        <th className="p-2.5">Nama Part</th>
                        <th className="p-2.5 text-right">Qty</th>
                        <th className="p-2.5">Departemen Tujuan</th>
                        <th className="p-2.5">Operator Pengambil</th>
                        <th className="p-2.5">Mesin Asal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {outboundLogs.map((log) => {
                        const d = new Date(log.outDate);
                        const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{timeStr} WIB</td>
                            <td className="p-2.5 font-mono font-black text-slate-900 whitespace-nowrap">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                                {log.lotNumber || `ID #${log.id}`}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-sky-800 whitespace-nowrap">{log.part.partNo}</td>
                            <td className="p-2.5 text-slate-800 max-w-[180px] truncate">{log.part.name}</td>
                            <td className="p-2.5 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                              {log.qty.toLocaleString("id-ID")} pcs
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-100 text-sky-800">
                                {log.destination || "NEXT PROCESS"}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700 whitespace-nowrap">{log.operator?.name || "Operator"}</td>
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap">{log.scanLog?.run?.machine?.code || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
              <span className="text-[11px] text-slate-500">
                Data rekapitulasi tersinkronisasi otomatis dengan pemotongan stok Finish Good.
              </span>
              <button
                type="button"
                onClick={() => setIsOutboundRecapOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
