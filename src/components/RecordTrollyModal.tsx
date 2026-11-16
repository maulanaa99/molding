"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  X,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  RotateCcw,
  Plus,
  Minus,
  Sparkles,
  Info,
} from "lucide-react";

interface RecordTrollyModalProps {
  isOpen: boolean;
  onClose: () => void;
  runId: number;
  machineCode: string;
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
  planTargetQty?: number | null;
  currentProducedQty?: number;
  trollyCount?: number;
  onConfirmRecord: (customQty?: number) => Promise<{ success: boolean; error?: string }>;
}

function playSuccessBeep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    // AudioContext may be restricted by browser policy
  }
}

export default function RecordTrollyModal({
  isOpen,
  onClose,
  machineCode,
  expectedPart,
  pairPart,
  pairStats,
  moldMode = "SET",
  planTargetQty,
  currentProducedQty = 0,
  trollyCount = 0,
  onConfirmRecord,
}: RecordTrollyModalProps) {
  const isFamilyMoldSet =
    (moldMode === "SET" || !moldMode) && Boolean(pairPart);

  // Tentukan part LH dan RH
  const isExpectedRH =
    expectedPart.partNo.toUpperCase().includes("RH") ||
    expectedPart.name.toUpperCase().includes("RH") ||
    expectedPart.name.toUpperCase().includes("KANAN");

  const lhPart = isFamilyMoldSet
    ? pairStats?.lhPart || (isExpectedRH && pairPart ? pairPart : expectedPart)
    : expectedPart;

  const rhPart = isFamilyMoldSet
    ? pairStats?.rhPart || (isExpectedRH ? expectedPart : pairPart || expectedPart)
    : pairPart || expectedPart;

  const stdCapacity = expectedPart.qtyPerTrolly || 1;
  const targetVal = typeof planTargetQty === "number" && planTargetQty > 0 ? planTargetQty : 0;

  // Hitung kuantiti tercapai saat ini & sisa target
  const currentVal = isFamilyMoldSet
    ? pairStats?.setsCount || 0
    : currentProducedQty;

  const remainingTarget = targetVal > 0 ? Math.max(0, targetVal - currentVal) : 0;
  const isSisaSedikit = targetVal > 0 && remainingTarget > 0 && remainingTarget < stdCapacity;

  // Nilai default cerdas: Jika sisa target sedikit, langsung isi sisa target!
  const smartDefaultQty = useMemo(() => {
    if (isSisaSedikit) {
      return remainingTarget;
    }
    return stdCapacity;
  }, [isSisaSedikit, remainingTarget, stdCapacity]);

  const [qtyInput, setQtyInput] = useState<number>(smartDefaultQty);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset qty input saat modal dibuka atau smart default berubah
  useEffect(() => {
    if (isOpen) {
      setQtyInput(smartDefaultQty);
      setErrorMessage(null);
    }
  }, [isOpen, smartDefaultQty]);

  if (!isOpen) return null;

  const containerLabel = (expectedPart.containerType || "Trolly").toUpperCase();
  const nextTrollyNum = (trollyCount || 0) + 1;
  const isPartial = qtyInput < stdCapacity;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (qtyInput <= 0) {
      setErrorMessage("Kuantiti per trolly harus lebih besar dari 0 pcs.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await onConfirmRecord(qtyInput);
      if (res.success) {
        playSuccessBeep();
        onClose();
      } else {
        setErrorMessage(res.error || "Gagal mencatat trolly.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mencatat trolly.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQty = (delta: number) => {
    setQtyInput((prev) => Math.max(1, prev + delta));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Catat {containerLabel} Selesai
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                  {machineCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Pencatatan hasil wadah {containerLabel.toLowerCase()} tanpa scan barcode
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info Mode Produk (Family Mold SET vs Single) */}
          {isFamilyMoldSet ? (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-600" />
                  Family Mold 1 Set (LH + RH)
                </span>
                <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                  1x Klik = Catat Sepasang
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Part Kiri (LH)</p>
                  <p className="font-extrabold text-slate-900 truncate">{lhPart.partNo}</p>
                  <p className="text-[11px] text-slate-500 truncate">{lhPart.name}</p>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono font-bold text-sky-800">
                    <span>Trl #{nextTrollyNum}</span>
                    <span>{qtyInput} pcs</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-sky-100 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Part Kanan (RH)</p>
                  <p className="font-extrabold text-slate-900 truncate">{rhPart.partNo}</p>
                  <p className="text-[11px] text-slate-500 truncate">{rhPart.name}</p>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono font-bold text-sky-800">
                    <span>Trl #{nextTrollyNum}</span>
                    <span>{qtyInput} pcs</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Part Produksi</p>
                  <p className="text-sm font-black text-slate-900">{expectedPart.partNo}</p>
                  <p className="text-xs text-slate-600 truncate">{expectedPart.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                    Wadah #{nextTrollyNum}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Standar: <strong>{stdCapacity} pcs</strong>/{containerLabel.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Target & Sisa Target Indicator */}
          {targetVal > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600 font-medium">Progress Target PPIC:</span>
                <span className="font-mono font-bold text-slate-900">
                  {currentVal} / {targetVal} {isFamilyMoldSet ? "Set" : "pcs"} (
                  {Math.min(100, Math.round((currentVal / targetVal) * 100))}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (currentVal / targetVal) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Tercapai: {currentVal}</span>
                <span className={remainingTarget <= 0 ? "text-emerald-600 font-bold" : "text-amber-700 font-bold"}>
                  {remainingTarget <= 0 ? "Target Terpenuhi" : `Sisa Target: ${remainingTarget} ${isFamilyMoldSet ? "Set" : "pcs"}`}
                </span>
              </div>
            </div>
          )}

          {/* Section Input Kuantiti dengan Smart Default */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <span>Kuantiti Isi {containerLabel} Ini:</span>
              </label>

              {/* Status Badge Default */}
              {isSisaSedikit ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Otomatis Sisa Target ({smartDefaultQty} pcs)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  Standar Penuh ({stdCapacity} pcs)
                </span>
              )}
            </div>

            {/* Stepper Input Kuantiti */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustQty(-10)}
                className="w-10 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center transition border border-slate-200 cursor-pointer"
                title="-10 pcs"
              >
                -10
              </button>
              <button
                type="button"
                onClick={() => handleAdjustQty(-1)}
                className="w-10 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center transition border border-slate-200 cursor-pointer"
                title="-1 pcs"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="number"
                  min="1"
                  max="99999"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full h-12 text-center text-xl sm:text-2xl font-black font-mono bg-white border-2 border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-hidden text-slate-900 shadow-inner"
                />
                <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-400 font-mono pointer-events-none">
                  PCS
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleAdjustQty(1)}
                className="w-10 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center transition border border-slate-200 cursor-pointer"
                title="+1 pcs"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleAdjustQty(10)}
                className="w-10 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-black text-sm flex items-center justify-center transition border border-slate-200 cursor-pointer"
                title="+10 pcs"
              >
                +10
              </button>
            </div>

            {/* Quick Reset to Default Button */}
            {qtyInput !== smartDefaultQty && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setQtyInput(smartDefaultQty)}
                  className="text-[11px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer transition py-0.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Kembalikan ke default ({smartDefaultQty} pcs)</span>
                </button>
              </div>
            )}
          </div>

          {/* Keterangan Sistem */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-500">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="leading-snug">
                {isFamilyMoldSet ? (
                  <>
                    Menyimpan <strong>1 Set Trolly</strong> (LH: {qtyInput} pcs + RH: {qtyInput} pcs). Total = <strong>{qtyInput * 2} pcs</strong>.
                  </>
                ) : (
                  <>
                    Menyimpan <strong>1 {containerLabel}</strong> ({qtyInput} pcs).
                  </>
                )}
                {isPartial && (
                  <span className="text-amber-700 font-bold block mt-0.5">
                    * Kuantiti di bawah kapasitas standar ({stdCapacity} pcs) akan otomatis ditandai sebagai PARTIAL.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || qtyInput <= 0}
            className="flex-1 sm:flex-initial px-6 py-3 rounded-xl text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting
                ? "Menyimpan..."
                : isFamilyMoldSet
                ? `Simpan 1 Set (${qtyInput} pcs LH + RH)`
                : `Simpan ${containerLabel} (${qtyInput} Pcs)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

