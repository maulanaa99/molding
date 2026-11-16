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
  const [activeTab, setActiveTab] = useState<"parts" | "machines" | "reasons" | "users">("parts");

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

  // CSV Import States
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const machineFileInputRef = useRef<HTMLInputElement>(null);
  const partFileInputRef = useRef<HTMLInputElement>(null);

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

    // Sheet 1: Template Data Siap Isi (Model C Hybrid)
    const headers = [
      "part_no",
      "nama_part",
      "customer",
      "cycle_time_detik",
      "cavity",
      "qty_per_kemasan",
      "satuan_kemasan",
      "material",
      "kode_mesin",
      "part_pasangan",
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
        "MC01",
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
        "PRT-PLT-005",
        "Plate Support Center",
        "PT. HONDA PROSPECT MOTOR",
        35.0,
        4,
        200,
        "BOX",
        "POM",
        "MC05; MC06",
        "",
        "DELIVERY",
      ],
      [
        "7415A703",
        "Bracket Side Frame LH",
        "PT. ASTRA DAIHATSU MOTOR",
        28.0,
        1,
        240,
        "RAK",
        "PC+ABS",
        "MC03; MC04",
        "7415A704",
        "PAINTING",
      ],
      [
        "7415A704",
        "Bracket Side Frame RH",
        "PT. ASTRA DAIHATSU MOTOR",
        28.0,
        1,
        240,
        "RAK",
        "PC+ABS",
        "MC03; MC04",
        "7415A703",
        "PAINTING",
      ],
    ];

    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set Column Widths for readability
    ws["!cols"] = [
      { wch: 18 }, // part_no
      { wch: 30 }, // nama_part
      { wch: 42 }, // customer
      { wch: 18 }, // cycle_time_detik
      { wch: 10 }, // cavity
      { wch: 18 }, // qty_per_kemasan
      { wch: 16 }, // satuan_kemasan
      { wch: 14 }, // material
      { wch: 22 }, // kode_mesin
      { wch: 18 }, // part_pasangan
      { wch: 18 }, // proses_lanjutan
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Master Part");

    // Sheet 2: Daftar Mesin Aktif (Referensi Resmi dari Database Pabrik)
    const machineSheetHeaders = [
      "Kode Mesin (Wajib Sama)",
      "Model / Merk Mesin",
      "Tonase (Ton)",
      "Status",
      "Petunjuk Pengisian",
    ];

    const machineRows = (initialData?.machines || []).map((m) => [
      m.code,
      m.model || `Mesin Molding ${m.code}`,
      m.tonnage || 0,
      m.isActive !== false ? "AKTIF" : "NON-AKTIF",
      "Gunakan kode ini di kolom 'kode_mesin' pada Sheet 1",
    ]);

    const wsMachines = XLSX.utils.aoa_to_sheet([machineSheetHeaders, ...machineRows]);
    wsMachines["!cols"] = [
      { wch: 24 }, // Kode Mesin
      { wch: 28 }, // Model Mesin
      { wch: 16 }, // Tonase
      { wch: 14 }, // Status
      { wch: 52 }, // Petunjuk
    ];
    XLSX.utils.book_append_sheet(wb, wsMachines, "Daftar Mesin Pabrik");

    // Sheet 3: Panduan & Kamus Kolom
    const guideData = [
      ["PANDUAN LENGKAP PENGISIAN MASTER PART & RELASI MESIN MOLDING (MMS)"],
      [""],
      ["Nama Kolom (Header)", "Wajib?", "Format / Tipe Data", "Aturan & Penjelasan Detail"],
      ["part_no", "YA (Kunci)", "Teks / Alfanumerik", "Kode/Nomor part unik perusahaan (Contoh: 7415A703, 79890W030P). Jika sudah ada di database, data part akan otomatis di-UPDATE (overwrite)."],
      ["nama_part", "YA", "Teks", "Deskripsi atau nama resmi part (Contoh: 4L45W 23MY X pander Mark, Cover Front Body)."],
      ["customer", "OPSIONAL", "Teks (Nama OEM/PT)", "Nama pelanggan atau OEM mobil (Contoh: PT. TOYOTA MOTOR MANUFACTURING INDONESIA, PT. MITSUBISHI MOTORS KRAMA YUDHA INDONESIA, PT. ASTRA DAIHATSU MOTOR, dll). Tampil di kanban."],
      ["cycle_time_detik", "YA", "Angka (Desimal)", "Waktu standar cetak 1 kali shot dalam detik (Contoh: 28, 42.5). Jika CT berbeda di tiap mesin (Skenario 2), buat baris terpisah untuk tiap mesin."],
      ["cavity", "YA", "Angka Bulat (>= 1)", "Jumlah produk yang keluar dalam 1 kali shot cetakan. Family Mold umumnya diisi 1 per sisi, atau 2 untuk cetakan reguler multi-cavity."],
      ["qty_per_kemasan", "YA", "Angka Bulat (>= 1)", "Standar kapasitas penuh isi 1 kemasan (Contoh: 120, 240, 648)."],
      ["satuan_kemasan", "OPSIONAL", "Pilihan: TROLLY / BOX / RAK", "Jenis wadah penyimpanan fisik (Default: TROLLY). Pilihan: TROLLY, BOX, atau RAK."],
      ["material", "OPSIONAL", "Teks Resin", "Bahan baku bijih plastik yang digunakan (Contoh: ABS, PP, PC+ABS, PA66, POM, PMMA)."],
      ["kode_mesin", "OPSIONAL", "Teks (Kode Mesin)", "Kode mesin molding yang diizinkan (Contoh: MC01 atau MC01; MC02). Lihat Sheet 'Daftar Mesin Pabrik' untuk daftar kode resmi."],
      ["part_pasangan", "OPSIONAL (Penting)", "part_no Pasangan", "Untuk FAMILY MOLD (LH & RH): Isi dengan nomor part pasangannya. Contoh: jika baris ini part LH, isi dengan part_no RH. Sistem otomatis menautkan kedua part secara dua arah. KOSONGKAN jika part berdiri sendiri (Single/Reguler)."],
      ["proses_lanjutan", "OPSIONAL", "Teks Proses", "Tujuan stasiun berikutnya (Default: PAINTING). Contoh: PAINTING, PLATING, SUB ASSY, ASSEMBLY, DELIVERY, GUDANG FG."],
      [""],
      ["ATURAN RELASI MESIN & SIKLUS WAKTU (MODEL C - HYBRID):"],
      ["1. SIKLUS WAKTU SAMA DI SEMUA MESIN:"],
      ["   - Cukup tulis 1 baris, masukkan kode mesin dipisahkan koma atau titik koma (Contoh: MC03; MC04)."],
      ["2. SIKLUS WAKTU BERBEDA PER MESIN (SKENARIO 2 - BEDA TONASE MESIN):"],
      ["   - Buat baris terpisah untuk part tersebut dengan kode mesin dan CT masing-masing:"],
      ["     * Baris 1: part_no = SL3800 | cycle_time_detik = 38 | kode_mesin = MC01"],
      ["     * Baris 2: part_no = SL3800 | cycle_time_detik = 24 | kode_mesin = MC02"],
      ["   - Sistem otomatis menggabungkan relasi mesin dan menerapkan CT 38s di MC01 serta CT 24s di MC02."],
      ["3. KEBIJAKAN FULL SYNC / RESET RELASI MESIN (OPSI 1):"],
      ["   - Saat file Excel diunggah, relasi mesin part tersebut diganti sepenuhnya (Full Sync) dengan yang ada di file."],
      ["   - Jika sebuah mesin dihapus dari baris part di Excel, relasi part tersebut pada mesin tersebut di sistem otomatis dilepas."],
      [""],
      ["ATURAN FAMILY MOLD (LH & RH):"],
      ["1. Part Kiri (LH) dan Kanan (RH) dibuat bersamaan dalam 1 dies mold."],
      ["2. Kolom 'part_pasangan' diisi nomor part pasangannya (LH menunjuk RH, RH menunjuk LH)."],
      ["3. Saat produksi, operator dapat memilih mode 'SET' (1 shot = 1 LH + 1 RH) atau 'SINGLE' jika salah satu cavity ditutup."],
    ];

    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    wsGuide["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 28 }, { wch: 95 }];
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
      "kode_mesin",
      "part_pasangan",
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

    // Sheet 2: Daftar Mesin Pabrik
    const machineSheetHeaders = [
      "Kode Mesin (Wajib Sama)",
      "Model / Merk Mesin",
      "Tonase (Ton)",
      "Status",
    ];
    const machineRows = (initialData?.machines || []).map((m) => [
      m.code,
      m.model || `Mesin Molding ${m.code}`,
      m.tonnage || 0,
      m.isActive !== false ? "AKTIF" : "NON-AKTIF",
    ]);
    const wsMachines = XLSX.utils.aoa_to_sheet([machineSheetHeaders, ...machineRows]);
    wsMachines["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsMachines, "Daftar Mesin Pabrik");

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
        if (res.unrecognizedMachines && res.unrecognizedMachines.length > 0) {
          msg += ` [Perhatian: Kode mesin berikut tidak dikenali di sistem: ${res.unrecognizedMachines.join(", ")}]`;
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
            Master Data Pabrik Molding
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Pengelolaan spesifikasi part cetak, relasi mesin molding, katalog alasan stop downtime, dan data karyawan.
          </p>
        </div>

        {/* Sub-nav tabs */}
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-slate-100 rounded-lg border border-slate-200">
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
            Part & Relasi Mesin ({initialData.parts.length})
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
            Mesin Molding ({initialData.machines.length})
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

                  {/* Bagian 3: Panduan Cycle Time Berbeda per Mesin (Model C Hybrid) */}
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 space-y-1.5 text-[11px] text-emerald-950">
                    <h5 className="font-black text-emerald-950 text-xs flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      C. Part dengan Siklus Waktu (CT) Berbeda di Mesin Berbeda (Model C Hybrid)
                    </h5>
                    <p className="leading-relaxed">
                      Jika part yang sama diproses di mesin berbeda dengan Cycle Time berbeda (misal karena beda tonase mesin, seperti <code>SL3800</code> di <strong>MC01 = 38 detik</strong>, sedangkan di <strong>MC02 = 24 detik</strong>):
                    </p>
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                      <li>
                        Cukup buat <strong>baris terpisah</strong> di Excel untuk part tersebut dengan kode mesin dan CT masing-masing:
                        <br />
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 mt-1 inline-block">
                          Baris 1: part_no = SL3800 | cycle_time_detik = 38 | kode_mesin = MC01
                        </span>
                        <br />
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 mt-0.5 inline-block">
                          Baris 2: part_no = SL3800 | cycle_time_detik = 24 | kode_mesin = MC02
                        </span>
                      </li>
                      <li>
                        Sistem MMS otomatis menggabungkan relasi mesin dan menyimpan Cycle Time spesifik per mesin tersebut.
                      </li>
                      <li>
                        Saat operator menjalankan part di MC01, sistem otomatis memakai <strong>38s</strong>. Saat dijalankan di MC02, otomatis memakai <strong>24s</strong>.
                      </li>
                      <li>
                        <strong>Catatan:</strong> Jika Cycle Time di semua mesin sama, Anda cukup membuat <strong>1 baris saja</strong> dengan menuliskan kode mesin dipisah titik koma (contoh: <code>MC03; MC04</code>).
                      </li>
                    </ul>
                  </div>

                  {/* Bagian 4: Relasi Mesin & Fitur Full Sync Overwrite */}
                  <div className="bg-slate-100 border border-slate-300 rounded-xl p-3.5 space-y-1.5 text-[11px]">
                    <h5 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Fitur Cerdas MMS Saat Upload Excel:
                    </h5>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      <li>
                        <strong>Full Sync / Reset Relasi Mesin:</strong> Saat file Excel diunggah, relasi mesin part tersebut diganti sepenuhnya sesuai daftar mesin di file. Jika mesin dihapus dari baris part di Excel, relasi mesin di database otomatis dilepas.
                      </li>
                      <li>
                        <strong>Auto Overwrite Data Part:</strong> Jika Anda mengunggah part_no yang sudah terdaftar, sistem langsung memperbarui nama, customer, cycle time, cavity, standar kemasan, material, dan relasi mesin tanpa menghapus riwayat kanban atau scan sebelumnya.
                      </li>
                      <li>
                        <strong>Sheet Referensi Mesin Pabrik:</strong> File template Excel (.xlsx) yang diunduh menyertakan lembar <em>&quot;Daftar Mesin Pabrik&quot;</em> yang memuat kode mesin resmi dari database Anda.
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
