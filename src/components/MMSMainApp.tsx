"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import Navbar, { NavTab } from "./Navbar";
import MachineCard, { MachineData } from "./MachineCard";
import MachineControlModal from "./MachineControlModal";
import SupervisorDashboard from "./SupervisorDashboard";
import ProductionReports, { ReportRow, ParetoItem } from "./ProductionReports";
import MasterDataView from "./MasterDataView";
import ProductionPlanningView, { PlanDetailItem } from "./ProductionPlanningView";
import FinishGoodStockView from "./FinishGoodStockView";
import LiveClockDisplay from "./LiveClockDisplay";
import TraceabilityView from "./TraceabilityView";
import OutboundPdaView from "./OutboundPdaView";
import {
  getMachinesWithStatus,
  startRun,
  stopRun,
  changeRunOperator,
  scanKanban,
  voidScan,
  forceStopRun,
  getDashboardOverview,
  getProductionReports,
  createKanban,
  importMachinesFromCsv,
  importPartsWithRelationsFromCsv,
  deleteMachine,
  saveRunRejects,
  getProductionPlans,
  createProductionPlan,
  deleteProductionPlan,
  updateProductionPlan,
  getFinishGoodStock,
  FinishGoodStockItem,
  createUser,
  updateUser,
  deleteUser,
  getMasterData,
  setPartPair,
  createPart,
  updatePart,
  deletePart,
  deleteMachineProductionData,
  deleteProductionRun,
} from "@/lib/actions";
import { Factory, ShieldCheck, Info, User, Filter, Eye, CheckCircle2, ChevronRight, SlidersHorizontal, ClipboardList } from "lucide-react";

interface MMSMainAppProps {
  initialMachines: MachineData[];
  initialOverview: {
    machineCounts: { total: number; running: number; down: number; idle: number };
    productionToday: {
      totalRuns: number;
      totalTrolly: number;
      totalPcsOk: number;
      totalPcsReject: number;
      efficiency: number;
      rejectRate: number;
    };
  };
  initialReports: {
    rows: ReportRow[];
    pareto: ParetoItem[];
  };
  masterData: {
    machines: Array<{ id: number; code: string; model: string | null; tonnage: number; isActive: boolean }>;
    parts: Array<{
      id: number;
      partNo: string;
      name: string;
      cycleTimeSec: number;
      cavity: number;
      qtyPerTrolly: number;
      isActive: boolean;
    }>;
    stopReasons: Array<{ id: number; code?: string | null; category: string; reason: string; isActive: boolean }>;
    kanbans: Array<{
      id: number;
      code: string;
      partId: number;
      qtyPerTrolly: number | null;
      isActive: boolean;
      part: { partNo: string; name: string; qtyPerTrolly: number };
    }>;
    users: Array<{ id: number; name: string; employeeId: string; role: string }>;
    defectTypes?: Array<{ id: number; code: string; name: string; category: string | null }>;
  };
  initialPlans?: PlanDetailItem[];
  initialStock?: FinishGoodStockItem[];
  initialServerTime?: number;
  authenticatedUser?: {
    id: number;
    name: string;
    employeeId: string;
    role: string;
  };
}

