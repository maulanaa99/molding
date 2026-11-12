import { prisma } from "../src/lib/prisma";

export async function seedMC02DummyOct21() {
  console.log("=== Seeding Data Produksi Dummy MC02 (21 Oktober 2026) ===");

  const targetDateStr = "2026-10-21";
  const startOfDay = new Date(`${targetDateStr}T00:00:00.000+07:00`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999+07:00`);

  // 1. Identifikasi Mesin MC02 (id: 17)
  const mc02 = await prisma.machine.findUnique({
    where: { code: "MC02" },
  });
  if (!mc02) {
    throw new Error("Mesin MC02 tidak ditemukan.");
  }

  // 2. Identifikasi Operator Ridwan (OPR05)
  const operator = await prisma.user.findFirst({
    where: { employeeId: "OPR05" },
  });
  if (!operator) {
    throw new Error("Operator Ridwan (OPR05) tidak ditemukan.");
  }

  // 3. Update Material Part jika belum ada
  await prisma.part.update({
    where: { id: 167 }, // 5H45 24MY OUTLANDER
    data: { material: "ABS 3001M" },
  });
  await prisma.part.update({
    where: { id: 88 }, // D30D Emblem Radiator Grille
    data: { material: "ABS 3001M" },
  });

  // 4. Bersihkan data dummy lama pada 2026-10-21 di MC02 agar idempoten
  const oldRuns = await prisma.productionRun.findMany({
    where: {
      machineId: mc02.id,
      startTime: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true },
  });
  const oldRunIds = oldRuns.map((r) => r.id);

  if (oldRunIds.length > 0) {
    await prisma.scanLog.deleteMany({
      where: { runId: { in: oldRunIds } },
    });
    await prisma.runReject.deleteMany({
      where: { runId: { in: oldRunIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { entity: "ProductionRun", entityId: { in: oldRunIds } },
    });
    await prisma.productionRun.deleteMany({
      where: { id: { in: oldRunIds } },
    });
  }

  await prisma.productionPlan.deleteMany({
    where: {
      machineId: mc02.id,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
    },
  });

  // 5. Buat Rencana Produksi (ProductionPlan)
  const plan1 = await prisma.productionPlan.create({
    data: {
      machineId: mc02.id,
      partId: 167, // 5H45 24MY OUTLANDER
      operatorId: operator.id,
      targetQty: 600,
      priority: 1,
      status: "COMPLETED",
      moldMode: "STANDARD",
      scheduledDate: new Date(`${targetDateStr}T07:30:00.000+07:00`),
      notes: "Part 1: 5H45 24MY OUTLANDER (Target 600 pcs, 4,5 Jam)",
    },
  });

  const plan2 = await prisma.productionPlan.create({
    data: {
      machineId: mc02.id,
      partId: 88, // D30D Emblem Radiator Grille
      operatorId: operator.id,
      targetQty: 480,
      priority: 2,
      status: "COMPLETED",
      moldMode: "STANDARD",
      scheduledDate: new Date(`${targetDateStr}T07:30:00.000+07:00`),
      notes: "Part 2: D30D Emblem Radiator Grille (Target 480 pcs, 1,5 Jam)",
    },
  });

  // 6. Stop Reasons
  const srK = await prisma.stopReason.findFirst({ where: { code: "K" } });
  const srU = await prisma.stopReason.findFirst({ where: { code: "U" } });
  const srF = await prisma.stopReason.findFirst({ where: { code: "F" } });
  const srOK = await prisma.stopReason.findFirst({ where: { code: "OK" } });

  // 7. Defect Types (DF-01: Short Mold / Suite Short, DF-02: Silver Streak)
  const dtSuteShort = await prisma.defectType.findFirst({ where: { id: 1 } });
  const dtSilver = await prisma.defectType.findFirst({ where: { id: 2 } });

  // 8. Kanbans
  const kb167 = await prisma.kanban.findFirst({ where: { partId: 167 } });
  const kb88 = await prisma.kanban.findFirst({ where: { partId: 88 } });

  // 9. Run 1: 5H45 24MY OUTLANDER
  // Timeline:
  // 07:30 - 07:50 : W (Setting mesin, 20m)
  // 07:50 - 12:30 : Produksi 5H45 24MY OUTLANDER (600 pcs)
  // 07:55 : 2 NG Suite Short
  // 12:30 - 12:45 : Ganti Dies K (15m)
  const run1 = await prisma.productionRun.create({
    data: {
      machineId: mc02.id,
      partId: 167,
      operatorId: operator.id,
      planId: plan1.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T07:50:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T12:30:00.000+07:00`),
      stopReasonId: srK?.id,
      notes: "07:30 - 07:50 W Setting mesin. Target 600 pcs tercapai. 12:30 - 12:45 Ganti Dies (K).",
      remainderQty: 0,
      qtyReject: 2,
      moldMode: "STANDARD",
    },
  });

  if (kb167) {
    await prisma.scanLog.create({
      data: {
        runId: run1.id,
        kanbanId: kb167.id,
        scannedById: operator.id,
        qty: 600,
        scannedAt: new Date(`${targetDateStr}T12:25:00.000+07:00`),
        lotNumber: "LOT-20261021-MC02-S1-T01",
      },
    });
  }

  // Reject Run 1: 2 NG Suite Short pada 07:55
  if (dtSuteShort) {
    await prisma.runReject.create({
      data: {
        runId: run1.id,
        defectTypeId: dtSuteShort.id,
        qty: 2,
        updatedAt: new Date(`${targetDateStr}T07:55:00.000+07:00`),
      },
    });
    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: run1.id,
        action: "UPDATE_REJECTS",
        userId: operator.id,
        oldValue: JSON.stringify({ breakdown: [] }),
        newValue: JSON.stringify({ breakdown: [{ defectTypeId: dtSuteShort.id, qty: 2 }] }),
        createdAt: new Date(`${targetDateStr}T07:55:00.000+07:00`),
      },
    });
  }

  // 10. Intermediate Run: 12:45 - 13:30 Makan U
  await prisma.productionRun.create({
    data: {
      machineId: mc02.id,
      partId: 167,
      operatorId: operator.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T12:45:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T12:45:00.000+07:00`),
      stopReasonId: srU?.id,
      notes: "12:45 - 13:30 Istirahat Makan (U).",
      remainderQty: 0,
      moldMode: "STANDARD",
    },
  });

  // 11. Run 2A: D30D Emblem Radiator Grille (Sesi 1)
  // Timeline:
  // 13:30 - 15:00 : Produksi D30D (Trolly 1 @ 240 pcs)
  // 14:00 : 2 NG Suite Short
  // 15:00 - 15:30 : Masalah Kualitas F (30m)
  const run2A = await prisma.productionRun.create({
    data: {
      machineId: mc02.id,
      partId: 88,
      operatorId: operator.id,
      planId: plan2.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T13:30:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T15:00:00.000+07:00`),
      stopReasonId: srF?.id,
      notes: "D30D Sesi 1 (240 pcs). 14:00 2 NG Suite Short. 15:00 - 15:30 Masalah Kualitas F.",
      remainderQty: 0,
      qtyReject: 2,
      moldMode: "STANDARD",
    },
  });

  if (kb88) {
    await prisma.scanLog.create({
      data: {
        runId: run2A.id,
        kanbanId: kb88.id,
        scannedById: operator.id,
        qty: 240,
        scannedAt: new Date(`${targetDateStr}T14:50:00.000+07:00`),
        lotNumber: "LOT-20261021-MC02-S1-T02",
      },
    });
  }

  // Reject Run 2A: 2 NG Suite Short pada 14:00
  if (dtSuteShort) {
    await prisma.runReject.create({
      data: {
        runId: run2A.id,
        defectTypeId: dtSuteShort.id,
        qty: 2,
        updatedAt: new Date(`${targetDateStr}T14:00:00.000+07:00`),
      },
    });
    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: run2A.id,
        action: "UPDATE_REJECTS",
        userId: operator.id,
        oldValue: JSON.stringify({ breakdown: [] }),
        newValue: JSON.stringify({ breakdown: [{ defectTypeId: dtSuteShort.id, qty: 2 }] }),
        createdAt: new Date(`${targetDateStr}T14:00:00.000+07:00`),
      },
    });
  }

  // 12. Run 2B: D30D Emblem Radiator Grille (Sesi 2)
  // Timeline:
  // 15:30 : 2 NG Silver
  // 15:30 - 16:15 : Produksi D30D (Trolly 2 @ 240 pcs, total 480 pcs)
  // 16:15 : Selesai Produksi (OK)
  const run2B = await prisma.productionRun.create({
    data: {
      machineId: mc02.id,
      partId: 88,
      operatorId: operator.id,
      planId: plan2.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T15:30:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T16:15:00.000+07:00`),
      stopReasonId: srOK?.id,
      notes: "D30D Sesi 2 (240 pcs, total 480 pcs). 15:30 2 NG Silver. 16:15 Produksi Selesai (Target 480 pcs tercapai).",
      remainderQty: 0,
      qtyReject: 2,
      moldMode: "STANDARD",
    },
  });

  if (kb88) {
    await prisma.scanLog.create({
      data: {
        runId: run2B.id,
        kanbanId: kb88.id,
        scannedById: operator.id,
        qty: 240,
        scannedAt: new Date(`${targetDateStr}T16:10:00.000+07:00`),
        lotNumber: "LOT-20261021-MC02-S1-T03",
      },
    });
  }

  // Reject Run 2B: 2 NG Silver pada 15:30
  if (dtSilver) {
    await prisma.runReject.create({
      data: {
        runId: run2B.id,
        defectTypeId: dtSilver.id,
        qty: 2,
        updatedAt: new Date(`${targetDateStr}T15:30:00.000+07:00`),
      },
    });
    await prisma.auditLog.create({
      data: {
        entity: "ProductionRun",
        entityId: run2B.id,
        action: "UPDATE_REJECTS",
        userId: operator.id,
        oldValue: JSON.stringify({ breakdown: [] }),
        newValue: JSON.stringify({ breakdown: [{ defectTypeId: dtSilver.id, qty: 2 }] }),
        createdAt: new Date(`${targetDateStr}T15:30:00.000+07:00`),
      },
    });
  }

  console.log("Seeding MC02 dummy data for 2026-10-21 complete!");
}

if (require.main === module) {
  seedMC02DummyOct21()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
