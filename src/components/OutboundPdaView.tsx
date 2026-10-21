"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  ShoppingCart,
  QrCode,
  Barcode,
  Camera,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Boxes,
  RotateCcw,
  Building2,
  User,
  Clock,
  Search,
  Sparkles,
  Layers,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Check,
  X,
  RefreshCw,
  Truck,
  PackageMinus,
  Info,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import {
  lookupTrolleyForOutbound,
  checkoutOutboundCart,
  getOutboundRecapReports,
  OutboundTrolleyItem,
  OutboundRecapItem,
} from "@/lib/actions";

interface OutboundPdaViewProps {
  currentUser: {
    id: number;
    name: string;
    employeeId: string;
    role: string;
    department?: string | null;
  };
  serverTimeOffset?: number;
  onStockUpdated?: () => void;
  isStandaloneMobile?: boolean;
}

const DEPARTMENTS = [
  "PAINTING 1",
  "PAINTING 2",
  "PLATING",
  "ASSEMBLY",
  "SUB ASSY",
  "DELIVERY",
  "GUDANG FG",
];

// Audio Synth Helpers
function playSuccessBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Ignore restricted policy
  }
}

function playWarningAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(440, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);
  } catch {
    // Ignore
  }
}

function playCheckoutSuccessChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 chord
    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  } catch {
    // Ignore
  }
}

