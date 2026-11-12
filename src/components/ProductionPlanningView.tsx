"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarDays,
  Plus,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Cpu,
  Check,
  FileText,
  User,
  UserX,
  X,
  Timer,
  ListPlus,
} from "lucide-react";
import TomSelectInput from "./TomSelectInput";

export interface PlanDetailItem {
  id: number;
  machineId: number;
  machineCode: string;
  partId: number;
  partNo: string;
  partName: string;
  cycleTimeSec: number;
  cavity: number;
  qtyPerTrolly: number;
  containerType?: string | null;
  targetQty: number;
  moldMode?: string | null;
  pairPart?: { id: number; partNo: string; name: string } | null;
  priority: number;
  status: string;
  notes?: string | null;
  scheduledDate?: string | null;
  createdAt: string;
  operatorId?: number | null;
  operatorName?: string | null;
  operatorEmployeeId?: string | null;
}

export interface FormPartRow {
  rowId: string;
  partId: number | null;
  targetQty: number | string;
  moldMode: string; // "SET", "SINGLE_LH", "SINGLE_RH", "STANDARD"
  notes: string;
}

interface ProductionPlanningViewProps {
  initialPlans: PlanDetailItem[];
  machines: Array<{
    id: number;
    code: string;
    model: string | null;
    tonnage: number;
    allowedParts: Array<{
      id: number;
      partNo: string;
      name: string;
      cycleTimeSec: number;
      cavity: number;
      qtyPerTrolly: number;
      containerType?: string | null;
      pairPart?: { id: number; partNo: string; name: string } | null;
    }>;
  }>;
  operators?: Array<{
    id: number;
    name: string;
    employeeId: string;
    role: string;
  }>;
  onCreatePlan: (data: {
    machineId: number;
    partId: number;
    targetQty: number;
    operatorId?: number | null;
    notes?: string;
    scheduledDate?: string;
    moldMode?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onCreatePlansBatch?: (data: {
    machineId: number;
    operatorId?: number | null;
    scheduledDate?: string;
    items: Array<{
      partId: number;
      targetQty: number;
      moldMode?: string;
      notes?: string;
    }>;
  }) => Promise<{ success: boolean; error?: string; count?: number }>;
  onDeletePlan: (id: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus: (id: number, status: string) => Promise<{ success: boolean; error?: string }>;
  onFilterPlans?: (filters: {
    machineId?: number;
    startDate?: string;
    endDate?: string;
  }) => Promise<PlanDetailItem[]>;
  currentUser?: {
    id: number;
    name: string;
    role: string;
    employeeId: string;
  };
}

// Menghitung detik estimasi pengerjaan job
export function calculateEstimatedSeconds(
  targetQty: number,
  cycleTimeSec: number,
  cavity: number,
  moldMode?: string | null,
  isFamilyMold: boolean = false
): number {
  if (!targetQty || !cycleTimeSec) return 0;
  // Pada mode SET Family Mold (1 shot = 1 LH + 1 RH):
  // Target 400 Set butuh 400 shot.
  // Pada part reguler atau mode single: shot = targetQty / cavity.
  const isSetFamilyMold = isFamilyMold && (moldMode === "SET" || !moldMode);
  const effectiveCavity = isSetFamilyMold ? 1 : Math.max(1, cavity || 1);
  const shots = isSetFamilyMold ? targetQty : targetQty / effectiveCavity;
  return shots * cycleTimeSec;
}

// Format durasi dalam jam desimal dan teks jam + menit
export function formatEstimatedDuration(totalSeconds: number): {
  hoursDecimal: string;
  formattedText: string;
  totalHours: number;
} {
  if (totalSeconds <= 0) {
    return { hoursDecimal: "0 jam", formattedText: "0 jam", totalHours: 0 };
  }
  const hours = totalSeconds / 3600;
  const wholeHours = Math.floor(hours);
  const remainingMins = Math.round((totalSeconds % 3600) / 60);

  let formattedText = "";
  if (wholeHours === 0) {
    formattedText = `${remainingMins} menit`;
  } else if (remainingMins === 0) {
    formattedText = `${wholeHours} jam`;
  } else {
    formattedText = `${wholeHours} jam ${remainingMins} mnt`;
  }

  const hoursDecimal = `${hours.toFixed(1).replace(".", ",")} jam`;
  return { hoursDecimal, formattedText, totalHours: hours };
}

export function calculateEstimatedHours(
  targetQty: number,
  cycleTimeSec: number,
  cavity: number,
  moldMode?: string | null,
  isFamilyMold: boolean = false
): string {
  const secs = calculateEstimatedSeconds(targetQty, cycleTimeSec, cavity, moldMode, isFamilyMold);
  return formatEstimatedDuration(secs).hoursDecimal;
}

const createInitialPartRow = (): FormPartRow => ({
  rowId: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  partId: null,
  targetQty: "",
  moldMode: "SET",
  notes: "",
});

export default function ProductionPlanningView({
  initialPlans,
  machines,
  operators = [],
  onCreatePlan,
  onCreatePlansBatch,
  onDeletePlan,
  onUpdateStatus,
  onFilterPlans,
  currentUser,
}: ProductionPlanningViewProps) {
  const isOperator = currentUser?.role?.toUpperCase() === "OPERATOR";

  if (isOperator) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-lg mx-auto shadow-sm my-8 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">Akses Terbatas</h2>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Halaman Rencana Job (PPIC) hanya dapat diakses oleh Planner, Supervisor, dan Admin MMS.
          </p>
        </div>
      </div>
    );
  }

  const [plans, setPlans] = useState<PlanDetailItem[]>(initialPlans);
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>("ALL");
  const [selectedOperatorFilter, setSelectedOperatorFilter] = useState<string>("ALL");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [isLoadingFilter, setIsLoadingFilter] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states untuk pembuatan Rencana Produksi (Multi-Part)
  const [formMachineId, setFormMachineId] = useState<number | null>(null);
  const [formOperatorId, setFormOperatorId] = useState<number | null>(null);
  const [formScheduledDate, setFormScheduledDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [formPartRows, setFormPartRows] = useState<FormPartRow[]>([createInitialPartRow()]);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync plans when initialPlans prop changes
  useEffect(() => {
    setPlans(initialPlans);
  }, [initialPlans]);

  // Selected machine in form
  const currentFormMachine = useMemo(
    () => (formMachineId ? machines.find((m) => m.id === formMachineId) || null : null),
    [machines, formMachineId]
  );

  // Handle machine selection change in form
  const handleMachineChange = (mId: number | null) => {
    setFormMachineId(mId);
    setFormPartRows([createInitialPartRow()]);
  };

  // Helper buka modal dengan mesin yang sudah dipilih
  const openAddModalWithMachine = (mId: number | null = null) => {
    setFormError(null);
    setFormMachineId(mId);
    setFormOperatorId(null);
    setFormScheduledDate(new Date().toISOString().slice(0, 10));
    setFormPartRows([createInitialPartRow()]);
    setShowAddModal(true);
  };

  // Tambah baris part baru ke antrean form
  const handleAddPartRow = () => {
    setFormPartRows((prev) => [...prev, createInitialPartRow()]);
  };

  // Hapus baris part tertentu
  const handleRemovePartRow = (rowId: string) => {
    if (formPartRows.length <= 1) return;
    setFormPartRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Update nilai baris part tertentu
  const handleUpdatePartRow = (rowId: string, patch: Partial<FormPartRow>) => {
    setFormPartRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r, ...patch };
        if (patch.partId !== undefined && currentFormMachine) {
          const partObj = currentFormMachine.allowedParts.find((p) => p.id === patch.partId);
          if (partObj) {
            updated.moldMode = (partObj as any).pairPart ? "SET" : "STANDARD";
          }
        }
        return updated;
      })
    );
  };

  // Hitung live estimasi waktu per baris dan total waktu mesin di dalam modal
  const modalRowsEstimation = useMemo(() => {
    if (!currentFormMachine) {
      return {
        rowDetails: [],
        totalSeconds: 0,
        totalQty: 0,
        validCount: 0,
        formattedTotal: { hoursDecimal: "0 jam", formattedText: "0 jam", totalHours: 0 },
      };
    }

    let totalSeconds = 0;
    let totalQty = 0;
    let validCount = 0;

    const rowDetails = formPartRows.map((row) => {
      const partObj = row.partId
        ? currentFormMachine.allowedParts.find((p) => p.id === row.partId) || null
        : null;

      const qty = typeof row.targetQty === "number" ? row.targetQty : parseInt(row.targetQty, 10) || 0;
      const isFamilyMold = Boolean((partObj as any)?.pairPart);
      const isSet = isFamilyMold && (row.moldMode === "SET" || !row.moldMode);

      let rowSeconds = 0;
      if (partObj && qty > 0) {
        rowSeconds = calculateEstimatedSeconds(
          qty,
          partObj.cycleTimeSec,
          partObj.cavity,
          row.moldMode,
          isFamilyMold
        );
        totalSeconds += rowSeconds;
        totalQty += isSet ? qty * 2 : qty;
        validCount += 1;
      }

      return {
        rowId: row.rowId,
        partObj,
        qty,
        isFamilyMold,
        isSet,
        rowSeconds,
        formattedDuration: formatEstimatedDuration(rowSeconds),
      };
    });

    const formattedTotal = formatEstimatedDuration(totalSeconds);

    return {
      rowDetails,
      totalSeconds,
      totalQty,
      validCount,
      formattedTotal,
    };
  }, [currentFormMachine, formPartRows]);

  // Options untuk TomSelect
  const machineOptions = useMemo(() => {
    return machines.map((m) => ({
      value: m.id,
      label: `${m.code} (${m.tonnage} Ton)`,
      sublabel: `${m.model || "Injection Molding"} : ${m.allowedParts.length} Part terdaftar`,
    }));
  }, [machines]);

  const partOptions = useMemo(() => {
    if (!currentFormMachine) return [];
    return currentFormMachine.allowedParts.map((p) => ({
      value: p.id,
      label: `${p.partNo} - ${p.name}`,
      sublabel: `Cycle Time: ${p.cycleTimeSec}s | Cavity: ${p.cavity} | Trolly: ${p.qtyPerTrolly} pcs`,
    }));
  }, [currentFormMachine]);

  const operatorOptions = useMemo(() => {
    return (operators || []).map((u) => ({
      value: u.id,
      label: `${u.employeeId} - ${u.name}`,
      sublabel: `Role: ${u.role}`,
    }));
  }, [operators]);

  // Filter rencana kerja
  const filteredPlans = useMemo(() => {
    let result = plans;

    if (selectedMachineFilter !== "ALL") {
      result = result.filter((p) => p.machineId === parseInt(selectedMachineFilter, 10));
    }

    if (selectedOperatorFilter !== "ALL") {
      result = result.filter((p) => p.operatorId === parseInt(selectedOperatorFilter, 10));
    }

    if (filterStartDate) {
      result = result.filter((p) => {
        const pDate = (p.scheduledDate || p.createdAt).slice(0, 10);
        return pDate >= filterStartDate;
      });
    }

    if (filterEndDate) {
      result = result.filter((p) => {
        const pDate = (p.scheduledDate || p.createdAt).slice(0, 10);
        return pDate <= filterEndDate;
      });
    }

    return result;
  }, [plans, selectedMachineFilter, selectedOperatorFilter, filterStartDate, filterEndDate]);

  // Akumulasi estimasi waktu dan kuantiti pada daftar filteredPlans
  const filteredPlansSummary = useMemo(() => {
    let totalSecs = 0;
    let totalTarget = 0;

    filteredPlans.forEach((p) => {
      const isFamilyMold = Boolean(p.pairPart);
      totalSecs += calculateEstimatedSeconds(
        p.targetQty,
        p.cycleTimeSec,
        p.cavity,
        p.moldMode,
        isFamilyMold
      );
      totalTarget += p.targetQty;
    });

    return {
      totalDuration: formatEstimatedDuration(totalSecs),
      totalTarget,
    };
  }, [filteredPlans]);

  // Mesin yang sedang difilter aktif
  const currentFilterMachine = useMemo(() => {
    if (selectedMachineFilter === "ALL") return null;
    return machines.find((m) => m.id === parseInt(selectedMachineFilter, 10)) || null;
  }, [machines, selectedMachineFilter]);

  // Statistik beban kerja mesin yang sedang difilter
  const machineWorkload = useMemo(() => {
    if (!currentFilterMachine) return null;
    const mPlans = plans.filter((p) => p.machineId === currentFilterMachine.id);
    const activeOrPending = mPlans.filter((p) => p.status === "IN_PROGRESS" || p.status === "PENDING");
    let totalSecs = 0;
    let totalTarget = 0;

    activeOrPending.forEach((p) => {
      const isFamilyMold = Boolean(p.pairPart);
      totalSecs += calculateEstimatedSeconds(
        p.targetQty,
        p.cycleTimeSec,
        p.cavity,
        p.moldMode,
        isFamilyMold
      );
      totalTarget += p.targetQty;
    });

    return {
      machine: currentFilterMachine,
      totalPlans: mPlans.length,
      activeCount: mPlans.filter((p) => p.status === "IN_PROGRESS").length,
      pendingCount: mPlans.filter((p) => p.status === "PENDING").length,
      completedCount: mPlans.filter((p) => p.status === "COMPLETED").length,
      totalDuration: formatEstimatedDuration(totalSecs),
      totalTarget,
    };
  }, [currentFilterMachine, plans]);

  const handleResetFilter = async () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setSelectedMachineFilter("ALL");
    setSelectedOperatorFilter("ALL");
    if (onFilterPlans) {
      setIsLoadingFilter(true);
      const res = await onFilterPlans({});
      setPlans(res);
      setIsLoadingFilter(false);
    }
  };

  // Metrics
  const inProgressCount = useMemo(
    () => filteredPlans.filter((p) => p.status === "IN_PROGRESS").length,
    [filteredPlans]
  );
  const pendingCount = useMemo(
    () => filteredPlans.filter((p) => p.status === "PENDING").length,
    [filteredPlans]
  );
  const completedCount = useMemo(
    () => filteredPlans.filter((p) => p.status === "COMPLETED").length,
    [filteredPlans]
  );

  // Submit batch multi-part plan
  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMachineId) {
      setFormError("Silakan pilih Mesin Molding terlebih dahulu.");
      return;
    }

    if (formPartRows.length === 0) {
      setFormError("Minimal harus ada 1 part yang dijadwalkan.");
      return;
    }

    for (let i = 0; i < formPartRows.length; i++) {
      const row = formPartRows[i];
      if (!row.partId) {
        setFormError(`Silakan pilih Part pada antrean #${i + 1}.`);
        return;
      }
      const parsedQty = typeof row.targetQty === "number" ? row.targetQty : parseInt(row.targetQty, 10);
      if (!parsedQty || isNaN(parsedQty) || parsedQty <= 0) {
        setFormError(`Target kuantiti pada antrean #${i + 1} wajib diisi angka lebih dari 0 pcs.`);
        return;
      }
    }

    setIsCreating(true);
    setFormError(null);

    const batchItems = formPartRows.map((r) => {
      const parsedQty = typeof r.targetQty === "number" ? r.targetQty : parseInt(r.targetQty, 10);
      const partObj = currentFormMachine?.allowedParts.find((p) => p.id === r.partId);
      const isFamilyMold = Boolean((partObj as any)?.pairPart);
      return {
        partId: r.partId!,
        targetQty: parsedQty,
        moldMode: isFamilyMold ? r.moldMode : undefined,
        notes: r.notes.trim() || undefined,
      };
    });

    let success = false;
    let errorMsg: string | undefined;

    if (onCreatePlansBatch) {
      const res = await onCreatePlansBatch({
        machineId: formMachineId,
        operatorId: formOperatorId,
        scheduledDate: formScheduledDate,
        items: batchItems,
      });
      success = res.success;
      errorMsg = res.error;
    } else {
      // Fallback: sequential single creation
      for (const item of batchItems) {
        const res = await onCreatePlan({
          machineId: formMachineId,
          partId: item.partId,
          targetQty: item.targetQty,
          operatorId: formOperatorId,
          scheduledDate: formScheduledDate,
          notes: item.notes,
          moldMode: item.moldMode,
        });
        if (!res.success) {
          success = false;
          errorMsg = res.error;
          break;
        }
        success = true;
      }
    }

    setIsCreating(false);

    if (success) {
      setShowAddModal(false);
      setFormMachineId(null);
      setFormOperatorId(null);
      setFormPartRows([createInitialPartRow()]);
    } else {
      setFormError(errorMsg || "Gagal membuat rencana produksi.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-sky-600" />
              Rencana Produksi & Antrean Job
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded font-black uppercase bg-sky-100 text-sky-800 border border-sky-300">
              Role: Planner
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Tentukan target kuantiti dan urutan part untuk setiap mesin molding. Anda dapat menjadwalkan
            beberapa part sekaligus untuk 1 mesin dan melihat estimasi total durasi pengerjaan secara otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openAddModalWithMachine(selectedMachineFilter !== "ALL" ? Number(selectedMachineFilter) : null)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer shrink-0"
        >
          <ListPlus className="w-5 h-5" />
          <span>+ Rencanakan Job Mesin (Bisa Beberapa Part)</span>
        </button>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Job Sedang Berjalan</p>
            <p className="text-2xl font-black text-emerald-700 font-mono tabular-numbers mt-1">
              {inProgressCount}{" "}
              <span className="text-xs font-normal text-slate-500">mesin</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Memproduksi target aktif</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Antrean Menunggu (Queue)</p>
            <p className="text-2xl font-black text-amber-700 font-mono tabular-numbers mt-1">
              {pendingCount}{" "}
              <span className="text-xs font-normal text-slate-500">job</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Siap jalan saat job aktif selesai</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Job Selesai Hari Ini</p>
            <p className="text-2xl font-black text-slate-900 font-mono tabular-numbers mt-1">
              {completedCount}{" "}
              <span className="text-xs font-normal text-slate-500">job</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Target tercapai 100%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-sky-200 bg-sky-50/40 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-sky-950 uppercase">Total Estimasi Beban Kerja</p>
            <p className="text-2xl font-black text-sky-700 font-mono tabular-numbers mt-1">
              {filteredPlansSummary.totalDuration.hoursDecimal}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              ~{filteredPlansSummary.totalDuration.formattedText} ({filteredPlans.length} job)
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
            <Timer className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter by Machine, Date Range & Job List */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
        {/* Filter Toolbar */}
        <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Mesin */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Mesin:</span>
              <select
                value={selectedMachineFilter}
                onChange={(e) => setSelectedMachineFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="ALL">Semua 15 Mesin</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} ({m.tonnage}T)
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Operator */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Operator:</span>
              <select
                value={selectedOperatorFilter}
                onChange={(e) => setSelectedOperatorFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
              >
                <option value="ALL">Semua Operator</option>
                {operators.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.employeeId} - {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Rentang Tanggal */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700">Rentang Tanggal:</span>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
                title="Tanggal Mulai"
              />
              <span className="text-xs text-slate-400 font-bold">s/d</span>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
                title="Tanggal Selesai"
              />
            </div>

            {/* Reset Filter */}
            {(filterStartDate || filterEndDate || selectedMachineFilter !== "ALL" || selectedOperatorFilter !== "ALL") && (
              <button
                type="button"
                onClick={handleResetFilter}
                disabled={isLoadingFilter}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer ml-1"
              >
                Reset Filter
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Menampilkan <b>{filteredPlans.length}</b> rencana kerja
          </p>
        </div>

        {/* WORKLOAD ESTIMATOR BANNER (Saat 1 Mesin Dipilih) */}
        {machineWorkload && (
          <div className="bg-gradient-to-r from-sky-50 via-indigo-50/60 to-white px-5 py-4 border-b border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-base">{machineWorkload.machine.code}</span>
                  <span className="text-xs font-bold text-slate-600 font-mono">
                    ({machineWorkload.machine.tonnage} Ton : {machineWorkload.machine.model || "Injection Molding"})
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Beban Mesin: <b>{machineWorkload.activeCount}</b> Sedang Jalan, <b>{machineWorkload.pendingCount}</b> Antrean Menunggu
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 bg-white/80 border border-sky-200 px-4 py-2 rounded-xl shadow-2xs">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Estimasi Jam Kerja Antrean</p>
                <p className="text-base font-black font-mono text-sky-700">
                  {machineWorkload.totalDuration.hoursDecimal}{" "}
                  <span className="text-xs font-normal text-slate-600">({machineWorkload.totalDuration.formattedText})</span>
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Total Target Part</p>
                <p className="text-base font-black font-mono text-slate-900">
                  {machineWorkload.totalTarget.toLocaleString("id-ID")}{" "}
                  <span className="text-xs font-normal text-slate-500">pcs</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => openAddModalWithMachine(machineWorkload.machine.id)}
                className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer shrink-0 ml-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Job ke Mesin Ini</span>
              </button>
            </div>
          </div>
        )}

        {/* Table of Plans */}
        {filteredPlans.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Tidak Ada Rencana Kerja yang Sesuai Filter</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Coba sesuaikan rentang tanggal, mesin, atau operator, atau klik tombol <b>&quot;+ Rencanakan Job Mesin&quot;</b> untuk membuat jadwal baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-extrabold uppercase text-[11px]">
                  <th className="py-3 px-4">Urutan / Status</th>
                  <th className="py-3 px-4">Tanggal Jadwal</th>
                  <th className="py-3 px-4">Mesin</th>
                  <th className="py-3 px-4">Operator Mesin</th>
                  <th className="py-3 px-4">Part & Model</th>
                  <th className="py-3 px-4">Target Kuantiti</th>
                  <th className="py-3 px-4">Estimasi Durasi Kerja</th>
                  <th className="py-3 px-4">Catatan Planner</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPlans.map((plan) => {
                  const isFamilyMold = Boolean(plan.pairPart);
                  const isFamilyMoldSet = isFamilyMold && plan.moldMode === "SET";
                  const planSeconds = calculateEstimatedSeconds(
                    plan.targetQty,
                    plan.cycleTimeSec,
                    plan.cavity,
                    plan.moldMode,
                    isFamilyMold
                  );
                  const estDuration = formatEstimatedDuration(planSeconds);
                  const isRunning = plan.status === "IN_PROGRESS";
                  const isCompleted = plan.status === "COMPLETED";

                  const planDateStr = plan.scheduledDate
                    ? new Date(plan.scheduledDate).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                    : new Date(plan.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                  return (
                    <tr
                      key={plan.id}
                      className={`hover:bg-slate-50/80 transition ${isRunning ? "bg-emerald-50/40" : isCompleted ? "opacity-60 bg-slate-50/30" : ""
                        }`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center font-mono">
                            #{plan.priority}
                          </span>
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                              Sedang Jalan
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Selesai
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                              Menunggu
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                          <span>{planDateStr}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-black text-sm text-slate-900">
                        {plan.machineCode}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {plan.operatorName ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{plan.operatorName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{plan.operatorEmployeeId}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                            <UserX className="w-3.5 h-3.5 text-slate-300" />
                            Belum ditentukan
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{plan.partNo}</p>
                        <p className="text-[11px] text-slate-500">{plan.partName}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          CT: {plan.cycleTimeSec}s | Cavity: {plan.cavity}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-900">
                        {plan.targetQty.toLocaleString("id-ID")}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          {isFamilyMoldSet ? "Set" : "pcs"}
                        </span>
                        {isFamilyMoldSet && (
                          <span className="block text-[10px] text-indigo-700 font-sans font-bold">
                            ({plan.targetQty} Kiri + {plan.targetQty} Kanan)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 font-mono font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-sky-600" />
                            {estDuration.hoursDecimal}
                          </span>
                          <p className="text-[10px] text-slate-500 font-medium">({estDuration.formattedText})</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {plan.notes || "-"}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCompleted && !isRunning && (
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(plan.id, "COMPLETED")}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-300 transition cursor-pointer"
                              title="Tandai Selesai"
                            >
                              Selesai
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDeletePlan(plan.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Hapus Job Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900 text-xs">
                  <td colSpan={5} className="py-3 px-4 text-slate-700 uppercase tracking-wide">
                    Total Beban Kerja ({filteredPlans.length} Rencana Terpilih):
                  </td>
                  <td className="py-3 px-4 font-mono font-black text-slate-900">
                    {filteredPlansSummary.totalTarget.toLocaleString("id-ID")} pcs
                  </td>
                  <td className="py-3 px-4 font-mono font-black text-sky-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-sky-600" />
                      <span>{filteredPlansSummary.totalDuration.hoursDecimal}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ({filteredPlansSummary.totalDuration.formattedText})
                      </span>
                    </div>
                  </td>
                  <td colSpan={2} className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PERENCANAAN PRODUKSI MESIN (MULTI-PART BATCH PLANNING) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/80 shrink-0">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-sky-600" />
                  Rencana Produksi Mesin (Bisa Beberapa Part Sekaligus)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jadwalkan satu atau beberapa part sekaligus dalam urutan antrean untuk 1 mesin molding.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form id="multi-plan-form" onSubmit={handleSubmitPlan} className="space-y-5">
                {/* 1. Pengaturan Mesin, Operator & Tanggal */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-sky-600" />
                    Langkah 1: Pilih Mesin & Penugasan
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Pilih Mesin (TomSelect) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-800">
                          Mesin Molding:
                        </label>
                        {formMachineId !== null && (
                          <button
                            type="button"
                            onClick={() => handleMachineChange(null)}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition inline-flex items-center gap-1 cursor-pointer"
                            title="Bersihkan pilihan mesin"
                          >
                            <X className="w-3 h-3" />
                            <span>Bersihkan (Clear)</span>
                          </button>
                        )}
                      </div>
                      <TomSelectInput
                        id="select-plan-machine"
                        value={formMachineId !== null ? formMachineId : ""}
                        onChange={(val) => handleMachineChange(val ? parseInt(val, 10) : null)}
                        placeholder="-- Pilih Mesin Molding --"
                        allowClear={true}
                        options={machineOptions}
                      />
                    </div>

                    {/* Pilih Operator Ditugaskan */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-sky-600" />
                        Operator Mesin (Ditugaskan):
                      </label>
                      <TomSelectInput
                        id="select-plan-operator"
                        value={formOperatorId !== null ? formOperatorId : ""}
                        onChange={(val) => setFormOperatorId(val ? parseInt(val, 10) : null)}
                        placeholder="Ketik nama karyawan atau NIK..."
                        allowClear={true}
                        options={operatorOptions}
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Opsional. Job akan otomatis diprioritaskan pada layar login operator ini.
                      </p>
                    </div>
                  </div>

                  {/* Tanggal Rencana Produksi */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                      Tanggal Rencana Produksi (Target Eksekusi):
                    </label>
                    <input
                      type="date"
                      value={formScheduledDate}
                      onChange={(e) => setFormScheduledDate(e.target.value)}
                      className="w-full sm:w-64 px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:border-sky-600"
                      required
                    />
                  </div>
                </div>

                {/* 2. DAFTAR PART YANG DIRENCANAKAN (BISA BEBERAPA PART SEKALIGUS) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-sky-600" />
                        Langkah 2: Daftar Part yang Dijadwalkan
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Tambahkan part yang akan dicetak di mesin ini secara berurutan.
                      </p>
                    </div>

                    {currentFormMachine && (
                      <button
                        type="button"
                        onClick={handleAddPartRow}
                        className="px-3 py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-black text-xs flex items-center gap-1.5 border border-sky-300 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Tambah Part</span>
                      </button>
                    )}
                  </div>

                  {!currentFormMachine ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1.5">
                      <Cpu className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">Silakan Pilih Mesin Molding Terlebih Dahulu</p>
                      <p className="text-[11px] text-slate-500">
                        Setelah memilih mesin, daftar part yang diizinkan untuk mesin tersebut akan muncul di sini.
                      </p>
                    </div>
                  ) : currentFormMachine.allowedParts.length === 0 ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                      Mesin {currentFormMachine.code} belum memiliki part yang terhubung. Silakan hubungkan part ke mesin ini di menu Master Data.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {formPartRows.map((row, idx) => {
                        const rowDetail = modalRowsEstimation.rowDetails[idx];
                        const partObj = rowDetail?.partObj;
                        const rowQty = rowDetail?.qty || 0;

                        return (
                          <div
                            key={row.rowId}
                            className="bg-white border-2 border-slate-200 hover:border-sky-300 rounded-xl p-4 space-y-3 transition shadow-2xs relative"
                          >
                            {/* Header Baris Part */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-black text-xs flex items-center justify-center font-mono">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-black text-slate-800">
                                  Urutan Job #{idx + 1}
                                </span>

                                {/* Badge Estimasi Waktu Per Part */}
                                {partObj && rowQty > 0 && (
                                  <span className="inline-flex items-center gap-1.5 font-mono font-black text-xs text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-300">
                                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                                    Estimasi: {rowDetail?.formattedDuration.hoursDecimal} ({rowDetail?.formattedDuration.formattedText})
                                  </span>
                                )}
                              </div>

                              {formPartRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePartRow(row.rowId)}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                  title="Hapus baris part ini"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Pilih Part */}
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Pilih Part yang Dicetak:
                              </label>
                              <TomSelectInput
                                key={`part-${row.rowId}-${formMachineId}`}
                                id={`select-part-${row.rowId}`}
                                value={row.partId !== null ? row.partId : ""}
                                onChange={(val) =>
                                  handleUpdatePartRow(row.rowId, {
                                    partId: val ? parseInt(val, 10) : null,
                                  })
                                }
                                placeholder="-- Cari atau pilih part mesin --"
                                allowClear={true}
                                options={partOptions}
                              />
                            </div>

                            {/* Mode Family Mold jika part berpasangan */}
                            {partObj && (partObj as any).pairPart && (() => {
                              const pairPart = (partObj as any).pairPart;
                              const isSelectedRH =
                                partObj.partNo.toUpperCase().includes("RH") ||
                                partObj.name.toUpperCase().includes("RH") ||
                                partObj.name.toUpperCase().includes("KANAN");

                              const singleModeKey = isSelectedRH ? "SINGLE_RH" : "SINGLE_LH";
                              const singleModeTitle = isSelectedRH ? "Single RH Saja" : "Single LH Saja";

                              return (
                                <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-black text-indigo-950 flex items-center gap-1.5 uppercase text-[11px]">
                                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                      Mode Family Mold (Berpasangan):
                                    </span>
                                    <span className="text-[10px] font-bold font-mono text-indigo-900 bg-indigo-200/80 px-2 py-0.5 rounded">
                                      Pasangan: {pairPart.partNo}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePartRow(row.rowId, { moldMode: "SET" })}
                                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer text-center ${row.moldMode === "SET"
                                        ? "bg-indigo-600 text-white shadow-2xs font-black"
                                        : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/50"
                                        }`}
                                    >
                                      1 Set (LH + RH)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePartRow(row.rowId, { moldMode: singleModeKey })}
                                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer text-center ${row.moldMode === singleModeKey
                                        ? "bg-indigo-600 text-white shadow-2xs font-black"
                                        : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/50"
                                        }`}
                                    >
                                      {singleModeTitle}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Target Kuantiti & Estimasi Waktu */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1">
                                  {row.moldMode === "SET" && (partObj as any)?.pairPart
                                    ? "Target Produksi (Jumlah Set):"
                                    : "Target Produksi (Pcs):"}
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder="Contoh: 400, 500, 1000"
                                  value={row.targetQty}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdatePartRow(row.rowId, {
                                      targetQty: val === "" ? "" : parseInt(val, 10) || "",
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-mono font-black text-slate-900 focus:border-sky-600 tabular-numbers"
                                  required
                                />
                                {row.moldMode === "SET" && (partObj as any)?.pairPart && (
                                  <p className="text-[10px] text-indigo-800 font-bold mt-1">
                                    {row.targetQty
                                      ? `${row.targetQty} Set = ${row.targetQty} LH + ${row.targetQty} RH (total ${Number(row.targetQty) * 2} pcs)`
                                      : "1 Set = 1 LH + 1 RH"}
                                  </p>
                                )}
                              </div>

                              <div>
                                <p className="text-xs font-bold text-slate-700 mb-1">Estimasi Durasi Part Ini:</p>
                                <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                                  <p className="text-sm font-black font-mono text-sky-700 tabular-numbers">
                                    {rowDetail ? rowDetail.formattedDuration.hoursDecimal : "0 jam"}{" "}
                                    <span className="text-xs font-normal text-slate-500">
                                      ({rowDetail ? rowDetail.formattedDuration.formattedText : "0 jam"})
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {partObj
                                      ? `CT: ${partObj.cycleTimeSec}s | Cavity: ${row.moldMode === "SET" && (partObj as any)?.pairPart ? "2 (LH+RH)" : partObj.cavity}`
                                      : "Pilih part terlebih dahulu"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Catatan Part (Opsional) */}
                            <div>
                              <input
                                type="text"
                                value={row.notes}
                                onChange={(e) =>
                                  handleUpdatePartRow(row.rowId, { notes: e.target.value })
                                }
                                placeholder="Catatan part (opsional, misal: Batch A / PO Astra)..."
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:border-sky-600"
                              />
                            </div>
                          </div>
                        );
                      })}

                      {/* Tombol Tambah Part Lain */}
                      <button
                        type="button"
                        onClick={handleAddPartRow}
                        className="w-full py-3 px-4 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50 text-sky-800 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-sky-600" />
                        <span>+ Tambah Part Lain ke Antrean Mesin Ini</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. RINGKASAN TOTAL PEKERJAAN MESIN (TOTAL WORKLOAD SUMMARY) */}
                {currentFormMachine && (
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-4 shadow-md space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-slate-700/80 pb-2">
                      <div className="flex items-center gap-2 text-sky-300 font-black uppercase tracking-wider text-[11px]">
                        <Timer className="w-4 h-4 text-sky-400" />
                        <span>Total Estimasi Pekerjaan Mesin ({currentFormMachine.code})</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                        {modalRowsEstimation.validCount} Part Terjadwal
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total Estimasi Durasi Kerja</p>
                        <p className="text-2xl font-black font-mono text-emerald-400 tabular-numbers">
                          {modalRowsEstimation.formattedTotal.hoursDecimal}
                        </p>
                        <p className="text-xs text-slate-300 mt-0.5 font-medium">
                          (~{modalRowsEstimation.formattedTotal.formattedText})
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total Target Produksi Mesin</p>
                        <p className="text-2xl font-black font-mono text-white tabular-numbers">
                          {modalRowsEstimation.totalQty.toLocaleString("id-ID")}{" "}
                          <span className="text-xs font-normal text-slate-400">pcs</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Semua part akan masuk antrean mesin secara berurutan
                        </p>
                      </div>
                    </div>

                    {modalRowsEstimation.validCount > 1 && (
                      <div className="pt-2 border-t border-slate-700/60 text-xs text-slate-300 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Rincian Estimasi per Part:</p>
                        <div className="flex flex-wrap gap-2">
                          {modalRowsEstimation.rowDetails
                            .filter((d) => d.partObj && d.qty > 0)
                            .map((d, i) => (
                              <span
                                key={d.rowId}
                                className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-200 inline-flex items-center gap-1.5"
                              >
                                <span className="text-sky-400 font-bold">#{i + 1}</span>
                                <span>{d.partObj?.partNo}</span>
                                <span className="text-slate-400">({d.qty} pcs)</span>:
                                <strong className="text-emerald-400">{d.formattedDuration.hoursDecimal}</strong>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={isCreating}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>

              <button
                type="submit"
                form="multi-plan-form"
                disabled={isCreating || !formMachineId || modalRowsEstimation.validCount === 0}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isCreating
                    ? "Menyimpan ke Antrean..."
                    : `Simpan Semua Rencana Job (${modalRowsEstimation.validCount} Part)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
