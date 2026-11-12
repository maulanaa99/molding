"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Camera, X, CheckCircle, AlertTriangle, QrCode, Keyboard, RefreshCw, Layers } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  runId: number;
  expectedPart: {
    id: number;
    partNo: string;
    name: string;
    qtyPerTrolly: number;
    containerType?: string | null;
  };
  pairPart?: {
    id: number;
    partNo: string;
    name: string;
    qtyPerTrolly?: number;
    containerType?: string | null;
  } | null;
  pairStats?: {
    isPair: boolean;
    lhPart: any;
    rhPart: any;
    lhTrollyCount: number;
    lhQty: number;
    rhTrollyCount: number;
    rhQty: number;
    setsCount: number;
  } | null;
  moldMode?: string;
  onScanSuccess: (
    code: string,
    customQty?: number
  ) => Promise<{ success: boolean; error?: string; addedQty?: number; isPartial?: boolean }>;
  availableKanbans?: Array<{ code: string; partNo: string; qty: number }>;
  planTargetQty?: number | null;
  currentProducedQty?: number;
  trollyCount?: number;
}

function playSuccessBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz beep
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext may be restricted by browser policy if unclicked
  }
}

function playWarningAlarm() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const now = ctx.currentTime;

    // Tone 1: High alert beep (659Hz - E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Tone 2: Buzzer alert (440Hz - A4)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(440, now + 0.2);
    gain2.gain.setValueAtTime(0.35, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.45);
  } catch {
    // AudioContext may be restricted by browser policy
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  expectedPart,
  pairPart,
  pairStats,
  moldMode = "SET",
  onScanSuccess,
  availableKanbans = [],
  planTargetQty,
  currentProducedQty = 0,
  trollyCount = 0,
}: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [selectedSide, setSelectedSide] = useState<"LH" | "RH">("LH");

  const isFamilyMoldSet = (moldMode === "SET" || !moldMode) && Boolean(pairPart);

  // Tentukan mana part LH (Kiri) dan part RH (Kanan) secara tepat
  const isExpectedRH =
    expectedPart.partNo.toUpperCase().includes("RH") ||
    expectedPart.name.toUpperCase().includes("RH") ||
    expectedPart.name.toUpperCase().includes("KANAN");

  const lhPart = isFamilyMoldSet
    ? (pairStats?.lhPart || (isExpectedRH && pairPart ? pairPart : expectedPart))
    : expectedPart;

  const rhPart = isFamilyMoldSet
    ? (pairStats?.rhPart || (isExpectedRH ? expectedPart : (pairPart || expectedPart)))
    : (pairPart || expectedPart);

  const currentActivePart = isFamilyMoldSet
    ? (selectedSide === "LH" ? lhPart : rhPart)
    : expectedPart;

  const targetPerSide = typeof planTargetQty === "number" && planTargetQty > 0 ? planTargetQty : 0;
  const lhQty = isFamilyMoldSet ? (pairStats?.lhQty || 0) : currentProducedQty;
  const rhQty = isFamilyMoldSet ? (pairStats?.rhQty || 0) : currentProducedQty;

  const isLhDone = isFamilyMoldSet && targetPerSide > 0 && lhQty >= targetPerSide;
  const isRhDone = isFamilyMoldSet && targetPerSide > 0 && rhQty >= targetPerSide;

  // Auto-switch cerdas ke sisi yang BELUM selesai saat modal dibuka
  useEffect(() => {
    if (isOpen && isFamilyMoldSet) {
      if (isLhDone && !isRhDone) {
        setSelectedSide("RH");
      } else if (isRhDone && !isLhDone) {
        setSelectedSide("LH");
      }
    }
  }, [isOpen, isFamilyMoldSet, isLhDone, isRhDone]);

  // Handler pemilihan sisi dengan Alarm Suara jika memilih sisi yang sudah lengkap
  const handleSideSelect = (side: "LH" | "RH") => {
    setSelectedSide(side);
    if (side === "LH" && isLhDone && !isRhDone) {
      playWarningAlarm();
    } else if (side === "RH" && isRhDone && !isLhDone) {
      playWarningAlarm();
    }
  };

  // Deteksi trolly sisa parsial secara otomatis dari sisa target PPIC per sisi aktif
  const currentSideProduced = isFamilyMoldSet
    ? (selectedSide === "LH" ? lhQty : rhQty)
    : currentProducedQty;

  const currentSideStdQty =
    (currentActivePart as any)?.qtyPerTrolly || expectedPart.qtyPerTrolly;

  const remainingTarget =
    targetPerSide > 0
      ? Math.max(0, targetPerSide - currentSideProduced)
      : null;

  const isPartialRemaining =
    remainingTarget !== null &&
    remainingTarget > 0 &&
    remainingTarget < currentSideStdQty;

  const [useAutoRemaining, setUseAutoRemaining] = useState<boolean>(isPartialRemaining);

  const defaultQty =
    isPartialRemaining && useAutoRemaining && remainingTarget
      ? remainingTarget
      : currentSideStdQty;

  const [manualQty, setManualQty] = useState<number>(defaultQty);

  useEffect(() => {
    setUseAutoRemaining(isPartialRemaining);
  }, [isPartialRemaining]);

  // Sync manualQty saat part aktif / sisi LH-RH / target berubah
  useEffect(() => {
    const nextDef =
      isPartialRemaining && useAutoRemaining && remainingTarget
        ? remainingTarget
        : currentSideStdQty;
    setManualQty(nextDef);
  }, [selectedSide, isPartialRemaining, useAutoRemaining, remainingTarget, currentSideStdQty]);

  const effectiveQty = manualQty > 0 ? manualQty : defaultQty;

  // Nama wadah / kontainer (Trolly, Box, Rak, dll)
  const containerName = (
    (currentActivePart as any)?.containerType ||
    expectedPart.containerType ||
    "Trolly"
  ).toUpperCase();

  // Hitung nomor urut trolly berikutnya secara otomatis
  const sideTrollyCount = isFamilyMoldSet
    ? (selectedSide === "LH" ? (pairStats?.lhTrollyCount || 0) : (pairStats?.rhTrollyCount || 0))
    : (typeof trollyCount === "number" && trollyCount > 0
        ? trollyCount
        : Math.floor(currentProducedQty / (currentSideStdQty || 1)));

  const nextTrollyNum = sideTrollyCount + 1;
  const cleanPartNo = currentActivePart.partNo.replace(/[\s\/\\]+/g, "-").toUpperCase();

  // Kode otomatis sistem: KB-{PartNo}-T01, KB-{PartNo}-T02, dst.
  const autoCode = useMemo(() => {
    return `KB-${cleanPartNo}-T${String(nextTrollyNum).padStart(2, "0")}`;
  }, [cleanPartNo, nextTrollyNum]);

  // Otomatis isi manualCode dengan kode auto saat modal dibuka atau sisi LH/RH berganti
  useEffect(() => {
    if (isOpen) {
      setManualCode(autoCode);
    }
  }, [isOpen, selectedSide, autoCode]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  // Close modal with Escape key (Keyboard accessibility R-32)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Start Camera Scanner
  useEffect(() => {
    if (!isOpen || mode !== "camera") {
      stopCamera();
      return;
    }

    let isMounted = true;
    const scannerId = "html5qr-reader";

    const startScanner = async () => {
      try {
        setCameraError(null);
        // Small delay to ensure DOM container is rendered
        await new Promise((r) => setTimeout(r, 200));

        if (!isMounted) return;

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            if (isScanningRef.current) return;
            isScanningRef.current = true;
            await handleBarcodeDetected(decodedText);
            // Cooldown before scanning again
            setTimeout(() => {
              isScanningRef.current = false;
            }, 2000);
          },
          () => {
            // Scanning in progress without match
          }
        );

        if (isMounted) {
          setIsCameraActive(true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errMsg =
            err instanceof Error
              ? err.message
              : "Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan mode manual.";
          setCameraError(errMsg);
          setIsCameraActive(false);
          setMode("manual");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, mode]);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore camera stop errors
      }
      scannerRef.current = null;
      setIsCameraActive(false);
    }
  };

  const handleBarcodeDetected = async (code: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const codeToSubmit = (code || "").trim() || autoCode;
    const result = await onScanSuccess(codeToSubmit, effectiveQty);

    if (result.success) {
      playSuccessBeep();
      const stdQty = currentActivePart.qtyPerTrolly || expectedPart.qtyPerTrolly;
      const rawResData = (result as any)?.data || {};
      const added =
        typeof result.addedQty === "number"
          ? result.addedQty
          : typeof rawResData.addedQty === "number"
          ? rawResData.addedQty
          : (effectiveQty || stdQty);
      const isPartial =
        typeof result.isPartial === "boolean"
          ? result.isPartial
          : typeof rawResData.isPartial === "boolean"
          ? rawResData.isPartial
          : added < stdQty;
      const matchedPartNo = (result as any).partNo || currentActivePart.partNo;
      setSuccessMessage(
        `Berhasil catat ${containerName.toLowerCase()} ${codeToSubmit}! +${added} pcs (${matchedPartNo})${
          isPartial ? " [Parsial - Sisa Target Selesai]" : ""
        } otomatis masuk ke Stok Finish Good gudang.`
      );
      // Maju otomatis ke nomor trolly berikutnya
      const nextNum = nextTrollyNum + 1;
      setManualCode(`KB-${cleanPartNo}-T${String(nextNum).padStart(2, "0")}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3500);
    } else {
      setErrorMessage(result.error || "Gagal memproses kode kanban.");
    }
    setIsProcessing(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeToUse = manualCode.trim() || autoCode;
    if (!codeToUse) return;
    await handleBarcodeDetected(codeToUse);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-title"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-sky-600 p-2 rounded-lg text-white">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="scanner-title" className="text-base font-extrabold tracking-tight">
                Scan Kanban {((currentActivePart as any)?.containerType || expectedPart.containerType || "TROLLY").toUpperCase()}
              </h2>
              <p className="text-xs text-slate-400">
                Part Target: <span className="text-sky-300 font-mono font-bold">{expectedPart.partNo}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer tap-target"
            aria-label="Tutup Dialog Scan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Kamera vs Manual */}
        <div className="bg-slate-100 p-1.5 flex gap-1 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setMode("camera");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer tap-target ${
              mode === "camera"
                ? "bg-white text-sky-800 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kamera Barcode / QR</span>
          </button>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setErrorMessage(null);
              setMode("manual");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer tap-target ${
              mode === "manual"
                ? "bg-white text-sky-800 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Input Kode Manual</span>
          </button>
        </div>

        {/* Family Mold Selector (LH vs RH) */}
        {isFamilyMoldSet && (
          <div className="bg-indigo-50 border-b border-indigo-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-[11px] font-black uppercase text-indigo-900 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Sisi {((currentActivePart as any)?.containerType || expectedPart.containerType || "Kemasan").toUpperCase()}:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                (Target: {targetPerSide > 0 ? `${targetPerSide} Set` : "-"})
              </span>
            </div>
            <div className="flex gap-1.5 flex-1 max-w-sm">
              <button
                type="button"
                onClick={() => handleSideSelect("LH")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  selectedSide === "LH"
                    ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400"
                    : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/60"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>LH: {lhPart.partNo}</span>
                </div>
                {targetPerSide > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isLhDone
                        ? "bg-emerald-500 text-white"
                        : "bg-indigo-200/90 text-indigo-950"
                    }`}
                  >
                    {isLhDone ? "✓ 100% Lengkap" : `${lhQty}/${targetPerSide} pcs`}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSideSelect("RH")}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                  selectedSide === "RH"
                    ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400"
                    : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/60"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>RH: {rhPart.partNo}</span>
                </div>
                {targetPerSide > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isRhDone
                        ? "bg-emerald-500 text-white"
                        : isLhDone
                        ? "bg-amber-400 text-slate-950 font-black animate-pulse"
                        : "bg-indigo-200/90 text-indigo-950"
                    }`}
                  >
                    {isRhDone ? "✓ 100% Lengkap" : isLhDone ? `⚠️ BELUM (${rhQty}/${targetPerSide})` : `${rhQty}/${targetPerSide} pcs`}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* ALARM PERINGATAN JIKA MEMILIH SISI KIRI YANG SUDAH LENGKAP */}
          {selectedSide === "LH" && isLhDone && !isRhDone && (
            <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 flex items-start gap-3 shadow-md animate-pulse">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-black uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                    🚨 ALARM: Target Sisi KIRI (LH) Sudah Tercapai!
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs w-fit">
                    LH Lengkap: {lhQty} / {targetPerSide} pcs
                  </span>
                </div>
                <p className="text-xs text-rose-900 font-extrabold mt-1">
                  Perhatian Operator: Sisi KANAN (RH) belum selesai ({rhQty} / {targetPerSide} pcs)!
                </p>
                <p className="text-[11px] text-slate-700 mt-0.5">
                  Jangan sampai lupa meng-input trolly sisi KANAN (<strong>{rhPart.partNo}</strong>) agar set komplit dan tidak tertinggal.
                </p>
                <button
                  type="button"
                  onClick={() => handleSideSelect("RH")}
                  className="mt-2.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>→ Beralih ke Sisi KANAN ({rhPart.partNo}) Sekarang</span>
                </button>
              </div>
            </div>
          )}

          {/* ALARM PERINGATAN JIKA MEMILIH SISI KANAN YANG SUDAH LENGKAP */}
          {selectedSide === "RH" && isRhDone && !isLhDone && (
            <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3.5 flex items-start gap-3 shadow-md animate-pulse">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-black uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                    🚨 ALARM: Target Sisi KANAN (RH) Sudah Tercapai!
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs w-fit">
                    RH Lengkap: {rhQty} / {targetPerSide} pcs
                  </span>
                </div>
                <p className="text-xs text-rose-900 font-extrabold mt-1">
                  Perhatian Operator: Sisi KIRI (LH) belum selesai ({lhQty} / {targetPerSide} pcs)!
                </p>
                <p className="text-[11px] text-slate-700 mt-0.5">
                  Jangan sampai lupa meng-input trolly sisi KIRI (<strong>{lhPart.partNo}</strong>) agar set komplit dan tidak tertinggal.
                </p>
                <button
                  type="button"
                  onClick={() => handleSideSelect("LH")}
                  className="mt-2.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>→ Beralih ke Sisi KIRI ({lhPart.partNo}) Sekarang</span>
                </button>
              </div>
            </div>
          )}

          {/* Card Pengaturan Qty Trolly (Dapat Diisi Manual Bebas) */}
          <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label htmlFor="trolly-qty-input" className="block text-xs font-black uppercase tracking-wider text-slate-800">
                  Qty Isi {((currentActivePart as any)?.containerType || expectedPart.containerType || "Kemasan / Trolly").toUpperCase()} Ini:
                </label>
                <p className="text-[11px] text-slate-500">
                  Ubah angka jika isi fisik trolly tidak penuh atau berbeda.
                </p>
              </div>

              {/* Input Qty Manual */}
              <div className="flex items-center gap-2">
                <input
                  id="trolly-qty-input"
                  type="number"
                  min={1}
                  max={99999}
                  value={manualQty || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setManualQty(isNaN(val) ? 0 : val);
                  }}
                  className="w-28 px-3 py-1.5 rounded-lg border-2 border-sky-600 bg-white text-base font-mono font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <span className="text-xs font-bold text-slate-700">pcs</span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pintasan:</span>
              <button
                type="button"
                onClick={() => {
                  setUseAutoRemaining(false);
                  setManualQty(currentSideStdQty);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  manualQty === currentSideStdQty
                    ? "bg-slate-800 text-white shadow-2xs font-black"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                }`}
              >
                Standar Penuh ({currentSideStdQty} pcs)
              </button>

              {isPartialRemaining && remainingTarget && (
                <button
                  type="button"
                  onClick={() => {
                    setUseAutoRemaining(true);
                    setManualQty(remainingTarget);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    manualQty === remainingTarget
                      ? "bg-amber-600 text-white shadow-2xs font-black"
                      : "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
                  }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>Sisa Target PPIC ({remainingTarget} pcs)</span>
                </button>
              )}

              {manualQty !== currentSideStdQty && (!isPartialRemaining || manualQty !== remainingTarget) && (
                <span className="ml-auto text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                  ★ Qty Manual Aktif ({manualQty} pcs)
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-500 italic">
              💡 Kanban / trolly baru akan otomatis didaftarkan ke sistem saat pertama kali dicatat tanpa perlu dibuat manual di menu master data.
            </p>
          </div>

          {/* Quick Action: Catat Langsung 1-Klik Otomatis (Tampil di Mode Apapun) */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                {/* <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
                  Pencatatan Otomatis (1-Klik)
                </span> */}
                <span className="text-emerald-100 text-[11px] font-bold">
                  {containerName} #{nextTrollyNum}
                </span>
              </div>
              <p className="text-xs font-bold text-white mt-1">
                Kode: <span className="font-mono bg-black/25 px-2 py-0.5 rounded text-white font-black">{manualCode || autoCode}</span> | Qty: <span className="font-mono bg-black/25 px-2 py-0.5 rounded text-amber-300 font-black">{effectiveQty} pcs</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleBarcodeDetected(manualCode.trim() || autoCode)}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition cursor-pointer shrink-0 tap-target"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  {/* <span>Catat {containerName} Ini Langsung</span> */}
                </>
              )}
            </button>
          </div>

          {/* Status Alerts */}
          {errorMessage && (
            <div className="bg-rose-50 border-2 border-rose-300 p-3.5 rounded-xl flex items-start gap-3 text-rose-900 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-rose-950">Validasi Scan Ditolak:</p>
                <p className="mt-0.5 font-medium">{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border-2 border-emerald-300 p-3.5 rounded-xl flex items-start gap-3 text-emerald-900 text-xs">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-emerald-950">Trolly Berhasil Dicatat:</p>
                <p className="mt-0.5 font-medium">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Mode Kamera */}
          {mode === "camera" && (
            <div className="space-y-3">
              <div className="relative bg-slate-950 rounded-xl overflow-hidden min-h-[260px] flex items-center justify-center border border-slate-800">
                <div id="html5qr-reader" className="w-full" />
                {!isCameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-900">
                    <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
                    <p className="text-xs">Mempersiapkan kamera...</p>
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-900 gap-2">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs font-bold text-white">Kamera Tidak Tersedia di LAN HTTP</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Browser membatasi akses kamera di jaringan tanpa HTTPS. Silakan gunakan tab
                      &quot;Input Kode Manual&quot; di atas untuk scan/input kanban.
                    </p>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-center text-slate-500 font-medium">
                Arahkan kamera ke QR / Barcode pada kanban trolly. Qty trolly:{" "}
                <span className="font-bold text-slate-800">
                  {effectiveQty ?? expectedPart.qtyPerTrolly} pcs
                </span>
                {isPartialRemaining && useAutoRemaining && (
                  <span className="text-amber-800 font-bold ml-1">
                    (Otomatis Sisa Target)
                  </span>
                )}
                .
              </p>
            </div>
          )}

          {/* Mode Manual Input / Quick Select */}
          {mode === "manual" && (
            <div className="space-y-4">
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="code-input" className="block text-xs font-bold text-slate-700">
                    Kode Kanban / Identitas {containerName}:
                  </label>
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    ✓ Terisi Otomatis
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    id="code-input"
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder={autoCode}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border-2 border-sky-600 text-sm font-mono font-black focus:border-sky-700 bg-sky-50/40 text-slate-900 uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
                      setManualCode(`KB-${cleanPartNo}-${randSuffix}`);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                    title="Generate Kode Acak Baru"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Acak</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg text-xs font-black transition cursor-pointer tap-target shrink-0 flex items-center gap-1.5 shadow-xs"
                  >
                    {isProcessing ? "Memproses..." : "Catat Kanban"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  💡 Tidak perlu mengetik apa-apa. Kode di atas sudah otomatis terisi dan siap dicatat. Anda hanya perlu mengubahnya jika ingin memakai kode custom atau barcode fisik.
                </p>
              </form>

              {/* Daftar Kanban Terdaftar untuk Part ini (Quick Click untuk Operator di Layar Sentuh) */}
              {(() => {
                const matchingKanbans = availableKanbans.filter(
                  (kb) => kb.partNo.trim().toLowerCase() === currentActivePart.partNo.trim().toLowerCase()
                );

                return (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <p className="text-xs font-bold text-slate-700">
                      Kartu Kanban Terdaftar {isFamilyMoldSet ? `(Sisi ${selectedSide}: ${currentActivePart.partNo})` : `Part ${currentActivePart.partNo}`} ({matchingKanbans.length}):
                    </p>
                    {matchingKanbans.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {matchingKanbans.map((kb) => (
                          <button
                            key={kb.code}
                            type="button"
                            onClick={() => handleBarcodeDetected(kb.code)}
                            disabled={isProcessing}
                            className="text-left p-2.5 rounded-lg border text-xs transition cursor-pointer tap-target bg-sky-50 border-sky-300 hover:bg-sky-100 hover:border-sky-400 text-sky-950 font-bold shadow-2xs"
                          >
                            <p className="font-mono font-black text-sm text-sky-900">{kb.code}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                              {isPartialRemaining && useAutoRemaining ? (
                                <span className="text-amber-800 font-extrabold flex items-center gap-1">
                                  <span>Otomatis:</span>
                                  <span className="font-mono font-black text-amber-950 bg-amber-200/80 px-1.5 py-0.5 rounded">
                                    {remainingTarget} pcs
                                  </span>
                                  <span className="text-[10px] text-amber-900/80 font-normal">(Sisa)</span>
                                </span>
                              ) : (
                                <span>
                                  Standar: <span className="font-mono font-bold text-slate-800">{kb.qty} pcs</span>
                                </span>
                              )}
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                        Belum ada kartu kanban terdaftar khusus untuk part <strong>{currentActivePart.partNo}</strong>.
                        <br />
                        Silakan ketik kode kanban pada kolom di atas atau scan barcode trolly fisik.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <p className="text-[11px] text-slate-500">
            Jeda anti-duplikat otomatis aktif (10 detik)
          </p>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer tap-target"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