export default function MMSMainApp({
  initialMachines,
  initialOverview,
  initialReports,
  masterData,
  initialPlans = [],
  initialStock = [],
  initialServerTime,
  authenticatedUser,
}: MMSMainAppProps) {
  const [activeTab, setActiveTab] = useState<NavTab>("machines");
  const [machines, setMachines] = useState<MachineData[]>(initialMachines);
  const [overview, setOverview] = useState(initialOverview);
  const [selectedMachine, setSelectedMachine] = useState<MachineData | null>(null);
  const [plans, setPlans] = useState<PlanDetailItem[]>(initialPlans);
  const [stock, setStock] = useState<FinishGoodStockItem[]>(initialStock);
  const [liveMasterData, setLiveMasterData] = useState(masterData);
  const [masterUsers, setMasterUsers] = useState(masterData.users || []);

  // Active User / Operator state from authenticated session
  const defaultFallbackUser = {
    id: 3,
    name: "Ahmad Dani",
    employeeId: "OPR01",
    role: "OPERATOR",
  };
  const [currentUser, setCurrentUser] = useState(
    authenticatedUser ||
    masterData.users?.find((u) => u.employeeId === "OPR01") ||
    masterData.users?.[0] ||
    defaultFallbackUser
  );

  useEffect(() => {
    if (authenticatedUser) {
      setCurrentUser(authenticatedUser);
      if (authenticatedUser.role?.toUpperCase() === "OPERATOR") {
        setOperatorViewMode("MY_MACHINES");
      }
    }
  }, [authenticatedUser]);

  useEffect(() => {
    if (currentUser?.role?.toUpperCase() === "OPERATOR") {
      setOperatorViewMode("MY_MACHINES");
    }
  }, [currentUser?.id, currentUser?.role]);

  const isOperator = currentUser?.role?.toUpperCase() === "OPERATOR";
  const isPlanner = currentUser?.role?.toUpperCase() === "PLANNER";

  // Redirect restricted tabs based on active role
  useEffect(() => {
    if (isOperator && (activeTab === "dashboard" || activeTab === "reports" || activeTab === "master" || activeTab === "planning")) {
      setActiveTab("machines");
    }
    if (isPlanner && activeTab === "master") {
      setActiveTab("planning");
    }
  }, [currentUser, isOperator, isPlanner, activeTab]);

  const [serverTimeOffset, setServerTimeOffset] = useState<number>(() => {
    if (initialServerTime) return initialServerTime - Date.now();
    return 0;
  });

  // Sinkronisasi jam server presisi (NTP atomic clock sync via /api/time)
  const syncServerClock = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await fetch("/api/time", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const t1 = Date.now();
        const rtt = t1 - t0;
        const estimatedServerNow = data.serverTime + Math.round(rtt / 2);
        const offset = estimatedServerNow - t1;
        setServerTimeOffset((prev) => (Math.abs(offset - prev) > 800 ? offset : prev));
      }
    } catch {
      // fallback silent
    }
  }, []);

  useEffect(() => {
    syncServerClock();
    const interval = setInterval(syncServerClock, 30000);
    return () => clearInterval(interval);
  }, [syncServerClock]);

  // Refresh machines, overview, planning, stock, and master data state
  const refreshData = useCallback(async () => {
    const [machRes, overRes, planRes, stockRes, masterRes] = await Promise.all([
      getMachinesWithStatus(),
      getDashboardOverview(),
      getProductionPlans(),
      getFinishGoodStock(),
      getMasterData(),
    ]);
    if (machRes.success && machRes.data) {
      setMachines(machRes.data as MachineData[]);
      if (machRes.serverTime) {
        const offset = new Date(machRes.serverTime).getTime() - Date.now();
        setServerTimeOffset((prev) => (Math.abs(offset - prev) > 800 ? offset : prev));
      }
      // If a machine modal is open, keep its state updated
      if (selectedMachine) {
        const updated = (machRes.data as MachineData[]).find((m) => m.id === selectedMachine.id);
        if (updated) setSelectedMachine(updated);
      }
    }
    if (overRes.success && overRes.data) {
      setOverview(overRes.data);
    }
    if (planRes.success && planRes.data) {
      setPlans(planRes.data as PlanDetailItem[]);
    }
    if (stockRes.success && stockRes.data) {
      setStock(stockRes.data as FinishGoodStockItem[]);
    }
    if (masterRes.success && masterRes.data) {
      setLiveMasterData(masterRes.data);
      setMasterUsers(masterRes.data.users);
    }
  }, [selectedMachine]);

  // Server action handlers
  const handleStartRun = async (data: {
    machineId: number;
    partId: number;
    operatorId: number;
    shift: string;
    planId?: number;
    moldMode?: string;
  }) => {
    const res = await startRun(data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleSetPartPair = async (partAId: number, partBId: number | null) => {
    const res = await setPartPair(partAId, partBId);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleStopRun = async (data: {
    runId: number;
    stopReasonId: number;
    remainderQty: number;
    qtyReject: number;
    notes: string;
    operatorId: number;
  }) => {
    const res = await stopRun(data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleChangeRunOperator = async (runId: number, newOperatorId: number) => {
    const res = await changeRunOperator({
      runId,
      newOperatorId,
      changedById: currentUser.id,
    });
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleScanKanban = async (
    runId: number,
    code: string,
    operatorId: number,
    customQty?: number
  ) => {
    const res = await scanKanban({ runId, code, operatorId, customQty });
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleVoidScan = async (scanId: number, reason: string, userId: number) => {
    const res = await voidScan(scanId, reason, userId);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleForceStop = async (runId: number, stopReasonId: number) => {
    const res = await forceStopRun(runId, stopReasonId, currentUser.id);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleApplyReportFilters = async (filters: {
    machineId?: number;
    partId?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await getProductionReports(filters);
    if (res.success && res.data) {
      return res.data;
    }
    return { rows: [], pareto: [] };
  };

  const handleCreateKanban = async (code: string, partId: number, qty?: number) => {
    const res = await createKanban(code, partId, qty);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleImportMachines = async (csvText: string) => {
    const res = await importMachinesFromCsv(csvText);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleImportParts = async (csvText: string) => {
    const res = await importPartsWithRelationsFromCsv(csvText);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleCreatePart = async (data: {
    partNo: string;
    name: string;
    cycleTimeSec: number;
    cavity: number;
    qtyPerTrolly: number;
    nextProcess?: string;
    machineIds?: number[];
    pairPartId?: number | null;
  }) => {
    const res = await createPart(data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleUpdatePart = async (
    id: number,
    data: {
      partNo?: string;
      name?: string;
      cycleTimeSec?: number;
      cavity?: number;
      qtyPerTrolly?: number;
      nextProcess?: string;
      isActive?: boolean;
      machineIds?: number[];
      pairPartId?: number | null;
    }
  ) => {
    const res = await updatePart(id, data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleDeletePart = async (id: number) => {
    const res = await deletePart(id);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleDeleteMachine = async (machineId: number) => {
    const res = await deleteMachine(machineId);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleDeleteMachineProductionData = async (machineId: number) => {
    const res = await deleteMachineProductionData(machineId, currentUser.id);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleDeleteProductionRun = async (runId: number) => {
    const res = await deleteProductionRun(runId, currentUser.id);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleSaveRunRejects = async (
    runId: number,
    rejects: Array<{ defectTypeId: number; qty: number; partId?: number }>
  ) => {
    const res = await saveRunRejects({
      runId,
      rejects,
      operatorId: currentUser.id,
    });
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleCreatePlan = async (data: {
    machineId: number;
    partId: number;
    targetQty: number;
    operatorId?: number | null;
    notes?: string;
    scheduledDate?: string;
    moldMode?: string;
  }) => {
    const res = await createProductionPlan(data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleDeletePlan = async (id: number) => {
    const res = await deleteProductionPlan(id);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleCreateUser = async (data: {
    employeeId: string;
    name: string;
    role: string;
    pin?: string;
  }) => {
    const res = await createUser(data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleUpdateUser = async (
    id: number,
    data: { name?: string; role?: string; pin?: string; isActive?: boolean }
  ) => {
    const res = await updateUser(id, data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleDeleteUser = async (id: number) => {
    const res = await deleteUser(id);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  const handleUpdatePlan = async (
    id: number,
    data: {
      targetQty?: number;
      priority?: number;
      status?: string;
      notes?: string;
    }
  ) => {
    const res = await updateProductionPlan(id, data);
    if (res.success) {
      await refreshData();
    }
    return res;
  };

  // Available Kanbans formatted for quick select
  const availableKanbanList = masterData.kanbans.map((k) => ({
    code: k.code,
    partNo: k.part.partNo,
    qty: k.qtyPerTrolly ?? k.part.qtyPerTrolly,
  }));

  // State Mode Tampilan Operator (Fokus Mesin Saya vs Semua Mesin)
  const [operatorViewMode, setOperatorViewMode] = useState<"MY_MACHINES" | "ALL_MACHINES">("MY_MACHINES");
  // State pemilihan mesin yang dipegang secara manual (jika operator belum start run atau pegang mesin baru)
  const [manualAssignedMachineIds, setManualAssignedMachineIds] = useState<number[]>([]);
  const [showMachineSelector, setShowMachineSelector] = useState(false);
  // Memoize planning machines array to avoid re-creating references during unrelated state updates
  const planningMachines = useMemo(() => {
    return machines.map((m) => ({
      id: m.id,
      code: m.code,
      model: m.model,
      tonnage: m.tonnage,
      allowedParts: m.allowedParts || [],
    }));
  }, [machines]);

  // Hitung mesin yang sedang dipegang oleh operator aktif saat ini
  const activeOperatorMachineIds = useMemo(() => {
    const ids = new Set<number>();
    // 1. Dari run yang sedang aktif berjalan
    machines.forEach((m) => {
      if (
        m.latestRun &&
        m.latestRun.operator &&
        (m.latestRun.operator.id === currentUser.id ||
          m.latestRun.operator.employeeId === currentUser.employeeId) &&
        m.status === "RUNNING"
      ) {
        ids.add(m.id);
      }
    });

    // 2. Dari rencana job (Production Plan) yang ditugaskan oleh planner ke operator ini
    plans.forEach((p) => {
      if (
        (p.status === "PENDING" || p.status === "IN_PROGRESS") &&
        (p.operatorId === currentUser.id || p.operatorEmployeeId === currentUser.employeeId)
      ) {
        ids.add(p.machineId);
      }
    });

    // 3. Gabungkan dengan manual assignment jika ada
    manualAssignedMachineIds.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [machines, currentUser, plans, manualAssignedMachineIds]);

  // Daftar mesin yang ditampilkan berdasarkan mode
  const displayedMachines = useMemo(() => {
    if (operatorViewMode === "MY_MACHINES" && currentUser.role?.toUpperCase() === "OPERATOR") {
      return machines.filter((m) => activeOperatorMachineIds.includes(m.id));
    }
    return machines;
  }, [machines, operatorViewMode, currentUser, activeOperatorMachineIds]);

  // Toggle penugasan manual mesin
  const handleToggleAssignMachine = (machineId: number) => {
    setManualAssignedMachineIds((prev) =>
      prev.includes(machineId) ? prev.filter((id) => id !== machineId) : [...prev, machineId]
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        usersList={masterUsers}
        serverTimeOffset={serverTimeOffset}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* TAB 1: LANTAI PRODUKSI */}
        {activeTab === "machines" && (
          <div className="space-y-4">
            {/* OPERATOR FOCUS BANNER (Tanggal, Jam, Status Operator & Mesin Tugas) */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Info Operator & Shift */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${currentUser.role === "ADMIN"
                        ? "bg-rose-500 text-white"
                        : currentUser.role === "SUPERVISOR"
                          ? "bg-indigo-500 text-white"
                          : currentUser.role === "PLANNER"
                            ? "bg-amber-400 text-slate-950"
                            : "bg-emerald-500 text-slate-950"
                        }`}
                    >
                      {currentUser.role === "ADMIN"
                        ? "Administrator Sistem MMS"
                        : currentUser.role === "SUPERVISOR"
                          ? "Supervisi Lantai Produksi"
                          : currentUser.role === "PLANNER"
                            ? "Perencanaan PPIC & Stok"
                            : "Stasiun Kerja Operator"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ID: {currentUser.employeeId}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-sky-400" />
                    <span>{currentUser.name}</span>
                  </h1>
                  <p className="text-xs text-slate-400">
                    {activeOperatorMachineIds.length > 0 ? (
                      <span>
                        Sedang mengoperasikan{" "}
                        <strong className="text-sky-300">
                          {activeOperatorMachineIds.length} Mesin
                        </strong>{" "}
                        ({activeOperatorMachineIds.map((id: number) => machines.find((m) => m.id === id)?.code).filter(Boolean).join(", ")})
                      </span>
                    ) : (
                      <span>Belum ada mesin yang aktif berjalan atas nama Anda saat ini.</span>
                    )}
                  </p>
                </div>

                {/* Live Tanggal & Waktu Server Besar (Isolated Component) */}
                <LiveClockDisplay serverTimeOffset={serverTimeOffset} />

                {/* View Mode Switcher (Mesin Saya vs Semua 15 Mesin) */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="bg-slate-800 p-1 rounded-xl flex border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setOperatorViewMode("MY_MACHINES")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${operatorViewMode === "MY_MACHINES"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                        }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Mesin Tugas Saya ({activeOperatorMachineIds.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperatorViewMode("ALL_MACHINES")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${operatorViewMode === "ALL_MACHINES"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                        }`}
                    >
                      <Factory className="w-3.5 h-3.5" />
                      <span>Semua Mesin (15)</span>
                    </button>
                  </div>

                  {/* Tombol Atur Penugasan Mesin */}
                  <button
                    type="button"
                    onClick={() => setShowMachineSelector(!showMachineSelector)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                    title="Pilih mesin yang Anda pegang hari ini"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Drawer Pemilih Mesin Tugas Manual (Jika operator memegang 2+ mesin atau ganti mesin) */}
              {showMachineSelector && (
                <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">
                      Pilih Mesin yang Anda Pegang / Tangani Shift Ini:
                    </span>
                    <button
                      type="button"
                      onClick={() => setManualAssignedMachineIds([])}
                      className="text-slate-400 hover:text-rose-400 underline text-[11px]"
                    >
                      Reset Pilihan Manual
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
                    {machines.map((m) => {
                      const isAssigned = activeOperatorMachineIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleAssignMachine(m.id)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border cursor-pointer flex items-center justify-between ${isAssigned
                            ? "bg-sky-900/60 border-sky-500 text-sky-200"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                            }`}
                        >
                          <span>{m.code}</span>
                          {isAssigned && <CheckCircle2 className="w-3 h-3 text-sky-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Switcher Tabs jika operator memegang LEBIH DARI 1 MESIN */}
            {activeOperatorMachineIds.length > 1 && (
              <div className="bg-sky-50 border-2 border-sky-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-sky-600 text-white rounded-lg">
                    <Factory className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-extrabold text-sky-950">
                      Mode Multi-Mesin Aktif ({activeOperatorMachineIds.length} Mesin Dipegang)
                    </h3>
                    <p className="text-[11px] text-sky-800">
                      Klik salah satu tombol mesin di samping untuk langsung membuka kontrol atau scan trolly:
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeOperatorMachineIds.map((mId: number) => {
                    const mach = machines.find((m) => m.id === mId);
                    if (!mach) return null;
                    const isRun = mach.status === "RUNNING";
                    return (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => setSelectedMachine(mach)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-xs ${isRun
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-white hover:bg-slate-100 text-slate-900 border border-slate-300"
                          }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>Buka {mach.code}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State jika filter Mesin Saya dipilih tapi belum ada mesin tugas */}
            {operatorViewMode === "MY_MACHINES" && displayedMachines.length === 0 ? (
              <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-300 shadow-2xs text-center space-y-4 max-w-xl mx-auto my-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
                  <ClipboardList className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                    Status: Siap Ditugaskan
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Kamu Belum Memiliki Tugas Hari Ini
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    Silakan hubungi bagian <strong className="text-sky-700 font-extrabold">Planner</strong> untuk penjadwalan antrean mesin molding, atau kamu juga dapat memilih mesin yang akan kamu operasikan secara mandiri di bawah ini.
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 text-left text-xs text-sky-950 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed text-sky-900">
                    Setiap rencana kerja yang dijadwalkan oleh Planner dengan nama/NIK Anda akan <strong>otomatis tampil</strong> di layar tugas ini secara langsung tanpa perlu me-refresh halaman.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowMachineSelector(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Pilih Mesin Tugas Mandiri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperatorViewMode("ALL_MACHINES")}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Factory className="w-4 h-4 text-slate-500" />
                    <span>Tampilkan Semua 15 Mesin</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Grid Mesin (Jika 1 mesin: lebar penuh; jika 2: berdampingan 2 kolom; jika banyak: grid responsive) */
              <div
                className={`grid gap-4 ${displayedMachines.length === 1
                  ? "grid-cols-1 max-w-2xl mx-auto"
                  : displayedMachines.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  }`}
              >
                {displayedMachines.map((machine: MachineData) => (
                  <MachineCard
                    key={machine.id}
                    machine={machine}
                    serverTimeOffset={serverTimeOffset}
                    onSelect={(m) => setSelectedMachine(m)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DASHBOARD SUPERVISOR */}
        {activeTab === "dashboard" && (
          <SupervisorDashboard
            machines={machines}
            overview={overview}
            onRefresh={refreshData}
            onSelectMachine={(m) => setSelectedMachine(m)}
            onForceStop={handleForceStop}
            stopReasons={masterData.stopReasons}
          />
        )}

        {/* TAB 3: RENCANA PRODUKSI & JOB SETUP (PPIC / PLANNER / SUPERVISOR / ADMIN) */}
        {activeTab === "planning" && !isOperator && (
          <ProductionPlanningView
            initialPlans={plans}
            machines={planningMachines}
            operators={masterUsers}
            currentUser={currentUser}
            onCreatePlan={handleCreatePlan}
            onDeletePlan={handleDeletePlan}
            onUpdateStatus={async (id, status) => {
              return await handleUpdatePlan(id, { status });
            }}
            onFilterPlans={async (filters) => {
              const res = await getProductionPlans(filters);
              if (res.success && res.data) {
                return res.data as PlanDetailItem[];
              }
              return [];
            }}
          />
        )}

        {/* TAB: TRACEABILITY QR CODE & NO. LOT */}
        {activeTab === "traceability" && (
          <TraceabilityView
            currentUser={currentUser}
            serverTimeOffset={serverTimeOffset}
          />
        )}

        {/* TAB 4: STOK GUDANG FINISH GOOD (REAL-TIME DARI HASIL TROLLY) */}
        {activeTab === "stock" && (
          <FinishGoodStockView
            initialStock={stock}
            onRefresh={async () => {
              const res = await getFinishGoodStock();
              return res.success && res.data ? (res.data as FinishGoodStockItem[]) : [];
            }}
          />
        )}

        {/* TAB: OUTBOUND PDA SCANNER (SISTEM KERANJANG PENGELUARAN NEXT PROCESS) */}
        {activeTab === "outbound" && (
          <OutboundPdaView
            currentUser={currentUser}
            serverTimeOffset={serverTimeOffset}
            onStockUpdated={async () => {
              const res = await getFinishGoodStock();
              if (res.success && res.data) {
                setStock(res.data as FinishGoodStockItem[]);
              }
            }}
          />
        )}

        {/* TAB 5: LAPORAN & DOWNTIME PARETO */}
        {activeTab === "reports" && (
          <ProductionReports
            initialRows={initialReports.rows}
            initialPareto={initialReports.pareto}
            machinesList={masterData.machines.map((m) => ({ id: m.id, code: m.code }))}
            partsList={masterData.parts.map((p) => ({ id: p.id, partNo: p.partNo }))}
            onApplyFilters={handleApplyReportFilters}
          />
        )}

        {/* TAB 5: MASTER DATA & KANBAN */}
        {activeTab === "master" && (
          <MasterDataView
            initialData={{ ...liveMasterData, users: masterUsers }}
            onCreateKanban={handleCreateKanban}
            onImportMachines={handleImportMachines}
            onImportParts={handleImportParts}
            onDeleteMachine={handleDeleteMachine}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onSetPartPair={handleSetPartPair}
            onCreatePart={handleCreatePart}
            onUpdatePart={handleUpdatePart}
            onDeletePart={handleDeletePart}
          />
        )}
      </main>

      {/* Machine Control Modal */}
      {selectedMachine && (
        <MachineControlModal
          isOpen={!!selectedMachine}
          onClose={() => setSelectedMachine(null)}
          machine={selectedMachine}
          serverTimeOffset={serverTimeOffset}
          currentUser={currentUser}
          stopReasons={masterData.stopReasons}
          availableKanbans={availableKanbanList}
          defectTypes={masterData.defectTypes || []}
          availableUsers={liveMasterData.users || masterData.users || []}
          onStartRun={handleStartRun}
          onStopRun={handleStopRun}
          onChangeRunOperator={handleChangeRunOperator}
          onScanKanban={handleScanKanban}
          onVoidScan={handleVoidScan}
          onSaveRejects={handleSaveRunRejects}
          onDeleteMachineProductionData={handleDeleteMachineProductionData}
          onDeleteProductionRun={handleDeleteProductionRun}
        />
      )}

      {/* Simple Industrial Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-3 px-4 sm:px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-medium">
            MMS (Molding Management System) &copy; 2026. Maulana Malik Ibrahim.
          </p>
          <p className="font-mono text-slate-500">
            Waktu Server: WIB (UTC+7)
          </p>
        </div>
      </footer>
    </div>
  );
}
