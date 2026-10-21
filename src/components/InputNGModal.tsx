"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AlertCircle, X, Check, Save, AlertTriangle, Layers, Split, Cpu } from "lucide-react";

export interface DefectTypeItem {
  id: number;
  code: string;
  name: string;
  category: string | null;
}

export interface PartInfo {
  id: number;
  partNo: string;
  name: string;
  cavity?: number;
  pairPartId?: number | null;
}

interface InputNGModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineCode: string;
  runId: number;
  // Part information
  mainPart: PartInfo;
  pairPart?: PartInfo | null;
  isSetMode?: boolean; // True ONLY if Family Mold AND mold mode is SET
  moldMode?: string | null; // "SET", "SINGLE_LH", "SINGLE_RH", "STANDARD"
  // Legacy fallback props
  partNo?: string;
  partName?: string;
  defectTypes: DefectTypeItem[];
  currentRejects: Array<{ defectTypeId: number; qty: number; partId?: number }>;
  onSaveRejects: (
    runId: number,
    rejects: Array<{ defectTypeId: number; qty: number; partId?: number }>
  ) => Promise<{ success: boolean; error?: string; totalReject?: number }>;
}

function getInitialQuantities(
  defectTypes: DefectTypeItem[],
  currentRejects: Array<{ defectTypeId: number; qty: number; partId?: number }>,
  mainPartId: number,
  pairPartId?: number | null
): Record<string, number> {
  const qMap: Record<string, number> = {};

  // Initialize for main part
  defectTypes.forEach((dt) => {
    qMap[`${mainPartId}_${dt.id}`] = 0;
  });

  // Initialize for pair part if present
  if (pairPartId) {
    defectTypes.forEach((dt) => {
      qMap[`${pairPartId}_${dt.id}`] = 0;
    });
  }

  // Populate from existing rejects
  currentRejects.forEach((r) => {
    const pId = r.partId || mainPartId;
    qMap[`${pId}_${r.defectTypeId}`] = r.qty;
  });

  return qMap;
}

