"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import {
  X,
  Play,
  Square,
  QrCode,
  Clock,
  User,
  Layers,
  AlertTriangle,
  History,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Calendar,
  FileText,
  AlertCircle,
  CalendarDays,
  TrendingUp,
  ArrowRight,
  Check,
  Lock,
  Printer,
  FileSpreadsheet,
  AlertOctagon,
  Pencil,
} from "lucide-react";
import QRCode from "qrcode";
import { MachineData } from "./MachineCard";
import BarcodeScannerModal from "./BarcodeScannerModal";
import StopReasonModal, { StopReasonItem } from "./StopReasonModal";
import InputNGModal, { DefectTypeItem } from "./InputNGModal";
import TomSelectInput, { TomSelectOption } from "./TomSelectInput";
import DailyMachineReportModal from "./DailyMachineReportModal";
import { printKanbanCard, printThermalKanbanElement } from "../lib/printThermal";

interface MachineControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: MachineData;
  currentUser: {
    id: number;
    name: string;
    employeeId: string;
    role: string;
  };
  stopReasons: StopReasonItem[];
  availableKanbans: Array<{ code: string; partNo: string; qty: number }>;
  serverTimeOffset?: number; // Delta ms antara server dan browser klien untuk sinkronisasi waktu akurat
  defectTypes?: DefectTypeItem[];
  onStartRun: (data: {
    machineId: number;
    partId: number;
    operatorId: number;
    shift: string;
    planId?: number;
    moldMode?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onStopRun: (data: {
    runId: number;
    stopReasonId: number;
    remainderQty: number;
    qtyReject: number;
    notes: string;
    operatorId: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onScanKanban: (
    runId: number,
    code: string,
    operatorId: number,
    customQty?: number
  ) => Promise<{ success: boolean; error?: string; addedQty?: number; isPartial?: boolean; lotNumber?: string; data?: any }>;
  onVoidScan: (
    scanId: number,
    reason: string,
    userId: number
  ) => Promise<{ success: boolean; error?: string }>;
  onSaveRejects?: (
    runId: number,
    rejects: Array<{ defectTypeId: number; qty: number; partId?: number }>
  ) => Promise<{ success: boolean; error?: string; totalReject?: number }>;
  onDeleteMachineProductionData?: (
    machineId: number
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteProductionRun?: (
    runId: number
  ) => Promise<{ success: boolean; error?: string }>;
  availableUsers?: Array<{
    id: number;
    employeeId: string;
    name: string;
    role?: string;
  }>;
  onChangeRunOperator?: (
    runId: number,
    newOperatorId: number
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdatePlan?: (
    id: number,
    data: {
      targetQty?: number;
      notes?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

// ============================================================
// 1) KOMPONEN BANTU: font TERBESAR yang masih muat di kotaknya.
//    - teks pendek  -> besar (sampai batas `max`)
//    - teks panjang -> mengecil otomatis (sampai batas `min`)
//    Kotak harus punya lebar (dari layout) dan tinggi (prop style.height).
// ============================================================
interface FitTextProps {
  children: React.ReactNode;
  max: number;
  min?: number;
  multiline?: boolean;
  lineHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}

const FitText: React.FC<FitTextProps> = ({
  children,
  max,
  min = 5,
  multiline = false,
  lineHeight = 1.1,
  className = "",
  style = {},
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return; // elemen belum tampil / tersembunyi
    let size = max;
    el.style.fontSize = `${size}pt`;
    const fits = () =>
      el.scrollWidth <= el.clientWidth * 0.97 && // lebar (cadangan 3% untuk cetak)
      el.scrollHeight <= el.clientHeight + 1;    // tinggi kotak
    while (size > min && !fits()) {
      size -= 0.25;
      el.style.fontSize = `${size}pt`;
    }
  }, [max, min, multiline]);

  useLayoutEffect(() => {
    fit();
  }, [children, fit]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener("beforeprint", fit);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("beforeprint", fit);
    };
  }, [fit]);

  return (
    <div
      ref={ref}
      data-fit-max={max}
      data-fit-min={min}
      className={className}
      style={{
        fontSize: `${max}pt`,
        lineHeight,
        overflow: "hidden",
        whiteSpace: multiline ? "normal" : "nowrap",
        wordBreak: multiline ? "break-word" : "normal",
        textOverflow: "ellipsis",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const LBL = "text-[5.5pt] font-bold uppercase text-slate-600 leading-none mb-[0.3mm]";
const TAG = "bg-black text-white font-mono font-black text-[6pt] leading-none rounded-[0.6mm] px-[1mm] py-[0.2mm] shrink-0 ml-[1mm] truncate";

export default function MachineControlModal({
  isOpen,
  onClose,
  machine,
  currentUser,
  stopReasons,
  availableKanbans,
  serverTimeOffset = 0,
  defectTypes = [],
  onStartRun,
  onStopRun,
  onScanKanban,
  onVoidScan,
  onSaveRejects,
  onDeleteMachineProductionData,
  onDeleteProductionRun,
  availableUsers = [],
  onChangeRunOperator,
  onUpdatePlan,
}: MachineControlModalProps) {
  const [modalTab, setModalTab] = useState<"operation" | "timeline">("operation");

  // Plan target revision state
  const [planToEdit, setPlanToEdit] = useState<{
    id: number;
    partNo: string;
    partName: string;
    targetQty: number;
    notes: string;
    isSet: boolean;
  } | null>(null);
  const [editTargetInput, setEditTargetInput] = useState<number>(0);
  const [editNotesInput, setEditNotesInput] = useState<string>("");
  const [isSavingPlanRevision, setIsSavingPlanRevision] = useState(false);
  const [editPlanError, setEditPlanError] = useState<string | null>(null);

  const handleOpenEditPlan = (plan: {
    id: number;
    partNo: string;
    partName: string;
    targetQty: number;
    notes?: string | null;
    isSet: boolean;
  }) => {
    setPlanToEdit({
      id: plan.id,
      partNo: plan.partNo,
      partName: plan.partName,
      targetQty: plan.targetQty,
      notes: plan.notes || "",
      isSet: plan.isSet,
    });
    setEditTargetInput(plan.targetQty);
    setEditNotesInput(plan.notes || "");
    setEditPlanError(null);
  };

  const handleSavePlanRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planToEdit || !onUpdatePlan) return;
    if (editTargetInput <= 0) {
      setEditPlanError("Target produksi harus lebih dari 0.");
      return;
    }
    setIsSavingPlanRevision(true);
    setEditPlanError(null);
    try {
      const res = await onUpdatePlan(planToEdit.id, {
        targetQty: Math.round(editTargetInput),
        notes: editNotesInput.trim() || undefined,
      });
      if (res.success) {
        setPlanToEdit(null);
      } else {
        setEditPlanError(res.error || "Gagal mengubah target rencana produksi.");
      }
    } catch (err: any) {
      setEditPlanError(err?.message || "Terjadi kesalahan saat menyimpan revisi target.");
    } finally {
      setIsSavingPlanRevision(false);
    }
  };

  // Start Run form states
  const [selectedPartId, setSelectedPartId] = useState<number>(
    machine.allowedParts[0]?.id || 0
  );
  const [showManualPartSelect, setShowManualPartSelect] = useState<boolean>(false);
  const [shift, setShift] = useState<string>("Shift 1");
  const [moldMode, setMoldMode] = useState<string>("SET");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Modals for sub-flows
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [isInputNGOpen, setIsInputNGOpen] = useState(false);

  // Live Timer & Target calculations
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [elapsedStr, setElapsedStr] = useState<string>("00:00:00");

  // Void scan reason modal
  const [voidScanId, setVoidScanId] = useState<number | null>(null);
  const [voidReasonText, setVoidReasonText] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const isRunning = machine.status === "RUNNING";
  const currentRun = machine.latestRun;
  const daily = machine.dailySummary;

  // Change run operator / relief states
  const [isChangingOperator, setIsChangingOperator] = useState(false);
  const [selectedNewOperatorId, setSelectedNewOperatorId] = useState<number>(0);
  const [isSavingOperator, setIsSavingOperator] = useState(false);
  const [activeOperator, setActiveOperator] = useState(currentRun?.operator || null);

  useEffect(() => {
    if (currentRun?.operator) {
      setActiveOperator(currentRun.operator);
    }
  }, [currentRun?.operator]);

  const isMorningShift1 = React.useMemo(() => {
    if (isRunning) return false;
    const now = new Date();
    const day = now.getDay();
    const isWd = day >= 1 && day <= 5;
    const curMin = now.getHours() * 60 + now.getMinutes();
    // Shift 1 morning window: 07:30 to 11:30 WIB
    return isWd && curMin >= 450 && curMin < 690;
  }, [isRunning]);

  const operatorSelectOptions: TomSelectOption[] = React.useMemo(() => {
    return (availableUsers || []).map((u) => ({
      value: u.id,
      label: `[${u.employeeId}] ${u.name}${u.role ? ` (${u.role})` : ""}`,
      sublabel: u.employeeId,
    }));
  }, [availableUsers]);

  const handleConfirmChangeOperator = async () => {
    if (!onChangeRunOperator || !currentRun || !selectedNewOperatorId) return;
    setIsSavingOperator(true);
    try {
      const res = await onChangeRunOperator(currentRun.id, selectedNewOperatorId);
      if (res.success) {
        const found = (availableUsers || []).find((u) => u.id === selectedNewOperatorId);
        if (found) {
          setActiveOperator({
            id: found.id,
            name: found.name,
            employeeId: found.employeeId,
          } as any);
        }
        setIsChangingOperator(false);
      } else {
        alert(res.error || "Gagal mengganti operator");
      }
    } finally {
      setIsSavingOperator(false);
    }
  };

  // Cek apakah ada job yang sudah direncanakan oleh PPIC / Planner untuk mesin ini
  const hasPlannedJob = !!(machine.activePlan || (machine.nextPlans && machine.nextPlans.length > 0));

  // Daftar seluruh part yang dijadwalkan diproses hari ini di mesin ini
  const activePartPlan = machine.activePlan || null;
  const queuedPlans = machine.nextPlans || [];
  const completedPlansToday = (machine.todayPlans || []).filter(
    (p) => p.status === "COMPLETED"
  );
  const totalPartsTodayCount =
    (currentRun ? 1 : activePartPlan ? 1 : 0) +
    queuedPlans.length +
    completedPlansToday.filter(
      (cp) => cp.partId !== currentRun?.part.id && cp.id !== activePartPlan?.id
    ).length;

  // Hak Akses & Penguncian Operator:
  // Hanya operator yang bertugas (atau Supervisor/Admin) yang dapat mengubah status mesin (Stop, Scan, NG)
  const isSupervisorOrAdmin = currentUser.role === "SUPERVISOR" || currentUser.role === "ADMIN";
  const isOperatorLocked = isRunning && currentRun
    ? currentRun.operator.id !== currentUser.id && !isSupervisorOrAdmin
    : false;

  const targetPlan = machine.activePlan || machine.nextPlans?.[0];
  const isPlanLocked = !isRunning && targetPlan?.operatorId
    ? targetPlan.operatorId !== currentUser.id && !isSupervisorOrAdmin
    : false;

  // State Cetak Label Kanban Trolly Selesai (Full)
  const [trolleyPrintData, setTrolleyPrintData] = useState<{
    trolleyNum: number;
    partNo: string;
    partName: string;
    qty: number;
    machineCode: string;
    operatorName: string;
    operatorId: string;
    timeStr: string;
    kanbanCode: string;
    lotNumber: string;
    uniqueQrPayload: string;
    shift: string;
    nextProcess: string;
    isPartial?: boolean;
    containerType?: string;
    customer?: string | null;
  } | null>(null);
  const [trolleyQrUrl, setTrolleyQrUrl] = useState<string>("");

  useEffect(() => {
    if (trolleyPrintData) {
      QRCode.toDataURL(trolleyPrintData.uniqueQrPayload, {
        width: 220,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setTrolleyQrUrl(url))
        .catch((err) => console.error("Error generating trolley QR:", err));
    }
  }, [trolleyPrintData]);

  // Keyboard accessibility (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        isOpen &&
        !isScannerOpen &&
        !isStopModalOpen &&
        !isInputNGOpen &&
        !voidScanId
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isScannerOpen, isStopModalOpen, isInputNGOpen, voidScanId]);

  // Update selected part when machine changes: prioritaskan part terakhir jika mesin baru saja stop
  useEffect(() => {
    if (machine.latestRun && machine.latestRun.part) {
      setSelectedPartId(machine.latestRun.part.id);
    } else if (machine.allowedParts.length > 0) {
      setSelectedPartId(machine.allowedParts[0].id);
    }
  }, [machine]);

  // Elapsed Timer effect with serverTimeOffset synchronization and previous accumulated duration
  useEffect(() => {
    if (isRunning && currentRun) {
      const updateTimer = () => {
        const start = new Date(currentRun.startTime).getTime();
        const nowSynchronized = Date.now() + serverTimeOffset;
        const currentDiff = Math.max(0, Math.floor((nowSynchronized - start) / 1000));
        const totalDiff = currentDiff + (currentRun.previousAccumulatedSec || 0);

        setElapsedSec(totalDiff);

        const hours = Math.floor(totalDiff / 3600);
        const minutes = Math.floor((totalDiff % 3600) / 60);
        const seconds = totalDiff % 60;
        setElapsedStr(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, currentRun, serverTimeOffset]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartId) {
      setStartError("Silakan pilih part terlebih dahulu.");
      return;
    }

    if (isPrevPartScansEmpty && !isSameOrPairLastPart) {
      setStartError(
        `Tidak dapat beralih ke next proses: Part yang diproses sebelumnya (${currentRun?.part.partNo}) belum memiliki input scan kuantiti trolly. Harap selesaikan scan trolly part sebelumnya terlebih dahulu.`
      );
      return;
    }

    setIsStarting(true);
    setStartError(null);

    const res = await onStartRun({
      machineId: machine.id,
      partId: selectedPartId,
      operatorId: currentUser.id,
      shift,
      moldMode,
    });

    setIsStarting(false);
    if (!res.success) {
      setStartError(res.error || "Gagal memulai run.");
    }
  };

  const handleStopSubmit = async (data: {
    stopReasonId: number;
    remainderQty: number;
    qtyReject: number;
    notes: string;
  }) => {
    if (!currentRun) return { success: false, error: "Run tidak ditemukan." };

    const res = await onStopRun({
      runId: currentRun.id,
      stopReasonId: data.stopReasonId,
      remainderQty: data.remainderQty,
      qtyReject: data.qtyReject,
      notes: data.notes,
      operatorId: currentUser.id,
    });

    if (res.success) {
      setIsStopModalOpen(false);
    }
    return res;
  };

  const handleScanCode = async (code: string, customQty?: number) => {
    if (!currentRun) return { success: false, error: "Run tidak aktif." };
    const res = await onScanKanban(currentRun.id, code, currentUser.id, customQty);

    if (res.success) {
      // Trolly tercatat -> Buat Lot ID unik & QR payload presisi jam
      const trollyNumber = (currentRun.trollyCount || 0) + 1;
      const now = new Date(Date.now() + serverTimeOffset);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const yyyy = now.getFullYear();
      const mm = pad(now.getMonth() + 1);
      const dd = pad(now.getDate());
      const hh = pad(now.getHours());
      const min = pad(now.getMinutes());
      const ss = pad(now.getSeconds());

      const yy = String(yyyy).slice(-2);
      const shiftStr = currentRun.shift || "Shift 1";
      const shiftMatch = shiftStr.match(/\d+/);
      const shiftCode = shiftMatch ? `S${shiftMatch[0]}` : shiftStr.replace(/\s+/g, "");
      const machineCode = (machine.code || `M${machine.id}`).trim().replace(/\s+/g, "");
      const rawResData = (res as any)?.data || {};
      const addedQty =
        typeof (res as any)?.addedQty === "number"
          ? (res as any).addedQty
          : typeof rawResData.addedQty === "number"
            ? rawResData.addedQty
            : typeof customQty === "number" && customQty > 0
              ? customQty
              : currentRun.part.qtyPerTrolly;

      const isPartial =
        typeof (res as any)?.isPartial === "boolean"
          ? (res as any).isPartial
          : typeof rawResData.isPartial === "boolean"
            ? rawResData.isPartial
            : addedQty < currentRun.part.qtyPerTrolly;

      const effectiveTrolleyNum =
        rawResData.trollyNumber ?? (res as any)?.trollyNumber ?? trollyNumber;

      const isKanbanRH =
        (currentRun.part.partNo || "").toUpperCase().includes("RH") ||
        (currentRun.part.name || "").toUpperCase().includes("RH");
      const sideTag =
        currentRun.moldMode === "SET" && currentRun.part.pairPartId
          ? isKanbanRH
            ? "-RH"
            : "-LH"
          : "";
      const lotNumber =
        rawResData.lotNumber ||
        (res as any)?.lotNumber ||
        `L-${machineCode}-${yy}${mm}${dd}-${shiftCode}${sideTag}-T${pad(effectiveTrolleyNum)}${isPartial ? "-PARTIAL" : ""
        }`;
      const uniqueQrPayload = `${code}#${lotNumber}#${hh}${min}${ss}`;

      const timeStr =
        now.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }) +
        " " +
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) +
        " WIB";

      setTrolleyPrintData({
        trolleyNum: effectiveTrolleyNum,
        partNo: currentRun.part.partNo,
        partName: currentRun.part.name,
        qty: addedQty,
        machineCode: machine.code,
        operatorName: currentUser.name,
        operatorId: currentUser.employeeId,
        timeStr,
        kanbanCode: code,
        lotNumber,
        uniqueQrPayload,
        shift: shiftStr,
        nextProcess: currentRun.part.nextProcess || "PAINTING",
        isPartial,
        containerType: currentRun.part.containerType || "TROLLY",
        customer: (currentRun.part as any).customer || null,
      });

      setIsScannerOpen(false);
    }
    return res;
  };

  const handleOpenTrolleyPrint = (
    param?: number | { trolleyNum?: number; isPartial?: boolean; customQty?: number }
  ) => {
    if (!currentRun) return;
    const now = new Date(Date.now() + serverTimeOffset);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    const isPartial = typeof param === "object" ? Boolean(param?.isPartial) : false;
    const customQty = typeof param === "object" ? param?.customQty : undefined;
    const trolleyNum = typeof param === "number" ? param : param?.trolleyNum;

    const tNum = trolleyNum ?? ((currentRun.trollyCount || 0) + (isPartial ? 1 : 1));
    const yy = String(yyyy).slice(-2);
    const shiftStr = currentRun.shift || "Shift 1";
    const shiftMatch = shiftStr.match(/\d+/);
    const shiftCode = shiftMatch ? `S${shiftMatch[0]}` : shiftStr.replace(/\s+/g, "");
    const machineCode = (machine.code || `M${machine.id}`).trim().replace(/\s+/g, "");
    const isKanbanRH =
      (currentRun.part.partNo || "").toUpperCase().includes("RH") ||
      (currentRun.part.name || "").toUpperCase().includes("RH");
    const sideTag =
      currentRun.moldMode === "SET" && currentRun.part.pairPartId
        ? isKanbanRH
          ? "-RH"
          : "-LH"
        : "";
    const lotNumber = `L-${machineCode}-${yy}${mm}${dd}-${shiftCode}${sideTag}-T${pad(tNum)}${isPartial ? "-PARTIAL" : ""
      }`;

    const kanbanCode =
      availableKanbans.find((k) => k.partNo === currentRun.part.partNo)?.code ||
      `KB-${currentRun.part.partNo.replace(/\s+/g, "-")}`;
    const uniqueQrPayload = `${kanbanCode}#${lotNumber}#${hh}${min}${ss}`;

    const timeStr =
      now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) +
      " " +
      now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      " WIB";

    setTrolleyPrintData({
      trolleyNum: tNum,
      partNo: currentRun.part.partNo,
      partName: currentRun.part.name,
      qty: isPartial && typeof customQty === "number" ? customQty : currentRun.part.qtyPerTrolly,
      machineCode: machine.code,
      operatorName: currentRun.operator.name,
      operatorId: currentRun.operator.employeeId || currentUser.employeeId,
      timeStr,
      kanbanCode,
      lotNumber,
      uniqueQrPayload,
      shift: shiftStr,
      nextProcess: currentRun.part.nextProcess || "PAINTING",
      isPartial,
      containerType: currentRun.part.containerType || "TROLLY",
      customer: (currentRun.part as any).customer || null,
    });
  };

  const handleConfirmVoidScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidScanId || !voidReasonText.trim()) return;

    if (currentUser.role !== "ADMIN") {
      alert("Akses Ditolak: Hanya pengguna dengan Role ADMIN yang berwenang membatalkan scan trolly.");
      return;
    }

    setIsVoiding(true);
    const res = await onVoidScan(voidScanId, voidReasonText.trim(), currentUser.id);
    setIsVoiding(false);

    if (res.success) {
      setVoidScanId(null);
      setVoidReasonText("");
    } else {
      alert(res.error || "Gagal membatalkan scan.");
    }
  };

  const handleClearMachineProductionData = async () => {
    if (currentUser.role !== "ADMIN") {
      alert("Akses Ditolak: Hanya pengguna dengan Role ADMIN yang berwenang menghapus data produksi mesin.");
      return;
    }

    const confirmMsg = `⚠️ PERINGATAN HAK AKSES ADMINISTRATOR:\n\nApakah Anda yakin ingin MENGHAPUS SELURUH DATA PRODUKSI pada mesin ${machine.code}?\n\n• Seluruh riwayat run produksi, scan kanban trolly, dan catatan defect NG pada mesin ini akan dihapus secara permanen.\n• Status mesin akan dikembalikan ke posisi IDLE.\n• Tindakan ini dicatat dalam Audit Log sistem.\n\nLanjutkan penghapusan data?`;
    if (!window.confirm(confirmMsg)) return;

    if (!onDeleteMachineProductionData) return;

    setIsDeletingData(true);
    try {
      const res = await onDeleteMachineProductionData(machine.id);
      if (!res.success) {
        alert(res.error || "Gagal menghapus data produksi mesin.");
      } else {
        alert(`Semua riwayat dan data produksi pada mesin ${machine.code} berhasil dibersihkan.`);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus data produksi mesin.";
      alert(msg);
    } finally {
      setIsDeletingData(false);
    }
  };

  const handleDeleteSingleRun = async (runId: number, partNo: string, qtyOk: number) => {
    if (currentUser.role !== "ADMIN") {
      alert("Akses Ditolak: Hanya pengguna dengan Role ADMIN yang berwenang menghapus data produksi.");
      return;
    }

    const confirmMsg = `Konfirmasi Administrator:\n\nApakah Anda yakin ingin menghapus data Run Produksi #${runId}?\nPart: ${partNo}\nHasil OK: ${qtyOk} pcs\n\nData scan trolly dan defect reject terkait run ini akan dihapus. Lanjutkan?`;
    if (!window.confirm(confirmMsg)) return;

    if (!onDeleteProductionRun) return;

    setIsDeletingData(true);
    try {
      const res = await onDeleteProductionRun(runId);
      if (!res.success) {
        alert(res.error || "Gagal menghapus data run produksi.");
      } else {
        alert(`Data run produksi #${runId} berhasil dihapus.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus data run produksi.";
      alert(msg);
    } finally {
      setIsDeletingData(false);
    }
  };

  // Target Qty & Efficiency Formula
  let targetQty = 0;
  let efficiency = 0;
  if (isRunning && currentRun && currentRun.part.cycleTimeSec > 0) {
    targetQty = Math.floor(
      (elapsedSec / currentRun.part.cycleTimeSec) * currentRun.part.cavity
    );
    if (targetQty > 0) {
      efficiency = Math.min(
        150,
        Math.round((currentRun.currentQty / targetQty) * 1000) / 10
      );
    }
  }

  const selectedPartObj = machine.allowedParts.find((p) => p.id === selectedPartId);
  const isSameAsLastPart =
    !isRunning &&
    currentRun &&
    currentRun.part &&
    selectedPartId === currentRun.part.id;

  const isSameOrPairLastPart =
    isSameAsLastPart ||
    Boolean(
      !isRunning &&
      currentRun &&
      currentRun.part?.pairPartId &&
      selectedPartId === currentRun.part.pairPartId &&
      (currentRun.moldMode === "SET" || moldMode === "SET")
    );

  // Validasi Poka-Yoke: Part yang diproses sebelumnya belum memiliki input scan kuantiti trolly
  const prevRunScansCount = currentRun ? (currentRun.currentQty || 0) : 0;
  const isPrevPartScansEmpty = Boolean(
    !isRunning &&
    currentRun &&
    prevRunScansCount === 0 &&
    (currentRun.trollyCount || 0) === 0
  );

  const allowedPartOptions: TomSelectOption[] = machine.allowedParts.map((p) => ({
    value: p.id,
    label: `${p.partNo} - ${p.name}`,
    sublabel: `CT: ${p.cycleTimeSec}s | Cavity: ${p.cavity} shot | Standar: ${p.qtyPerTrolly} pcs/trolly${p.pairPart ? ` (Family Mold: Pasangan ${p.pairPart.partNo})` : ""
      }`,
  }));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-300 flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="machine-modal-title"
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${isRunning
            ? "bg-emerald-700 text-white border-emerald-800"
            : machine.status === "DOWN"
              ? "bg-rose-700 text-white border-rose-800"
              : "bg-slate-900 text-white border-slate-800"
            }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg text-white">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="machine-modal-title" className="text-xl font-black tracking-tight">
                  {machine.code}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-white text-slate-900">
                  {machine.tonnage} Ton
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded font-black uppercase bg-black/30">
                  {machine.status}
                </span>
                {totalPartsTodayCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white/20 text-white flex items-center gap-1 border border-white/20">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{totalPartsTodayCount} Part Hari Ini</span>
                  </span>
                )}
              </div>
              <p className="text-xs opacity-90">{machine.model || "Injection Molding Machine"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition border border-white/20 shadow-xs cursor-pointer tap-target"
              title="Buka Formulir Laporan Harian (FO/MLD/009 Rev.08)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Laporan Standar (FO/MLD/009)</span>
              <span className="sm:hidden">Laporan</span>
            </button>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer tap-target"
              aria-label="Tutup Kontrol Mesin"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector: Operasi vs Kronologi/Progress Hari Ini */}
        <div className="bg-slate-100 p-1.5 flex gap-1 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setModalTab("operation")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer tap-target ${modalTab === "operation"
              ? "bg-white text-sky-800 shadow-xs border border-slate-200 font-extrabold"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Layers className="w-4 h-4" />
            <span>Operasi Mesin (START / STOP / SCAN)</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab("timeline")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer tap-target ${modalTab === "timeline"
              ? "bg-white text-sky-800 shadow-xs border border-slate-200 font-extrabold"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <History className="w-4 h-4 text-sky-600" />
            <span>Progress & Kronologi Hari Ini</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* VIEW TAB 1: OPERASI MESIN */}
          {modalTab === "operation" && (
            <>
              {/* STATE 1: RUNNING STATE */}
              {isRunning && currentRun ? (
                <div className="space-y-5">
                  {/* Top Banner Live Production */}
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-800 bg-emerald-200/60 px-2.5 py-0.5 rounded-full mb-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                        Sedang Beroperasi
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">
                        {currentRun.part.partNo}
                      </h3>
                      <p className="text-sm font-semibold text-slate-700">{currentRun.part.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Cycle Time:{" "}
                        <span className="font-mono font-bold text-slate-700">
                          {currentRun.part.cycleTimeSec}s
                        </span>{" "}
                        | Cavity:{" "}
                        <span className="font-mono font-bold text-slate-700">
                          {currentRun.part.cavity}
                        </span>{" "}
                        | Standar Trolly:{" "}
                        <span className="font-mono font-bold text-slate-700">
                          {currentRun.part.qtyPerTrolly} pcs
                        </span>
                      </p>
                    </div>

                    {/* Big Live Clock (Disinkronkan dengan Jam Server) */}
                    <div className="bg-white border-2 border-emerald-300 rounded-xl px-5 py-3 text-center shadow-xs shrink-0 w-full sm:w-auto min-w-[240px]">
                      <p className="text-[11px] font-bold text-emerald-800 uppercase flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Durasi Jalan (Server Sync)
                      </p>
                      <p className="text-2xl font-black text-emerald-700 font-mono tabular-numbers mt-0.5">
                        {elapsedStr}
                      </p>

                      {!isChangingOperator ? (
                        <div className="mt-1 pt-1.5 border-t border-emerald-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 truncate min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                            <span className="text-[11px] text-slate-500">Inspector:</span>
                            <span className="font-extrabold text-slate-900 truncate">
                              {activeOperator?.name || currentRun.operator.name}
                            </span>
                          </div>
                          {onChangeRunOperator && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNewOperatorId(activeOperator?.id || currentRun.operator.id);
                                setIsChangingOperator(true);
                              }}
                              className="ml-2 shrink-0 text-[10px] font-black uppercase tracking-wider text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-md transition-all shadow-2xs cursor-pointer"
                              title="Ganti Operator / Inspector aktif (istirahat/relief)"
                            >
                              Ganti
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-emerald-200 text-left space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
                              Pilih Operator Pengganti:
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsChangingOperator(false)}
                              className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>
                          <TomSelectInput
                            id="change-run-operator-select"
                            options={operatorSelectOptions}
                            value={selectedNewOperatorId}
                            onChange={(val) => setSelectedNewOperatorId(Number(val))}
                            placeholder="Pilih nama operator pengganti..."
                          />
                          <div className="flex gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setIsChangingOperator(false)}
                              className="flex-1 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmChangeOperator}
                              disabled={isSavingOperator || !selectedNewOperatorId}
                              className="flex-1 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded border border-emerald-700 transition-colors shadow-xs"
                            >
                              {isSavingOperator ? "Menyimpan..." : "Simpan"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Antrean Part Hari Ini (Quick Breadcrumb / Stepper) */}
                  <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-800 font-black shrink-0">
                      <CalendarDays className="w-4 h-4 text-sky-700" />
                      <span>Part Diproses Hari Ini:</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      {/* Active Part */}
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-400 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                        <span>#1 {currentRun.part.partNo} (Sedang Jalan)</span>
                      </span>

                      {/* Next Queued Parts */}
                      {queuedPlans.map((qp, idx) => (
                        <React.Fragment key={qp.id}>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-slate-800 font-bold border border-slate-300 shadow-2xs">
                            <span className="text-[10px] font-mono text-sky-700 font-extrabold">#{qp.priority || idx + 2}</span>
                            <span>{qp.part.partNo}</span>
                            <span className="text-[10px] text-slate-500 font-normal font-mono">({qp.targetQty} pcs)</span>
                          </span>
                        </React.Fragment>
                      ))}

                      {queuedPlans.length === 0 && (
                        <span className="text-[11px] text-slate-500 italic">
                          (Hanya 1 part dijadwalkan hari ini)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Family Mold Mode (LH + RH Pair) Status & Independent Counters */}
                  {currentRun.pairStats && (currentRun.moldMode === "SET" || !currentRun.moldMode) && (
                    <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border-2 border-indigo-300 rounded-2xl p-4 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                            <Layers className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="text-xs font-black uppercase text-indigo-950 tracking-wide block">
                              Family Mold Aktif: Mode 1 Set (LH & RH)
                            </span>
                            <span className="text-[11px] text-indigo-800">
                              1 Kali Shot menghasilkan 1 Part Kiri (LH) dan 1 Part Kanan (RH)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black bg-indigo-200/90 text-indigo-950 px-3 py-1 rounded-lg border border-indigo-300 shadow-2xs">
                            Total: {currentRun.pairStats.setsCount} Set Selesai
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Box LH */}
                        <div className="bg-white border-2 border-sky-200 rounded-xl p-3 space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 bg-sky-100 px-2 py-0.5 rounded">
                              Part Kiri (LH)
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-500">
                              Std: {currentRun.pairStats.lhPart.qtyPerTrolly} pcs/trolly
                            </span>
                          </div>
                          <p className="text-sm font-black text-slate-900 truncate">
                            {currentRun.pairStats.lhPart.partNo} - {currentRun.pairStats.lhPart.name}
                          </p>
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-xl font-black font-mono text-sky-700">
                              {currentRun.pairStats.lhQty} <span className="text-xs font-normal text-slate-500">pcs</span>
                            </span>
                            <span className="text-xs font-mono font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {currentRun.pairStats.lhTrollyCount} Trolly LH
                            </span>
                          </div>
                        </div>

                        {/* Box RH */}
                        <div className="bg-white border-2 border-indigo-200 rounded-xl p-3 space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                              Part Kanan (RH)
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-500">
                              Std: {currentRun.pairStats.rhPart.qtyPerTrolly} pcs/trolly
                            </span>
                          </div>
                          <p className="text-sm font-black text-slate-900 truncate">
                            {currentRun.pairStats.rhPart.partNo} - {currentRun.pairStats.rhPart.name}
                          </p>
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-xl font-black font-mono text-indigo-700">
                              {currentRun.pairStats.rhQty} <span className="text-xs font-normal text-slate-500">pcs</span>
                            </span>
                            <span className="text-xs font-mono font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              {currentRun.pairStats.rhTrollyCount} Trolly RH
                            </span>
                          </div>
                        </div>
                      </div>

                      {currentRun.pairStats.lhQty !== currentRun.pairStats.rhQty && (
                        <div className="bg-amber-100/70 border border-amber-300 rounded-lg px-3 py-1.5 text-[11px] text-amber-900 flex items-center justify-between">
                          <span className="font-semibold">
                            Selisih: {Math.abs(currentRun.pairStats.lhQty - currentRun.pairStats.rhQty)} pcs belum komplit set.
                          </span>
                          <span className="font-mono font-bold">
                            {currentRun.pairStats.lhQty > currentRun.pairStats.rhQty ? "Trolly RH tertinggal" : "Trolly LH tertinggal"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Counter Grid: Trolly, Qty OK, Qty NG, Target, Efisiensi */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Scan Trolly</p>
                        <p className="text-xl sm:text-2xl font-black text-sky-700 font-mono tabular-numbers mt-1">
                          {currentRun.trollyCount}{" "}
                          <span className="text-xs font-normal text-slate-500">trolly</span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Via Barcode Kanban</p>
                      </div>
                      {currentRun.trollyCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenTrolleyPrint()}
                          className="mt-2 text-[10px] font-extrabold text-sky-700 hover:text-sky-950 flex items-center gap-1 cursor-pointer bg-sky-50 px-2 py-1 rounded-md border border-sky-200 transition"
                          title="Cetak Label Kanban Trolly Penuh"
                        >
                          <Printer className="w-3 h-3 text-sky-600" />
                          <span>Cetak Label Trolly</span>
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">
                        {currentRun.pairStats && (currentRun.moldMode === "SET" || !currentRun.moldMode)
                          ? "Set Selesai Komplit"
                          : "Total Qty OK"}
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tabular-numbers mt-1">
                        {currentRun.pairStats && (currentRun.moldMode === "SET" || !currentRun.moldMode) ? (
                          <>
                            {currentRun.pairStats.setsCount}{" "}
                            <span className="text-xs font-normal text-slate-500">Set</span>
                          </>
                        ) : (
                          <>
                            {currentRun.currentQty}{" "}
                            <span className="text-xs font-normal text-slate-500">pcs</span>
                          </>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {currentRun.pairStats && (currentRun.moldMode === "SET" || !currentRun.moldMode)
                          ? `Total: ${currentRun.currentQty} pcs (${currentRun.trollyCount} trolly)`
                          : `(${currentRun.trollyCount} trolly + sisa)`}
                      </p>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-300 p-3 rounded-xl">
                      <p className="text-[11px] font-bold text-amber-900 uppercase flex items-center justify-between">
                        <span>Part NG (Cacat)</span>
                        {currentRun.qtyReject > 0 && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-amber-700 font-mono tabular-numbers mt-1">
                        {currentRun.qtyReject}{" "}
                        <span className="text-xs font-normal text-amber-900/70">pcs</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsInputNGOpen(true)}
                        className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline mt-0.5 cursor-pointer block text-left"
                      >
                        {currentRun.qtyReject > 0 ? "Edit Rincian →" : "+ Catat NG →"}
                      </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Target Qty</p>
                      <p className="text-xl sm:text-2xl font-black text-slate-800 font-mono tabular-numbers mt-1">
                        {targetQty}{" "}
                        <span className="text-xs font-normal text-slate-500">pcs</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Rumus: (Durasi ÷ CT) × Cav</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl col-span-2 sm:col-span-1">
                      <p className="text-[11px] font-bold text-slate-500 uppercase">Efisiensi Live</p>
                      <p
                        className={`text-xl sm:text-2xl font-black font-mono tabular-numbers mt-1 ${efficiency >= 85
                          ? "text-emerald-700"
                          : efficiency >= 70
                            ? "text-amber-600"
                            : "text-rose-600"
                          }`}
                      >
                        {efficiency}%
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Qty Aktual ÷ Target</p>
                    </div>
                  </div>

                  {/* TARGET PRODUKSI & TRIGGER SELESAI */}
                  {currentRun.planTargetQty && currentRun.planTargetQty > 0 && (() => {
                    const isFamilyMoldSet =
                      (currentRun.moldMode === "SET" || !currentRun.moldMode) &&
                      Boolean(currentRun.pairStats);

                    const targetVal = currentRun.planTargetQty;
                    const achievedVal = isFamilyMoldSet
                      ? (currentRun.pairStats?.setsCount || 0)
                      : currentRun.currentQty;

                    const percent = Math.min(100, Math.round((achievedVal / targetVal) * 100));
                    const isReached = achievedVal >= targetVal;
                    const remainingVal = Math.max(0, targetVal - achievedVal);

                    const estHoursRemaining =
                      currentRun.part.cycleTimeSec > 0
                        ? (
                          (remainingVal / (isFamilyMoldSet ? 1 : currentRun.part.cavity || 1)) *
                          (currentRun.part.cycleTimeSec / 3600)
                        ).toFixed(1)
                        : "0.0";

                    return (
                      <div className="space-y-2">
                        {/* Celebratory Alert Banner if Target Reached */}
                        {isReached ? (
                          <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl border-2 border-amber-600 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="bg-slate-950 text-amber-400 p-2.5 rounded-xl shrink-0">
                                <CheckCircle2 className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-950">
                                  Target Produksi Tercapai!
                                </p>
                                <p className="text-base font-extrabold leading-tight">
                                  {isFamilyMoldSet
                                    ? `Hasil: ${achievedVal} / ${targetVal} Set Komplit (100% Selesai)`
                                    : `Hasil: ${achievedVal} / ${targetVal} pcs OK (100% Selesai)`}
                                </p>
                                {isFamilyMoldSet && currentRun.pairStats && (
                                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                                    Rincian: LH {currentRun.pairStats.lhQty}/{targetVal} pcs | RH {currentRun.pairStats.rhQty}/{targetVal} pcs
                                  </p>
                                )}
                                <p className="text-xs text-slate-900 font-semibold mt-0.5">
                                  {machine.nextPlans && machine.nextPlans.length > 0
                                    ? `Part berikutnya di antrean: ${machine.nextPlans[0].part.partNo} (${machine.nextPlans[0].targetQty} pcs).`
                                    : "Silakan selesaikan run ini untuk berganti ke part berikutnya."}
                                </p>
                                {onUpdatePlan && (currentRun.planId || machine.activePlan?.id) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const pId = currentRun.planId || machine.activePlan?.id;
                                      if (!pId) return;
                                      handleOpenEditPlan({
                                        id: pId,
                                        partNo: currentRun.part.partNo,
                                        partName: currentRun.part.name,
                                        targetQty: targetVal,
                                        notes: machine.activePlan?.notes || "",
                                        isSet: isFamilyMoldSet,
                                      });
                                    }}
                                    className="mt-2 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-xs w-fit"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Tambah / Revisi Target Lagi</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsStopModalOpen(true)}
                              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shrink-0 tap-target"
                            >
                              <Square className="w-4 h-4 fill-amber-400 text-amber-400" />
                              <span>Selesaikan Job & Ganti Part</span>
                            </button>
                          </div>
                        ) : (
                          /* Target Progress Bar While Running */
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                                <CalendarDays className="w-4 h-4 text-sky-700" />
                                Progress Target PPIC:
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {isFamilyMoldSet
                                    ? `${achievedVal} / ${targetVal} Set (${percent}%)`
                                    : `${achievedVal} / ${targetVal} pcs (${percent}%)`}
                                </span>
                                {onUpdatePlan && (currentRun.planId || machine.activePlan?.id) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const pId = currentRun.planId || machine.activePlan?.id;
                                      if (!pId) return;
                                      handleOpenEditPlan({
                                        id: pId,
                                        partNo: currentRun.part.partNo,
                                        partName: currentRun.part.name,
                                        targetQty: targetVal,
                                        notes: machine.activePlan?.notes || "",
                                        isSet: isFamilyMoldSet,
                                      });
                                    }}
                                    className="px-2 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-black flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                    title="Revisi Target Rencana Produksi"
                                  >
                                    <Pencil className="w-3 h-3 text-sky-600" />
                                    <span>Revisi Target</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Bar */}
                            <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            {isFamilyMoldSet && currentRun.pairStats && (
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200 font-mono">
                                <div className="text-sky-800">
                                  <strong>LH:</strong> {currentRun.pairStats.lhQty} / {targetVal} pcs ({Math.min(100, Math.round((currentRun.pairStats.lhQty / targetVal) * 100))}%)
                                </div>
                                <div className="text-indigo-800 text-right">
                                  <strong>RH:</strong> {currentRun.pairStats.rhQty} / {targetVal} pcs ({Math.min(100, Math.round((currentRun.pairStats.rhQty / targetVal) * 100))}%)
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                              <span>
                                Sisa: {remainingVal} {isFamilyMoldSet ? "Set" : "pcs"} lagi
                              </span>
                              {currentRun.part.cycleTimeSec > 0 && (
                                <span>
                                  Estimasi sisa waktu: ~{estHoursRemaining} jam
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Action Lock Banner jika dioperasikan operator lain */}
                  {isOperatorLocked && (
                    <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl flex items-start gap-3">
                      <div className="p-2 bg-amber-200 text-amber-900 rounded-lg shrink-0 mt-0.5">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                          <span>Kontrol Mesin Terkunci</span>
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                            Operator Bertugas: {currentRun.operator.name}
                          </span>
                        </h4>
                        <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                          Anda sedang login sebagai <strong>{currentUser.name}</strong> ({currentUser.employeeId}).
                          Hanya operator yang sedang bertugas di mesin ini (<strong>{currentRun.operator.name}</strong>) atau Supervisor/Admin yang berhak mengubah status mesin (Stop), mencatat NG, atau men-scan trolly.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ACTION BUTTONS (Touch First: Height 56px, Large, High Contrast) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => !isOperatorLocked && setIsScannerOpen(true)}
                      disabled={isOperatorLocked}
                      title={isOperatorLocked ? "Terkunci: Bukan operator bertugas" : "Scan Trolly Kanban"}
                      className={`font-extrabold text-sm sm:text-base py-3.5 sm:py-4 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-md tap-target ${isOperatorLocked
                        ? "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
                        : "bg-sky-600 hover:bg-sky-700 text-white cursor-pointer"
                        }`}
                    >
                      {isOperatorLocked ? (
                        <Lock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-slate-500" />
                      ) : (
                        <QrCode className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      )}
                      <div className="text-left">
                        <span className="block leading-tight">
                          SCAN {(currentRun.part.containerType || "TROLLY").toUpperCase()}
                        </span>
                        <span className="text-[11px] font-semibold block opacity-90 font-mono">
                          {isOperatorLocked ? "Terkunci (Bukan Petugas)" : `+${currentRun.part.qtyPerTrolly} Pcs OK`}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => !isOperatorLocked && setIsInputNGOpen(true)}
                      disabled={isOperatorLocked}
                      title={isOperatorLocked ? "Terkunci: Bukan operator bertugas" : "Catat NG"}
                      className={`font-extrabold text-sm sm:text-base py-3.5 sm:py-4 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-md tap-target relative ${isOperatorLocked
                        ? "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
                        : "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                        }`}
                    >
                      {isOperatorLocked ? (
                        <Lock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-slate-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                      )}
                      <div className="text-left">
                        <span className="block leading-tight">INPUT NG</span>
                        <span className="text-[11px] font-semibold block opacity-90 font-mono">
                          {isOperatorLocked
                            ? "Terkunci"
                            : currentRun.qtyReject > 0
                              ? `${currentRun.qtyReject} Pcs Rusak`
                              : "Catat Cacat Real-Time"}
                        </span>
                      </div>
                      {currentRun.qtyReject > 0 && !isOperatorLocked && (
                        <span className="absolute -top-2 -right-2 bg-amber-950 text-white text-[11px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-xs">
                          {currentRun.qtyReject}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => !isOperatorLocked && setIsStopModalOpen(true)}
                      disabled={isOperatorLocked}
                      title={isOperatorLocked ? "Terkunci: Hanya operator bertugas yang dapat menghentikan mesin" : "Stop Mesin"}
                      className={`font-extrabold text-sm sm:text-base py-3.5 sm:py-4 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-md tap-target ${isOperatorLocked
                        ? "bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75"
                        : "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                        }`}
                    >
                      {isOperatorLocked ? (
                        <Lock className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-slate-500" />
                      ) : (
                        <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-white shrink-0" />
                      )}
                      <div className="text-left">
                        <span className="block leading-tight">STOP MESIN</span>
                        <span className="text-[11px] font-semibold block opacity-90">
                          {isOperatorLocked ? "Terkunci" : "Pilih Alasan Stop"}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* DAFTAR LENGKAP PART YANG DIPROSES HARI INI */}
                  <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-sky-100 text-sky-800 rounded-xl">
                          <CalendarDays className="w-5 h-5 text-sky-700" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                            Jadwal & Urutan Part Hari Ini (Mesin {machine.code})
                          </h4>
                          <p className="text-xs text-slate-500">
                            Rencana kerja dari PPIC: daftar seluruh part yang diproduksi hari ini
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold bg-sky-100 text-sky-800 px-3 py-1 rounded-full border border-sky-200">
                        Total {totalPartsTodayCount} Part Terjadwal
                      </span>
                    </div>

                    <div className="space-y-3">
                      {/* 1. PART SEDANG BERJALAN (ACTIVE) */}
                      {(() => {
                        const isFamilyMoldSet =
                          (currentRun.moldMode === "SET" || !currentRun.moldMode) &&
                          Boolean(currentRun.pairStats);

                        const targetVal = currentRun.planTargetQty;
                        const achievedVal = isFamilyMoldSet
                          ? (currentRun.pairStats?.setsCount || 0)
                          : currentRun.currentQty;

                        const percent = targetVal && targetVal > 0
                          ? Math.min(100, Math.round((achievedVal / targetVal) * 100))
                          : 0;

                        return (
                          <div className="bg-emerald-50/70 border-2 border-emerald-400 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white tracking-wide shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                  Job Aktif Sedang Jalan #1
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-600">
                                  Operator: {currentRun.operator.name}
                                </span>
                              </div>
                              {targetVal && targetVal > 0 && (
                                <span className="text-xs font-mono font-extrabold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded">
                                  {percent}% Tercapai
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <h5 className="text-base font-black text-slate-900">
                                  {currentRun.part.partNo} - {currentRun.part.name}
                                  {isFamilyMoldSet && currentRun.pairStats && (
                                    <span className="text-xs font-bold text-indigo-700 ml-1.5 block sm:inline">
                                      + Pasangan: {currentRun.pairStats.rhPart.partNo}
                                    </span>
                                  )}
                                </h5>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {isFamilyMoldSet ? (
                                    <>
                                      Mode: <strong className="text-indigo-900">1 Set (LH + RH)</strong> | Cycle Time: <strong className="text-slate-800">{currentRun.part.cycleTimeSec}s</strong> | Standar: <strong className="text-slate-800">{currentRun.part.qtyPerTrolly} pcs/trolly</strong>
                                    </>
                                  ) : (
                                    <>
                                      Cavity: <strong className="text-slate-800">{currentRun.part.cavity} shot</strong> | Cycle Time: <strong className="text-slate-800">{currentRun.part.cycleTimeSec}s</strong> | Standar: <strong className="text-slate-800">{currentRun.part.qtyPerTrolly} pcs/trolly</strong>
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="text-left sm:text-right shrink-0">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Target PPIC</p>
                                <p className="text-base font-black text-emerald-950 font-mono">
                                  {isFamilyMoldSet ? (
                                    <>
                                      {achievedVal} / {targetVal || "-"} <span className="text-xs font-normal">Set Selesai</span>
                                    </>
                                  ) : (
                                    <>
                                      {achievedVal} / {targetVal || "-"} <span className="text-xs font-normal">pcs OK</span>
                                    </>
                                  )}
                                </p>
                                <p className="text-[11px] text-emerald-800 font-semibold">
                                  {currentRun.trollyCount} Trolly Scan
                                  {isFamilyMoldSet && currentRun.pairStats ? (
                                    <span> ({currentRun.pairStats.lhTrollyCount} LH + {currentRun.pairStats.rhTrollyCount} RH)</span>
                                  ) : null}
                                  {targetVal && targetVal > achievedVal ? (
                                    <span> | Sisa: {targetVal - achievedVal} {isFamilyMoldSet ? "Set" : "pcs"}</span>
                                  ) : null}
                                </p>
                              </div>
                            </div>

                            {/* Rincian LH vs RH jika Family Mold */}
                            {isFamilyMoldSet && currentRun.pairStats && targetVal && (
                              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2 rounded-lg border border-emerald-200 font-mono">
                                <div className="text-sky-900">
                                  <strong>LH ({currentRun.pairStats.lhPart.partNo}):</strong> {currentRun.pairStats.lhQty} / {targetVal} pcs ({Math.min(100, Math.round((currentRun.pairStats.lhQty / targetVal) * 100))}%)
                                </div>
                                <div className="text-indigo-900 text-right">
                                  <strong>RH ({currentRun.pairStats.rhPart.partNo}):</strong> {currentRun.pairStats.rhQty} / {targetVal} pcs ({Math.min(100, Math.round((currentRun.pairStats.rhQty / targetVal) * 100))}%)
                                </div>
                              </div>
                            )}

                            {/* Progress Bar Active Part */}
                            {targetVal && targetVal > 0 && (
                              <div className="w-full h-2 bg-emerald-200/80 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* 2. ANTREAN PART BERIKUTNYA (QUEUED) */}
                      {queuedPlans.map((plan, index) => {
                        const isSetPlan = (plan.moldMode === "SET" || !plan.moldMode) && Boolean(plan.part.pairPart);
                        const estHours =
                          plan.part.cycleTimeSec > 0
                            ? ((plan.targetQty / (isSetPlan ? 1 : plan.part.cavity || 1)) * (plan.part.cycleTimeSec / 3600)).toFixed(1)
                            : "0.0";
                        const trollyNeeded = Math.ceil(plan.targetQty / plan.part.qtyPerTrolly);

                        return (
                          <div
                            key={plan.id}
                            className="bg-sky-50/50 border border-sky-300 rounded-xl p-3.5 space-y-2 hover:bg-sky-50 transition shadow-2xs"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-700 text-white tracking-wide">
                                  Antrean #{plan.priority || index + 2}
                                </span>
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                  Menunggu Part #{index + 1} Selesai
                                </span>
                              </div>
                              {plan.operatorName && (
                                <span className="text-[11px] text-slate-600">
                                  Ditugaskan: <strong className="text-slate-800">{plan.operatorName}</strong>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <h5 className="text-base font-black text-slate-900">
                                  {plan.part.partNo} - {plan.part.name}
                                </h5>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  Cavity: <strong className="text-slate-800">{plan.part.cavity} shot</strong> | Cycle Time: <strong className="text-slate-800">{plan.part.cycleTimeSec}s</strong> | Standar: <strong className="text-slate-800">{plan.part.qtyPerTrolly} pcs/trolly</strong>
                                </p>
                                {plan.notes && (
                                  <p className="text-xs text-slate-600 italic mt-1 bg-white/70 p-1.5 rounded border border-slate-200">
                                    Catatan PPIC: &ldquo;{plan.notes}&rdquo;
                                  </p>
                                )}
                              </div>
                              <div className="text-left sm:text-right shrink-0">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Target Rencana</p>
                                <p className="text-lg font-black text-sky-950 font-mono">
                                  {plan.targetQty.toLocaleString("id-ID")}{" "}
                                  <span className="text-xs font-normal">
                                    {isSetPlan ? "Set (Kiri & Kanan)" : "pcs"}
                                  </span>
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  ~{trollyNeeded} Trolly | Est: ~{estHours} jam
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* 3. PART YANG SELESAI HARI INI */}
                      {completedPlansToday.map((cp) => (
                        <div
                          key={cp.id}
                          className="bg-slate-50 border border-slate-300 rounded-xl p-3 flex items-center justify-between gap-3 text-slate-600 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="p-1 bg-emerald-100 text-emerald-800 rounded-full">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                                  Selesai Hari Ini
                                </span>
                                <h6 className="text-sm font-bold text-slate-800">
                                  {cp.part.partNo} - {cp.part.name}
                                </h6>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-slate-800">
                              {cp.targetQty} pcs
                            </span>
                            <span className="text-[10px] block text-emerald-700 font-bold">Target Tuntas</span>
                          </div>
                        </div>
                      ))}

                      {/* 4. JIKA TIDAK ADA ANTREAN BERIKUTNYA */}
                      {queuedPlans.length === 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center text-xs text-slate-600">
                          <p className="font-bold text-slate-700">
                            Hanya 1 part yang dijadwalkan untuk mesin {machine.code} hari ini.
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Belum ada antrean part berikutnya. Jika ada job cetak tambahan setelah part ini, silakan hubungi Planner PPIC.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* STATE 2: IDLE OR STOPPED (START NEW RUN FORM / PLANNING QUEUE) */
                <div className="space-y-4">
                  {/* Shift 1 Morning Setup Info Banner */}
                  {isMorningShift1 && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
                      <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="text-xs space-y-0.5">
                        <p className="font-extrabold text-amber-950 flex flex-wrap items-center gap-1.5">
                          <span>Waktu Setting Awal Shift 1 (Mulai 07:30 WIB)</span>
                          <span className="text-[10px] font-mono font-bold bg-amber-200/90 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                            Simbol K (Setting / Pemanasan)
                          </span>
                        </p>
                        <p className="text-amber-900/90 leading-relaxed text-[11px]">
                          Mesin dinyalakan & dipanaskan sejak 07:30. Durasi dari 07:30 hingga Anda menekan <strong>START</strong> otomatis tercatat sebagai waktu setting awal (Simbol K) pada Formulir Laporan Harian (FO/MLD/009). Silakan tekan tombol START saat mold dan mesin telah siap cetak.
                        </p>
                      </div>
                    </div>
                  )}

                  {machine.status === "DOWN" && currentRun && currentRun.stopReason && (
                    <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm mb-1">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Mesin Sedang Berhenti (Downtime Berjalan):</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        Alasan: {currentRun.stopReason.reason}
                      </p>
                      <p className="text-xs text-slate-600">
                        Kategori: {currentRun.stopReason.category} | Waktu Stop:{" "}
                        {new Date(currentRun.stopTime || currentRun.startTime).toLocaleTimeString(
                          "id-ID"
                        )}
                      </p>
                    </div>
                  )}

                  {/* Sisa Part / Trolly Parsial dari Run Sebelumnya */}
                  {currentRun && typeof currentRun.remainderQty === "number" && currentRun.remainderQty > 0 && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-700" /> Sisa Part / Trolly Belum Penuh:
                        </span>
                        <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                          Tercatat Sisa: <span className="font-mono font-black text-amber-950 text-base">{currentRun.remainderQty} pcs</span> (Part {currentRun.part.partNo})
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Sisa part ini sudah masuk hitungan hasil OK & stok gudang.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenTrolleyPrint({ isPartial: true, customQty: currentRun.remainderQty })}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Cetak Label Trolly Sisa ({currentRun.remainderQty} pcs)</span>
                      </button>
                    </div>
                  )}
                  {(machine.activePlan || (machine.nextPlans && machine.nextPlans.length > 0)) && (
                    <div className="bg-sky-50 border-2 border-sky-400 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-sky-600 text-white rounded-lg">
                            <CalendarDays className="w-4 h-4" />
                          </span>
                          <div>
                            <h3 className="text-xs font-black uppercase text-sky-950 tracking-wide">
                              Jadwal Kerja dari Planner (PPIC)
                            </h3>
                            <p className="text-xs text-sky-900 font-medium">
                              Operator tidak perlu mencari part secara manual. Silakan klik tombol di bawah untuk langsung memproses job ini.
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold bg-sky-200/80 text-sky-900 px-2.5 py-1 rounded-md">
                          Prioritas #{machine.activePlan?.priority || machine.nextPlans?.[0]?.priority || 1}
                        </span>
                      </div>

                      {/* Detail Job Siap Jalan */}
                      {(() => {
                        const targetPlan = machine.activePlan || machine.nextPlans?.[0];
                        if (!targetPlan) return null;
                        const partMatch = machine.allowedParts.find((p) => p.id === targetPlan.partId);
                        const isTargetSet = (targetPlan.moldMode === "SET" || !targetPlan.moldMode) && Boolean(partMatch?.pairPart);
                        const estHours = partMatch && partMatch.cycleTimeSec > 0
                          ? ((targetPlan.targetQty / (isTargetSet ? 1 : partMatch.cavity || 1)) * (partMatch.cycleTimeSec / 3600)).toFixed(1)
                          : "0.0";

                        return (
                          <div className="bg-white rounded-xl p-3.5 border border-sky-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                                  Part Dijadwalkan
                                </span>
                                <h4 className="text-lg font-black text-slate-900 mt-0.5">
                                  {targetPlan.part.partNo} - {targetPlan.part.name}
                                </h4>
                                {targetPlan.notes && (
                                  <p className="text-xs text-slate-600 italic mt-0.5">
                                    Catatan PPIC: &ldquo;{targetPlan.notes}&rdquo;
                                  </p>
                                )}
                              </div>
                              <div className="text-left sm:text-right">
                                <div className="flex items-center justify-start sm:justify-end gap-1.5 mb-0.5">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase">Target Produksi</p>
                                  {onUpdatePlan && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenEditPlan({
                                          id: targetPlan.id,
                                          partNo: targetPlan.part.partNo,
                                          partName: targetPlan.part.name,
                                          targetQty: targetPlan.targetQty,
                                          notes: targetPlan.notes,
                                          isSet: isTargetSet,
                                        })
                                      }
                                      className="px-1.5 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[10px] font-black flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                      title="Revisi Target Rencana Produksi"
                                    >
                                      <Pencil className="w-3 h-3 text-sky-600" />
                                      <span>Revisi</span>
                                    </button>
                                  )}
                                </div>
                                <p className="text-xl font-black text-sky-900 font-mono">
                                  {targetPlan.targetQty.toLocaleString("id-ID")}{" "}
                                  <span className="text-xs font-normal">
                                    {isTargetSet ? "Set (Kiri & Kanan)" : "pcs"}
                                  </span>
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  Estimasi: ~{estHours} jam
                                </p>
                              </div>
                            </div>

                            {/* Lock Warning jika job direncanakan untuk operator lain */}
                            {isPlanLocked && (
                              <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Job Khusus Petugas Lain: </span>
                                  Job rencana ini ditugaskan untuk operator <strong>{targetPlan.operatorName || "lain"}</strong>. Anda login sebagai <strong>{currentUser.name}</strong>.
                                </div>
                              </div>
                            )}

                            {/* Poka-Yoke Warning jika part sebelumnya belum ada input scan */}
                            {(() => {
                              const isTargetSame = Boolean(
                                currentRun && targetPlan && targetPlan.partId === currentRun.part.id
                              );
                              const isTargetFamilyPair = Boolean(
                                currentRun &&
                                targetPlan &&
                                currentRun.part.pairPartId &&
                                targetPlan.partId === currentRun.part.pairPartId &&
                                (currentRun.moldMode === "SET" || targetPlan.moldMode === "SET")
                              );
                              const isTargetNextProcess = !isTargetSame && !isTargetFamilyPair;
                              const isTargetBlockedByEmptyPrev = isPrevPartScansEmpty && isTargetNextProcess;

                              return (
                                <>
                                  {isTargetBlockedByEmptyPrev && (
                                    <div className="bg-rose-50 border-2 border-rose-300 p-3 rounded-xl text-xs text-rose-950 flex items-start gap-2.5">
                                      <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                      <div className="space-y-1">
                                        <span className="font-extrabold text-rose-900 block uppercase tracking-wide">
                                          Terkunci: Part Sebelumnya Belum Di-Scan
                                        </span>
                                        <p className="text-rose-800 leading-relaxed">
                                          Part yang diproses sebelumnya (<strong>{currentRun?.part.partNo} - {currentRun?.part.name}</strong>) belum memiliki input scan kuantiti trolly (0 qty).
                                          Anda tidak dapat beralih ke next proses sebelum menyelesaikan input scan part sebelumnya.
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Tombol One-Click Start Planning */}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setIsStarting(true);
                                      setStartError(null);
                                      const res = await onStartRun({
                                        machineId: machine.id,
                                        partId: targetPlan.partId,
                                        operatorId: currentUser.id,
                                        shift,
                                        planId: targetPlan.id,
                                      });
                                      setIsStarting(false);
                                      if (!res.success) {
                                        setStartError(res.error || "Gagal memulai job planner.");
                                      }
                                    }}
                                    disabled={isStarting || isPlanLocked || isTargetBlockedByEmptyPrev}
                                    title={
                                      isPlanLocked
                                        ? "Terkunci: Rencana job ini ditugaskan untuk operator lain"
                                        : isTargetBlockedByEmptyPrev
                                          ? `Terkunci: Part sebelumnya (${currentRun?.part.partNo}) belum memiliki input scan trolly`
                                          : "Mulai Job"
                                    }
                                    className={`w-full py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition shadow-md tap-target ${isPlanLocked || isTargetBlockedByEmptyPrev
                                      ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300"
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                      }`}
                                  >
                                    {isPlanLocked || isTargetBlockedByEmptyPrev ? (
                                      <Lock className="w-5 h-5 text-slate-500" />
                                    ) : (
                                      <Play className="w-5 h-5 fill-white" />
                                    )}
                                    <span>
                                      {isStarting
                                        ? "Memproses..."
                                        : isPlanLocked
                                          ? `TERKUNCI UNTUK OPERATOR: ${targetPlan.operatorName || "LAIN"}`
                                          : isTargetBlockedByEmptyPrev
                                            ? `TERKUNCI: SCAN PART SEBELUMNYA (${currentRun?.part.partNo}) DAHULU`
                                            : `START JOB PLANNING: ${targetPlan.part.partNo} (${targetPlan.targetQty} PCS)`}
                                    </span>
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Next Queue Preview */}
                      {machine.nextPlans && machine.nextPlans.length > 1 && (
                        <div className="pt-2 border-t border-sky-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase text-sky-950 flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-sky-700" />
                              <span>Antrean Part Berikutnya Hari Ini ({machine.nextPlans.length - 1} Part):</span>
                            </p>
                          </div>
                          <div className="space-y-2">
                            {machine.nextPlans.slice(1).map((np, idx) => {
                              const estHours =
                                np.part.cavity > 0 && np.part.cycleTimeSec > 0
                                  ? ((np.targetQty / np.part.cavity) * (np.part.cycleTimeSec / 3600)).toFixed(1)
                                  : "0.0";
                              const trollyNeeded = Math.ceil(np.targetQty / np.part.qtyPerTrolly);

                              return (
                                <div
                                  key={np.id}
                                  className="text-xs bg-white/90 border border-sky-200 p-2.5 rounded-xl text-sky-950 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-black uppercase bg-sky-200 text-sky-900 px-1.5 py-0.5 rounded font-mono">
                                        #{np.priority || idx + 2}
                                      </span>
                                      <span className="font-black text-slate-900">
                                        {np.part.partNo} - {np.part.name}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                      Cav: {np.part.cavity} | CT: {np.part.cycleTimeSec}s | Standar: {np.part.qtyPerTrolly} pcs/trolly
                                      {np.operatorName && ` | Operator: ${np.operatorName}`}
                                    </p>
                                  </div>
                                  <div className="text-left sm:text-right shrink-0">
                                    <span className="font-mono font-black text-sm text-sky-950 block">
                                      {np.targetQty.toLocaleString("id-ID")} pcs
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      ~{trollyNeeded} Trolly | Est: ~{estHours} jam
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tombol Opsi: Pilih Part Lain Manual */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowManualPartSelect(true)}
                          className="text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Atau Pilih Part Lain Secara Manual di Mesin {machine.code}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual Override / Start Form */}
                  {(!hasPlannedJob || showManualPartSelect) && (
                    <form onSubmit={handleStart} className="space-y-4">
                      {startError && (
                        <div className="bg-rose-50 border border-rose-300 p-3 rounded-lg text-rose-900 text-xs font-bold">
                          {startError}
                        </div>
                      )}

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            Mulai Run Produksi Baru
                          </h3>
                          {hasPlannedJob && (
                            <button
                              type="button"
                              onClick={() => setShowManualPartSelect(false)}
                              className="text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                            >
                              ← Kembali ke Job Rencana PPIC
                            </button>
                          )}
                        </div>

                        {/* 1. Pilih Part (TomSelect dengan Fitur Clear) */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="part-select" className="block text-xs font-bold text-slate-700">
                              Pilih Part (Terdaftar untuk {machine.code}):
                            </label>
                            {selectedPartId > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPartId(0);
                                  setMoldMode("SET");
                                }}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded transition inline-flex items-center gap-1 cursor-pointer"
                                title="Bersihkan pilihan part"
                              >
                                <X className="w-3 h-3" />
                                <span>Bersihkan (Clear)</span>
                              </button>
                            )}
                          </div>

                          {machine.allowedParts.length > 0 ? (
                            <TomSelectInput
                              key={`machine-part-select-${machine.id}-${machine.allowedParts.length}`}
                              id="part-select"
                              value={selectedPartId > 0 ? selectedPartId : ""}
                              onChange={(val) => {
                                const pId = val ? parseInt(val, 10) : 0;
                                setSelectedPartId(pId);
                                setMoldMode("SET");
                              }}
                              placeholder={`-- Cari nomor part atau nama part untuk ${machine.code} --`}
                              allowClear={true}
                              options={allowedPartOptions}
                            />
                          ) : (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                              Belum ada part yang dihubungkan ke mesin ini. Silakan atur relasi di menu <strong>Master & Kanban</strong> → tab <strong>Part & Relasi</strong>.
                            </div>
                          )}
                        </div>

                        {/* Petunjuk saat part di-clear atau belum dipilih */}
                        {!selectedPartObj && machine.allowedParts.length > 0 && (
                          <div className="p-3 bg-slate-100/80 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500 font-medium">
                            Ketik nomor part atau nama part pada kotak pencarian di atas untuk memilih dan melihat rincian Cycle Time serta Cavity Mold.
                          </div>
                        )}

                        {/* Info Part Terpilih */}
                        {selectedPartObj && (
                          <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-200 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Cycle Time</p>
                              <p className="text-base font-extrabold text-slate-800 font-mono">
                                {selectedPartObj.cycleTimeSec} detik
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Cavity Mold</p>
                              <p className="text-base font-extrabold text-slate-800 font-mono">
                                {selectedPartObj.pairPart && moldMode === "SET"
                                  ? "2 cavity (LH + RH)"
                                  : `${selectedPartObj.cavity} shot`}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Standar Trolly</p>
                              <p className="text-base font-extrabold text-sky-800 font-mono">
                                {selectedPartObj.qtyPerTrolly} pcs
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Family Mold Mode Selector jika part memiliki pasangan (LH / RH) */}
                        {selectedPartObj?.pairPart && (() => {
                          const isSelectedRH =
                            selectedPartObj.partNo.toUpperCase().includes("RH") ||
                            selectedPartObj.name.toUpperCase().includes("RH") ||
                            selectedPartObj.name.toUpperCase().includes("KANAN");

                          const singleModeKey = isSelectedRH ? "SINGLE_RH" : "SINGLE_LH";
                          const singleModeTitle = isSelectedRH ? "Single Kanan (RH Saja)" : "Single Kiri (LH Saja)";
                          const singleModeDesc = isSelectedRH
                            ? `Cavity kiri (${selectedPartObj.pairPart.partNo}) ditutup (Cavity: 1)`
                            : `Cavity kanan (${selectedPartObj.pairPart.partNo}) ditutup (Cavity: 1)`;

                          return (
                            <div className="bg-indigo-50/80 border-2 border-indigo-300 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wide text-indigo-950 flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-indigo-600" />
                                  Pilihan Mode Family Mold:
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded">
                                  Pasangan: {selectedPartObj.pairPart.partNo}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => setMoldMode("SET")}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${moldMode === "SET"
                                    ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                    : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                  <span className="text-xs font-black block">Mode 1 Set (LH + RH)</span>
                                  <span className={`text-[11px] block mt-0.5 ${moldMode === "SET" ? "text-indigo-100" : "text-slate-500"}`}>
                                    1 shot = 1 LH + 1 RH (Cavity: 2)
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setMoldMode(singleModeKey)}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${moldMode === singleModeKey
                                    ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                    : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                  <span className="text-xs font-black block">{singleModeTitle}</span>
                                  <span className={`text-[11px] block mt-0.5 ${moldMode === singleModeKey ? "text-indigo-100" : "text-slate-500"}`}>
                                    {singleModeDesc}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 2. Pilih Shift */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <label htmlFor="shift-select" className="block text-xs font-bold text-slate-700 mb-1">
                              Shift Kerja:
                            </label>
                            <select
                              id="shift-select"
                              value={shift}
                              onChange={(e) => setShift(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                            >
                              <option value="Shift 1">Shift 1 (07:00 - 15:00)</option>
                              <option value="Shift 2">Shift 2 (15:00 - 23:00)</option>
                              <option value="Shift 3">Shift 3 (23:00 - 07:00)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Operator Aktif:
                            </label>
                            <div className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>{currentUser.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                ({currentUser.employeeId})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Deteksi kelanjutan part yang sama */}
                      {isSameAsLastPart && (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                          <RotateCcw className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-extrabold text-emerald-800">
                              Mode Lanjutkan Part yang Sama
                            </p>
                            <p className="text-slate-600 mt-0.5">
                              Part yang dipilih sama dengan sesi sebelum stop. Timer durasi jalan akan otomatis melanjutkan dari sesi sebelumnya tanpa mereset waktu dari nol.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Validasi Poka-Yoke: Part sebelumnya belum ada scan qty */}
                      {isPrevPartScansEmpty && !isSameOrPairLastPart && (
                        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-950">
                          <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-extrabold text-rose-900 uppercase tracking-wide">
                              Terkunci: Part Sebelumnya Belum Di-Scan
                            </p>
                            <p className="text-rose-800 leading-relaxed">
                              Part yang diproses sebelumnya (<strong>{currentRun?.part.partNo} - {currentRun?.part.name}</strong>) belum memiliki input scan kuantiti trolly. Anda tidak dapat beralih ke part lain sebelum kuantiti part sebelumnya di-scan atau diinput.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Big START Button */}
                      <button
                        type="submit"
                        disabled={isStarting || !selectedPartId || machine.allowedParts.length === 0 || (isPrevPartScansEmpty && !isSameOrPairLastPart)}
                        className="w-full py-4 px-6 rounded-xl text-base font-black bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white transition shadow-md flex items-center justify-center gap-2 cursor-pointer tap-target"
                      >
                        {isPrevPartScansEmpty && !isSameOrPairLastPart ? (
                          <Lock className="w-5 h-5 text-slate-500" />
                        ) : (
                          <Play className="w-5 h-5 fill-white" />
                        )}
                        <span>
                          {isStarting
                            ? "Memulai Run..."
                            : !selectedPartId
                              ? "SILAKAN PILIH PART TERLEBIH DAHULU"
                              : isPrevPartScansEmpty && !isSameOrPairLastPart
                                ? `TERKUNCI: SCAN PART SEBELUMNYA (${currentRun?.part.partNo}) DAHULU`
                                : isSameAsLastPart
                                  ? "LANJUTKAN PRODUKSI (SAMBUNG WAKTU)"
                                  : "MULAI PRODUKSI MANUAL"}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {/* VIEW TAB 2: PROGRESS & KRONOLOGI HARI INI (TIMELINE) */}
          {modalTab === "timeline" && (
            <div className="space-y-4">
              {/* Card Narasi Harian yang Sangat Mudah Dibaca */}
              <div className="bg-sky-50 border-2 border-sky-300 rounded-xl p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sky-950 font-black text-sm">
                    <FileText className="w-4 h-4 text-sky-700" />
                    <span>Ringkasan Harian Mesin {machine.code}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReportOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs self-start sm:self-auto cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Buka Form Standar (FO/MLD/009)</span>
                  </button>
                </div>
                <p className="text-xs text-sky-950 leading-relaxed font-medium">
                  {daily?.narrativeSummary || "Belum ada catatan aktivitas mesin hari ini."}
                </p>
              </div>

              {/* KPI Ringkas Hari Ini */}
              {daily && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase">Waktu Berjalan (RUN)</p>
                    <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                      {formatHoursMinutes(daily.totalRunMinutes)}
                    </p>
                  </div>

                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <p className="text-[10px] font-bold text-rose-800 uppercase">Waktu Berhenti (STOP)</p>
                    <p className="text-lg font-black text-rose-700 font-mono mt-0.5">
                      {formatHoursMinutes(daily.totalDowntimeMinutes)}
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-800 uppercase">Frekuensi Stop</p>
                    <p className="text-lg font-black text-amber-700 font-mono mt-0.5">
                      {daily.stopsCount} kali
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Operator Bertugas</p>
                    <p className="text-xs font-bold text-slate-900 mt-1 truncate">
                      {daily.operators.join(", ") || "-"}
                    </p>
                  </div>
                </div>
              )}

              {/* Panel Hak Akses Khusus Admin vs Info Otorisasi */}
              {currentUser.role === "ADMIN" ? (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-wide text-rose-950 uppercase">
                          Akses Administrator: Hapus / Reset Data Produksi Mesin
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-200 text-rose-900 border border-rose-300">
                          ADMIN ONLY
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                        Hanya role <strong>ADMIN</strong> yang diizinkan menghapus data produksi. Menghapus riwayat produksi akan membersihkan seluruh run, scan kanban trolly, dan catatan defect reject pada mesin <strong>{machine.code}</strong> serta mengembalikan status mesin ke <strong>IDLE</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isDeletingData}
                    onClick={handleClearMachineProductionData}
                    className="shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeletingData ? "Sedang Menghapus..." : "Hapus Semua Data Mesin Ini"}
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 text-slate-500 text-xs">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Otorisasi Terbatas: Hanya pengguna dengan Role <strong>ADMIN</strong> yang memiliki hak akses untuk menghapus atau mereset data riwayat produksi pada mesin ini.
                  </span>
                </div>
              )}

              {/* Visual Horizontal Timeline Bar */}
              {daily && daily.timelineEvents.length > 0 && (
                <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Visual Garis Waktu Hari Ini:</span>
                    <div className="flex gap-3 text-[10px]">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Running
                      </span>
                      <span className="flex items-center gap-1 text-rose-700">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Stop / Downtime
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full h-7 rounded-lg bg-slate-100 border border-slate-300 overflow-hidden flex">
                    {daily.timelineEvents.map((ev, idx) => {
                      const totalM = Math.max(1, daily.totalRunMinutes + daily.totalDowntimeMinutes);
                      const widthPct = Math.max(2, (ev.durationMinutes / totalM) * 100);
                      const isRun = ev.type === "RUN";

                      return (
                        <div
                          key={idx}
                          className={`h-full border-r border-white/50 transition relative group ${isRun ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"
                            }`}
                          style={{ width: `${widthPct}%` }}
                          title={`${isRun ? "RUN" : "STOP"}: ${ev.durationMinutes} menit (${isRun ? ev.partNo : ev.stopReason
                            })`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tabel Rinci Kronologis Jam per Jam */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-800">
                    Log Kronologi Jam & Aktivitas Mesin Hari Ini:
                  </h4>
                </div>

                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">Jam (Mulai - Selesai)</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Durasi</th>
                        <th className="py-2 px-3">Part / Keterangan</th>
                        <th className="py-2 px-3">Hasil / Alasan</th>
                        <th className="py-2 px-3">Operator</th>
                        {currentUser.role === "ADMIN" && (
                          <th className="py-2 px-3 text-right">Aksi (Admin)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {daily && daily.timelineEvents.length > 0 ? (
                        daily.timelineEvents.map((ev, idx) => {
                          const isRun = ev.type === "RUN";
                          const startStr = new Date(ev.startTime).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const endStr = ev.endTime
                            ? new Date(ev.endTime).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : "Berjalan...";

                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                {startStr} - {endStr}
                              </td>
                              <td className="py-2 px-3">
                                {isRun ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800">
                                    RUNNING
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                                    STOP
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-700">
                                {formatHoursMinutes(ev.durationMinutes)}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {isRun ? ev.partNo : ev.stopCategory}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {isRun ? `${ev.qtyOk} pcs OK` : ev.stopReason}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {isRun ? ev.operatorName : "-"}
                              </td>
                              {currentUser.role === "ADMIN" && (
                                <td className="py-2 px-3 text-right">
                                  {isRun && ev.runId ? (
                                    <button
                                      type="button"
                                      title="Hapus data run produksi ini (Admin Only)"
                                      disabled={isDeletingData}
                                      onClick={() =>
                                        handleDeleteSingleRun(
                                          ev.runId!,
                                          ev.partNo || "Part",
                                          ev.qtyOk || 0
                                        )
                                      }
                                      className="px-2 py-1 rounded text-[10px] font-bold text-rose-700 hover:text-white hover:bg-rose-600 border border-rose-300 hover:border-rose-600 transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Hapus Run
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-slate-300">-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={currentUser.role === "ADMIN" ? 7 : 6}
                            className="py-6 text-center text-slate-500 text-xs"
                          >
                            Belum ada riwayat aktivitas mesin pada hari ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-slate-500 font-mono">
            {machine.code} | {machine.tonnage} Ton | Waktu Server Tersinkron
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer tap-target"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Sub-Modals */}
      {isRunning && currentRun && (
        <>
          <BarcodeScannerModal
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            runId={currentRun.id}
            expectedPart={currentRun.part}
            pairPart={currentRun.part.pairPart || null}
            pairStats={currentRun.pairStats || null}
            moldMode={currentRun.moldMode || "SET"}
            onScanSuccess={handleScanCode}
            availableKanbans={availableKanbans}
            planTargetQty={currentRun.planTargetQty || machine.activePlan?.targetQty || null}
            currentProducedQty={currentRun.currentQty}
            trollyCount={currentRun.trollyCount}
          />

          <StopReasonModal
            isOpen={isStopModalOpen}
            onClose={() => setIsStopModalOpen(false)}
            machineCode={machine.code}
            partNo={currentRun.part.partNo}
            stopReasons={stopReasons}
            onSubmitStop={handleStopSubmit}
            currentQty={currentRun.currentQty || 0}
            scanCount={currentRun.trollyCount || 0}
          />
        </>
      )}

      {/* Void Scan Modal */}
      {voidScanId && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmVoidScan}
            className="bg-white rounded-xl max-w-md w-full p-5 space-y-3 shadow-2xl border border-slate-300"
          >
            <h3 className="text-sm font-extrabold text-rose-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              Batalkan Scan Trolly (Void Scan)
            </h3>
            <p className="text-xs text-slate-600">
              Membatalkan scan akan mengurangi hasil trolly dan pcs pada run ini. Tindakan ini
              dicatat dalam audit log.
            </p>
            <div>
              <label htmlFor="void-reason" className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Pembatalan (Wajib):
              </label>
              <input
                id="void-reason"
                type="text"
                value={voidReasonText}
                onChange={(e) => setVoidReasonText(e.target.value)}
                placeholder="Contoh: Salah scan kanban part lain..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-rose-600"
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidScanId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isVoiding || !voidReasonText.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isVoiding ? "Memproses..." : "Konfirmasi Void"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Input NG Modal (Real-time defect recording without stopping machine) */}
      {isRunning && currentRun && (() => {
        const isFamilyMold = Boolean(currentRun.part.pairPartId && currentRun.part.pairPart);
        const isSetMode = isFamilyMold && (currentRun.moldMode === "SET" || !currentRun.moldMode);

        return (
          <InputNGModal
            key={`${machine.code}-${currentRun.id}-${isInputNGOpen}`}
            isOpen={isInputNGOpen}
            onClose={() => setIsInputNGOpen(false)}
            machineCode={machine.code}
            mainPart={{
              id: currentRun.part.id,
              partNo: currentRun.part.partNo,
              name: currentRun.part.name,
              cavity: currentRun.part.cavity,
              pairPartId: currentRun.part.pairPartId,
            }}
            pairPart={
              isSetMode && currentRun.part.pairPart
                ? {
                  id: currentRun.part.pairPart.id,
                  partNo: currentRun.part.pairPart.partNo,
                  name: currentRun.part.pairPart.name,
                  cavity: currentRun.part.pairPart.cavity,
                }
                : null
            }
            isSetMode={isSetMode}
            moldMode={currentRun.moldMode || (isFamilyMold ? "SET" : "STANDARD")}
            runId={currentRun.id}
            defectTypes={defectTypes}
            currentRejects={
              currentRun.rejects?.map((rj: any) => ({
                defectTypeId: rj.defectTypeId,
                partId: rj.partId || currentRun.part.id,
                qty: rj.qty,
              })) || []
            }
            onSaveRejects={async (runId, rejects) => {
              if (onSaveRejects) {
                return await onSaveRejects(runId, rejects);
              }
              return { success: false, error: "Handler simpan NG belum terkonfigurasi." };
            }}
          />
        );
      })()}

      {/* Modal: Cetak Label Kanban Selesai (Full) - Format Landscape 9.3cm x 6.4cm */}
      {trolleyPrintData && (() => {
        const cTypeUpper = (trolleyPrintData.containerType || "TROLLY").toUpperCase();
        const cTypePrefix = cTypeUpper === "BOX" ? "BOX #" : cTypeUpper === "RAK" ? "RAK #" : "TR #";

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:static print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:w-auto print:max-w-none print:rounded-none print:p-0 print:m-0">
              {/* Modal Header (No Print) */}
              <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 rounded-lg text-white">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black">{cTypeUpper} #{trolleyPrintData.trolleyNum} Selesai Penuh!</h3>
                      <span className="text-[9px] font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700 px-1.5 py-0.5 rounded">
                        Landscape 9.5cm x 6.5cm
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Siap dicetak ke kartu kanban {cTypeUpper.toLowerCase()} (Tinggi: 6,5 cm x Lebar: 9,5 cm)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTrolleyPrintData(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* AREA KARTU FISIK KANBAN (Print Area - 95mm x 65mm) */}
              <div className="p-5 bg-slate-100 flex items-center justify-center print:p-0 print:m-0 print:bg-transparent">
                <div
                  id="kanban-trolley-card"
                  style={{ width: "95mm", height: "65mm" }}
                  className="print-area bg-white border-[0.6mm] border-black rounded-[2mm] text-black font-sans shadow-md flex flex-col overflow-hidden print:rounded-none print:shadow-none"
                >
                  {/* ============ 1. HEADER (9mm) ============ */}
                  <div style={{ height: "9mm" }} className="bg-black text-white flex items-center justify-between px-[2mm] shrink-0">
                    <div className="flex items-center gap-[1.8mm] min-w-0">
                      <span className="bg-white text-black font-black text-[9pt] leading-none px-[1.4mm] py-[1mm] rounded-[0.8mm] tracking-wider">
                        MMS
                      </span>
                      <div className="min-w-0 leading-none">
                        <p className="text-[5.5pt] font-bold tracking-[0.15em] text-slate-300 leading-none">MOLDING DIVISION</p>
                        <h4 className="text-[12pt] font-black leading-none mt-[0.6mm] whitespace-nowrap">KANBAN {cTypeUpper}</h4>
                      </div>
                    </div>
                    <div className="bg-white text-black rounded-[1mm] h-[6.4mm] px-[2mm] flex items-center shrink-0">
                      <span className="font-mono font-black text-[14pt] leading-none">
                        {trolleyPrintData.isPartial
                          ? `SISA #${trolleyPrintData.trolleyNum}`
                          : `${cTypePrefix}${trolleyPrintData.trolleyNum}`}
                      </span>
                    </div>
                  </div>

                  {/* ============ 2. BODY (tinggi tersisa = 50.8mm) ============ */}
                  <div className="flex flex-1 min-h-0">
                    {/* ---- Kiri: QR + kode + status ---- */}
                    <div
                      style={{ width: "34mm" }}
                      className="shrink-0 flex flex-col items-center border-r-[0.4mm] border-black px-[1.5mm] pt-[1mm] pb-[1.2mm] overflow-hidden"
                    >
                      {trolleyQrUrl && (
                        <img
                          src={trolleyQrUrl}
                          alt={`QR Code ${trolleyPrintData.uniqueQrPayload}`}
                          style={{ width: "31mm", height: "31mm" }}
                          className="bg-white border-[0.4mm] border-black rounded-[0.8mm] p-[0.5mm] object-contain"
                        />
                      )}
                      <FitText max={12} min={9} className="w-full text-center font-mono font-black mt-[1mm]">
                        {trolleyPrintData.kanbanCode}
                      </FitText>
                      <FitText max={8} min={5} className="w-full text-center font-mono text-slate-600 mt-[0.5mm]">
                        {trolleyPrintData.uniqueQrPayload}
                      </FitText>
                      <div
                        style={{ height: "6mm" }}
                        className={`mt-auto w-full flex items-center justify-center font-black text-[9.5pt] tracking-wide border-[0.4mm] border-black rounded-[0.8mm] ${trolleyPrintData.isPartial ? "bg-amber-300 text-black" : "bg-emerald-600 text-white"
                          }`}
                      >
                        {trolleyPrintData.isPartial ? "PARTIAL (SISA)" : "FULL (PENUH)"}
                      </div>
                    </div>

                    {/* ---- Kanan: detail (Lot 6.5mm + Cust 6.5mm + Part 15.8mm + Grid 22.0mm = 50.8mm) ---- */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      {/* LOT + SHIFT */}
                      <div style={{ height: "6.5mm" }} className="px-[1.5mm] pt-[0.4mm] border-b-[0.4mm] border-black overflow-hidden shrink-0 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <p className="text-[5.5pt] font-bold uppercase text-slate-600 leading-none">No. Lot</p>
                          <span className={TAG}>{trolleyPrintData.shift}</span>
                        </div>
                        <FitText max={10} min={7.5} className="font-mono font-black" style={{ height: "3.8mm" }}>
                          {trolleyPrintData.lotNumber}
                        </FitText>
                      </div>

                      {/* CUSTOMER / OEM (Dedicated Full-Width Row) */}
                      <div style={{ height: "6.5mm" }} className="px-[1.5mm] pt-[0.4mm] border-b-[0.4mm] border-black overflow-hidden shrink-0 flex flex-col justify-between bg-slate-50">
                        <p className={LBL}>Customer / OEM</p>
                        <FitText max={10} min={6.5} multiline className="font-black uppercase tracking-wide leading-tight" style={{ height: "3.8mm" }}>
                          {trolleyPrintData.customer || "—"}
                        </FitText>
                      </div>

                      {/* PART NO + NAMA PART (Spacing rapat, dinamis responsif <=25 vs >25 karakter) */}
                      <div style={{ height: "15.8mm" }} className="px-[1.5mm] pt-[0.5mm] border-b-[0.4mm] border-black overflow-hidden shrink-0 flex flex-col justify-between">
                        <div>
                          <p className={LBL}>Part No / Nama Part</p>
                          <FitText max={13.5} min={9.5} className="font-mono font-black" style={{ height: "4.4mm" }}>
                            {trolleyPrintData.partNo}
                          </FitText>
                        </div>
                        {(() => {
                          const nameLen = (trolleyPrintData.partName || "").trim().length;
                          // Responsif panjang karakter:
                          // <= 25 karakter: huruf diperbesar sedikit (max 13.5pt)
                          // > 25 karakter: huruf diperkecil (max 10.5pt, min 7pt) agar membungkus pas dalam 2 baris
                          const nameMaxPt = nameLen <= 25 ? 13.5 : 10.5;
                          const nameMinPt = nameLen <= 25 ? 9.0 : 7.0;

                          return (
                            <FitText
                              max={nameMaxPt}
                              min={nameMinPt}
                              multiline
                              lineHeight={1.15}
                              className="font-black leading-tight"
                              style={{ height: "7.8mm" }}
                            >
                              {trolleyPrintData.partName}
                            </FitText>
                          );
                        })()}
                      </div>

                      {/* Grid 2 x 2: Row 1 = 10.5mm, Row 2 (Operator & Next Process) = 11.5mm (Seimbang & Proporsional di Layar maupun Cetak) */}
                      <div
                        className="flex-1 min-h-0 grid"
                        style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "10.5mm minmax(0,1fr)" }}
                      >
                        {/* Isi / Satuan Kemasan */}
                        <div className="px-[1.5mm] pt-[0.5mm] pb-[0.4mm] border-r-[0.4mm] border-b-[0.4mm] border-black overflow-hidden flex flex-col justify-between">
                          <p className={LBL}>Isi / {cTypeUpper} (PCS)</p>
                          <FitText max={21} min={14} lineHeight={1} className="font-mono font-black" style={{ height: "7.2mm" }}>
                            {trolleyPrintData.qty}
                          </FitText>
                        </div>

                        {/* Mesin */}
                        <div className="px-[1.5mm] pt-[0.5mm] pb-[0.4mm] border-b-[0.4mm] border-black overflow-hidden flex flex-col justify-between">
                          <p className={LBL}>Mesin</p>
                          <FitText max={21} min={14} lineHeight={1} className="font-mono font-black" style={{ height: "7.2mm" }}>
                            {trolleyPrintData.machineCode}
                          </FitText>
                        </div>

                        {/* Operator (ID di baris label) */}
                        <div className="px-[1.5mm] pt-[0.6mm] pb-[0.5mm] border-r-[0.4mm] border-black overflow-hidden flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-[0.2mm]">
                            <p className="text-[5.5pt] font-bold uppercase text-slate-600 leading-none">Operator</p>
                            <span className={TAG}>{trolleyPrintData.operatorId}</span>
                          </div>
                          <FitText max={14} min={8.5} multiline className="font-extrabold" style={{ height: "6.8mm" }}>
                            {trolleyPrintData.operatorName}
                          </FitText>
                        </div>

                        {/* Next Process (boleh 2 baris) */}
                        <div className="px-[1.5mm] pt-[0.6mm] pb-[0.5mm] overflow-hidden flex flex-col justify-between">
                          <div className="flex items-center mb-[0.2mm]">
                            <p className="text-[5.5pt] font-bold uppercase text-slate-600 leading-none">Next Process</p>
                          </div>
                          <FitText max={15} min={9} multiline className="font-black" style={{ height: "6.8mm" }}>
                            {trolleyPrintData.nextProcess}
                          </FitText>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ============ 3. FOOTER (4mm) ============ */}
                  <div
                    style={{ height: "4mm" }}
                    className="shrink-0 bg-black text-white flex items-center justify-between gap-[2mm] px-[2mm] text-[5pt] leading-none"
                  >
                    <span className="font-mono truncate">
                      <strong>Waktu:</strong> {trolleyPrintData.timeStr}
                    </span>
                    <strong className="uppercase tracking-wider whitespace-nowrap">Scan QR saat pindah proses</strong>
                  </div>
                </div>
              </div>

              {/* Actions (No Print) */}
              <div className="no-print p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTrolleyPrintData(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => printKanbanCard("kanban-trolley-card")}
                  className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Label Kanban (Print)</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Formulir Laporan Harian (FO/MLD/009 Rev.08) */}
      {isReportOpen && (
        <DailyMachineReportModal
          key={`report-mc-${machine.id}`}
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          machineId={machine.id}
          machinesList={[{ id: machine.id, code: machine.code, tonnage: machine.tonnage }]}
        />
      )}

      {/* Modal Revisi Target Rencana Produksi */}
      {planToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border-2 border-sky-400 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-gradient-to-r from-sky-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-white/20 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">
                    Revisi Target Rencana Produksi
                  </h3>
                  <p className="text-[11px] text-sky-200">
                    Mesin {machine.code} - PPIC Plan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlanToEdit(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanRevision} className="p-5 space-y-4">
              {/* Info Part */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Part Diproduksi
                </span>
                <p className="text-base font-black text-slate-900 font-mono">
                  {planToEdit.partNo}
                </p>
                <p className="text-xs text-slate-600 font-medium truncate">
                  {planToEdit.partName}
                </p>
                <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-xs flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Target Saat Ini:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {planToEdit.targetQty.toLocaleString("id-ID")} {planToEdit.isSet ? "Set" : "pcs"}
                  </span>
                </div>
              </div>

              {/* Input Target Baru */}
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-target-qty"
                  className="block text-xs font-black uppercase tracking-wider text-slate-800"
                >
                  Target Baru ({planToEdit.isSet ? "Set" : "pcs"}):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="edit-target-qty"
                    type="number"
                    min={1}
                    max={999999}
                    required
                    value={editTargetInput || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setEditTargetInput(isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-sky-600 bg-white text-lg font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="Contoh: 500"
                    autoFocus
                  />
                  <span className="text-xs font-extrabold text-slate-700 shrink-0">
                    {planToEdit.isSet ? "Set" : "pcs"}
                  </span>
                </div>

                {/* Quick Add / Minus Chips */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Preset:</span>
                  {[-100, -50, +50, +100, +200].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setEditTargetInput((prev) => Math.max(1, (prev || 0) + delta))}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Catatan / Alasan Revisi */}
              <div className="space-y-1">
                <label
                  htmlFor="edit-plan-notes"
                  className="block text-xs font-bold text-slate-700"
                >
                  Catatan / Alasan Perubahan (Opsional):
                </label>
                <input
                  id="edit-plan-notes"
                  type="text"
                  value={editNotesInput}
                  onChange={(e) => setEditNotesInput(e.target.value)}
                  placeholder="Misal: Permintaan PPIC via WA / Tambahan order..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {editPlanError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-xs text-rose-700 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editPlanError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPlanToEdit(null)}
                  disabled={isSavingPlanRevision}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlanRevision || editTargetInput <= 0}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  {isSavingPlanRevision ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Target Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
