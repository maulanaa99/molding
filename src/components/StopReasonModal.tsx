"use client";

import React, { useState, useEffect } from "react";
import { AlertOctagon, X, Check, FileText, CheckCircle2, AlertTriangle } from "lucide-react";

export interface StopReasonItem {
  id: number;
  code?: string | null;
  category: string;
  reason: string;
}

interface StopReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineCode: string;
  partNo: string;
  stopReasons: StopReasonItem[];
  onSubmitStop: (data: {
    stopReasonId: number;
    remainderQty: number;
    qtyReject: number;
    notes: string;
  }) => Promise<{ success: boolean; error?: string }>;
  currentQty?: number;
  scanCount?: number;
}

export default function StopReasonModal({
  isOpen,
  onClose,
  machineCode,
  partNo,
  stopReasons,
  onSubmitStop,
  currentQty = 0,
  scanCount = 0,
}: StopReasonModalProps) {
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [remainderQty, setRemainderQty] = useState<number>(0);
  const [qtyReject, setQtyReject] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  // Group categories with "Selesai Produksi" prioritized right after "Semua"
  const rawCategories = Array.from(new Set(stopReasons.map((r) => r.category)));
  const hasSelesai = rawCategories.some(
    (c) => c === "Selesai Produksi" || c.toLowerCase().includes("selesai")
  );
  const otherCats = rawCategories.filter(
    (c) => c !== "Selesai Produksi" && !c.toLowerCase().includes("selesai")
  );
  const categories = [
    "Semua",
    ...(hasSelesai ? ["Selesai Produksi"] : []),
    ...otherCats,
  ];

  const filteredReasons =
    selectedCategory === "Semua"
      ? stopReasons
      : stopReasons.filter((r) => r.category === selectedCategory);

  const selectedReasonObj = stopReasons.find((r) => r.id === selectedReasonId);
  const isSelesaiProduksi = Boolean(
    selectedReasonObj &&
    (selectedReasonObj.category === "Selesai Produksi" ||
      selectedReasonObj.category === "Selesai" ||
      selectedReasonObj.reason.toLowerCase().includes("selesai produksi") ||
      selectedReasonObj.reason.toLowerCase().includes("selesai"))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReasonId) {
      setErrorMessage("Silakan pilih salah satu alasan stop terlebih dahulu.");
      return;
    }

    // Poka-Yoke: Jika memilih Selesai Produksi / Selesai Job, wajib ada kuantiti output scan atau sisa part
    if (isSelesaiProduksi) {
      const totalAccounted =
        (currentQty || 0) + (scanCount || 0) + Math.max(0, Number(remainderQty) || 0);
      if (totalAccounted === 0) {
        setErrorMessage(
          "Tidak dapat memilih Selesai Produksi: Part ini belum memiliki input scan kuantiti trolly atau sisa part. Silakan scan trolly terlebih dahulu atau isi kuantiti pada kolom Sisa Qty Trolly jika ada sisa part."
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await onSubmitStop({
      stopReasonId: selectedReasonId,
      remainderQty: Math.max(0, Number(remainderQty) || 0),
      qtyReject: Math.max(0, Number(qtyReject) || 0),
      notes: notes.trim(),
    });

    setIsSubmitting(false);
    if (!res.success) {
      setErrorMessage(res.error || "Gagal menghentikan mesin.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-300 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-modal-title"
      >
        {/* Header */}
        <div
          className={`text-white px-5 py-4 flex items-center justify-between border-b transition-colors ${
            isSelesaiProduksi
              ? "bg-emerald-700 border-emerald-800"
              : "bg-rose-700 border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-2 rounded-lg text-white">
              {isSelesaiProduksi ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertOctagon className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 id="stop-modal-title" className="text-base font-extrabold tracking-tight">
                {isSelesaiProduksi ? "Selesai Produksi / Ganti Job: " : "Hentikan Mesin: "}
                {machineCode}
              </h2>
              <p className="text-xs text-white/90 font-mono">
                Part Terakhir: {partNo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer tap-target"
            aria-label="Batal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-rose-900 text-xs font-bold">
              {errorMessage}
            </div>
          )}

          {/* 1. Pilih Kategori Alasan Stop */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              1. Pilih Kategori Alasan Stop (Wajib):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelesaiCat = cat === "Selesai Produksi" || cat.toLowerCase().includes("selesai");
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer tap-target ${
                      isSelected
                        ? isSelesaiCat
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-rose-600 text-white shadow-xs"
                        : isSelesaiCat
                        ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    {isSelesaiCat ? `✓ ${cat}` : cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Daftar Alasan Stop Spesifik */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              2. Pilih Alasan Stop Spesifik:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
              {filteredReasons.map((sr) => {
                const isSelected = selectedReasonId === sr.id;
                const isThisSelesai =
                  sr.category === "Selesai Produksi" ||
                  sr.category === "Selesai" ||
                  sr.reason.toLowerCase().includes("selesai produksi") ||
                  sr.reason.toLowerCase().includes("selesai");

                return (
                  <button
                    key={sr.id}
                    type="button"
                    onClick={() => setSelectedReasonId(sr.id)}
                    className={`text-left p-3 rounded-lg border text-xs transition cursor-pointer tap-target flex items-start justify-between gap-2 ${
                      isSelected
                        ? isThisSelesai
                          ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-extrabold ring-2 ring-emerald-500/20"
                          : "bg-rose-50 border-rose-500 text-rose-950 font-extrabold ring-2 ring-rose-500/20"
                        : isThisSelesai
                        ? "bg-emerald-50/40 border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                        : "bg-white border-slate-200 text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        {sr.code && (
                          <span
                            className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded border ${
                              isThisSelesai
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : "bg-slate-200 text-slate-900 border-slate-300"
                            }`}
                          >
                            {sr.code}
                          </span>
                        )}
                        <span
                          className={`text-[10px] uppercase font-bold block ${
                            isThisSelesai ? "text-emerald-700" : "text-slate-400"
                          }`}
                        >
                          {sr.category}
                        </span>
                      </div>
                      <span className="font-medium text-xs text-slate-900">{sr.reason}</span>
                    </div>
                    {isSelected && (
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isThisSelesai ? "text-emerald-600" : "text-rose-600"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner Informasi Status IDLE vs DOWN */}
          {selectedReasonObj && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                isSelesaiProduksi
                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              {isSelesaiProduksi ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-extrabold">
                  {isSelesaiProduksi
                    ? "Status Mesin Menjadi IDLE (Siap Produksi Baru)"
                    : "Status Mesin Menjadi DOWN (Downtime Berjalan)"}
                </p>
                <p className="text-[11px] leading-relaxed">
                  {isSelesaiProduksi
                    ? "Karena alasan adalah Selesai Produksi, mesin akan langsung berstatus IDLE (siap menerima job/part selanjutnya) dan rencana job ditandai Selesai (COMPLETED)."
                    : "Mesin akan tercatat mengalami downtime (DOWN) hari ini sampai operator menekan START untuk part baru."}
                </p>
              </div>
            </div>
          )}

          {/* 3. Input Sisa Pcs & Reject Pcs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label htmlFor="remainder-input" className="block text-xs font-bold text-slate-800 mb-1">
                Sisa Pcs (Trolly Belum Penuh):
              </label>
              <input
                id="remainder-input"
                type="number"
                min="0"
                value={remainderQty}
                onChange={(e) => setRemainderQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold focus:border-rose-600 tabular-numbers"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Pcs pada trolly terakhir yang belum mencapai standar trolly penuh.
              </p>
            </div>

            <div>
              <label htmlFor="reject-input" className="block text-xs font-bold text-slate-800 mb-1">
                Qty Reject (Pcs Rusak/Cacat):
              </label>
              <input
                id="reject-input"
                type="number"
                min="0"
                value={qtyReject}
                onChange={(e) => setQtyReject(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono font-bold focus:border-rose-600 tabular-numbers"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                Total part yang di-reject selama run ini.
              </p>
            </div>
          </div>

          {/* 4. Catatan Tambahan (Opsional) */}
          <div>
            <label htmlFor="notes-input" className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Catatan Tindakan / Deskripsi (Opsional):
            </label>
            <input
              id="notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isSelesaiProduksi
                  ? "Contoh: Target 1000 pcs selesai, mold siap diganti..."
                  : "Contoh: Mold dibersihkan teknisi maintenance..."
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-rose-600"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer tap-target"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedReasonId}
              className={`px-6 py-2.5 rounded-lg text-xs font-extrabold transition shadow-sm cursor-pointer tap-target flex items-center gap-2 ${
                isSelesaiProduksi
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30"
                  : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30"
              } disabled:bg-slate-300`}
            >
              {isSubmitting
                ? "Menyimpan Data..."
                : isSelesaiProduksi
                ? "Konfirmasi Selesai & Set IDLE"
                : "Konfirmasi STOP (Downtime)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