export default function InputNGModal({
  isOpen,
  onClose,
  machineCode,
  runId,
  mainPart: propMainPart,
  pairPart: propPairPart,
  isSetMode = false,
  moldMode = "STANDARD",
  partNo: fallbackPartNo,
  partName: fallbackPartName,
  defectTypes,
  currentRejects,
  onSaveRejects,
}: InputNGModalProps) {
  // Normalize main part object
  const mainPart: PartInfo = propMainPart || {
    id: 0,
    partNo: fallbackPartNo || "-",
    name: fallbackPartName || "-",
    cavity: 1,
    pairPartId: null,
  };

  const pairPart = propPairPart || null;

  // Active side tab for Family Mold SET mode (defaults to mainPart.id)
  const [activeTabPartId, setActiveTabPartId] = useState<number>(mainPart.id);

  // Map of `${partId}_${defectTypeId}` -> quantity
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    getInitialQuantities(defectTypes, currentRejects, mainPart.id, pairPart?.id)
  );
  const [initialSnapshot, setInitialSnapshot] = useState<Record<string, number>>(() =>
    getInitialQuantities(defectTypes, currentRejects, mainPart.id, pairPart?.id)
  );
  const [prevRunId, setPrevRunId] = useState(runId);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");

  // Prompt confirmation when closing with unsaved edits
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  // Sync if runId changes (React 19 pattern: adjust during render)
  if (runId !== prevRunId) {
    setPrevRunId(runId);
    setActiveTabPartId(mainPart.id);
    const fresh = getInitialQuantities(defectTypes, currentRejects, mainPart.id, pairPart?.id);
    setQuantities(fresh);
    setInitialSnapshot(fresh);
    setErrorMessage(null);
    setSaveSuccess(false);
    setShowUnsavedPrompt(false);
  }

  // Determine operational scenario
  // 1. Family Mold SET Mode: pairPart exists & isSetMode === true
  const isFamilyMoldSet = Boolean(isSetMode && pairPart);
  // 2. Family Mold SINGLE Mode: pairPartId exists, but isSetMode is false
  const isFamilyMoldSingle = Boolean(mainPart.pairPartId && !isSetMode);
  // 3. Multi-Cavity Reguler (2 Part yang Sama): no pairPartId, cavity > 1
  const isMultiCavitySamePart = Boolean(!mainPart.pairPartId && (mainPart.cavity || 1) > 1);
  // 4. Single Cavity Reguler: no pairPartId, cavity <= 1
  const isSingleCavity = !mainPart.pairPartId && (mainPart.cavity || 1) <= 1;

  // Side detection for labels (RH vs LH)
  const isMainPartRh =
    mainPart.partNo.toUpperCase().includes("RH") ||
    mainPart.name.toUpperCase().includes("RH") ||
    (!mainPart.partNo.toUpperCase().includes("LH") && !mainPart.name.toUpperCase().includes("LH"));

  const mainSideLabel = isMainPartRh ? "Sisi Kanan (RH)" : "Sisi Kiri (LH)";
  const pairSideLabel = isMainPartRh ? "Sisi Kiri (LH)" : "Sisi Kanan (RH)";

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const relevantPartIds = [mainPart.id];
    if (isFamilyMoldSet && pairPart) relevantPartIds.push(pairPart.id);

    return relevantPartIds.some((pId) =>
      defectTypes.some((dt) => {
        const key = `${pId}_${dt.id}`;
        const curr = quantities[key] || 0;
        const initial = initialSnapshot[key] || 0;
        return curr !== initial;
      })
    );
  }, [quantities, initialSnapshot, defectTypes, mainPart.id, isFamilyMoldSet, pairPart]);

  // Calculate live total NG per side
  const totalMainNG = useMemo(() => {
    return defectTypes.reduce((acc, dt) => acc + (quantities[`${mainPart.id}_${dt.id}`] || 0), 0);
  }, [quantities, defectTypes, mainPart.id]);

  const totalPairNG = useMemo(() => {
    if (!pairPart) return 0;
    return defectTypes.reduce((acc, dt) => acc + (quantities[`${pairPart.id}_${dt.id}`] || 0), 0);
  }, [quantities, defectTypes, pairPart]);

  const totalNG = useMemo(() => {
    return isFamilyMoldSet ? totalMainNG + totalPairNG : totalMainNG;
  }, [isFamilyMoldSet, totalMainNG, totalPairNG]);

  const initialTotalNG = useMemo(() => {
    const mainInit = defectTypes.reduce(
      (acc, dt) => acc + (initialSnapshot[`${mainPart.id}_${dt.id}`] || 0),
      0
    );
    if (!isFamilyMoldSet || !pairPart) return mainInit;
    const pairInit = defectTypes.reduce(
      (acc, dt) => acc + (initialSnapshot[`${pairPart.id}_${dt.id}`] || 0),
      0
    );
    return mainInit + pairInit;
  }, [initialSnapshot, defectTypes, mainPart.id, isFamilyMoldSet, pairPart]);

  // Active side part details
  const activePart =
    isFamilyMoldSet && pairPart && activeTabPartId === pairPart.id ? pairPart : mainPart;
  const activeSideName =
    isFamilyMoldSet && pairPart && activeTabPartId === pairPart.id
      ? pairSideLabel
      : isFamilyMoldSet
      ? mainSideLabel
      : "";

  // Handle close attempt: intercept if there are unsaved edits
  const handleAttemptClose = () => {
    if (isSaving) return;
    if (hasUnsavedChanges) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  // Keyboard accessibility: Escape triggers safe close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving) {
        if (showUnsavedPrompt) {
          setShowUnsavedPrompt(false);
        } else if (hasUnsavedChanges) {
          setShowUnsavedPrompt(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, hasUnsavedChanges, showUnsavedPrompt, onClose]);

  // Adjust quantity for active tab part
  const handleAdjust = (defectId: number, delta: number) => {
    const targetPartId = isFamilyMoldSet ? activeTabPartId : mainPart.id;
    const key = `${targetPartId}_${defectId}`;
    setQuantities((prev) => {
      const current = prev[key] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [key]: updated };
    });
    setSaveSuccess(false);
  };

  const handleSetDirect = (defectId: number, val: number) => {
    const targetPartId = isFamilyMoldSet ? activeTabPartId : mainPart.id;
    const key = `${targetPartId}_${defectId}`;
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
    setSaveSuccess(false);
  };

  // Save logic
  const handlePerformSave = async (shouldCloseAfter: boolean = true) => {
    setIsSaving(true);
    setErrorMessage(null);

    const payload: Array<{ defectTypeId: number; qty: number; partId?: number }> = [];

    // Main part rejects
    defectTypes.forEach((dt) => {
      const q = quantities[`${mainPart.id}_${dt.id}`] || 0;
      payload.push({
        defectTypeId: dt.id,
        qty: Math.max(0, q),
        partId: mainPart.id,
      });
    });

    // Pair part rejects (if Family Mold SET mode)
    if (isFamilyMoldSet && pairPart) {
      defectTypes.forEach((dt) => {
        const q = quantities[`${pairPart.id}_${dt.id}`] || 0;
        payload.push({
          defectTypeId: dt.id,
          qty: Math.max(0, q),
          partId: pairPart.id,
        });
      });
    }

    const res = await onSaveRejects(runId, payload);
    setIsSaving(false);

    if (res.success) {
      setInitialSnapshot({ ...quantities });
      setShowUnsavedPrompt(false);
      setSaveSuccess(true);
      if (shouldCloseAfter) {
        setTimeout(() => {
          onClose();
        }, 350);
      }
    } else {
      setErrorMessage(res.error || "Gagal menyimpan data NG ke server.");
    }
  };

  // Category grouping
  const getNormalizedCategory = (rawCat?: string | null): string => {
    if (!rawCat) return "Lainnya";
    const lower = rawCat.toLowerCase();
    if (lower.includes("setting") || lower.includes("gate") || lower.includes("cooling")) {
      return "Setting & Parameter";
    }
    if (lower.includes("material") || lower.includes("moisture") || lower.includes("temperature")) {
      return "Material";
    }
    if (lower.includes("mold") || lower.includes("clamping") || lower.includes("handling")) {
      return "Mold & Mekanikal";
    }
    return "Lainnya";
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    defectTypes.forEach((d) => {
      set.add(getNormalizedCategory(d.category));
    });
    return ["Semua", ...Array.from(set)];
  }, [defectTypes]);

  const filteredDefects = useMemo(() => {
    if (selectedCategory === "Semua") return defectTypes;
    return defectTypes.filter((d) => getNormalizedCategory(d.category) === selectedCategory);
  }, [defectTypes, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-300 flex flex-col max-h-[92vh] relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ng-modal-title"
      >
        {/* Header - Industrial Amber / Orange for Defect Recording */}
        <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between border-b border-amber-700">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg text-white shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="ng-modal-title" className="text-lg font-black tracking-tight">
                  Pencatatan Part NG (Defect)
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-white text-slate-900">
                  {machineCode}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded font-bold uppercase bg-amber-800 text-amber-100">
                  Mesin Tetap Jalan
                </span>
              </div>
              <p className="text-xs text-amber-100 font-medium">
                Part: <span className="font-bold">{mainPart.partNo}</span> &bull; {mainPart.name}
              </p>
            </div>
          </div>

          <button
            onClick={handleAttemptClose}
            disabled={isSaving}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
            aria-label="Tutup Modal NG"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operational Mode Header Banner (Distinguishes Family Set, Family Single, Multi-Cavity Reguler, Single Cavity) */}
        <div className="bg-slate-900 text-white px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {isFamilyMoldSet ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                <Split className="w-3.5 h-3.5" />
                Family Mold: Mode 1 Set (LH & RH)
              </span>
            ) : isFamilyMoldSingle ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-blue-500 text-white">
                <Cpu className="w-3.5 h-3.5" />
                Family Mold: Mode Single ({moldMode === "SINGLE_LH" ? "Sisi Kiri / LH" : "Sisi Kanan / RH"})
              </span>
            ) : isMultiCavitySamePart ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-indigo-500 text-white">
                <Layers className="w-3.5 h-3.5" />
                Multi-Cavity: 2 Part yang Sama (Cavity: {mainPart.cavity})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-slate-700 text-slate-200">
                Single Part Reguler (Cavity: 1)
              </span>
            )}

            <span className="text-xs text-slate-400 hidden md:inline">
              {isFamilyMoldSet
                ? "1 Kali shot = 1 Part Kanan (RH) + 1 Part Kiri (LH)"
                : isFamilyMoldSingle
                ? "1 Cavity ditutup. Semua defect tercatat untuk sisi aktif ini"
                : isMultiCavitySamePart
                ? "1 Kali shot mencetak 2 pcs part yang sama persis"
                : "Standar single cavity part"}
            </span>
          </div>

          {/* Live Total NG Display */}
          <div className="flex items-center gap-3 shrink-0">
            {isFamilyMoldSet && (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                  {isMainPartRh ? "RH" : "LH"}: <b className="text-amber-400">{totalMainNG}</b>
                </span>
                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                  {isMainPartRh ? "LH" : "RH"}: <b className="text-amber-400">{totalPairNG}</b>
                </span>
              </div>
            )}
            <div className="bg-amber-500 text-slate-950 px-3 py-1 rounded-lg font-mono font-black text-sm flex items-center gap-1.5 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-900">Total NG:</span>
              <span className="tabular-numbers text-base">{totalNG}</span>
              <span className="text-xs font-semibold">pcs</span>
            </div>
          </div>
        </div>

        {/* TABS SELECTOR: ONLY SHOWN FOR FAMILY MOLD SET MODE */}
        {isFamilyMoldSet && pairPart && (
          <div className="bg-amber-50/80 border-b border-amber-200 px-5 py-3">
            <p className="text-[11px] font-bold text-amber-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              Pilih Sisi Part yang Mengalami Defect (NG):
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* Tab Sisi 1: Main Part (biasanya RH) */}
              <button
                type="button"
                onClick={() => setActiveTabPartId(mainPart.id)}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                  activeTabPartId === mainPart.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        activeTabPartId === mainPart.id
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {mainSideLabel}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold truncate mt-1">{mainPart.partNo}</p>
                  <p
                    className={`text-[11px] truncate ${
                      activeTabPartId === mainPart.id ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {mainPart.name}
                  </p>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-lg font-mono font-black text-sm shrink-0 ${
                    activeTabPartId === mainPart.id
                      ? "bg-slate-800 text-amber-400 border border-slate-700"
                      : "bg-slate-100 text-slate-900 border border-slate-200"
                  }`}
                >
                  {totalMainNG} <span className="text-[10px] font-normal">NG</span>
                </div>
              </button>

              {/* Tab Sisi 2: Pair Part (biasanya LH) */}
              <button
                type="button"
                onClick={() => setActiveTabPartId(pairPart.id)}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                  activeTabPartId === pairPart.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        activeTabPartId === pairPart.id
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {pairSideLabel}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold truncate mt-1">{pairPart.partNo}</p>
                  <p
                    className={`text-[11px] truncate ${
                      activeTabPartId === pairPart.id ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {pairPart.name}
                  </p>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-lg font-mono font-black text-sm shrink-0 ${
                    activeTabPartId === pairPart.id
                      ? "bg-slate-800 text-amber-400 border border-slate-700"
                      : "bg-slate-100 text-slate-900 border border-slate-200"
                  }`}
                >
                  {totalPairNG} <span className="text-[10px] font-normal">NG</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Current Active Target Banner */}
        {isFamilyMoldSet && (
          <div className="bg-amber-100/60 border-b border-amber-200 px-5 py-2 flex items-center justify-between text-xs text-amber-950 font-bold">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>
                Sedang menginput defect untuk:{" "}
                <span className="font-extrabold text-amber-900 underline">
                  {activeSideName} ({activePart.partNo} - {activePart.name})
                </span>
              </span>
            </div>
            {hasUnsavedChanges && (
              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-black border border-amber-300 animate-pulse">
                Ada Perubahan Belum Disimpan
              </span>
            )}
          </div>
        )}

        {/* Category Filters */}
        {categories.length > 1 && (
          <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 mr-1 shrink-0">Kategori:</span>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const countInCat =
                cat === "Semua"
                  ? defectTypes.length
                  : defectTypes.filter((d) => getNormalizedCategory(d.category) === cat).length;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-amber-600 text-white shadow-xs font-black ring-2 ring-amber-500/20"
                      : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-300 shadow-2xs"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected
                        ? "bg-amber-800 text-amber-100 font-black"
                        : "bg-slate-100 text-slate-500 font-semibold"
                    }`}
                  >
                    {countInCat}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable Defect List for Current Target Side */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Data NG berhasil disimpan ke server database!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredDefects.map((dt) => {
              const currentTargetPartId = isFamilyMoldSet ? activeTabPartId : mainPart.id;
              const key = `${currentTargetPartId}_${dt.id}`;
              const qty = quantities[key] || 0;
              const hasCount = qty > 0;

              return (
                <div
                  key={dt.id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                    hasCount
                      ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-400/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                        {dt.code}
                      </span>
                      {dt.category && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {dt.category}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-1 truncate" title={dt.name}>
                      {dt.name}
                    </p>
                  </div>

                  {/* Quantity Stepper (Touch-Friendly: Min Height 38px) */}
                  <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleAdjust(dt.id, -1)}
                      disabled={qty <= 0 || isSaving}
                      className="w-9 h-9 flex items-center justify-center rounded-md bg-white text-slate-700 font-black text-base hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 transition cursor-pointer active:scale-95"
                      aria-label={`Kurangi ${dt.name}`}
                    >
                      &minus;
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => handleSetDirect(dt.id, parseInt(e.target.value) || 0)}
                      disabled={isSaving}
                      className="w-12 h-9 text-center font-mono font-black text-sm bg-white rounded-md border border-slate-200 text-slate-900 tabular-numbers focus:border-amber-600 focus:outline-hidden"
                      aria-label={`Jumlah ${dt.name}`}
                    />

                    <button
                      type="button"
                      onClick={() => handleAdjust(dt.id, 1)}
                      disabled={isSaving}
                      className="w-9 h-9 flex items-center justify-center rounded-md bg-amber-600 text-white font-black text-base hover:bg-amber-700 disabled:opacity-30 transition cursor-pointer active:scale-95 shadow-xs"
                      aria-label={`Tambah ${dt.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-1.5 w-full sm:w-auto">
            <span className="font-semibold">Status Data:</span>
            {hasUnsavedChanges ? (
              <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300 text-[11px]">
                Perubahan belum disimpan
              </span>
            ) : (
              <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 text-[11px] flex items-center gap-1">
                <Check className="w-3 h-3" /> Tersinkron ke Server ({initialTotalNG} pcs)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={() => handlePerformSave(true)}
              disabled={isSaving || !hasUnsavedChanges}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Menyimpan ke Server..." : "SIMPAN DATA NG"}</span>
            </button>
          </div>
        </div>

        {/* CONFIRMATION TOAST / DIALOG WHEN UNSAVED EDITS EXIST */}
        {showUnsavedPrompt && (
          <div className="absolute inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border-2 border-amber-400 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Data NG Belum Disimpan!
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Anda telah mengubah data part NG namun belum mengklik tombol{" "}
                    <span className="font-bold text-amber-700">Simpan</span>. Apakah Anda ingin
                    menyimpan data NG ini sekarang?
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                <p className="font-bold text-amber-900">Ringkasan Perubahan:</p>
                <p className="text-slate-700 mt-0.5">
                  Total sebelum: <span className="font-mono font-bold">{initialTotalNG} pcs</span> →{" "}
                  Total baru: <span className="font-mono font-bold text-amber-800">{totalNG} pcs</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handlePerformSave(true)}
                  disabled={isSaving}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Menyimpan..." : "Ya, Simpan Data"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUnsavedPrompt(false);
                    onClose();
                  }}
                  disabled={isSaving}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition cursor-pointer"
                >
                  Buang Perubahan
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowUnsavedPrompt(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
                >
                  Kembali Melanjutkan Edit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
