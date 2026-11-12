import { prisma } from "../src/lib/prisma";

export async function seedMC01DummyOct21() {
  console.log("=== Seeding Data Produksi Dummy MC01 (21 Oktober 2026) ===");

  const targetDateStr = "2026-10-21";
  const startOfDay = new Date(`${targetDateStr}T00:00:00.000+07:00`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999+07:00`);

  // 1. Identifikasi Mesin MC01
  const mc01 = await prisma.machine.findUnique({
    where: { code: "MC01" },
  });
  if (!mc01) {
    throw new Error("Mesin MC01 tidak ditemukan.");
  }

  // 2. Identifikasi Operator (Dini Damayanti / OPR01)
  const operator = await prisma.user.findFirst({
    where: { employeeId: "OPR01" },
  });
  if (!operator) {
    throw new Error("Operator OPR01 tidak ditemukan.");
  }

  // 3. Update Material Part jika belum ada
  await prisma.part.update({
    where: { id: 98 },
    data: { material: "ABS 3001M" },
  });
  await prisma.part.update({
    where: { id: 97 },
    data: { material: "ABS 3001M" },
  });
  await prisma.part.update({
    where: { id: 87 },
    data: { material: "ABS 3001M" },
  });

  // 4. Bersihkan data dummy lama pada 2026-10-21 di MC01 agar idempoten
  const oldRuns = await prisma.productionRun.findMany({
    where: {
      machineId: mc01.id,
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
    await prisma.productionRun.deleteMany({
      where: { id: { in: oldRunIds } },
    });
  }

  await prisma.productionPlan.deleteMany({
    where: {
      machineId: mc01.id,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
    },
  });

  // 5. Buat Rencana Produksi (ProductionPlan)
  const plan1 = await prisma.productionPlan.create({
    data: {
      machineId: mc01.id,
      partId: 98, // 5J45 26MY RR EMBLEM 3DIA
      operatorId: operator.id,
      targetQty: 420,
      priority: 1,
      status: "COMPLETED",
      moldMode: "STANDARD",
      scheduledDate: new Date(`${targetDateStr}T07:30:00.000+07:00`),
      notes: "Part 1: 5J45 Emblem RR 3 DIA (Target 420 pcs, 1,7 jam)",
    },
  });

  const plan2 = await prisma.productionPlan.create({
    data: {
      machineId: mc01.id,
      partId: 97, // 4L45W 23MY X pander Mark
      operatorId: operator.id,
      targetQty: 648,
      priority: 2,
      status: "COMPLETED",
      moldMode: "STANDARD",
      scheduledDate: new Date(`${targetDateStr}T07:30:00.000+07:00`),
      notes: "Part 2: 4L45W 23MY Xpander Emblem (Target 648 pcs, 2,7 jam)",
    },
  });

  const plan3 = await prisma.productionPlan.create({
    data: {
      machineId: mc01.id,
      partId: 87, // 4L45W 3 DIAMOND TAIL GATE
      operatorId: operator.id,
      targetQty: 700,
      priority: 3,
      status: "COMPLETED",
      moldMode: "STANDARD",
      scheduledDate: new Date(`${targetDateStr}T07:30:00.000+07:00`),
      notes: "Part 3: 4L45W 3 Diamond Tail Gate (Target 700 pcs, 2,5 jam)",
    },
  });

  // 6. Stop Reasons
  const srW = await prisma.stopReason.findFirst({ where: { code: "W" } });
  const srK = await prisma.stopReason.findFirst({ where: { code: "K" } });
  const srM = await prisma.stopReason.findFirst({ where: { code: "M" } });
  const srOK = await prisma.stopReason.findFirst({ where: { code: "OK" } });

  // 7. Kanbans
  const kb98 = await prisma.kanban.findFirst({ where: { partId: 98 } });
  const kb97 = await prisma.kanban.findFirst({ where: { partId: 97 } });
  const kb87 = await prisma.kanban.findFirst({ where: { partId: 87 } });

  // 8. Run 1: 5J45 Emblem RR 3 DIA
  // Timeline: 07:30 - 07:45 setting mesin kode W, 07:45 - 09:30 run (1,75 jam), 09:30 - 09:45 setting kode W
  const run1 = await prisma.productionRun.create({
    data: {
      machineId: mc01.id,
      partId: 98,
      operatorId: operator.id,
      planId: plan1.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T07:45:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T09:30:00.000+07:00`),
      stopReasonId: srW?.id,
      notes: "07:30 - 07:45 Setting mesin (W). Selesai target 420 pcs. 09:30 - 09:45 Setting mesin kode W.",
      remainderQty: 0,
      moldMode: "STANDARD",
    },
  });

  if (kb98) {
    await prisma.scanLog.create({
      data: {
        runId: run1.id,
        kanbanId: kb98.id,
        scannedById: operator.id,
        qty: 420,
        scannedAt: new Date(`${targetDateStr}T09:25:00.000+07:00`),
        lotNumber: "LOT-20261021-S1-T01",
      },
    });
  }

  // 9. Run 2: 4L45W 23MY Xpander Emblem
  // Timeline: 09:45 - 12:30 run (2,75 jam), 12:30 - 12:45 stop mesin, 12:45 - 13:00 ganti dies (K), 13:00 - 13:30 setting mesin (W)
  const run2 = await prisma.productionRun.create({
    data: {
      machineId: mc01.id,
      partId: 97,
      operatorId: operator.id,
      planId: plan2.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T09:45:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T12:30:00.000+07:00`),
      stopReasonId: srK?.id,
      notes: "Selesai target 648 pcs. 12:30 - 12:45 Stop mesin. 12:45 - 13:00 Ganti dies (K). 13:00 - 13:30 Setting mesin (W).",
      remainderQty: 0,
      moldMode: "STANDARD",
    },
  });

  if (kb97) {
    await prisma.scanLog.create({
      data: {
        runId: run2.id,
        kanbanId: kb97.id,
        scannedById: operator.id,
        qty: 648,
        scannedAt: new Date(`${targetDateStr}T12:20:00.000+07:00`),
        lotNumber: "LOT-20261021-S1-T02",
      },
    });
  }

  // 10. Run 3A: 4L45W 3 Diamond Tail Gate (Sesi 1)
  // Timeline: 13:30 - 15:00 run (1,5 jam), 15:00 - 15:30 stop mesin
  const run3A = await prisma.productionRun.create({
    data: {
      machineId: mc01.id,
      partId: 87,
      operatorId: operator.id,
      planId: plan3.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T13:30:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T15:00:00.000+07:00`),
      stopReasonId: srM?.id,
      notes: "Sesi 1 4L45W 3 Diamond Tail Gate (440 pcs). 15:00 - 15:30 Stop mesin.",
      remainderQty: 0,
      moldMode: "STANDARD",
    },
  });

  if (kb87) {
    await prisma.scanLog.create({
      data: {
        runId: run3A.id,
        kanbanId: kb87.id,
        scannedById: operator.id,
        qty: 440,
        scannedAt: new Date(`${targetDateStr}T14:55:00.000+07:00`),
        lotNumber: "LOT-20261021-S1-T03",
      },
    });
  }

  // 11. Run 3B: 4L45W 3 Diamond Tail Gate (Sesi 2)
  // Timeline: 15:30 - 16:25 run (55 menit), 16:25 - 16:30 stop mesin (produksi selesai)
  await prisma.productionRun.create({
    data: {
      machineId: mc01.id,
      partId: 87,
      operatorId: operator.id,
      planId: plan3.id,
      shift: "Shift 1",
      status: "STOPPED",
      startTime: new Date(`${targetDateStr}T15:30:00.000+07:00`),
      stopTime: new Date(`${targetDateStr}T16:25:00.000+07:00`),
      stopReasonId: srOK?.id,
      notes: "Sesi 2 Tail Gate (260 pcs, total 700 pcs). 16:25 - 16:30 Stop mesin (Produksi Selesai, Target 700 pcs tercapai).",
      remainderQty: 260,
      moldMode: "STANDARD",
    },
  });

  console.log("Seeding MC01 dummy data for 2026-10-21 complete!");
}

if (require.main === module) {
  seedMC01DummyOct21()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
