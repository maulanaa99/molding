"use client";

import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Database,
  Printer,
  QrCode,
  Layers,
  Cpu,
  AlertTriangle,
  Plus,
  CheckCircle,
  FileText,
  FileSpreadsheet,
  Download,
  Upload,
  UserPlus,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  KeyRound,
  Shield,
  Search,
  Lock,
  X,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import QRCode from "qrcode";
import { printThermalKanbanElement } from "@/lib/printThermal";

interface MasterDataViewProps {
  initialData: {
    machines: Array<{ id: number; code: string; model: string | null; tonnage: number; isActive: boolean }>;
    parts: Array<{
      id: number;
      partNo: string;
      name: string;
      cycleTimeSec: number;
      cavity: number;
      qtyPerTrolly: number;
      containerType?: string | null;
      customer?: string | null;
      material?: string | null;
      isActive: boolean;
      pairPart?: { id: number; partNo: string; name: string } | null;
      machines?: Array<{ machineId: number; cycleTimeSec?: number | null; machine: { id: number; code: string } }>;
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
    users: Array<{ id: number; name: string; employeeId: string; role: string; isActive?: boolean }>;
  };
  onCreateKanban: (
    code: string,
    partId: number,
    qty?: number
  ) => Promise<{ success: boolean; error?: string }>;
  onImportMachines?: (csvText: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  onImportParts?: (csvText: string) => Promise<{
    success: boolean;
    count?: number;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    error?: string;
  }>;
  onImportPartsRows?: (rows: string[][]) => Promise<{
    success: boolean;
    count?: number;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    error?: string;
  }>;
  onDeleteMachine?: (machineId: number) => Promise<{ success: boolean; error?: string }>;
  onCreateUser?: (data: {
    employeeId: string;
    name: string;
    role: string;
    pin?: string;
  }) => Promise<{ success: boolean; error?: string; data?: any }>;
  onUpdateUser?: (
    id: number,
    data: { name?: string; role?: string; pin?: string; isActive?: boolean }
  ) => Promise<{ success: boolean; error?: string; data?: any }>;
  onDeleteUser?: (id: number) => Promise<{ success: boolean; error?: string; message?: string }>;
  onSetPartPair?: (partAId: number, partBId: number | null) => Promise<{ success: boolean; error?: string }>;
  onCreatePart?: (data: {
    partNo: string;
    name: string;
    cycleTimeSec: number;
    cavity: number;
    qtyPerTrolly: number;
    containerType?: string;
    customer?: string;
    material?: string;
    nextProcess?: string;
    machineIds?: number[];
    pairPartId?: number | null;
  }) => Promise<{ success: boolean; error?: string; data?: any }>;
  onUpdatePart?: (
    id: number,
    data: {
      partNo?: string;
      name?: string;
      cycleTimeSec?: number;
      cavity?: number;
      qtyPerTrolly?: number;
      containerType?: string;
      customer?: string | null;
      material?: string | null;
      nextProcess?: string;
      isActive?: boolean;
      machineIds?: number[];
      pairPartId?: number | null;
    }
  ) => Promise<{ success: boolean; error?: string; data?: any }>;
  onDeletePart?: (id: number) => Promise<{ success: boolean; error?: string }>;
}

export default function MasterDataView({
  initialData,
  onCreateKanban,
  onImportMachines,
  onImportParts,
  onImportPartsRows,
  onDeleteMachine,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onSetPartPair,
  onCreatePart,
  onUpdatePart,
  onDeletePart,
}: MasterDataViewProps) {
  const [activeTab, setActiveTab] = useState<"kanban" | "machines" | "parts" | "reasons" | "users">("kanban");
  const [kanbansList, setKanbansList] = useState(initialData.kanbans);
  const [selectedKanbanToPrint, setSelectedKanbanToPrint] = useState<(typeof initialData.kanbans)[0] | null>(
    initialData.kanbans[0] || null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  // User management states
  const [usersList, setUsersList] = useState(initialData.users);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<(typeof initialData.users)[0] | null>(null);
  const [userFeedback, setUserFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);

  // Form states tambah user
  const [newEmpId, setNewEmpId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState("OPERATOR");
  const [newUserPin, setNewUserPin] = useState("1234");

  // Form states edit user
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState("OPERATOR");
  const [editUserPin, setEditUserPin] = useState("");
  const [editUserActive, setEditUserActive] = useState(true);

  useEffect(() => {
    setUsersList(initialData.users);
  }, [initialData.users]);

  // Filtered users list
  const filteredUsers = usersList.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole =
      userRoleFilter === "ALL" || u.role.toUpperCase() === userRoleFilter;
    return matchSearch && matchRole;
  });

  const handleOpenAddUser = () => {
    setNewEmpId("");
    setNewUserName("");
    setNewUserRole("OPERATOR");
    setNewUserPin("1234");
    setUserFeedback(null);
    setShowAddUserModal(true);
  };

  const handleOpenEditUser = (u: (typeof initialData.users)[0]) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserRole(u.role);
    setEditUserPin("");
    setEditUserActive(u.isActive !== false);
    setUserFeedback(null);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId.trim() || !newUserName.trim()) {
      setUserFeedback({ type: "error", text: "ID Karyawan (NIK) dan Nama Lengkap wajib diisi." });
      return;
    }
    if (onCreateUser) {
      setIsUserSubmitting(true);
      setUserFeedback(null);
      const res = await onCreateUser({
        employeeId: newEmpId.trim().toUpperCase(),
        name: newUserName.trim(),
        role: newUserRole,
        pin: newUserPin.trim() || "1234",
      });
      setIsUserSubmitting(false);
      if (res.success) {
        setShowAddUserModal(false);
        setUserFeedback({
          type: "success",
          text: `Karyawan ${newUserName} (${newEmpId.toUpperCase()}) sebagai ${newUserRole} berhasil ditambahkan!`,
        });
      } else {
        setUserFeedback({ type: "error", text: res.error || "Gagal menambahkan user baru." });
      }
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserName.trim()) {
      setUserFeedback({ type: "error", text: "Nama Karyawan tidak boleh kosong." });
      return;
    }
    if (onUpdateUser) {
      setIsUserSubmitting(true);
      setUserFeedback(null);
      const res = await onUpdateUser(editingUser.id, {
        name: editUserName.trim(),
        role: editUserRole,
        pin: editUserPin.trim() || undefined,
        isActive: editUserActive,
      });
      setIsUserSubmitting(false);
      if (res.success) {
        setEditingUser(null);
        setUserFeedback({
          type: "success",
          text: `Data karyawan ${editingUser.employeeId} berhasil diperbarui!`,
        });
      } else {
        setUserFeedback({ type: "error", text: res.error || "Gagal memperbarui data user." });
      }
    }
  };

  const handleToggleUserActive = async (u: (typeof initialData.users)[0]) => {
    if (onUpdateUser) {
      const nextActive = u.isActive === false ? true : false;
      const res = await onUpdateUser(u.id, { isActive: nextActive });
      if (res.success) {
        setUserFeedback({
          type: "success",
          text: `Status ${u.name} (${u.employeeId}) diubah menjadi ${nextActive ? "Aktif" : "Nonaktif"}.`,
        });
      } else {
        setUserFeedback({ type: "error", text: res.error || "Gagal mengubah status." });
      }
    }
  };

  const handleDeleteUserClick = async (u: (typeof initialData.users)[0]) => {
    if (!confirm(`Hapus karyawan ${u.name} (${u.employeeId})?`)) return;
    if (onDeleteUser) {
      const res = await onDeleteUser(u.id);
      if (res.success) {
        setUserFeedback({
          type: "success",
          text: res.message || `Karyawan ${u.name} berhasil dihapus.`,
        });
      } else {
        setUserFeedback({ type: "error", text: res.error || "Gagal menghapus user." });
      }
    }
  };

  // ==========================================
  // Part Management States & Handlers
  // ==========================================
  const [partsList, setPartsList] = useState(initialData.parts);
  const [partSearch, setPartSearch] = useState("");
  const [partMoldFilter, setPartMoldFilter] = useState<"ALL" | "PAIR" | "SINGLE">("ALL");
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<(typeof initialData.parts)[0] | null>(null);
  const [partFeedback, setPartFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPartSubmitting, setIsPartSubmitting] = useState(false);

  // Form states tambah part
  const [newPartNo, setNewPartNo] = useState("");
  const [newPartName, setNewPartName] = useState("");
  const [newPartCt, setNewPartCt] = useState(30.0);
  const [newPartCavity, setNewPartCavity] = useState(1);
  const [newPartQtyTrolly, setNewPartQtyTrolly] = useState(100);
  const [newPartContainerType, setNewPartContainerType] = useState("TROLLY");
  const [newPartCustomer, setNewPartCustomer] = useState("");
  const [newPartMaterial, setNewPartMaterial] = useState("");
  const [newPartNextProcess, setNewPartNextProcess] = useState("PAINTING");
  const [newPartMachineIds, setNewPartMachineIds] = useState<number[]>([]);
  const [newPartPairId, setNewPartPairId] = useState<number | null>(null);

