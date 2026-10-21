import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Menghapus data mesin IMM-01 sampai IMM-15...");

  // Cari mesin dengan kode IMM-01 sampai IMM-15
  const sampleCodes = Array.from({ length: 15 }, (_, i) => `IMM-${(i + 1).toString().padStart(2, "0")}`);

  const machines = await prisma.machine.findMany({
    where: {
      code: { in: sampleCodes },
    },
    select: { id: true, code: true },
  });

  if (machines.length === 0) {
    console.log("Tidak ada mesin IMM-01 sampai IMM-15 yang ditemukan di database.");
    return;
  }

  const machineIds = machines.map((m) => m.id);

  // 1. Hapus ScanLog terkait runs dari mesin-mesin ini jika ada
  const runs = await prisma.productionRun.findMany({
    where: { machineId: { in: machineIds } },
    select: { id: true },
  });
  const runIds = runs.map((r) => r.id);

  if (runIds.length > 0) {
    await prisma.scanLog.deleteMany({
      where: { runId: { in: runIds } },
    });
    // 2. Hapus ProductionRun
    await prisma.productionRun.deleteMany({
      where: { id: { in: runIds } },
    });
  }

  // 3. Hapus relasi MachinePart
  await prisma.machinePart.deleteMany({
    where: { machineId: { in: machineIds } },
  });

  // 4. Hapus Mesin
  const deleted = await prisma.machine.deleteMany({
    where: { id: { in: machineIds } },
  });

  console.log(`Berhasil menghapus ${deleted.count} mesin (${sampleCodes.join(", ")}).`);
}

main()
  .catch((e) => {
    console.error("Gagal menghapus mesin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