export default function OutboundPdaView({
  currentUser,
  serverTimeOffset = 0,
  onStockUpdated,
  isStandaloneMobile = false,
}: OutboundPdaViewProps) {
  // Mode Tampilan: "SCANNER" (Keranjang Belanja) vs "RECAP" (Histori Rekap Pengeluaran)
  const [viewMode, setViewMode] = useState<"SCANNER" | "RECAP">("SCANNER");

  // Departemen Aktif (default dari currentUser.department jika ada, atau "PAINTING 1")
  const [selectedDept, setSelectedDept] = useState<string>(
    currentUser.department && DEPARTMENTS.includes(currentUser.department.toUpperCase())
      ? currentUser.department.toUpperCase()
      : "PAINTING 1"
  );

  // Keranjang Trolly
  const [cart, setCart] = useState<OutboundTrolleyItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Kamera Scanner
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Checkout State
  const [isCheckingOut, startTransitionCheckout] = useTransition();
  const [checkoutResult, setCheckoutResult] = useState<{
    batchNo: string;
    totalTrolly: number;
    totalQty: number;
    destination: string;
  } | null>(null);

  // Rekap Data State
  const [recapLogs, setRecapLogs] = useState<OutboundRecapItem[]>([]);
  const [isLoadingRecap, setIsLoadingRecap] = useState(false);
  const [recapDateFilter, setRecapDateFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [recapDeptFilter, setRecapDeptFilter] = useState<string>("ALL");

  // Perhitungan Akumulasi Keranjang
  const totalQtyInCart = cart.reduce((acc, item) => acc + item.qty, 0);
  const totalTrolleyCount = cart.length;

  // Auto-focus ke input field laser scanner
  useEffect(() => {
    if (viewMode === "SCANNER" && !isCameraActive) {
      inputRef.current?.focus();
    }
  }, [viewMode, isCameraActive, cart.length]);

  // Listener Global Hardware Laser Barcode Scanner (keystrokes cepat + Enter)
  useEffect(() => {
    let keyBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika sedang mengetik di input form lain selain scan
      if (
        document.activeElement &&
        document.activeElement.tagName === "INPUT" &&
        document.activeElement !== inputRef.current
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (keyBuffer.trim().length > 3) {
          e.preventDefault();
          processScanCode(keyBuffer.trim());
          keyBuffer = "";
        }
      } else if (e.key.length === 1) {
        // Laser scanners biasanya mengetik karakter dengan jeda < 30ms
        if (timeDiff > 200) {
          keyBuffer = e.key;
        } else {
          keyBuffer += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDept, cart]);

  // Proses scan barcode / lot
  const processScanCode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setErrorMessage(null);
    setWarningMessage(null);
    setSuccessToast(null);

    // Cek apakah trolly ini sudah ada di dalam keranjang
    const isAlreadyInCart = cart.some(
      (item) =>
        item.lotNumber.toUpperCase() === cleanCode.toUpperCase() ||
        (cleanCode.includes("#") && cleanCode.includes(item.lotNumber))
    );

    if (isAlreadyInCart) {
      playWarningAlarm();
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([150, 50, 150]);
      setErrorMessage(`Trolly "${cleanCode}" sudah ada di dalam keranjang!`);
      setScanInput("");
      return;
    }

    setIsSearching(true);
    const res = await lookupTrolleyForOutbound(cleanCode, selectedDept);
    setIsSearching(false);
    setScanInput("");

    if (!res.success || !res.data) {
      playWarningAlarm();
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200]);
      setErrorMessage(res.error || `Trolly tidak ditemukan untuk kode: ${cleanCode}`);
      return;
    }

    const item = res.data;

    // Cek duplikat by scanLogId
    if (cart.some((c) => c.scanLogId === item.scanLogId)) {
      playWarningAlarm();
      setErrorMessage(`Trolly ${item.lotNumber} sudah ada di dalam keranjang!`);
      return;
    }

    // Berhasil temukan trolly!
    playSuccessBeep();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([80]);

    if (item.isDeptMismatch) {
      setWarningMessage(item.mismatchWarning || "Perhatian: Alur tujuan part berbeda dengan departemen Anda!");
    } else {
      setSuccessToast(`+1 Trolly Masuk: ${item.partNo} (${item.qty} pcs)`);
    }

    setCart((prev) => [item, ...prev]);

    // Keep focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Submit scan form
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanInput.trim()) {
      processScanCode(scanInput.trim());
    }
  };

  // Hapus item dari keranjang
  const handleRemoveItem = (scanLogId: number) => {
    setCart((prev) => prev.filter((item) => item.scanLogId !== scanLogId));
    setSuccessToast("Item berhasil dihapus dari keranjang.");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Kosongkan keranjang
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Kosongkan seluruh trolly dari keranjang?")) {
      setCart([]);
      setErrorMessage(null);
      setWarningMessage(null);
      setSuccessToast("Keranjang telah dikosongkan.");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  // Eksekusi Simpan & Checkout Pengeluaran
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("Keranjang masih kosong! Silakan scan minimal 1 trolly.");
      return;
    }

    startTransitionCheckout(async () => {
      const payload = {
        items: cart.map((c) => ({
          scanLogId: c.scanLogId,
          qty: c.qty,
          lotNumber: c.lotNumber,
        })),
        destination: selectedDept,
        operatorId: currentUser.id,
        notes: `Pengeluaran ke ${selectedDept} via PDA Android`,
      };

      const res = await checkoutOutboundCart(payload);

      if (res.success && res.data) {
        playCheckoutSuccessChime();
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([100, 100, 200]);

        setCheckoutResult({
          batchNo: res.data.batchNo,
          totalTrolly: res.data.totalTrolly,
          totalQty: res.data.totalQty,
          destination: selectedDept,
        });

        // Kosongkan keranjang
        setCart([]);
        setErrorMessage(null);
        setWarningMessage(null);

        // Notifikasi refresh stok finish good ke parent
        if (onStockUpdated) {
          onStockUpdated();
        }
      } else {
        playWarningAlarm();
        setErrorMessage(res.error || "Gagal memproses checkout pengeluaran.");
      }
    });
  };

  // Kamera Scanner Functions
  const startCamera = async () => {
    setIsCameraActive(true);
    setCameraError(null);
    try {
      const html5QrCode = new Html5Qrcode("pda-qr-reader");
      scannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          stopCamera();
          processScanCode(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengakses kamera";
      setCameraError(message);
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
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Load Rekap Pengeluaran
  const loadRecapData = async () => {
    setIsLoadingRecap(true);
    const res = await getOutboundRecapReports({
      startDate: recapDateFilter,
      endDate: recapDateFilter,
      department: recapDeptFilter,
    });
    if (res.success && res.data) {
      setRecapLogs(res.data);
    }
    setIsLoadingRecap(false);
  };

  useEffect(() => {
    if (viewMode === "RECAP") {
      loadRecapData();
    }
  }, [viewMode, recapDateFilter, recapDeptFilter]);

  // Ekspor Rekap ke CSV
  const handleExportRecapCsv = () => {
    if (recapLogs.length === 0) {
      alert("Tidak ada data rekap untuk diekspor.");
      return;
    }
    let csv = "ID,Tanggal Keluar,Jam,No Batch,No Lot Trolly,Departemen Tujuan,Part No,Nama Part,Qty (Pcs),Operator Pengambil,Mesin Asal,Shift\n";
    recapLogs.forEach((r) => {
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
    link.setAttribute("download", `Rekap_Outbound_FG_${recapDateFilter}_${recapDeptFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      {/* HEADER UTAMA PDA / MOBILE */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-black">
              <PackageMinus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-sky-400 font-extrabold">
                  PDA ANDROID SCANNER
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  LIVE OUT
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Pengeluaran Finish Good
              </h1>
            </div>
          </div>

          {/* Toggle View Mode: Scanner vs Rekap */}
          <div className="flex bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode("SCANNER")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === "SCANNER"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Scan Cart</span>
            </button>
            <button
              onClick={() => setViewMode("RECAP")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === "RECAP"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Rekap</span>
            </button>
          </div>
        </div>

        {/* IDENTITAS OPERATOR & PILIHAN DEPARTEMEN NEXT PROCESS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          {/* Departemen Pemilih */}
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <label className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center gap-1 mb-1">
              <Building2 className="w-3 h-3 text-sky-400" />
              Departemen Anda (Next Process):
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-900 text-amber-300 font-black text-sm px-3 py-2 rounded-lg border border-slate-700 focus:outline-hidden focus:border-amber-400"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Operator Bertugas */}
          <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400 flex items-center gap-1 mb-0.5">
                <User className="w-3 h-3 text-emerald-400" />
                Operator Bertugas:
              </span>
              <p className="font-black text-sm text-white truncate">{currentUser.name}</p>
              <p className="text-[10px] font-mono text-slate-400">NIK: {currentUser.employeeId}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px] font-bold">
                {currentUser.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE: SCANNER & SUPERMARKET CART */}
      {viewMode === "SCANNER" && (
        <>
          {/* SCANNER INPUT CARD (HARDWARE SCANNER & KAMERA) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-sky-600" />
                  Scan Barcode / QR Label Trolly:
                </label>
                <button
                  type="button"
                  onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer ${
                    isCameraActive
                      ? "bg-rose-100 text-rose-700 border border-rose-300"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isCameraActive ? "Tutup Kamera" : "Kamera PDA"}</span>
                </button>
              </div>

              {/* Input Field dengan Listener Autofocus */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Arahkan laser scanner PDA ke QR / Ketik No. Lot..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  disabled={isSearching || isCheckingOut}
                  className="w-full pl-10 pr-24 py-3 bg-slate-50 border-2 border-sky-500 rounded-xl font-mono font-bold text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-sky-100 transition shadow-inner"
                />
                <QrCode className="w-5 h-5 text-sky-600 absolute left-3 top-3.5" />
                <button
                  type="submit"
                  disabled={isSearching || !scanInput.trim()}
                  className="absolute right-2 top-2 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-black text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? "Mencari..." : "+ Masuk"}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                Tekan tombol fisik laser PDA Android atau gunakan kamera untuk men-scan label trolly.
              </p>
            </form>

            {/* Kamera View Box */}
            {isCameraActive && (
              <div className="mt-3 p-3 bg-slate-900 rounded-xl text-center">
                <div id="pda-qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg" />
                {cameraError && <p className="text-xs text-rose-400 mt-2 font-bold">{cameraError}</p>}
                <p className="text-[11px] text-slate-400 mt-2">
                  Arahkan kamera ke QR Code label trolly
                </p>
              </div>
            )}
          </div>

          {/* NOTIFIKASI ERROR / WARNING / TOAST */}
          {errorMessage && (
            <div className="bg-rose-50 border-2 border-rose-500 text-rose-900 p-3 rounded-xl flex items-start gap-2.5 shadow-sm animate-shake">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-black text-rose-950 uppercase tracking-wide">Peringatan Scan:</p>
                <p className="font-semibold mt-0.5">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-800 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {warningMessage && (
            <div className="bg-amber-50 border-2 border-amber-500 text-amber-950 p-3 rounded-xl flex items-start gap-2.5 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-black uppercase tracking-wide">Perbedaan Departemen Tujuan:</p>
                <p className="font-semibold mt-0.5">{warningMessage}</p>
              </div>
              <button
                onClick={() => setWarningMessage(null)}
                className="text-amber-600 hover:text-amber-950 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {successToast && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{successToast}</span>
              </div>
              <button
                onClick={() => setSuccessToast(null)}
                className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* RINGKASAN KERANJANG TROLLY (SUPERMARKET CART HEADER) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-sky-600" />
                <h2 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                  Keranjang Trolly Pengeluaran
                </h2>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>
              )}
            </div>

            {/* Counter Badges Besar */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-black uppercase text-sky-700 tracking-wider block">
                  Total Trolly
                </span>
                <span className="text-2xl font-black text-sky-950 font-mono">
                  {totalTrolleyCount} <span className="text-xs font-bold text-sky-700">Trolly</span>
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">
                  Total Kuantiti (Qty)
                </span>
                <span className="text-2xl font-black text-emerald-950 font-mono">
                  {totalQtyInCart.toLocaleString("id-ID")}{" "}
                  <span className="text-xs font-bold text-emerald-700">Pcs</span>
                </span>
              </div>
            </div>

            {/* DAFTAR ITEM TROLLY DALAM KERANJANG */}
            {cart.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-600">Keranjang Pengeluaran Masih Kosong</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Silakan scan QR label trolly yang diambil dari buffer Finish Good molding.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {cart.map((item, index) => (
                  <div
                    key={item.scanLogId}
                    className={`p-3 rounded-xl border transition ${
                      item.isDeptMismatch
                        ? "bg-amber-50/70 border-amber-300"
                        : "bg-slate-50 border-slate-200 hover:border-sky-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {cart.length - index}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                              {item.lotNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                item.isDeptMismatch
                                  ? "bg-amber-200 text-amber-900"
                                  : "bg-sky-100 text-sky-800"
                              }`}
                            >
                              Tujuan: {item.nextProcess}
                            </span>
                          </div>
                          <p className="font-mono font-extrabold text-sm text-slate-900 mt-1">
                            {item.partNo}
                          </p>
                          <p className="text-xs text-slate-600 font-semibold line-clamp-1">
                            {item.partName}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                            <span>Mesin: {item.machineCode}</span>
                            <span>•</span>
                            <span>{item.shift}</span>
                            <span>•</span>
                            <span>Molding: {item.operatorName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Qty & Action Hapus */}
                      <div className="text-right shrink-0 flex flex-col items-end justify-between">
                        <span className="font-mono font-black text-base text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                          {item.qty} pcs
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.scanLogId)}
                          className="mt-2 text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus trolly ini dari keranjang"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STICKY BOTTOM CHECKOUT BUTTON */}
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-300 shadow-2xl z-40">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <div className="hidden sm:block text-xs">
                <span className="text-slate-500 block">Kirim ke:</span>
                <span className="font-black text-slate-900">{selectedDept}</span>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut || cart.length === 0}
                className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-black text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/25"
              >
                {isCheckingOut ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>MEMPROSES PENGELUARAN...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      SIMPAN & KELUARKAN ({totalTrolleyCount} TROLLY • {totalQtyInCart} PCS)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* VIEW MODE: REKAP HISTORI PENGELUARAN */}
      {viewMode === "RECAP" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-black text-base text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-600" />
                <span>Rekapitulasi Pengeluaran Finish Good</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Histori scan trolly yang dikeluarkan ke next process.
              </p>
            </div>
            <button
              onClick={handleExportRecapCsv}
              disabled={recapLogs.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 block mb-1">Tanggal Transaksi:</label>
              <input
                type="date"
                value={recapDateFilter}
                onChange={(e) => setRecapDateFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Departemen Tujuan:</label>
              <select
                value={recapDeptFilter}
                onChange={(e) => setRecapDeptFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
              >
                <option value="ALL">Semua Departemen</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ringkasan Rekap */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">
              Total Ditemukan: <span className="font-black text-slate-900">{recapLogs.length} Trolly</span>
            </span>
            <span className="font-bold text-slate-600">
              Total Qty:{" "}
              <span className="font-black text-emerald-700 font-mono">
                {recapLogs.reduce((acc, r) => acc + r.qty, 0).toLocaleString("id-ID")} pcs
              </span>
            </span>
          </div>

          {/* Tabel / Card List Rekap */}
          {isLoadingRecap ? (
            <div className="text-center py-10">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-bold">Memuat rekapitulasi pengeluaran...</p>
            </div>
          ) : recapLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Boxes className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-xs">Tidak ada data pengeluaran pada filter ini.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
              {recapLogs.map((log) => {
                const d = new Date(log.outDate);
                const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                          {log.lotNumber || `ID #${log.id}`}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-100 text-sky-800">
                          {log.destination || "NEXT PROCESS"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {timeStr} WIB
                        </span>
                      </div>
                      <p className="font-mono font-black text-slate-900 text-sm mt-1">
                        {log.part.partNo}
                      </p>
                      <p className="text-slate-600 truncate">{log.part.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                        <span>Pengambil: {log.operator?.name || "Operator"}</span>
                        <span>•</span>
                        <span>Batch: {log.batchNo || "-"}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg block">
                        {log.qty} pcs
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* POPUP / MODAL SUKSES CHECKOUT */}
      {checkoutResult && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-lg font-black text-slate-900">PENGELUARAN BERHASIL!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Stok finish good telah otomatis dipotong sesuai trolly yang dikeluarkan.
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 my-4 text-left border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">No. Batch:</span>
                <span className="font-mono font-black text-slate-900">{checkoutResult.batchNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Departemen Tujuan:</span>
                <span className="font-black text-sky-800">{checkoutResult.destination}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Total Trolly:</span>
                <span className="font-mono font-black text-slate-900">{checkoutResult.totalTrolly} Trolly</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-700 font-extrabold">Total Kuantiti:</span>
                <span className="font-mono font-black text-sm text-emerald-700">
                  {checkoutResult.totalQty.toLocaleString("id-ID")} pcs
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCheckoutResult(null);
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 50);
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs transition cursor-pointer"
            >
              SCAN TROLLY BERIKUTNYA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
