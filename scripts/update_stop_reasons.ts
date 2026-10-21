import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const newStopReasons = [
  { category: "Pemeriksaan", reason: "Cek sheet harian/mingguan" },
  { category: "Kerusakan", reason: "Kerusakan Auto Loader" },
  { category: "Aktivitas", reason: "Meeting" },
  { category: "Logistik", reason: "Pengangkutan" },
  { category: "Material", reason: "Material Habis" },
  { category: "Kualitas", reason: "Masalah Qualitas" },
  { category: "Kerusakan", reason: "Kerusakan Mold" },
  { category: "Kerusakan", reason: "Kerusakan Mesin" },
  { category: "Kerusakan", reason: "Kerusakan Robot" },
  { category: "Material", reason: "Ganti Material" },
  { category: "Setup", reason: "Ganti Dies/Setting Robot" },
  { category: "Kerusakan", reason: "Kerusakan Dryer" },
  { category: "Lainnya", reason: "Kondisi Lain" },
  { category: "Setup", reason: "Dies Belum diganti" },
];

async function updateStopReasons() {
  console.log("Updating StopReasons in database...");

  // Nonaktifkan alasan stop lama yang tidak ada di list baru
  const newReasonTexts = newStopReasons.map((r) => r.reason);

  await prisma.stopReason.updateMany({
    where: {
      reason: { notIn: newReasonTexts },
    },
    data: {
      isActive: false,
    },
  });

  // Tambahkan atau aktifkan yang baru
  for (const item of newStopReasons) {
    const existing = await prisma.stopReason.findFirst({
      where: { reason: item.reason },
    });

    if (existing) {
      await prisma.stopReason.update({
        where: { id: existing.id },
        data: {
          category: item.category,
          isActive: true,
        },
      });
      console.log(`Updated: ${item.reason} [${item.category}]`);
    } else {
      await prisma.stopReason.create({
        data: {
          category: item.category,
          reason: item.reason,
          isActive: true,
        },
      });
      console.log(`Created: ${item.reason} [${item.category}]`);
    }
  }

  const activeCount = await prisma.stopReason.count({ where: { isActive: true } });
  console.log(`Total active stop reasons: ${activeCount}`);
}

updateStopReasons()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