  // Form states edit part
  const [editPartNo, setEditPartNo] = useState("");
  const [editPartName, setEditPartName] = useState("");
  const [editPartCt, setEditPartCt] = useState(30.0);
  const [editPartCavity, setEditPartCavity] = useState(1);
  const [editPartQtyTrolly, setEditPartQtyTrolly] = useState(100);
  const [editPartContainerType, setEditPartContainerType] = useState("TROLLY");
  const [editPartCustomer, setEditPartCustomer] = useState("");
  const [editPartMaterial, setEditPartMaterial] = useState("");
  const [editPartNextProcess, setEditPartNextProcess] = useState("PAINTING");
  const [editPartMachineIds, setEditPartMachineIds] = useState<number[]>([]);
  const [editPartPairId, setEditPartPairId] = useState<number | null>(null);
  const [editPartActive, setEditPartActive] = useState(true);

  useEffect(() => {
    setPartsList(initialData.parts);
  }, [initialData.parts]);

  // Filtered parts list
  const filteredParts = partsList.filter((p) => {
    const q = partSearch.toLowerCase();
    const matchSearch =
      p.partNo.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.machines && p.machines.some((m) => m.machine.code.toLowerCase().includes(q)));

    const matchFilter =
      partMoldFilter === "ALL" ||
      (partMoldFilter === "PAIR" && !!p.pairPart) ||
      (partMoldFilter === "SINGLE" && !p.pairPart);

    return matchSearch && matchFilter;
  });

  const handleOpenAddPart = () => {
    setNewPartNo("");
    setNewPartName("");
    setNewPartCt(30.0);
    setNewPartCavity(1);
    setNewPartQtyTrolly(100);
    setNewPartContainerType("TROLLY");
    setNewPartCustomer("");
    setNewPartMaterial("");
    setNewPartNextProcess("PAINTING");
    setNewPartMachineIds([]);
    setNewPartPairId(null);
    setPartFeedback(null);
    setShowAddPartModal(true);
  };

  const handleOpenEditPart = (p: (typeof initialData.parts)[0]) => {
    setEditingPart(p);
    setEditPartNo(p.partNo);
    setEditPartName(p.name);
    setEditPartCt(p.cycleTimeSec);
    setEditPartCavity(p.cavity);
    setEditPartQtyTrolly(p.qtyPerTrolly);
    setEditPartContainerType((p as any).containerType || "TROLLY");
    setEditPartCustomer((p as any).customer || "");
    setEditPartMaterial(p.material || "");
    setEditPartNextProcess((p as any).nextProcess || "PAINTING");

    // Pre-select machines currently assigned
    const currentMIds: number[] = [];
    if (p.machines) {
      p.machines.forEach((mRel) => {
        const found = initialData.machines.find((m) => m.code === mRel.machine.code);
        if (found) currentMIds.push(found.id);
      });
    }
    setEditPartMachineIds(currentMIds);
    setEditPartPairId(p.pairPart ? p.pairPart.id : null);
    setEditPartActive(p.isActive !== false);
    setPartFeedback(null);
  };

  const handleCreatePartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartNo.trim() || !newPartName.trim()) {
      setPartFeedback({ type: "error", text: "Nomor Part dan Nama Part wajib diisi." });
      return;
    }
    if (onCreatePart) {
      setIsPartSubmitting(true);
      setPartFeedback(null);
      const res = await onCreatePart({
        partNo: newPartNo.trim().toUpperCase(),
        name: newPartName.trim(),
        cycleTimeSec: Number(newPartCt) || 30.0,
        cavity: Number(newPartCavity) || 1,
        qtyPerTrolly: Number(newPartQtyTrolly) || 100,
        containerType: newPartContainerType,
        customer: newPartCustomer.trim().toUpperCase() || undefined,
        material: newPartMaterial.trim() || undefined,
        nextProcess: newPartNextProcess,
        machineIds: newPartMachineIds,
        pairPartId: newPartPairId,
      });
      setIsPartSubmitting(false);
      if (res.success) {
        setShowAddPartModal(false);
        setPartFeedback({
          type: "success",
          text: `Part ${newPartNo.toUpperCase()} - ${newPartName} berhasil ditambahkan!`,
        });
      } else {
        setPartFeedback({ type: "error", text: res.error || "Gagal menambahkan part baru." });
      }
    }
  };

  const handleUpdatePartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;
    if (!editPartNo.trim() || !editPartName.trim()) {
      setPartFeedback({ type: "error", text: "Nomor Part dan Nama Part tidak boleh kosong." });
      return;
    }
    if (onUpdatePart) {
      setIsPartSubmitting(true);
      setPartFeedback(null);
      const res = await onUpdatePart(editingPart.id, {
        partNo: editPartNo.trim().toUpperCase(),
        name: editPartName.trim(),
        cycleTimeSec: Number(editPartCt) || 30.0,
        cavity: Number(editPartCavity) || 1,
        qtyPerTrolly: Number(editPartQtyTrolly) || 100,
        containerType: editPartContainerType,
        customer: editPartCustomer.trim().toUpperCase() || null,
        material: editPartMaterial.trim() || null,
        nextProcess: editPartNextProcess,
        machineIds: editPartMachineIds,
        pairPartId: editPartPairId,
        isActive: editPartActive,
      });
      setIsPartSubmitting(false);
      if (res.success) {
        setPartsList((prev) =>
          prev.map((item) =>
            item.id === editingPart.id
              ? {
                  ...item,
                  partNo: editPartNo.trim().toUpperCase(),
                  name: editPartName.trim(),
                  cycleTimeSec: Number(editPartCt) || 30.0,
                  cavity: Number(editPartCavity) || 1,
                  qtyPerTrolly: Number(editPartQtyTrolly) || 100,
                  containerType: editPartContainerType,
                  customer: editPartCustomer.trim().toUpperCase() || null,
                  material: editPartMaterial.trim() || null,
                  nextProcess: editPartNextProcess,
                  isActive: editPartActive,
                }
              : item
          )
        );
        setEditingPart(null);
        setPartFeedback({
          type: "success",
          text: `Data part ${editPartNo.toUpperCase()} berhasil di-overwrite / diperbarui!`,
        });
      } else {
        setPartFeedback({ type: "error", text: res.error || "Gagal memperbarui data part." });
      }
    }
  };

  const handleDeletePartClick = async (p: (typeof initialData.parts)[0]) => {
    if (!confirm(`Hapus part ${p.partNo} (${p.name}) dari database?`)) return;
    if (onDeletePart) {
      const res = await onDeletePart(p.id);
      if (res.success) {
        setPartFeedback({
          type: "success",
          text: `Part ${p.partNo} berhasil dihapus.`,
        });
      } else {
        setPartFeedback({ type: "error", text: res.error || "Gagal menghapus part." });
      }
    }
  };

  const handleExportCurrentPartsCsv = () => {
    let csv = "part_no,nama_part,customer,cycle_time_detik,cavity,qty_per_kemasan,satuan_kemasan,material,daftar_kode_mesin,pasangan,proses_lanjutan\n";
    partsList.forEach((p) => {
      const machineCodes = p.machines?.map((m) => m.machine.code).join(";") || "";
      const pairPartNo = p.pairPart?.partNo || "";
      const escapedName = p.name.includes(",") || p.name.includes('"')
        ? `"${p.name.replace(/"/g, '""')}"`
        : p.name;
      const cust = (p as any).customer || "";
      const escapedCust = cust.includes(",") || cust.includes('"') || cust.includes(";")
        ? `"${cust.replace(/"/g, '""')}"`
        : cust;
      const mat = (p as any).material || "";
      const escapedMat = mat.includes(",") || mat.includes('"') || mat.includes(";")
        ? `"${mat.replace(/"/g, '""')}"`
        : mat;
      const cType = (p as any).containerType || "TROLLY";
      const escapedMachines = machineCodes ? `"${machineCodes}"` : "";
      csv += `${p.partNo},${escapedName},${escapedCust},${p.cycleTimeSec},${p.cavity},${p.qtyPerTrolly},${cType},${escapedMat},${escapedMachines},${pairPartNo},${(p as any).nextProcess || "PAINTING"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `master_part_mms_live_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // New Kanban Form state
  const [newCode, setNewCode] = useState("");
  const [newPartId, setNewPartId] = useState<number>(initialData.parts[0]?.id || 1);
  const [newQty, setNewQty] = useState<number>(initialData.parts[0]?.qtyPerTrolly || 100);
  const [isCreating, setIsCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // CSV Import States
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const machineFileInputRef = useRef<HTMLInputElement>(null);
  const partFileInputRef = useRef<HTMLInputElement>(null);

  // Generate QR image when selectedKanbanToPrint changes
  useEffect(() => {
    if (selectedKanbanToPrint) {
      QRCode.toDataURL(selectedKanbanToPrint.code, {
        width: 250,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Error generating QR:", err));
    }
  }, [selectedKanbanToPrint]);

  const handleCreateKanban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    setIsCreating(true);
    setFormMsg(null);

    const res = await onCreateKanban(newCode.trim(), newPartId, newQty);
    setIsCreating(false);

    if (res.success) {
      setFormMsg({ type: "success", text: `Kanban "${newCode.toUpperCase()}" berhasil dibuat!` });
      const targetPart = initialData.parts.find((p) => p.id === newPartId)!;
      const newObj = {
        id: Date.now(),
        code: newCode.toUpperCase(),
        partId: newPartId,
        qtyPerTrolly: newQty,
        isActive: true,
        part: targetPart,
      };
      setKanbansList([newObj, ...kanbansList]);
      setSelectedKanbanToPrint(newObj);
      setNewCode("");
    } else {
      setFormMsg({ type: "error", text: res.error || "Gagal membuat kanban." });
    }
  };

  const handlePrint = () => {
    printThermalKanbanElement("master-kanban-card");
  };

  // Download CSV Templates directly
  const handleDownloadMachineTemplate = () => {
    const csvContent =
      "kode_mesin,model_mesin,tonase,status_aktif\n" +
      "MC01,SI-100-6s,100,TRUE\n" +
      "MC02,SI-100-6s,100,TRUE\n" +
      "MC03,SI-280-6s,280,TRUE\n" +
      "MC04,SI-280-6s,280,TRUE\n" +
      "MC05,SI-450-6s,450,TRUE\n" +
      "MC06,SI-450-6s,450,TRUE\n" +
      "MC07,SI-450-6s,450,TRUE\n" +
      "MC08,SI-450-6s,450,TRUE\n" +
      "MC09,SI-850-6s,850,TRUE\n" +
      "MC10,SI-850-6s,850,TRUE\n" +
      "MC11,SI-850-6s,850,TRUE\n" +
      "MC12,JSW 1800,1800,TRUE\n" +
      "MC13,JSW 1300,1300,TRUE\n" +
      "MC14,SI-850-6s,850,TRUE\n" +
      "MC15,JSW 1800,1800,TRUE\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "template_import_mesin_mms.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [showExcelGuide, setShowExcelGuide] = useState(false);

  const handleDownloadPartTemplate = () => {
    handleDownloadPartTemplateXlsx();
  };

  const handleDownloadPartTemplateXlsx = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Template Data Siap Isi
    const headers = [
      "part_no",
      "nama_part",
      "customer",
      "cycle_time_detik",
      "cavity",
      "qty_per_kemasan",
      "satuan_kemasan",
      "material",
      "daftar_kode_mesin",
      "pasangan",
      "proses_lanjutan",
    ];

    const sampleRows = [
      [
        "PRT-CVR-001",
        "Cover Front Body A",
        "PT. TOYOTA MOTOR MANUFACTURING INDONESIA",
        42.5,
        2,
        120,
        "TROLLY",
        "ABS",
        "MC01;MC11",
        "",
        "PAINTING",
      ],
      [
        "SL3800",
        "Cap, Front Garnish",
        "PT. MITSUBISHI MOTORS KRAMA YUDHA INDONESIA",
        38.0,
        2,
        80,
        "BOX",
        "PP",
        "MC01",
        "",
        "SUB ASSY",
      ],
      [
        "SL3800",
        "Cap, Front Garnish",
        "PT. MITSUBISHI MOTORS KRAMA YUDHA INDONESIA",
        24.0,
        2,
        80,
        "BOX",
        "PP",
        "MC02",
        "",
        "SUB ASSY",
      ],
      [
        "PRT-BRK-003",
        "Bracket Side Frame LH",
        "PT. ASTRA DAIHATSU MOTOR",
        28.0,
        1,
        240,
        "RAK",
        "PC+ABS",
        "MC03;MC04",
        "PRT-BRK-004",
        "DELIVERY",
      ],
      [
        "PRT-BRK-004",
        "Bracket Side Frame RH",
        "PT. ASTRA DAIHATSU MOTOR",
        28.0,
        1,
        240,
        "RAK",
        "PC+ABS",
        "MC03;MC04",
        "PRT-BRK-003",
        "DELIVERY",
      ],
    ];

    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set Column Widths for readability
    ws["!cols"] = [
      { wch: 18 }, // part_no
      { wch: 28 }, // nama_part
      { wch: 42 }, // customer
      { wch: 18 }, // cycle_time_detik
      { wch: 10 }, // cavity
      { wch: 18 }, // qty_per_kemasan
      { wch: 16 }, // satuan_kemasan
      { wch: 14 }, // material
      { wch: 24 }, // daftar_kode_mesin
      { wch: 18 }, // pasangan
      { wch: 18 }, // proses_lanjutan
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Master Part");

    // Sheet 2: Panduan & Kamus Kolom
    const guideData = [
      ["PANDUAN LENGKAP PENGISIAN MASTER PART & RELASI MESIN MOLDING (MMS)"],
      [""],
      ["Nama Kolom (Header)", "Wajib?", "Format / Tipe Data", "Aturan & Penjelasan Detail"],
      ["part_no", "YA (Kunci)", "Teks / Alfanumerik", "Kode/Nomor part unik perusahaan (Contoh: 7415A703, 79890W030P). Jika sudah ada di database, data part akan otomatis di-UPDATE (overwrite)."],
      ["nama_part", "YA", "Teks", "Deskripsi atau nama resmi part (Contoh: 4L45W 23MY X pander Mark, Cover Front Body)."],
      ["customer", "OPSIONAL", "Teks (Nama OEM/PT)", "Nama pelanggan atau OEM mobil (Contoh: PT. TOYOTA MOTOR MANUFACTURING INDONESIA, PT. MITSUBISHI MOTORS KRAMA YUDHA INDONESIA, PT. ASTRA DAIHATSU MOTOR, PT. NISSAN MOTOR INDONESIA, dll). Tampil di kanban."],
      ["cycle_time_detik", "YA", "Angka (Desimal)", "Waktu standar cetak 1 kali shot dalam detik (Contoh: 28, 42.5). Jika CT berbeda di tiap mesin, buat baris terpisah untuk tiap mesin (Opsi Multi-Row)."],
      ["cavity", "YA", "Angka Bulat (>= 1)", "Jumlah produk yang keluar dalam 1 kali shot cetakan. Family Mold umumnya diisi 1 per sisi, atau 2 untuk cetakan reguler multi-cavity."],
      ["qty_per_kemasan", "YA", "Angka Bulat (>= 1)", "Standar kapasitas penuh isi 1 kemasan (Contoh: 120, 240, 648)."],
      ["satuan_kemasan", "OPSIONAL", "Pilihan: TROLLY / BOX / RAK", "Jenis wadah penyimpanan fisik (Default: TROLLY). Pilihan: TROLLY, BOX, atau RAK."],
      ["material", "OPSIONAL", "Teks Resin", "Bahan baku bijih plastik yang digunakan (Contoh: ABS, PP, PC+ABS, PA66, POM, PMMA)."],
      ["daftar_kode_mesin", "OPSIONAL", "Teks (Pemisah titik koma)", "Daftar kode mesin molding yang diizinkan memproses part ini (Contoh: MC01 atau MC01;MC02;MC11). Otomatis membuat relasi mesin."],
      ["pasangan", "OPSIONAL (Penting)", "part_no Pasangan", "Untuk FAMILY MOLD (LH & RH): Isi dengan nomor part pasangannya. Contoh: jika baris ini part LH, isi dengan part_no RH. Sistem otomatis menautkan kedua part. KOSONGKAN jika part berdiri sendiri (Single/Reguler)."],
      ["proses_lanjutan", "OPSIONAL", "Teks Proses", "Tujuan stasiun berikutnya (Default: PAINTING). Contoh: PAINTING, PLATING, SUB ASSY, ASSEMBLY, DELIVERY, GUDANG FG."],
      [""],
      ["PANDUAN KHUSUS: SIKLUS WAKTU (CYCLE TIME) BERBEDA PER MESIN:"],
      ["Jika satu part yang sama memiliki Cycle Time berbeda ketika diproses di mesin berbeda (misal SL3800 di MC01 = 38s, di MC02 = 24s):"],
      ["1. Buat baris terpisah di Excel untuk part tersebut dengan kode mesin dan CT masing-masing:"],
      ["   - Baris 1: part_no = SL3800, cycle_time_detik = 38, daftar_kode_mesin = MC01"],
      ["   - Baris 2: part_no = SL3800, cycle_time_detik = 24, daftar_kode_mesin = MC02"],
      ["2. Sistem otomatis menyimpan nilai CT 38s khusus MC01, dan CT 24s khusus MC02 ke database relasi mesin (MachinePart)."],
      ["3. Saat operator menjalankan part tersebut di MC01, sistem memakai 38 detik. Saat dijalankan di MC02, sistem memakai 24 detik."],
      [""],
      ["ATURAN PENTING TIPE PART:"],
      ["1. FAMILY MOLD (LH & RH):"],
      ["   - Memiliki pasangan cetakan (misal: Sisi Kiri / LH dan Sisi Kanan / RH dibuat bersamaan dalam 1 dies mold)."],
      ["   - Kolom 'pasangan' WAJIB diisi nomor part pasangannya."],
      ["   - Saat produksi, sistem menyediakan mode 'SET' (1 shot menghasilkan 1 LH + 1 RH) atau mode 'SINGLE' jika satu cavity ditutup."],
      ["   - Target planning: 400 Set = 400 pcs LH + 400 pcs RH (membutuhkan 400 shot)."],
      ["2. REGULER MULTI-CAVITY / SINGLE PART:"],
      ["   - Part tunggal tanpa pasangan (kolom 'pasangan' dikosongkan)."],
      ["   - Menghasilkan produk yang identik (misal Cavity 2 menghasilkan 2 pcs part yang sama persis dalam 1 shot)."],
      ["   - Mode Family Mold otomatis tidak aktif, target produksi dihitung dalam satuan pcs biasa."],
    ];

    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    wsGuide["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 28 }, { wch: 95 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan & Kamus Kolom");

    XLSX.writeFile(wb, "template_import_master_part_mms.xlsx");
  };

  const handleExportCurrentPartsXlsx = () => {
    const wb = XLSX.utils.book_new();

    const headers = [
      "part_no",
      "nama_part",
      "customer",
      "cycle_time_detik",
      "cavity",
      "qty_per_kemasan",
      "satuan_kemasan",
      "material",
      "daftar_kode_mesin",
      "pasangan",
      "proses_lanjutan",
    ];

    const rows: any[][] = [];

    partsList.forEach((p) => {
      const pairPartNo = p.pairPart?.partNo || "";
      const cust = (p as any).customer || "";
      const mat = (p as any).material || "";
      const cType = (p as any).containerType || "TROLLY";
      const nextProc = (p as any).nextProcess || "PAINTING";

      // Cek apakah part memiliki relasi mesin dengan CT spesifik yang berbeda
      const assignedMachines = p.machines || [];
      const hasDistinctCt = assignedMachines.some((mRel) => mRel.cycleTimeSec && mRel.cycleTimeSec !== p.cycleTimeSec);

      if (hasDistinctCt && assignedMachines.length > 1) {
        // Ekspor multi-row (1 baris per mesin dengan CT spesifiknya)
        assignedMachines.forEach((mRel) => {
          rows.push([
            p.partNo,
            p.name,
            cust,
            mRel.cycleTimeSec || p.cycleTimeSec,
            p.cavity,
            p.qtyPerTrolly,
            cType,
            mat,
            mRel.machine.code,
            pairPartNo,
            nextProc,
          ]);
        });
      } else {
        // Ekspor 1 baris standar
        const machineCodes = assignedMachines.map((m) => m.machine.code).join(";") || "";
        rows.push([
          p.partNo,
          p.name,
          cust,
          p.cycleTimeSec,
          p.cavity,
          p.qtyPerTrolly,
          cType,
          mat,
          machineCodes,
          pairPartNo,
          nextProc,
        ]);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 42 },
      { wch: 18 },
      { wch: 10 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Master Part Live");
    XLSX.writeFile(wb, `master_part_mms_live_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Upload Handlers
  const handleMachineFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportMachines) return;

    setIsImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const res = await onImportMachines(text);
      if (res.success) {
        setImportStatus({
          type: "success",
          text: `Berhasil mengimpor ${res.count} data mesin dari file "${file.name}"!`,
        });
      } else {
        setImportStatus({
          type: "error",
          text: res.error || "Gagal mengimpor file CSV mesin.",
        });
      }
    } catch {
      setImportStatus({ type: "error", text: "Gagal membaca file CSV." });
    }
    setIsImporting(false);
    if (machineFileInputRef.current) machineFileInputRef.current.value = "";
  };

  const handlePartFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);
    setPartFeedback(null);

    const isExcel =
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.type.includes("spreadsheetml") ||
      file.type.includes("excel");

    try {
      let res: any;

      if (isExcel) {
        // Parse Excel workbook via SheetJS
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

        // Convert all cell values to string
        const stringRows: string[][] = rawRows.map((row) =>
          Array.isArray(row) ? row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : "")) : []
        );

        if (onImportPartsRows) {
          res = await onImportPartsRows(stringRows);
        } else if (onImportParts) {
          // Fallback convert to csv if only onImportParts is available
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          res = await onImportParts(csvText);
        } else {
          throw new Error("Handler import part tidak tersedia.");
        }
      } else {
        // Plain CSV file
        const text = await file.text();
        if (onImportParts) {
          res = await onImportParts(text);
        } else {
          throw new Error("Handler import part tidak tersedia.");
        }
      }

      if (res && res.success) {
        const updated = res.updatedCount ?? res.count ?? 0;
        const created = res.createdCount ?? 0;
        const skipped = res.skippedCount ?? 0;
        let msg = `Berhasil memproses ${res.count ?? (updated + created)} part dari file "${file.name}"! `;
        if (updated > 0 && created > 0) {
          msg += `(${updated} part berhasil di-overwrite, ${created} part baru didaftarkan)`;
        } else if (updated > 0) {
          msg += `(Semua ${updated} part berhasil di-overwrite dengan data terbaru)`;
        } else if (created > 0) {
          msg += `(${created} part baru berhasil didaftarkan)`;
        }
        if (skipped > 0) {
          msg += ` [Catatan: ${skipped} baris kosong/tidak valid dilewati]`;
        }
        setImportStatus({
          type: "success",
          text: msg,
        });
        setPartFeedback({
          type: "success",
          text: msg,
        });
      } else {
        const errMsg = res?.error || "Gagal mengimpor file data part.";
        setImportStatus({
          type: "error",
          text: errMsg,
        });
        setPartFeedback({
          type: "error",
          text: errMsg,
        });
      }
    } catch (err: any) {
      const errMsg = `Gagal membaca file "${file.name}": ${err?.message || "Format file tidak valid."}`;
      setImportStatus({ type: "error", text: errMsg });
      setPartFeedback({ type: "error", text: errMsg });
    }

    setIsImporting(false);
    if (partFileInputRef.current) partFileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-600" />
            Master Data & Pembuatan Label QR Kanban
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Pengelolaan data mesin, spesifikasi part cetak, kode barcode trolly, dan relasi mesin.
          </p>
        </div>

        {/* Sub-nav tabs */}
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => {
              setActiveTab("kanban");
              setImportStatus(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeTab === "kanban"
                ? "bg-white text-sky-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Label QR Kanban
          </button>
          <button
            onClick={() => {
              setActiveTab("machines");
              setImportStatus(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeTab === "machines"
                ? "bg-white text-sky-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Mesin ({initialData.machines.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("parts");
              setImportStatus(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeTab === "parts"
                ? "bg-white text-sky-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Part & Relasi ({initialData.parts.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("reasons");
              setImportStatus(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeTab === "reasons"
                ? "bg-white text-sky-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Alasan Stop ({initialData.stopReasons.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("users");
              setImportStatus(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeTab === "users"
                ? "bg-white text-sky-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Karyawan & Operator ({usersList.length})
          </button>
        </div>
      </div>

      {/* Global Import Notification */}
      {importStatus && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            importStatus.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : "bg-rose-50 text-rose-900 border-rose-300"
          }`}
        >
          {importStatus.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{importStatus.text}</span>
        </div>
      )}

      {/* TAB 1: KANBAN & QR PRINT (FR-05 & FR-06) */}
      {activeTab === "kanban" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri: Form Buat Kanban & List Kanban */}
          <div className="lg:col-span-2 space-y-4">
            {/* Form Tambah Kanban */}
            <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-sky-600" />
                Registrasi Kartu Kanban Trolly Baru
              </h3>

              {formMsg && (
                <div
                  className={`p-3 rounded-lg text-xs font-bold ${
                    formMsg.type === "success"
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
                      : "bg-rose-50 text-rose-900 border border-rose-300"
                  }`}
                >
                  {formMsg.text}
                </div>
              )}

              <form onSubmit={handleCreateKanban} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label htmlFor="kanban-code" className="block text-xs font-bold text-slate-700 mb-1">
                    Kode QR Kanban:
                  </label>
                  <input
                    id="kanban-code"
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Contoh: KB-CVR-001-C"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold uppercase focus:border-sky-600"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="kanban-part" className="block text-xs font-bold text-slate-700 mb-1">
                    Untuk Part:
                  </label>
                  <select
                    id="kanban-part"
                    value={newPartId}
                    onChange={(e) => {
                      const pId = Number(e.target.value);
                      setNewPartId(pId);
                      const p = initialData.parts.find((item) => item.id === pId);
                      if (p) setNewQty(p.qtyPerTrolly);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                  >
                    {initialData.parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.partNo} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="kanban-qty" className="block text-xs font-bold text-slate-700 mb-1">
                    Standar Qty Trolly:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="kanban-qty"
                      type="number"
                      value={newQty}
                      onChange={(e) => setNewQty(Number(e.target.value))}
                      className="w-24 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isCreating || !newCode.trim()}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-lg px-3 py-2 transition cursor-pointer tap-target"
                    >
                      {isCreating ? "Menyimpan..." : "Buat Label"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* List Kanban */}
            <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Daftar Kartu Kanban Terdaftar
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {kanbansList.length} Kartu
                </span>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                      <th className="py-2.5 px-3">Kode Kanban</th>
                      <th className="py-2.5 px-3">Part No</th>
                      <th className="py-2.5 px-3">Nama Part</th>
                      <th className="py-2.5 px-3">Qty / Trolly</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {kanbansList.map((kb) => {
                      const isSelected = selectedKanbanToPrint?.id === kb.id;
                      return (
                        <tr
                          key={kb.id}
                          className={`hover:bg-slate-50 transition cursor-pointer ${
                            isSelected ? "bg-sky-50 font-bold text-sky-950" : ""
                          }`}
                          onClick={() => setSelectedKanbanToPrint(kb)}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {kb.code}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-800">{kb.part.partNo}</td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">
                            {kb.part.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-emerald-800 font-bold">
                            {kb.qtyPerTrolly ?? kb.part.qtyPerTrolly} pcs
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedKanbanToPrint(kb);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold transition"
                            >
                              Pilih Cetak
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Preview Kartu & Cetak Label QR */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border-2 border-slate-300 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-sky-600" />
                  Pratinjau Cetak Label Kanban
                </h3>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!selectedKanbanToPrint}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-2xs tap-target"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak (Print)</span>
                </button>
              </div>

              {selectedKanbanToPrint && qrDataUrl ? (() => {
                const fullPart = initialData.parts.find((p) => p.id === selectedKanbanToPrint.partId || p.partNo === selectedKanbanToPrint.part.partNo);
                return (
                  /* AREA KARTU KANBAN FISIK UNTUK TROLLY (8.8cm x 6.5cm, Margin 0.5cm) */
                  <div className="flex items-center justify-center p-3 bg-slate-100 rounded-xl">
                    <div
                      id="master-kanban-card"
                      style={{ width: "88mm", height: "65mm" }}
                      className="print-area bg-white border-2 border-slate-900 rounded-lg p-2 text-slate-900 font-sans shadow-md flex flex-col justify-between overflow-hidden print:rounded-none print:shadow-none print:border-2 print:border-black"
                    >
                      {/* 1. Header Bar */}
                      <div className="border-b-2 border-slate-900 pb-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[7.5px] font-black leading-none tracking-wider">
                            MMS
                          </span>
                          <div>
                            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-500 leading-none">
                              MOLDING DIVISION
                            </p>
                            <h4 className="text-[11px] font-black tracking-tight text-slate-950 leading-tight">
                              KANBAN MASTER TROLLY
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase border leading-none bg-sky-100 text-sky-900 border-sky-400">
                            MASTER KANBAN
                          </span>
                          <span className="text-[9.5px] font-mono font-black text-slate-950 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 leading-none">
                            {selectedKanbanToPrint.code}
                          </span>
                        </div>
                      </div>

                      {/* 2. Main Body: 2 Kolom (Kiri: QR Code + Kode, Kanan: Detail Part) */}
                      <div className="flex items-stretch gap-2 my-auto py-0.5">
                        {/* Kolom Kiri: QR Code */}
                        <div className="w-[26mm] shrink-0 flex flex-col items-center justify-center border-r border-dashed border-slate-300 pr-1.5">
                          <img
                            src={qrDataUrl}
                            alt={`QR Code ${selectedKanbanToPrint.code}`}
                            className="w-[22mm] h-[22mm] border border-slate-900 rounded p-0.5 object-contain"
                          />
                          <span className="font-mono text-[8px] font-black text-slate-900 mt-1 tracking-tight text-center leading-none truncate max-w-[25mm]">
                            {selectedKanbanToPrint.code}
                          </span>
                          <span className="text-[6px] font-mono text-slate-500 text-center leading-none truncate max-w-[25mm] mt-0.5">
                            MASTER TROLLY
                          </span>
                        </div>

                        {/* Kolom Kanan: Rincian Lengkap */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-1">
                          {/* Customer / OEM */}
                          <div className="border-b border-dashed border-slate-300 pb-0.5">
                            <div className="flex items-center justify-between leading-none">
                              <span className="text-[6.5px] font-bold text-slate-500 uppercase">Customer / OEM:</span>
                            </div>
                            <p className="text-[9px] font-black text-slate-950 uppercase truncate leading-tight mt-0.5">
                              {fullPart?.customer || "—"}
                            </p>
                          </div>

                          {/* Part No & Nama */}
                          <div>
                            <div className="flex items-baseline justify-between leading-none">
                              <span className="text-[7px] font-bold text-slate-500 uppercase">Part No:</span>
                              <span className="font-mono font-black text-[11px] text-slate-950">
                                {selectedKanbanToPrint.part.partNo}
                              </span>
                            </div>
                            <p className="text-[9px] font-black text-slate-900 truncate leading-tight mt-0.5">
                              {selectedKanbanToPrint.part.name}
                            </p>
                          </div>

                          {/* Grid 2 Kolom (Qty, Cycle Time, Cavity, Next Process) */}
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-dashed border-slate-300 pt-0.5 text-[7px]">
                            <div>
                              <span className="text-slate-500 uppercase block font-bold leading-none">Standar Isi:</span>
                              <span className="font-mono font-black text-[11px] text-emerald-800 leading-tight block">
                                {selectedKanbanToPrint.qtyPerTrolly ?? selectedKanbanToPrint.part.qtyPerTrolly}{" "}
                                <span className="text-[7.5px] font-normal text-slate-600">pcs</span>
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 uppercase block font-bold leading-none">Cycle Time:</span>
                              <span className="font-mono font-black text-[9.5px] text-slate-900 leading-tight block">
                                {fullPart?.cycleTimeSec ?? "-"}s (Cav: {fullPart?.cavity ?? 1})
                              </span>
                            </div>
                            <div className="truncate">
                              <span className="text-slate-500 uppercase block font-bold leading-none">Pasangan:</span>
                              <span className="font-bold text-[8px] text-slate-800 leading-tight block truncate">
                                {fullPart?.pairPart?.partNo || "-"}
                              </span>
                            </div>
                            <div className="truncate">
                              <span className="text-slate-500 uppercase block font-bold leading-none">Next Process:</span>
                              <span className="font-black text-[8.5px] text-sky-800 leading-tight block truncate">
                                {(fullPart as any)?.nextProcess || "PLATING"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Footer Bar */}
                      <div className="pt-0.5 border-t border-slate-900 flex justify-between items-center text-[7px] text-slate-600 leading-none">
                        <span className="font-mono truncate">
                          <strong className="text-slate-800">MMS MOLDING:</strong> Label Kanban Master Fisik
                        </span>
                        <span className="font-mono font-semibold text-slate-500 shrink-0 ml-1">
                          9.3cm x 7.5cm (Margin 0.5cm)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Pilih salah satu kartu kanban di tabel untuk melihat dan mencetak label QR.
                </div>
              )}

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Tempelkan kartu kanban ini pada trolly. Saat trolly terisi penuh, operator cukup
                mengarahkan kamera ke QR untuk mencatat hasil produksi.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MESIN (FR-01 & FR-09) */}
      {activeTab === "machines" && (
        <div className="space-y-4">
          {/* Machine Action Toolbar: Download Template & Import CSV */}
          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Impor & Kelola 15 Mesin Molding
              </h3>
              <p className="text-xs text-slate-500">
                Unduh template CSV untuk mengisi daftar 15 mesin di Excel, lalu unggah kembali untuk impor otomatis.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadMachineTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer border border-slate-300 tap-target"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Unduh Template CSV Mesin</span>
              </button>

              <input
                ref={machineFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleMachineFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => machineFileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white text-xs font-extrabold transition cursor-pointer shadow-2xs tap-target"
              >
                <Upload className="w-4 h-4" />
                <span>{isImporting ? "Mengimpor..." : "Upload CSV Mesin"}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-slate-900">
                Master Mesin Injection Molding ({initialData.machines.length} Unit)
              </h3>
              <span className="text-xs font-mono text-slate-500">Format: IMM-01 s/d IMM-15</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="py-3 px-4">Kode Mesin</th>
                    <th className="py-3 px-4">Tonase Clamping</th>
                    <th className="py-3 px-4">Model / Brand</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {initialData.machines.length > 0 ? (
                    initialData.machines.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-black text-slate-900 font-mono text-sm">
                          {m.code}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {m.tonnage} Ton
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {m.model || "Injection Molding"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            Aktif
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Yakin ingin menghapus mesin ${m.code}?`)) {
                                if (onDeleteMachine) {
                                  await onDeleteMachine(m.id);
                                }
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        <p className="font-bold text-slate-700 text-sm">Belum ada mesin terdaftar.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Gunakan tombol &quot;Upload CSV Mesin&quot; di atas untuk mengimpor daftar mesin pabrik Anda.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PARTS & MACHINE RELATIONS (FR-02, FR-03 & FR-09) */}
      {activeTab === "parts" && (
        <div className="space-y-4">
          {/* Part Action Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Master Part & Relasi Mesin Molding
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-sky-100 text-sky-900 border border-sky-300">
                  Total: {partsList.length} Part
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola Cycle Time, Cavity, Trolly Qty, dan Mesin yang diizinkan. Edit langsung via tombol aksi atau upload CSV (otomatis overwrite).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddPart}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition cursor-pointer shadow-sm tap-target"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Part</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExcelGuide(true)}
                title="Buka panduan lengkap pengisian Excel"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition cursor-pointer tap-target"
              >
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Panduan Excel</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPartTemplateXlsx}
                title="Unduh template Excel resmi (.xlsx) dengan kamus kolom"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition cursor-pointer tap-target"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Template Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCurrentPartsXlsx}
                title="Unduh seluruh data master part aktif dalam format Excel (.xlsx)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer border border-slate-300 tap-target"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Unduh Data Live (.xlsx)</span>
              </button>

              <input
                ref={partFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handlePartFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => partFileInputRef.current?.click()}
                disabled={isImporting}
                title="Upload file Excel (.xlsx) atau CSV untuk update/overwrite data part"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold transition cursor-pointer shadow-2xs tap-target"
              >
                <Upload className="w-4 h-4" />
                <span>{isImporting ? "Mengimpor..." : "Upload Excel / CSV"}</span>
              </button>
            </div>
          </div>

          {/* Feedback banner for Part operations */}
          {partFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
                partFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                  : "bg-rose-50 text-rose-950 border-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {partFeedback.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{partFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setPartFeedback(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MODAL PANDUAN UPLOAD EXCEL MASTER PART */}
          {showExcelGuide && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-300 p-6 space-y-5 max-h-[92vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Panduan Format Excel (.xlsx) Master Part & Relasi Mesin
                      </h3>
                      <p className="text-xs text-slate-500">
                        Standar penulisan kolom, Family Mold (LH/RH), Multi-Cavity, dan Overwrite Otomatis.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExcelGuide(false)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-slate-700">
                  {/* Bagian 1: Kamus Kolom */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-sky-600" />
                      1. Kamus & Spesifikasi Kolom Excel (Sheet 1)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Baris 1 wajib berisi nama header kolom persis seperti berikut (huruf kecil atau besar didukung otomatis):
                    </p>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-left text-[11px] border border-slate-300 bg-white rounded-lg">
                        <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                          <tr>
                            <th className="py-2 px-3">Nama Kolom</th>
                            <th className="py-2 px-2.5">Wajib?</th>
                            <th className="py-2 px-3">Tipe Data & Contoh</th>
                            <th className="py-2 px-3">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">part_no</td>
                            <td className="py-2 px-2.5 font-bold text-rose-600">YA (Kunci)</td>
                            <td className="py-2 px-3 font-mono">7415A703, PRT-CVR-001</td>
                            <td className="py-2 px-3">Nomor part unik. Jika sudah ada di database, baris ini otomatis <strong>meng-overwrite (memperbarui)</strong> data part tersebut.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">nama_part</td>
                            <td className="py-2 px-2.5 font-bold text-rose-600">YA</td>
                            <td className="py-2 px-3">4L45W 23MY X pander Mark</td>
                            <td className="py-2 px-3">Deskripsi/nama part yang akan dicetak pada label QR kanban fisik.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">customer</td>
                            <td className="py-2 px-2.5 font-bold text-slate-500">Opsional</td>
                            <td className="py-2 px-3">PT. TOYOTA MOTOR MFG, PT. MMKI</td>
                            <td className="py-2 px-3">Nama OEM/Customer. Tercetak tebal di label kanban trolly.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">cycle_time_detik</td>
                            <td className="py-2 px-2.5 font-bold text-rose-600">YA</td>
                            <td className="py-2 px-3 font-mono">29, 42.5</td>
                            <td className="py-2 px-3">Standar waktu siklus injeksi 1 shot dalam detik.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">cavity</td>
                            <td className="py-2 px-2.5 font-bold text-rose-600">YA</td>
                            <td className="py-2 px-3 font-mono">1, 2, 4</td>
                            <td className="py-2 px-3">Jumlah rongga cetakan aktif per shot.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">qty_per_kemasan</td>
                            <td className="py-2 px-2.5 font-bold text-rose-600">YA</td>
                            <td className="py-2 px-3 font-mono">120, 240, 648</td>
                            <td className="py-2 px-3">Kapasitas standar isi penuh per trolly/box/rak.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">satuan_kemasan</td>
                            <td className="py-2 px-2.5 font-bold text-slate-500">Opsional</td>
                            <td className="py-2 px-3 font-mono">TROLLY, BOX, RAK</td>
                            <td className="py-2 px-3">Default: <strong>TROLLY</strong> jika dikosongkan.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">material</td>
                            <td className="py-2 px-2.5 font-bold text-slate-500">Opsional</td>
                            <td className="py-2 px-3">ABS, PP, PC+ABS, PA66</td>
                            <td className="py-2 px-3">Bahan baku resin plastik.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">daftar_kode_mesin</td>
                            <td className="py-2 px-2.5 font-bold text-slate-500">Opsional</td>
                            <td className="py-2 px-3 font-mono">MC01;MC02;MC11</td>
                            <td className="py-2 px-3">Daftar mesin molding yang boleh mencetak part ini (dipisah titik koma).</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">pasangan</td>
                            <td className="py-2 px-2.5 font-bold text-amber-700">Kritis LH/RH</td>
                            <td className="py-2 px-3 font-mono">7415A704</td>
                            <td className="py-2 px-3">Untuk <strong>Family Mold LH/RH</strong>: Isi dengan <code>part_no</code> pasangannya. Kosongkan untuk part single/reguler.</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">proses_lanjutan</td>
                            <td className="py-2 px-2.5 font-bold text-slate-500">Opsional</td>
                            <td className="py-2 px-3 font-mono">PAINTING, SUB ASSY</td>
                            <td className="py-2 px-3">Default: <strong>PAINTING</strong> jika dikosongkan.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Bagian 2: Family Mold vs Multi-Cavity Reguler */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-1.5">
                      <h5 className="font-black text-sky-950 text-xs flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-sky-700" />
                        A. Part Berpasangan (Family Mold LH & RH)
                      </h5>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-sky-900 leading-relaxed">
                        <li>
                          Dibuat dalam 1 dies cetakan yang sama (sisi Kiri / LH dan sisi Kanan / RH).
                        </li>
                        <li>
                          <strong>Cara Isi di Excel:</strong> Buat 2 baris (satu baris untuk LH, satu baris untuk RH). Di baris LH, kolom <code>pasangan</code> diisi <code>part_no</code> milik RH. Begitu juga sebaliknya di baris RH.
                        </li>
                        <li>
                          <strong>Perhitungan Target Planning:</strong> Target 400 Set = <strong>400 pcs LH + 400 pcs RH</strong> (membutuhkan 400 shot cetakan, total 800 pcs).
                        </li>
                        <li>
                          <strong>Mode di Mesin:</strong> Operator dapat memilih mode <code>SET</code> (1 shot = 1 LH + 1 RH, Cavity 2) atau <code>SINGLE_LH / SINGLE_RH</code> jika satu sisi cavity ditutup.
                        </li>
                      </ul>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                      <h5 className="font-black text-amber-950 text-xs flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-amber-700" />
                        B. Single Part & Multi-Cavity Reguler
                      </h5>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-900 leading-relaxed">
                        <li>
                          Part tunggal yang tidak memiliki pasangan cetakan.
                        </li>
                        <li>
                          <strong>Cara Isi di Excel:</strong> Kolom <code>pasangan</code> <strong>WAJIB DIKOSONGKAN (strip atau kosong)</strong>.
                        </li>
                        <li>
                          <strong>Contoh Multi-Cavity:</strong> Cavity = 2 pada part tunggal menghasilkan 2 pcs part yang SAMA PERSIS dalam 1 kali shot.
                        </li>
                        <li>
                          <strong>Perhitungan Target Planning:</strong> Dihitung dalam pcs biasa: <code>Jumlah Shot = Target Pcs ÷ Cavity</code> (contoh: target 1.000 pcs butuh 500 shot). Opsi Family Mold tidak akan muncul.
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Bagian 3: Panduan Cycle Time Berbeda per Mesin (Opsi A) */}
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 space-y-1.5 text-[11px] text-emerald-950">
                    <h5 className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      C. Part yang Memiliki Cycle Time Berbeda di Mesin Berbeda (Opsi Baris Terpisah)
                    </h5>
                    <p className="leading-relaxed">
                      Jika part yang sama diproses di mesin berbeda dengan Cycle Time berbeda (misal part <code>SL3800</code> di <strong>MC01 = 38 detik</strong>, sedangkan di <strong>MC02 = 24 detik</strong>):
                    </p>
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                      <li>
                        Cukup buat <strong>2 baris</strong> di Excel untuk part tersebut:
                        <br />
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 mt-1 inline-block">
                          Baris 1: part_no = SL3800 | cycle_time_detik = 38 | daftar_kode_mesin = MC01
                        </span>
                        <br />
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 mt-0.5 inline-block">
                          Baris 2: part_no = SL3800 | cycle_time_detik = 24 | daftar_kode_mesin = MC02
                        </span>
                      </li>
                      <li>
                        Sistem MMS otomatis menggabungkan relasi mesin dan menyimpan Cycle Time spesifik per mesin tersebut.
                      </li>
                      <li>
                        Saat operator memilih part di MC01, sistem otomatis memakai <strong>38s</strong>. Saat dipilih di MC02, otomatis memakai <strong>24s</strong>.
                      </li>
                    </ul>
                  </div>

                  {/* Bagian 4: Relasi Mesin & Fitur Overwrite */}
                  <div className="bg-slate-100 border border-slate-300 rounded-xl p-3.5 space-y-1.5 text-[11px]">
                    <h5 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Fitur Cerdas MMS Saat Upload Excel:
                    </h5>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      <li>
                        <strong>Auto Overwrite:</strong> Jika Anda mengunggah part_no yang sudah terdaftar, sistem akan langsung memperbarui nama, customer, cycle time, cavity, standar kemasan, material, dan relasi mesin tanpa menghapus riwayat kanban atau scan sebelumnya.
                      </li>
                      <li>
                        <strong>Relasi Mesin Fleksibel:</strong> Anda dapat menuliskan kode mesin dipisah tanda titik koma (<code>MC01;MC02;MC11</code>) atau mengunggah baris ganda part yang sama dengan mesin berbeda; sistem otomatis menggabungkan relasi mesinnya.
                      </li>
                      <li>
                        <strong>Download Template Otomatis:</strong> Klik tombol <strong>&quot;Template Excel (.xlsx)&quot;</strong> di atas untuk mendapatkan file Excel yang sudah memiliki contoh baris lengkap dan lembar kamus kolom.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleDownloadPartTemplateXlsx}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Template Excel Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExcelGuide(false)}
                    className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Tutup Panduan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Cari Part No, Nama, atau Mesin..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold focus:border-sky-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs font-bold text-slate-600">Filter Tipe:</span>
              <select
                value={partMoldFilter}
                onChange={(e) => setPartMoldFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:border-sky-600"
              >
                <option value="ALL">Semua Part ({partsList.length})</option>
                <option value="PAIR">Family Mold LH/RH ({partsList.filter((p) => !!p.pairPart).length})</option>
                <option value="SINGLE">Single / Reguler ({partsList.filter((p) => !p.pairPart).length})</option>
              </select>
            </div>
          </div>

          {/* Parts Table */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-slate-900">
                Daftar Master Part ({filteredParts.length} ditampilkan)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Klik tombol <strong className="text-sky-700">Edit</strong> untuk mengubah data tanpa CSV
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="py-3 px-4">Part No</th>
                    <th className="py-3 px-4">Nama Part</th>
                    <th className="py-3 px-4">Cycle Time</th>
                    <th className="py-3 px-4">Cavity</th>
                    <th className="py-3 px-4">Standar Kemasan</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4">Mesin Diizinkan</th>
                    <th className="py-3 px-4">Family Mold (LH/RH)</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredParts.length > 0 ? (
                    filteredParts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 font-mono text-sm">
                                {p.partNo}
                              </span>
                              {p.isActive === false && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                                  Nonaktif
                                </span>
                              )}
                            </div>
                            {(p as any).customer && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-black bg-amber-50 text-amber-900 border border-amber-300 w-fit uppercase font-mono tracking-wide">
                                {(p as any).customer}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <span className="text-slate-900 font-bold block">{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-bold">
                              {(p as any).nextProcess || "PAINTING"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {p.cycleTimeSec} detik
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {p.cavity} shot
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-sky-800">
                          <div>
                            <span>{p.qtyPerTrolly} pcs</span>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">
                              / {(p as any).containerType || "TROLLY"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {(p as any).material || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {p.machines && p.machines.length > 0 ? (
                              p.machines.map((mRel, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 bg-sky-50 text-sky-950 border border-sky-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                                  title={mRel.cycleTimeSec ? `Cycle Time Khusus Mesin: ${mRel.cycleTimeSec} detik` : `Cycle Time Default: ${p.cycleTimeSec} detik`}
                                >
                                  <span>{mRel.machine.code}</span>
                                  {mRel.cycleTimeSec && mRel.cycleTimeSec > 0 && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black">
                                      {mRel.cycleTimeSec}s
                                    </span>
                                  )}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Belum di-assign</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {p.pairPart ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-100 text-indigo-950 font-black text-[10px] border border-indigo-300 shadow-2xs">
                                <Layers className="w-3 h-3 text-indigo-700" />
                                <span>SET: {p.pairPart.partNo}</span>
                              </span>
                              {onSetPartPair && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Lepas hubungan pasangan antara ${p.partNo} dan ${p.pairPart?.partNo}?`)) {
                                      await onSetPartPair(p.id, null);
                                    }
                                  }}
                                  className="text-[10px] text-rose-600 hover:text-rose-800 underline font-bold cursor-pointer"
                                >
                                  Lepas
                                </button>
                              )}
                            </div>
                          ) : onSetPartPair ? (
                            <select
                              value=""
                              onChange={async (e) => {
                                const targetId = Number(e.target.value);
                                if (targetId) {
                                  await onSetPartPair(p.id, targetId);
                                }
                              }}
                              className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-indigo-500 cursor-pointer shadow-2xs"
                            >
                              <option value="">+ Hubungkan Pasangan (LH/RH)</option>
                              {partsList
                                .filter((other) => other.id !== p.id && !other.pairPart)
                                .map((other) => (
                                  <option key={other.id} value={other.id}>
                                    Pasangkan dg: {other.partNo} - {other.name}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditPart(p)}
                              title="Edit Part & Relasi Mesin"
                              className="p-1.5 rounded-lg bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 font-bold transition cursor-pointer flex items-center gap-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePartClick(p)}
                              title="Hapus Part"
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 font-bold transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        <p className="font-bold text-slate-700 text-sm">Tidak ada part yang sesuai pencarian.</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Coba ganti kata kunci pencarian atau tambah part baru.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MODAL: TAMBAH PART BARU */}
          {showAddPartModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Registrasi Master Part Baru
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Masukkan parameter cetakan, cycle time, cavity, dan relasi mesin
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddPartModal(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreatePartSubmit} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Nomor Part (Part No):
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 7415A703"
                        value={newPartNo}
                        onChange={(e) => setNewPartNo(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase focus:border-sky-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Proses Lanjutan:
                      </label>
                      <select
                        value={newPartNextProcess}
                        onChange={(e) => setNewPartNextProcess(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                      >
                        <option value="PAINTING 1">PAINTING 1</option>
                        <option value="PAINTING 2">PAINTING 2</option>
                        <option value="PLATING">PLATING</option>
                        <option value="ASSEMBLY">ASSEMBLY</option>
                        <option value="SUB ASSY">SUB ASSY</option>
                        <option value="PAINTING">PAINTING (Umum)</option>
                        <option value="DELIVERY">DELIVERY</option>
                        <option value="PACKING">PACKING</option>
                        <option value="QC CHECK">QC CHECK</option>
                        <option value="GUDANG FG">GUDANG FG</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Part / Deskripsi:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 5D45W MARK NISSAN REAR"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Customer / OEM:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: TOYOTA, DAIHATSU, MITSUBISHI, SUZUKI, NISSAN, HONDA"
                      value={newPartCustomer}
                      onChange={(e) => setNewPartCustomer(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600 uppercase"
                      list="customer-suggestions"
                    />
                    <datalist id="customer-suggestions">
                      <option value="PT. TOYOTA MOTOR MANUFACTURING INDONESIA" />
                      <option value="PT. MITSUBISHI MOTORS KRAMA YUDHA INDONESIA" />
                      <option value="PT. NISSAN MOTOR INDONESIA" />
                      <option value="PT. HINO MOTORS MANUFACTURING INDONESIA" />
                      <option value="PT. ASTRA DAIHATSU MOTOR" />
                      <option value="PT. HONDA PROSPECT MOTOR" />
                      <option value="PT. SUZUKI INDOMOBIL MOTOR" />
                      <option value="PT. HYUNDAI MOTOR MANUFACTURING INDONESIA" />
                      <option value="PT. ISUZU ASTRA MOTOR INDONESIA" />
                      <option value="TOYOTA" />
                      <option value="DAIHATSU" />
                      <option value="MITSUBISHI" />
                      <option value="SUZUKI" />
                      <option value="HONDA" />
                      <option value="NISSAN" />
                      <option value="HINO" />
                      <option value="HYUNDAI" />
                      <option value="ISUZU" />
                    </datalist>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Nama customer akan tercetak tebal pada label kanban trolly fisik.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Cycle Time (detik):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={newPartCt}
                        onChange={(e) => setNewPartCt(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Cavity (shot):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newPartCavity}
                        onChange={(e) => setNewPartCavity(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Satuan Kemasan:
                      </label>
                      <select
                        value={newPartContainerType}
                        onChange={(e) => setNewPartContainerType(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold text-xs bg-white text-slate-800 focus:border-sky-600"
                      >
                        <option value="TROLLY">TROLLY</option>
                        <option value="BOX">BOX</option>
                        <option value="RAK">RAK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Qty / {newPartContainerType}:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newPartQtyTrolly}
                        onChange={(e) => setNewPartQtyTrolly(parseInt(e.target.value, 10) || 100)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Material (Bahan Baku):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: ABS 3001M, PP T20, ABS+PC"
                      value={newPartMaterial}
                      onChange={(e) => setNewPartMaterial(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-xs focus:border-sky-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Opsional — tampil di Formulir Laporan Harian (FO/MLD/009)
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Pasangan Family Mold (Jika LH / RH):
                    </label>
                    <select
                      value={newPartPairId || ""}
                      onChange={(e) => setNewPartPairId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600 bg-white"
                    >
                      <option value="">Tidak Ada (Single / Reguler Multi-Cavity)</option>
                      {partsList
                        .filter((p) => !p.pairPart)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            Pasangan dg: {p.partNo} - {p.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Mesin yang diizinkan */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">
                      Mesin yang Diizinkan Memproses:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {initialData.machines.map((m) => {
                        const isSelected = newPartMachineIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setNewPartMachineIds(newPartMachineIds.filter((id) => id !== m.id));
                              } else {
                                setNewPartMachineIds([...newPartMachineIds, m.id]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition cursor-pointer ${
                              isSelected
                                ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-300 hover:border-sky-500"
                            }`}
                          >
                            {isSelected ? `✓ ${m.code}` : m.code}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Klik kode mesin untuk memilih mesin mana saja yang kompatibel dengan mold part ini.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAddPartModal(false)}
                      disabled={isPartSubmitting}
                      className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isPartSubmitting}
                      className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isPartSubmitting ? "Menyimpan..." : "Simpan Part"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL: EDIT PART (OVERWRITE) */}
          {editingPart && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Edit Master Part ({editingPart.partNo})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Perbarui parameter, relasi mesin, atau status aktif (otomatis overwrite data lama)
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPart(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleUpdatePartSubmit} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Nomor Part (Part No):
                      </label>
                      <input
                        type="text"
                        value={editPartNo}
                        onChange={(e) => setEditPartNo(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase focus:border-sky-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        Proses Lanjutan:
                      </label>
                      <select
                        value={editPartNextProcess}
                        onChange={(e) => setEditPartNextProcess(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                      >
                        <option value="PAINTING 1">PAINTING 1</option>
                        <option value="PAINTING 2">PAINTING 2</option>
                        <option value="PLATING">PLATING</option>
                        <option value="ASSEMBLY">ASSEMBLY</option>
                        <option value="SUB ASSY">SUB ASSY</option>
                        <option value="PAINTING">PAINTING (Umum)</option>
                        <option value="DELIVERY">DELIVERY</option>
                        <option value="PACKING">PACKING</option>
                        <option value="QC CHECK">QC CHECK</option>
                        <option value="GUDANG FG">GUDANG FG</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Part / Deskripsi:
                    </label>
                    <input
                      type="text"
                      value={editPartName}
                      onChange={(e) => setEditPartName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Customer / OEM:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: TOYOTA, DAIHATSU, MITSUBISHI, SUZUKI, NISSAN, HONDA"
                      value={editPartCustomer}
                      onChange={(e) => setEditPartCustomer(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600 uppercase"
                      list="customer-suggestions"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Nama customer akan tercetak tebal pada label kanban trolly fisik.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Cycle Time (detik):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editPartCt}
                        onChange={(e) => setEditPartCt(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Cavity (shot):
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editPartCavity}
                        onChange={(e) => setEditPartCavity(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Satuan Kemasan:
                      </label>
                      <select
                        value={editPartContainerType}
                        onChange={(e) => setEditPartContainerType(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold text-xs bg-white text-slate-800 focus:border-sky-600"
                      >
                        <option value="TROLLY">TROLLY</option>
                        <option value="BOX">BOX</option>
                        <option value="RAK">RAK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                        Qty / {editPartContainerType}:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editPartQtyTrolly}
                        onChange={(e) => setEditPartQtyTrolly(parseInt(e.target.value, 10) || 100)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Material (Bahan Baku):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: ABS 3001M, PP T20, ABS+PC"
                      value={editPartMaterial}
                      onChange={(e) => setEditPartMaterial(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-xs focus:border-sky-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Opsional — tampil di Formulir Laporan Harian (FO/MLD/009)
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Pasangan Family Mold (Jika LH / RH):
                    </label>
                    <select
                      value={editPartPairId || ""}
                      onChange={(e) => setEditPartPairId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600 bg-white"
                    >
                      <option value="">Tidak Ada (Single / Reguler Multi-Cavity)</option>
                      {partsList
                        .filter((p) => p.id !== editingPart.id && (!p.pairPart || p.pairPart.id === editingPart.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            Pasangkan dg: {p.partNo} - {p.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Mesin yang diizinkan */}
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">
                      Mesin yang Diizinkan Memproses:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {initialData.machines.map((m) => {
                        const isSelected = editPartMachineIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditPartMachineIds(editPartMachineIds.filter((id) => id !== m.id));
                              } else {
                                setEditPartMachineIds([...editPartMachineIds, m.id]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border transition cursor-pointer ${
                              isSelected
                                ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-300 hover:border-sky-500"
                            }`}
                          >
                            {isSelected ? `✓ ${m.code}` : m.code}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Aktif */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="edit-part-active"
                      checked={editPartActive}
                      onChange={(e) => setEditPartActive(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="edit-part-active" className="font-bold text-slate-800 cursor-pointer">
                      Part Aktif (Tersedia untuk Perencanaan PPIC dan Produksi Mesin)
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingPart(null)}
                      disabled={isPartSubmitting}
                      className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isPartSubmitting}
                      className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isPartSubmitting ? "Menyimpan..." : "Simpan Perubahan (Overwrite)"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALASAN STOP (FR-04) */}
      {activeTab === "reasons" && (
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-900">
              Katalog Alasan Stop (Downtime Categories)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <th className="py-3 px-4 w-24">Simbol / Kode</th>
                  <th className="py-3 px-4">Kategori Masalah</th>
                  <th className="py-3 px-4">Deskripsi Alasan Stop</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {initialData.stopReasons.map((sr) => (
                  <tr key={sr.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-black text-slate-900">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
                        {sr.code || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-rose-900 uppercase">
                      {sr.category}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{sr.reason}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                        Aktif
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: USERS & OPERATOR MANAGEMENT (Admin MMS) */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Header Card & Tambah Operator Button */}
          <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-sky-600" />
                  Manajemen Karyawan & Operator Pabrik
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300">
                  Total: {usersList.length} Orang
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tambahkan operator baru, atur PIN keamanan, dan kelola penugasan peran kerja.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddUser}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold transition cursor-pointer shadow-sm shrink-0 tap-target"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Registrasi Karyawan / Operator Baru</span>
            </button>
          </div>

          {/* Feedback message banner */}
          {userFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
                userFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-rose-50 text-rose-900 border-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {userFeedback.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{userFeedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setUserFeedback(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Cari NIK atau Nama..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-sky-600"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Role:</span>
              {["ALL", "OPERATOR", "PLANNER", "SUPERVISOR", "ADMIN"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setUserRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    userRoleFilter === r
                      ? "bg-sky-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {r === "ALL" ? "Semua" : r}
                </button>
              ))}
            </div>
          </div>

          {/* Table of Users */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="py-3 px-4">NIK / ID</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">Peran (Role)</th>
                    <th className="py-3 px-4">PIN Keamanan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const isActive = u.isActive !== false;
                      const roleUpper = u.role.toUpperCase();
                      const roleBadge =
                        roleUpper === "ADMIN"
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : roleUpper === "SUPERVISOR"
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : roleUpper === "PLANNER"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300";

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50/80 transition ${
                            !isActive ? "opacity-60 bg-slate-50/40" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm">
                            {u.employeeId}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs shrink-0">
                                {u.name.charAt(0)}
                              </div>
                              <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                {u.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded border ${roleBadge}`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                              <KeyRound className="w-3 h-3 text-slate-400" />
                              PIN Terpasang
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {isActive ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Aktif
                              </span>
                            ) : (
                              <span className="bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                Non-Aktif
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                title="Edit User"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleUserActive(u)}
                                className={`px-2.5 py-1 rounded border text-xs font-bold transition cursor-pointer ${
                                  isActive
                                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                }`}
                                title={isActive ? "Nonaktifkan Karyawan" : "Aktifkan Karyawan"}
                              >
                                {isActive ? "Nonaktifkan" : "Aktifkan"}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUserClick(u)}
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer"
                                title="Hapus Karyawan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        Tidak ada karyawan yang sesuai dengan kata kunci pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Registrasi User Baru */}
          {showAddUserModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-300 p-5 space-y-4"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Registrasi Karyawan / Operator Baru
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Tambahkan personil untuk lantai produksi MMS
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      NIK / ID Karyawan:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: OPR03, OPR04, SPV02"
                      value={newEmpId}
                      onChange={(e) => setNewEmpId(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold uppercase focus:border-sky-600"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Digunakan untuk login dan identifikasi stasiun mesin.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Lengkap:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Bambang Wijaya"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Peran / Role:
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                    >
                      <option value="OPERATOR">OPERATOR (Lantai Mesin, Scan Kanban, Input Reject)</option>
                      <option value="PLANNER">PLANNER (Perencanaan Job & Stok Finish Good)</option>
                      <option value="SUPERVISOR">SUPERVISOR (Oversight OEE, Investigasi Stop, Dashboard)</option>
                      <option value="ADMIN">ADMIN (Kendali Penuh Sistem & Master Data)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      PIN Keamanan:
                    </label>
                    <input
                      type="password"
                      placeholder="Default: 1234"
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value)}
                      maxLength={10}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold tracking-widest focus:border-sky-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      PIN default adalah 1234 jika tidak diubah.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      disabled={isUserSubmitting}
                      className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isUserSubmitting}
                      className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isUserSubmitting ? "Menyimpan..." : "Simpan Karyawan"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Edit User */}
          {editingUser && (
            <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-300 p-5 space-y-4"
                role="dialog"
                aria-modal="true"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                      <Edit2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Edit Data Karyawan ({editingUser.employeeId})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Ubah nama, peran, reset PIN, atau status keaktifan
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleUpdateUserSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      ID Karyawan / NIK (Permanen):
                    </label>
                    <input
                      type="text"
                      value={editingUser.employeeId}
                      disabled
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 font-mono font-bold text-slate-600 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Lengkap:
                    </label>
                    <input
                      type="text"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Peran / Role:
                    </label>
                    <select
                      value={editUserRole}
                      onChange={(e) => setEditUserRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold focus:border-sky-600"
                    >
                      <option value="OPERATOR">OPERATOR (Lantai Mesin, Scan Kanban, Input Reject)</option>
                      <option value="PLANNER">PLANNER (Perencanaan Job & Stok Finish Good)</option>
                      <option value="SUPERVISOR">SUPERVISOR (Oversight OEE, Investigasi Stop, Dashboard)</option>
                      <option value="ADMIN">ADMIN (Kendali Penuh Sistem & Master Data)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Reset PIN Keamanan:
                    </label>
                    <input
                      type="password"
                      placeholder="Biarkan kosong jika tidak ingin mengubah PIN"
                      value={editUserPin}
                      onChange={(e) => setEditUserPin(e.target.value)}
                      maxLength={10}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold tracking-widest focus:border-sky-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Hanya isi jika karyawan lupa PIN atau ingin mengganti PIN.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="edit-user-active"
                      checked={editUserActive}
                      onChange={(e) => setEditUserActive(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="edit-user-active" className="font-bold text-slate-800 cursor-pointer">
                      Akun Karyawan Aktif (Bisa Login & Dipilih di Mesin)
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      disabled={isUserSubmitting}
                      className="px-4 py-2 rounded-lg border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isUserSubmitting}
                      className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isUserSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
