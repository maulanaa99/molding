import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding initial MMS data...");

  // 1. Users
  await prisma.user.upsert({
    where: { employeeId: "ADM01" },
    update: {},
    create: {
      employeeId: "ADM01",
      name: "Admin MMS",
      pinHash: "1234",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { employeeId: "SPV01" },
    update: {},
    create: {
      employeeId: "SPV01",
      name: "Budi Santoso",
      pinHash: "1234",
      role: "SUPERVISOR",
    },
  });

  await prisma.user.upsert({
    where: { employeeId: "OPR01" },
    update: {},
    create: {
      employeeId: "OPR01",
      name: "Ahmad Dani",
      pinHash: "1234",
      role: "OPERATOR",
    },
  });

  await prisma.user.upsert({
    where: { employeeId: "OPR02" },
    update: {},
    create: {
      employeeId: "OPR02",
      name: "Siti Rahma",
      pinHash: "1234",
      role: "OPERATOR",
    },
  });

  await prisma.user.upsert({
    where: { employeeId: "PLN01" },
    update: {},
    create: {
      employeeId: "PLN01",
      name: "Rian Planner (PPIC)",
      pinHash: "1234",
      role: "PLANNER",
    },
  });

  // 2. Stop Reasons (Sesuai Form FO/MLD/009 Rev.08)
  const stopReasons = [
    // Sebab Stop (A - N)
    { code: "A", category: "Pemeriksaan", reason: "Cek sheet harian/mingguan" },
    { code: "B", category: "Kerusakan", reason: "Kerusakan Auto Loader" },
    { code: "C", category: "Aktivitas", reason: "Meeting" },
    { code: "D", category: "Logistik", reason: "Pengangkutan" },
    { code: "E", category: "Material", reason: "Material Habis" },
    { code: "F", category: "Kualitas", reason: "Masalah Qualitas" },
    { code: "G", category: "Kerusakan Mold", reason: "Kerusakan Mold" },
    { code: "H", category: "Kerusakan Mesin", reason: "Kerusakan Mesin" },
    { code: "I", category: "Kerusakan", reason: "Kerusakan Robot" },
    { code: "J", category: "Material", reason: "Ganti Material" },
    { code: "K", category: "Setup", reason: "Ganti Dies/Setting Robot" },
    { code: "L", category: "Kerusakan", reason: "Kerusakan Dryer" },
    { code: "M", category: "Lainnya", reason: "Kondisi Lain" },
    { code: "N", category: "Setup", reason: "Dies Belum diganti" },
    // Sebab Lambat (Q - Y)
    { code: "Q", category: "Sebab Lambat", reason: "5S" },
    { code: "R", category: "Sebab Lambat", reason: "Meeting , Training" },
    { code: "S", category: "Sebab Lambat", reason: "Pengecekan alat" },
    { code: "T", category: "Sebab Lambat", reason: "Tidak ada trolly" },
    { code: "U", category: "Sebab Lambat", reason: "Makan" },
    { code: "V", category: "Sebab Lambat", reason: "Trial" },
    { code: "W", category: "Sebab Lambat", reason: "Sesuai Intruksi" },
    { code: "X", category: "Sebab Lambat", reason: "Listrik mati" },
    { code: "Y", category: "Sebab Lambat", reason: "Pengecekan Qualitas" },
    // Selesai Produksi
    { code: "OK", category: "Selesai Produksi", reason: "Selesai Produksi (Target Tercapai)" },
    { code: "CHG", category: "Selesai Produksi", reason: "Selesai Produksi (Ganti Part / Job Baru)" },
  ];

  for (const sr of stopReasons) {
    const existing = await prisma.stopReason.findFirst({
      where: {
        OR: [{ reason: sr.reason }, { code: sr.code }],
      },
    });
    if (!existing) {
      await prisma.stopReason.create({ data: { ...sr, isActive: true } });
    } else {
      await prisma.stopReason.update({
        where: { id: existing.id },
        data: { code: sr.code, category: sr.category, reason: sr.reason, isActive: true },
      });
    }
  }

  // 2.5 Defect Types (Standar Injection Molding)
  const defectTypes = [
    { code: "DF-01", name: "Short Mold / Short Shot", category: "Setting/Material" },
    { code: "DF-02", name: "Silver Streak", category: "Material/Moisture" },
    { code: "DF-03", name: "Flash / Burry", category: "Mold/Clamping" },
    { code: "DF-04", name: "Sink Mark", category: "Setting/Cooling" },
    { code: "DF-05", name: "Black Dot / Gosong", category: "Material/Temperature" },
    { code: "DF-06", name: "Warpage / Bending", category: "Cooling/Ejection" },
    { code: "DF-07", name: "Scratch / Baret", category: "Handling/Mold" },
    { code: "DF-08", name: "Flow Line / Weld Line", category: "Setting/Mold" },
    { code: "DF-09", name: "Jetting / Spray Mark", category: "Gate/Velocity" },
    { code: "DF-10", name: "Defect Lainnya", category: "Lainnya" },
  ];

  for (const dt of defectTypes) {
    await prisma.defectType.upsert({
      where: { code: dt.code },
      update: { name: dt.name, category: dt.category, isActive: true },
      create: { code: dt.code, name: dt.name, category: dt.category, isActive: true },
    });
  }

  // 3. Machines (Dikosongkan agar pengguna dapat memasukkan data mesin riil)
  // Data mesin dapat diimpor melalui file CSV di menu Master & Kanban.
  const createdMachines: Record<string, number> = {};

  // 4. Parts
  const partsData = [
    { partNo: "PRT-CVR-001", name: "Cover Front Body A", cycleTimeSec: 42.5, cavity: 2, qtyPerTrolly: 120 },
    { partNo: "PRT-HSG-002", name: "Housing Lower Base", cycleTimeSec: 36.0, cavity: 1, qtyPerTrolly: 80 },
    { partNo: "PRT-BRK-003", name: "Bracket Side Frame R/L", cycleTimeSec: 28.0, cavity: 4, qtyPerTrolly: 240 },
    { partNo: "PRT-FAN-004", name: "Cooling Impeller Blade", cycleTimeSec: 55.0, cavity: 1, qtyPerTrolly: 60 },
    { partNo: "PRT-GRH-005", name: "Gear Housing Shield", cycleTimeSec: 48.0, cavity: 2, qtyPerTrolly: 100 },
    { partNo: "PRT-PAN-006", name: "Control Panel Bezel", cycleTimeSec: 31.0, cavity: 2, qtyPerTrolly: 160 },
  ];

  const createdParts: Record<string, number> = {};
  for (const p of partsData) {
    const rec = await prisma.part.upsert({
      where: { partNo: p.partNo },
      update: { name: p.name, cycleTimeSec: p.cycleTimeSec, cavity: p.cavity, qtyPerTrolly: p.qtyPerTrolly },
      create: p,
    });
    createdParts[p.partNo] = rec.id;
  }

  // 5. MachinePart Relations
  const relations = [
    { machine: "IMM-01", parts: ["PRT-CVR-001", "PRT-HSG-002", "PRT-GRH-005"] },
    { machine: "IMM-02", parts: ["PRT-CVR-001", "PRT-HSG-002"] },
    { machine: "IMM-03", parts: ["PRT-BRK-003", "PRT-PAN-006"] },
    { machine: "IMM-04", parts: ["PRT-BRK-003", "PRT-PAN-006"] },
    { machine: "IMM-05", parts: ["PRT-PAN-006"] },
    { machine: "IMM-06", parts: ["PRT-PAN-006"] },
    { machine: "IMM-07", parts: ["PRT-BRK-003"] },
    { machine: "IMM-08", parts: ["PRT-BRK-003"] },
    { machine: "IMM-09", parts: ["PRT-HSG-002", "PRT-GRH-005"] },
    { machine: "IMM-10", parts: ["PRT-HSG-002", "PRT-GRH-005"] },
    { machine: "IMM-11", parts: ["PRT-CVR-001", "PRT-FAN-004"] },
    { machine: "IMM-12", parts: ["PRT-CVR-001", "PRT-FAN-004"] },
    { machine: "IMM-13", parts: ["PRT-HSG-002", "PRT-PAN-006"] },
    { machine: "IMM-14", parts: ["PRT-BRK-003"] },
    { machine: "IMM-15", parts: ["PRT-CVR-001", "PRT-FAN-004", "PRT-GRH-005"] },
  ];

  for (const rel of relations) {
    const mId = createdMachines[rel.machine];
    if (!mId) continue;
    for (const pNo of rel.parts) {
      const pId = createdParts[pNo];
      if (!pId) continue;
      await prisma.machinePart.upsert({
        where: { machineId_partId: { machineId: mId, partId: pId } },
        update: {},
        create: { machineId: mId, partId: pId },
      });
    }
  }

  // 6. Kanbans
  const kanbanSamples = [
    { code: "KB-CVR-001-A", partNo: "PRT-CVR-001", qty: 120 },
    { code: "KB-CVR-001-B", partNo: "PRT-CVR-001", qty: 120 },
    { code: "KB-HSG-002-A", partNo: "PRT-HSG-002", qty: 80 },
    { code: "KB-HSG-002-B", partNo: "PRT-HSG-002", qty: 80 },
    { code: "KB-BRK-003-A", partNo: "PRT-BRK-003", qty: 240 },
    { code: "KB-BRK-003-B", partNo: "PRT-BRK-003", qty: 240 },
    { code: "KB-FAN-004-A", partNo: "PRT-FAN-004", qty: 60 },
    { code: "KB-GRH-005-A", partNo: "PRT-GRH-005", qty: 100 },
    { code: "KB-PAN-006-A", partNo: "PRT-PAN-006", qty: 160 },
  ];

  for (const kb of kanbanSamples) {
    const partId = createdParts[kb.partNo];
    if (!partId) continue;
    await prisma.kanban.upsert({
      where: { code: kb.code },
      update: { qtyPerTrolly: kb.qty },
      create: {
        code: kb.code,
        partId,
        qtyPerTrolly: kb.qty,
      },
    });
  }

  // 7. Initial Production Plans (Antrean Job Planner)
  const mc01 = await prisma.machine.findFirst({ where: { code: "MC01" } });
  const mc02 = await prisma.machine.findFirst({ where: { code: "MC02" } });
  const partCover = await prisma.part.findFirst({ where: { partNo: "PRT-CVR-001" } });
  const partHousing = await prisma.part.findFirst({ where: { partNo: "PRT-HSG-002" } });
  const partShield = await prisma.part.findFirst({ where: { partNo: "PRT-GRH-005" } });

  if (mc01 && partCover && partHousing) {
    const countMC01 = await prisma.productionPlan.count({ where: { machineId: mc01.id } });
    if (countMC01 === 0) {
      await prisma.productionPlan.create({
        data: {
          machineId: mc01.id,
          partId: partCover.id,
          targetQty: 1000,
          priority: 1,
          status: "IN_PROGRESS",
          notes: "Target 1000 pcs (Estimasi 3.9 jam) - Order Batch A Astra",
        },
      });
      await prisma.productionPlan.create({
        data: {
          machineId: mc01.id,
          partId: partHousing.id,
          targetQty: 500,
          priority: 2,
          status: "PENDING",
          notes: "Antrean #2: Ganti ke Part B setelah Part A selesai",
        },
      });
    }
  }

  if (mc02 && partShield) {
    const countMC02 = await prisma.productionPlan.count({ where: { machineId: mc02.id } });
    if (countMC02 === 0) {
      await prisma.productionPlan.create({
        data: {
          machineId: mc02.id,
          partId: partShield.id,
          targetQty: 1200,
          priority: 1,
          status: "PENDING",
          notes: "Target 1200 pcs (Estimasi 4.2 jam)",
        },
      });
    }
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
