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
  ArrowRight,
  TrendingUp,
  Cpu,
  Check,
  FileText,
  User,
  UserX,
  X,
} from "lucide-react";
import { ProductionPlanItem } from "./MachineCard";
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

function calculateEstimatedHours(targetQty: number, cycleTimeSec: number, cavity: number, moldMode?: string | null): string {
  if (!targetQty || !cycleTimeSec) return "0 jam";
  // Pada mode SET (Family Mold): 1 target = 1 Set (1 shot menghasilkan 1 LH + 1 RH).
  // Maka jumlah shot yang dibutuhkan = targetQty (misal target 400 Set butuh 400 shot).
  // Pada mode Single atau part standar: shots = targetQty / cavity.
  const shots = moldMode === "SET" ? targetQty : targetQty / (cavity || 1);
  const totalSeconds = shots * cycleTimeSec;
  const hours = totalSeconds / 3600;
  if (hours < 1) {
    const mins = Math.round(totalSeconds / 60);
    return `${mins} menit`;
  }
  return `${hours.toFixed(1).replace(".", ",")} jam`;
}

export default function ProductionPlanningView({
  initialPlans,
  machines,
  operators = [],
  onCreatePlan,
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

  // Form states (default kosong / null sesuai permintaan)
  const [formMachineId, setFormMachineId] = useState<number | null>(null);
  const [formPartId, setFormPartId] = useState<number | null>(null);
  const [formOperatorId, setFormOperatorId] = useState<number | null>(null);
  const [formTargetQty, setFormTargetQty] = useState<number | string>("");
  const [formScheduledDate, setFormScheduledDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [formNotes, setFormNotes] = useState<string>("");
  const [formMoldMode, setFormMoldMode] = useState<string>("SET");
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

  // Selected part in form
  const currentFormPart = useMemo(() => {
    if (!currentFormMachine || !formPartId) return null;
    return (
      currentFormMachine.allowedParts.find((p) => p.id === formPartId) || null
    );
  }, [currentFormMachine, formPartId]);

  // Handle machine selection change in form
  const handleMachineChange = (mId: number | null) => {
    setFormMachineId(mId);
    setFormPartId(null); // Kosongkan part saat mesin diganti
  };

  // Estimated duration live calculation
  const liveEstimatedHours = useMemo(() => {
    if (!currentFormPart) return "0 jam";
    const qty = typeof formTargetQty === "number" ? formTargetQty : parseInt(formTargetQty, 10) || 0;
    return calculateEstimatedHours(
      qty,
      currentFormPart.cycleTimeSec,
      currentFormPart.cavity,
      formMoldMode
    );
  }, [formTargetQty, currentFormPart, formMoldMode]);

  // Memoized options for TomSelect to prevent recreating arrays on every render/keystroke
  const machineOptions = useMemo(() => {
    return machines.map((m) => ({
      value: m.id,
      label: `${m.code} (${m.tonnage} Ton)`,
      sublabel: `${m.model || "Injection Molding"} - ${m.allowedParts.length} Part terdaftar`,
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

  // Filter plans by machine, operator, and date range
  const filteredPlans = useMemo(() => {
    let result = plans;

    // Filter mesin
    if (selectedMachineFilter !== "ALL") {
      result = result.filter((p) => p.machineId === parseInt(selectedMachineFilter, 10));
    }

    // Filter operator
    if (selectedOperatorFilter !== "ALL") {
      result = result.filter((p) => p.operatorId === parseInt(selectedOperatorFilter, 10));
    }

    // Filter tanggal mulai
    if (filterStartDate) {
      result = result.filter((p) => {
        const pDate = (p.scheduledDate || p.createdAt).slice(0, 10);
        return pDate >= filterStartDate;
      });
    }

    // Filter tanggal selesai
    if (filterEndDate) {
      result = result.filter((p) => {
        const pDate = (p.scheduledDate || p.createdAt).slice(0, 10);
        return pDate <= filterEndDate;
      });
    }

    return result;
  }, [plans, selectedMachineFilter, selectedOperatorFilter, filterStartDate, filterEndDate]);

  // Handle server-side filter request if onFilterPlans provided
  const handleApplyServerFilter = async () => {
    if (onFilterPlans) {
      setIsLoadingFilter(true);
      const res = await onFilterPlans({
        machineId: selectedMachineFilter !== "ALL" ? Number(selectedMachineFilter) : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });
      setPlans(res);
      setIsLoadingFilter(false);
    }
  };

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

  // Handle submit new plan
  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMachineId) {
      setFormError("Silakan pilih Mesin Molding terlebih dahulu.");
      return;
    }
    if (!formPartId) {
      setFormError("Silakan pilih Part yang akan diproduksi.");
      return;
    }
    const parsedQty = typeof formTargetQty === "number" ? formTargetQty : parseInt(formTargetQty, 10);
    if (!parsedQty || isNaN(parsedQty) || parsedQty <= 0) {
      setFormError("Target kuantiti produksi wajib diisi angka lebih dari 0 pcs.");
      return;
    }

    setIsCreating(true);
    setFormError(null);

    const isFamilyMold = Boolean((currentFormPart as any)?.pairPart);

    const res = await onCreatePlan({
      machineId: formMachineId,
      partId: formPartId,
      targetQty: parsedQty,
      operatorId: formOperatorId,
      scheduledDate: formScheduledDate,
      notes: formNotes.trim(),
      moldMode: isFamilyMold ? formMoldMode : undefined,
    });

    setIsCreating(false);

    if (res.success) {
      setShowAddModal(false);
      setFormMachineId(null);
      setFormPartId(null);
      setFormTargetQty("");
      setFormNotes("");
      setFormOperatorId(null);
    } else {
      setFormError(res.error || "Gagal membuat rencana produksi.");
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
            Tentukan target kuantiti dan urutan part untuk setiap mesin molding. Operator di lantai
            produksi cukup menjalankan antrean yang telah Anda jadwalkan tanpa perlu memilih part
            secara manual.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setFormMachineId(null);
            setFormPartId(null);
            setFormTargetQty("");
            setFormOperatorId(null);
            setFormNotes("");
            setShowAddModal(true);
          }}
          className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>+ Tambah Rencana Job Baru</span>
        </button>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Job Sedang Berjalan</p>
            <p className="text-2xl font-black text-emerald-700 font-mono tabular-numbers mt-1">
              {inProgressCount}{" "}
              <span className="text-xs font-normal text-slate-500">mesin</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Memproduksi target planner</p>
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

            {/* Reset / Clear Filter */}
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

        {/* Table of Plans */}
        {filteredPlans.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Tidak Ada Rencana Kerja yang Sesuai Filter</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Coba sesuaikan rentang tanggal, mesin, atau operator, atau klik tombol <b>&quot;+ Tambah Rencana Job Baru&quot;</b> untuk membuat jadwal baru.
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
                  <th className="py-3 px-4">Estimasi Durasi</th>
                  <th className="py-3 px-4">Catatan Planner</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPlans.map((plan) => {
                  const isFamilyMoldSet = Boolean(plan.pairPart) && plan.moldMode === "SET";
                  const estTime = calculateEstimatedHours(
                    plan.targetQty,
                    plan.cycleTimeSec,
                    plan.cavity,
                    isFamilyMoldSet ? "SET" : "STANDARD"
                  );
                  const isRunning = plan.status === "IN_PROGRESS";
                  const isCompleted = plan.status === "COMPLETED";

                  // Format Tanggal Jadwal
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

                      {/* Operator Mesin */}
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

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          {estTime}
                        </span>
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
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Job Rencana Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 space-y-4 p-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-600" />
                Tambah Rencana Job Baru
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs font-bold text-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitPlan} className="space-y-4">
              {/* 1. Pilih Mesin (TomSelect) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    1. Pilih Mesin Molding:
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

              {/* 2. Pilih Part (TomSelect) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    2. Pilih Part (Terdaftar di Mesin):
                  </label>
                  {formPartId !== null && (
                    <button
                      type="button"
                      onClick={() => setFormPartId(null)}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition inline-flex items-center gap-1 cursor-pointer"
                      title="Bersihkan pilihan part"
                    >
                      <X className="w-3 h-3" />
                      <span>Bersihkan (Clear)</span>
                    </button>
                  )}
                </div>
                {currentFormMachine ? (
                  currentFormMachine.allowedParts.length > 0 ? (
                    <TomSelectInput
                      key={`part-select-${formMachineId}`}
                      id="select-plan-part"
                      value={formPartId !== null ? formPartId : ""}
                      onChange={(val) => setFormPartId(val ? parseInt(val, 10) : null)}
                      placeholder="-- Pilih Part yang akan diproduksi --"
                      allowClear={true}
                      options={partOptions}
                    />
                  ) : (
                    <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                      Mesin {currentFormMachine.code} belum memiliki part yang terhubung.
                    </p>
                  )
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 font-medium">
                    Silakan pilih Mesin Molding di atas terlebih dahulu untuk melihat daftar part yang diizinkan.
                  </div>
                )}

                {/* Family Mold Mode jika part memiliki pasangan LH / RH */}
                {currentFormPart && (currentFormPart as any).pairPart && (() => {
                  const partObj = currentFormPart as any;
                  const isSelectedRH =
                    partObj.partNo.toUpperCase().includes("RH") ||
                    partObj.name.toUpperCase().includes("RH") ||
                    partObj.name.toUpperCase().includes("KANAN");

                  const singleModeKey = isSelectedRH ? "SINGLE_RH" : "SINGLE_LH";
                  const singleModeTitle = isSelectedRH ? "Single RH Saja" : "Single LH Saja";

                  return (
                    <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-indigo-950 flex items-center gap-1.5 uppercase">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          Mode Family Mold:
                        </span>
                        <span className="text-[10px] font-bold font-mono text-indigo-900 bg-indigo-200/80 px-2 py-0.5 rounded">
                          Pasangan: {partObj.pairPart.partNo}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormMoldMode("SET")}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer text-center ${formMoldMode === "SET"
                              ? "bg-indigo-600 text-white shadow-2xs font-black"
                              : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100/50"
                            }`}
                        >
                          1 Set (LH + RH)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormMoldMode(singleModeKey)}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer text-center ${formMoldMode === singleModeKey
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
              </div>

              {/* 3. Pilih Operator / Karyawan Mesin (Ditugaskan) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  3. Pilih Operator / Karyawan Mesin (Ditugaskan):
                </label>
                <TomSelectInput
                  id="select-plan-operator"
                  value={formOperatorId !== null ? formOperatorId : ""}
                  onChange={(val) => setFormOperatorId(val ? parseInt(val, 10) : null)}
                  placeholder="Ketik nama karyawan atau NIK / Employee ID..."
                  allowClear={true}
                  options={operatorOptions}
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Karyawan ini yang akan ditugaskan memegang mesin. Mesin akan otomatis muncul di layar fokus operator tersebut.
                </p>
              </div>

              {/* 4. Target Kuantiti & Perhitungan Otomatis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-sky-50/70 p-3.5 rounded-xl border border-sky-200">
                <div>
                  <label className="block text-xs font-bold text-sky-950 mb-1">
                    {formMoldMode === "SET" && (currentFormPart as any)?.pairPart
                      ? "Target Produksi (Jumlah Set):"
                      : "Target Produksi (Pcs):"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Contoh: 400, 500, 1000"
                    value={formTargetQty}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setFormTargetQty("");
                      } else {
                        const parsed = parseInt(val, 10);
                        setFormTargetQty(isNaN(parsed) ? "" : parsed);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-sky-300 bg-white text-sm font-mono font-black text-slate-900 focus:border-sky-600 tabular-numbers"
                    required
                  />
                  {formMoldMode === "SET" && (currentFormPart as any)?.pairPart ? (
                    <div className="mt-1 text-[11px] bg-indigo-100/80 border border-indigo-200 text-indigo-950 p-2 rounded-lg space-y-0.5">
                      <p className="font-extrabold">
                        {formTargetQty ? `${formTargetQty} Set = ${formTargetQty} Kiri + ${formTargetQty} Kanan` : "1 Set = 1 Kiri + 1 Kanan"}
                      </p>
                      <p className="text-[10px] text-indigo-800">
                        Total {formTargetQty ? (Number(formTargetQty) * 2).toLocaleString("id-ID") : 0} pcs ({formTargetQty || 0} shot cetakan)
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-sky-800 mt-1">Bebas diisi angka berapa saja (misal: 350, 400, 1000 pcs)</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-sky-950 mb-1">Estimasi Waktu Selesai:</p>
                  <div className="bg-white border border-sky-300 rounded-lg p-2 text-center">
                    <p className="text-base font-black font-mono text-sky-700 tabular-numbers">
                      {liveEstimatedHours}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {formMoldMode === "SET" && (currentFormPart as any)?.pairPart
                        ? "Rumus: Target Set × CT (1 shot = 1 set)"
                        : "Rumus: (Target ÷ Cav) × CT"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Tanggal Rencana Produksi (Bisa Hari Ini, Besok, atau Lusa) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                  Tanggal Rencana Produksi (Target Eksekusi):
                </label>
                <input
                  type="date"
                  value={formScheduledDate}
                  onChange={(e) => setFormScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:border-sky-600"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Planner dapat menyiapkan job setup untuk besok atau hari lain sebelumnya.
                </p>
              </div>

              {/* 5. Catatan Planner */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Catatan Order / Customer (Opsional):
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Contoh: Order Batch A untuk Customer Astra..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-sky-600"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
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
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCreating ? "Menyimpan..." : "Simpan ke Antrean"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
