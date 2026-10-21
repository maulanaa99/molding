"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  QrCode,
  Search,
  Camera,
  Layers,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Boxes,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Check,
  Info,
  Calendar,
  Sparkles,
  Building2,
  Truck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import {
  TraceabilityItem,
  searchTraceability,
  getRecentTraceabilityLogs,
  confirmTraceabilityReceiving,
} from "@/lib/actions";

interface TraceabilityViewProps {
  currentUser: {
    id: number;
    name: string;
    employeeId: string;
    role: string;
  };
  serverTimeOffset?: number;
}

export default function TraceabilityView({
  currentUser,
  serverTimeOffset = 0,
}: TraceabilityViewProps) {
  // Helper tanggal lokal
  const getTodayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getYesterdayIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getLast7DaysIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<TraceabilityItem | null>(null);
  const [recentLogs, setRecentLogs] = useState<TraceabilityItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Pagination States
  const [filterStartDate, setFilterStartDate] = useState<string>(getTodayIso());
  const [filterEndDate, setFilterEndDate] = useState<string>(getTodayIso());
  const [filterPreset, setFilterPreset] = useState<"TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "ALL" | "CUSTOM">("TODAY");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [tableSearch, setTableSearch] = useState<string>("");

  // Scanner Kamera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Modal Print Label
  const [printData, setPrintData] = useState<TraceabilityItem | null>(null);
  const [printQrUrl, setPrintQrUrl] = useState<string>("");

  // Konfirmasi Penerimaan
  const [isPendingReceive, startTransitionReceive] = useTransition();

  // Load recent scan logs dengan filter tanggal & indexing paginasi
  const loadRecentLogs = async (
    targetPage = page,
    targetPageSize = pageSize,
    startDate = filterStartDate,
    endDate = filterEndDate,
    search = tableSearch
  ) => {
    setIsLoadingRecent(true);
    try {
      const res = await getRecentTraceabilityLogs({
        page: targetPage,
        pageSize: targetPageSize,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search.trim() || undefined,
      });
      if (res.success && res.data) {
        setRecentLogs(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.total);
          setPage(res.pagination.page);
          setPageSize(res.pagination.pageSize);
          setTotalPages(res.pagination.totalPages);
        } else {
          setTotalCount(res.data.length);
          setTotalPages(1);
        }
        if (res.data.length > 0 && !selectedItem) {
          setSelectedItem(res.data[0]);
        }
      }
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    loadRecentLogs(1, pageSize, getTodayIso(), getTodayIso(), "");
  }, []);

  const handlePresetToday = () => {
    const today = getTodayIso();
    setFilterPreset("TODAY");
    setFilterStartDate(today);
    setFilterEndDate(today);
    setPage(1);
    loadRecentLogs(1, pageSize, today, today, tableSearch);
  };

  const handlePresetYesterday = () => {
    const yest = getYesterdayIso();
    setFilterPreset("YESTERDAY");
    setFilterStartDate(yest);
    setFilterEndDate(yest);
    setPage(1);
    loadRecentLogs(1, pageSize, yest, yest, tableSearch);
  };

  const handlePresetLast7Days = () => {
    const start = getLast7DaysIso();
    const today = getTodayIso();
    setFilterPreset("LAST_7_DAYS");
    setFilterStartDate(start);
    setFilterEndDate(today);
    setPage(1);
    loadRecentLogs(1, pageSize, start, today, tableSearch);
  };

  const handlePresetAll = () => {
    setFilterPreset("ALL");
    setFilterStartDate("");
    setFilterEndDate("");
    setPage(1);
    loadRecentLogs(1, pageSize, "", "", tableSearch);
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setFilterPreset("CUSTOM");
    setFilterStartDate(start);
    setFilterEndDate(end);
    setPage(1);
    loadRecentLogs(1, pageSize, start, end, tableSearch);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    loadRecentLogs(1, newSize, filterStartDate, filterEndDate, tableSearch);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    loadRecentLogs(newPage, pageSize, filterStartDate, filterEndDate, tableSearch);
  };

  const handleTableSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    loadRecentLogs(1, pageSize, filterStartDate, filterEndDate, tableSearch);
  };

  // Generate QR Code data URL when printData is set
  useEffect(() => {
    if (printData) {
      const payload = `${printData.kanban.code}#${printData.lotNumber}#${new Date(printData.scannedAt).toISOString().slice(11, 19).replace(/:/g, "")}`;
      QRCode.toDataURL(payload, {
        width: 220,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then((url) => setPrintQrUrl(url))
        .catch((err) => console.error("Error creating QR url:", err));
    }
  }, [printData]);

  // Handle Search Submission
  const handleSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch ?? searchQuery).trim();
    if (!q) {
      setErrorMessage("Silakan ketik nomor Lot atau scan QR Code terlebih dahulu.");
      return;
    }

    setIsLoadingSearch(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await searchTraceability(q);
    setIsLoadingSearch(false);

    if (res.success && res.data && res.data.length > 0) {
      setSelectedItem(res.data[0]);
      setSuccessMessage(`Ditemukan ${res.data.length} data lot yang cocok.`);
    } else {
      setErrorMessage(res.error || "Data lot tidak ditemukan.");
    }
  };

  // Audio Beep on camera scan success
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // audio context fallback
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    const scannerId = "traceability-qr-reader";

    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }

      const html5Qr = new Html5Qrcode(scannerId);
      scannerRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          playBeep();
          setSearchQuery(decodedText);
          stopCamera();
          await handleSearch(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      setCameraError(
        "Kamera tidak dapat diakses atau izin ditolak. Silakan gunakan scanner gun USB atau ketik manual."
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Konfirmasi Terima Trolly di Stasiun Lanjutan
  const handleConfirmReceive = (location: string) => {
    if (!selectedItem) return;
    startTransitionReceive(async () => {
      const res = await confirmTraceabilityReceiving(
        selectedItem.id,
        location,
        `Dikonfirmasi oleh ${currentUser.name} (${currentUser.role})`
      );
      if (res.success) {
        setSuccessMessage(`Trolly berhasil dikonfirmasi diterima di ${location}!`);
        // update local item
        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                receivedAt: new Date().toISOString(),
                receivedLocation: location,
                receivedNotes: `Dikonfirmasi oleh ${currentUser.name}`,
              }
            : null
        );
        loadRecentLogs();
      } else {
        setErrorMessage(res.error || "Gagal mengonfirmasi penerimaan.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <QrCode className="w-6 h-6 text-sky-600" />
              Traceability & Pelacakan Lot QR Kanban
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
              Live Verified
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Lacak asal-usul part dari fisik trolly. Ketahui mesin molding pencetak, operator yang
            membuat, tanggal jam injeksi (WIB), parameter kualitas, hingga status serah-terima ke
            Plating, Painting, atau Gudang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadRecentLogs()}
            disabled={isLoadingRecent}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? "animate-spin" : ""}`} />
            Refresh Log
          </button>
        </div>
      </div>

      {/* SCANNER & SEARCH SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolom Kiri: Input Search & Tombol Kamera (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Scan atau Ketik No. Lot:</span>
              <span className="text-[10px] font-semibold text-slate-400">Scanner Gun / Kamera</span>
            </h2>

            {/* Input & Action Buttons */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="space-y-2.5"
            >
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan QR trolly atau ketik misal: LOT-20261015..."
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isLoadingSearch}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isLoadingSearch ? "Mencari Data..." : "Lacak Traceability"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isCameraActive) {
                      stopCamera();
                    } else {
                      startCamera();
                    }
                  }}
                  className={`px-3 py-2.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                    isCameraActive
                      ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                      : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isCameraActive ? "Tutup Kamera" : "Scan Kamera"}
                </button>
              </div>
            </form>

            {/* Kamera Viewport */}
            {isCameraActive && (
              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <p className="text-[11px] font-bold text-slate-300 text-center">
                  Arahkan kamera ke QR Code label trolly
                </p>
                <div
                  id="traceability-qr-reader"
                  className="w-full aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700"
                />
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full text-center text-xs text-rose-400 hover:text-rose-300 font-bold py-1"
                >
                  Batal / Matikan Kamera
                </button>
              </div>
            )}

            {cameraError && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs font-bold text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Recent Lots Quick Pills */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-500 block mb-1.5">
                Lot Terakhir Dicetak (Klik untuk Cek):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {recentLogs.slice(0, 6).map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => {
                      setSearchQuery(log.lotNumber);
                      setSelectedItem(log);
                    }}
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border transition cursor-pointer ${
                      selectedItem?.id === log.id
                        ? "bg-sky-100 text-sky-900 border-sky-400 font-black shadow-2xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {log.lotNumber} ({log.machine.code})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Guide */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-1.5 text-xs text-sky-950">
            <p className="font-extrabold flex items-center gap-1.5 text-sky-900">
              <Info className="w-4 h-4 text-sky-600" /> Format QR Code & No. Lot:
            </p>
            <p className="text-[11px] leading-relaxed text-sky-800">
              Label QR pada setiap trolly memuat kode kanban, nomor lot (tanggal + shift + no trolly),
              dan jam cetak presisi WIB. Anda dapat menggunakan kamera HP, scanner gun kasir/gudang,
              atau mengetikkan langsung kode lot di kotak pencarian.
            </p>
          </div>
        </div>

        {/* Kolom Kanan: Detail Traceability Terpilih (7 cols) */}
        <div className="lg:col-span-7">
          {selectedItem ? (
            <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
              {/* Header Lot & Status */}
              <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500 text-slate-950 tracking-wider">
                      TERVERIFIKASI SISTEM
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ID Log #{selectedItem.id}
                    </span>
                  </div>
                  <h3 className="text-lg font-black font-mono text-amber-400 tracking-wide mt-1">
                    {selectedItem.lotNumber}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintData(selectedItem)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak Label Trolly
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* 4 Pilar Traceability Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* 1. Identitas Part */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-sky-600" /> 1. Identitas Produk
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {selectedItem.part.partNo}
                    </p>
                    <p className="text-xs font-bold text-slate-600 truncate">
                      {selectedItem.part.name}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium border-t border-slate-200">
                      <span>Kuantiti / Trolly:</span>
                      <span className="font-mono font-black text-xs text-emerald-700">
                        {selectedItem.qty} pcs
                      </span>
                    </div>
                  </div>

                  {/* 2. Asal Mesin Molding */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" /> 2. Mesin Molding Pencetak
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {selectedItem.machine.code} ({selectedItem.machine.tonnage} Ton)
                    </p>
                    <p className="text-xs font-medium text-slate-500 truncate">
                      {selectedItem.machine.model || "Injection Molding Machine"}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium border-t border-slate-200">
                      <span>Cycle Time:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {selectedItem.part.cycleTimeSec} detik / shot
                      </span>
                    </div>
                  </div>

                  {/* 3. Manpower & Shift */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-600" /> 3. Operator Bertugas
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {selectedItem.operator.name}
                    </p>
                    <p className="text-xs font-mono font-bold text-slate-500">
                      NIK: {selectedItem.operator.employeeId} ({selectedItem.operator.role})
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium border-t border-slate-200">
                      <span>Regu Kerja:</span>
                      <span className="font-bold text-slate-900">
                        {selectedItem.run.shift || "Shift 1"}
                      </span>
                    </div>
                  </div>

                  {/* 4. Waktu Cetak & Status Run */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" /> 4. Waktu Cetak (WIB)
                    </span>
                    <p className="text-sm font-mono font-black text-slate-900">
                      {new Date(selectedItem.scannedAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}{" "}
                      WIB
                    </p>
                    <p className="text-xs text-slate-500 font-bold">
                      {new Date(selectedItem.scannedAt).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-medium border-t border-slate-200">
                      <span>Status Run Mesin:</span>
                      <span
                        className={`font-black text-xs ${
                          selectedItem.run.status === "RUNNING"
                            ? "text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {selectedItem.run.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Kualitas & Defect pada Run Tersebut */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      Parameter Kualitas & Histori Defect Run Mesin #{selectedItem.run.id}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-900">
                      Total Reject Mesin: {selectedItem.run.qtyReject} pcs
                    </span>
                  </div>

                  {selectedItem.run.rejects && selectedItem.run.rejects.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedItem.run.rejects.map((rej, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-white border border-amber-300 rounded text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="text-rose-600 font-black">{rej.qty} pcs</span>
                          <span>{rej.defectName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({rej.defectCode})</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-800 font-bold flex items-center gap-1 pt-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Tidak ada reject dicatat pada
                      batch run ini (Zero Defect).
                    </p>
                  )}
                </div>

                {/* Next Process & Serah Terima Antar Departemen */}
                <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-sky-800 block">
                        Destinasi Proses Selanjutnya:
                      </span>
                      <span className="text-base font-black text-sky-950 flex items-center gap-1.5">
                        <Truck className="w-4.5 h-4.5 text-sky-600" />
                        {selectedItem.part.nextProcess || "PAINTING / PLATING"}
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Status Verifikasi Kedatangan:
                      </span>
                      {selectedItem.receivedAt ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Diterima di {selectedItem.receivedLocation} pada{" "}
                            {new Date(selectedItem.receivedAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold">
                          Belum Dikonfirmasi / In-Transit
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tombol Konfirmasi Terima Cepat */}
                  {!selectedItem.receivedAt && (
                    <div className="pt-2 border-t border-sky-200 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Konfirmasi Terima:</span>
                      <button
                        type="button"
                        disabled={isPendingReceive}
                        onClick={() => handleConfirmReceive("PLATING")}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Terima di Plating
                      </button>
                      <button
                        type="button"
                        disabled={isPendingReceive}
                        onClick={() => handleConfirmReceive("PAINTING")}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Terima di Painting
                      </button>
                      <button
                        type="button"
                        disabled={isPendingReceive}
                        onClick={() => handleConfirmReceive("WAREHOUSE_FG")}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Masuk Gudang FG
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-300 shadow-2xs text-center space-y-3">
              <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-800">
                Pilih atau Scan QR Code untuk Menampilkan Traceability
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Scan label fisik trolly menggunakan kamera atau ketikkan No. Lot pada kolom
                pencarian di sebelah kiri.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TABEL LOG TROLLY SCAN TERAKHIR DENGAN FILTER TANGGAL & INDEXING PAGINASI */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
        {/* Header & Filter Controls Bar */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600" /> Riwayat Scan & Trolly Produksi Terbaru
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Gunakan filter tanggal dan paginasi terindeks agar pemuatan data cepat dan ringan.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                Total {totalCount.toLocaleString("id-ID")} Trolly
              </span>
              <button
                type="button"
                onClick={() => loadRecentLogs(page, pageSize, filterStartDate, filterEndDate, tableSearch)}
                disabled={isLoadingRecent}
                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                title="Muat Ulang Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecent ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Filter Toolbar: Presets, Date Pickers, & Table Search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> Filter:
              </span>
              <button
                type="button"
                onClick={handlePresetToday}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterPreset === "TODAY"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={handlePresetYesterday}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterPreset === "YESTERDAY"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={handlePresetLast7Days}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterPreset === "LAST_7_DAYS"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={handlePresetAll}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterPreset === "ALL"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Semua
              </button>
            </div>

            {/* Custom Date Range & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Dari:</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => handleCustomDateChange(e.target.value, filterEndDate)}
                    className="bg-transparent font-mono text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <span className="text-slate-400 font-bold">-</span>
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">S/d:</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => handleCustomDateChange(filterStartDate, e.target.value)}
                    className="bg-transparent font-mono text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Search Inside Table */}
              <form onSubmit={handleTableSearchSubmit} className="relative min-w-[190px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Cari Lot / Part / Mesin..."
                  className="w-full pl-8 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 bg-white"
                />
              </form>
            </div>
          </div>
        </div>

        {/* Table Data */}
        <div className="overflow-x-auto relative min-h-[160px]">
          {isLoadingRecent && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 py-2 rounded-xl shadow-md border border-slate-200">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                <span>Memuat data trolly terindeks...</span>
              </div>
            </div>
          )}

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-black text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">No. Lot</th>
                <th className="py-2.5 px-3">Part No & Nama</th>
                <th className="py-2.5 px-3">Mesin</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">Kuantiti</th>
                <th className="py-2.5 px-3">Waktu (WIB)</th>
                <th className="py-2.5 px-3">Status Terima</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recentLogs.length > 0 ? (
                recentLogs.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-sky-50/50 transition cursor-pointer ${
                      selectedItem?.id === item.id ? "bg-sky-50 font-bold" : ""
                    }`}
                    onClick={() => {
                      setSelectedItem(item);
                      setSearchQuery(item.lotNumber);
                    }}
                  >
                    <td className="py-2.5 px-3 font-mono font-black text-sky-900 whitespace-nowrap">
                      {item.lotNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-black text-slate-900">{item.part.partNo}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {item.part.name}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                      {item.machine.code}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {item.operator.name}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                      {item.run.shift || "Shift 1"}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-black text-emerald-800 whitespace-nowrap">
                      {item.qty} pcs
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                      {new Date(item.scannedAt).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      WIB
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.receivedAt ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {item.receivedLocation}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                          In-Transit
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintData(item);
                        }}
                        className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-md transition"
                        title="Cetak Label"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-bold space-y-1">
                    <p>Tidak ada data trolly yang sesuai dengan filter tanggal atau pencarian.</p>
                    <p className="text-[11px] font-normal text-slate-400">
                      Coba pilih filter preset &quot;Semua&quot; atau sesuaikan rentang tanggal di atas.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span>
              Menampilkan{" "}
              <strong className="text-slate-900 font-mono">
                {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
              </strong>{" "}
              -{" "}
              <strong className="text-slate-900 font-mono">
                {Math.min(page * pageSize, totalCount)}
              </strong>{" "}
              dari <strong className="text-slate-900 font-mono">{totalCount.toLocaleString("id-ID")}</strong> data
            </span>
            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-300 pl-3">
              <span className="text-[11px] text-slate-500">Per Hal:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-0.5 border border-slate-300 rounded bg-white text-xs font-bold text-slate-800 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={page <= 1 || isLoadingRecent}
              className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold transition"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-4 h-4 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoadingRecent}
              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold transition flex items-center gap-0.5 text-xs text-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </button>

            {/* Page Number Chips */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5) {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  p = start + i;
                }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageChange(p)}
                    disabled={isLoadingRecent}
                    className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-bold transition ${
                      page === p
                        ? "bg-sky-600 text-white shadow-xs"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoadingRecent}
              className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold transition flex items-center gap-0.5 text-xs text-slate-700"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={page >= totalPages || isLoadingRecent}
              className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold transition"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        </div>
      </div>

      {/* POPUP CETAK LABEL TROLLY KANBAN */}
      {printData && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-300 space-y-4 p-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-sky-600" />
                Cetak Label Kanban Trolly
              </h3>
              <button
                type="button"
                onClick={() => setPrintData(null)}
                className="text-slate-400 hover:text-slate-700 p-1 text-base font-bold"
              >
                &times;
              </button>
            </div>

            {/* Label Fisik Print Preview */}
            <div
              id="trolley-print-preview"
              className="border-2 border-slate-900 rounded-xl p-4 bg-white text-slate-900 font-sans space-y-3 print:border-none print:p-0"
            >
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block">
                    KANBAN PRODUKSI MOLDING
                  </span>
                  <h4 className="text-sm font-black tracking-tight text-slate-950">
                    TAG IDENTITAS TROLLY
                  </h4>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-400 inline-block uppercase">
                    FULL (PENUH)
                  </span>
                </div>
              </div>

              {/* No Lot */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-amber-900 block">
                    NO. LOT PRODUKSI (TRACEABILITY):
                  </span>
                  <span className="font-mono font-black text-xs text-amber-950 tracking-wide">
                    {printData.lotNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Shift:</span>
                  <span className="font-mono font-bold text-xs text-slate-800">
                    {printData.run.shift || "Shift 1"}
                  </span>
                </div>
              </div>

              {/* QR Code */}
              {printQrUrl && (
                <div className="flex flex-col items-center justify-center p-2 bg-white">
                  <img
                    src={printQrUrl}
                    alt={`QR Code ${printData.lotNumber}`}
                    className="w-32 h-32 border border-slate-200 rounded p-1"
                  />
                  <span className="font-mono text-[9px] font-extrabold text-slate-800 mt-1">
                    {printData.kanban.code}
                  </span>
                </div>
              )}

              {/* Detail Info */}
              <div className="border-t-2 border-slate-900 pt-2 space-y-1 text-xs">
                <div className="flex justify-between items-baseline border-b border-dashed border-slate-200 pb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Part No:</span>
                  <span className="font-mono font-black text-xs">{printData.part.partNo}</span>
                </div>
                <div className="border-b border-dashed border-slate-200 pb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Nama Part:
                  </span>
                  <span className="font-extrabold text-xs text-slate-900 block truncate">
                    {printData.part.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-dashed border-slate-200 pb-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Isi / Trolly:
                    </span>
                    <span className="font-mono font-black text-sm text-emerald-800">
                      {printData.qty} pcs
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Mesin Molding:
                    </span>
                    <span className="font-mono font-black text-xs">
                      {printData.machine.code}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-b border-dashed border-slate-200 pb-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Operator:
                    </span>
                    <span className="font-bold text-[11px] text-slate-800 truncate block">
                      {printData.operator.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Next Process:
                    </span>
                    <span className="font-black text-[11px] text-sky-800">
                      {printData.part.nextProcess || "PLATING"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintData(null)}
                className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
