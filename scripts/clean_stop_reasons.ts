import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const allowedStopReasons = [
  "Cek sheet harian/mingguan",
  "Kerusakan Auto Loader",
  "Meeting",
  "Pengangkutan",
  "Material Habis",
  "Masalah Qualitas",
  "Kerusakan Mold",
  "Kerusakan Mesin",
  "Kerusakan Robot",
  "Ganti Material",
  "Ganti Dies/Setting Robot",
  "Kerusakan Dryer",
  "Kondisi Lain",
  "Dies Belum diganti",
];

async function hardDeleteOldStopReasons() {
  console.log("Checking stop reasons outside the 14 allowed items...");

  // Cek apakah ada ProductionRun yang berelasi dengan stop reason selain 14 ini
  const outsideReasons = await prisma.stopReason.findMany({
    where: {
      reason: { notIn: allowedStopReasons },
    },
    include: {
      runs: true,
    },
  });

  console.log(`Found ${outsideReasons.length} stop reasons outside the 14 allowed list.`);

  for (const sr of outsideReasons) {
    if (sr.runs.length > 0) {
      console.log(`StopReason "${sr.reason}" has ${sr.runs.length} historical run records. Setting run.stopReasonId to null or alternative before delete...`);
      // Unlink from ProductionRun to prevent foreign key constraint violation
      await prisma.productionRun.updateMany({
        where: { stopReasonId: sr.id },
        data: { stopReasonId: null },
      });
    }

    await prisma.stopReason.delete({
      where: { id: sr.id },
    });
    console.log(`Permanently deleted: "${sr.reason}"`);
  }

  // Verifikasi final total StopReason di database
  const remaining = await prisma.stopReason.findMany({
    orderBy: { id: "asc" },
  });

  console.log(`\nRemaining Stop Reasons in DB (${remaining.length}):`);
  remaining.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.category}] ${r.reason} (ID: ${r.id})`);
  });
}

hardDeleteOldStopReasons()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
