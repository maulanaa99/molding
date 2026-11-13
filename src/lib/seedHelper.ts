import { prisma } from "./prisma";

export async function autoSeedInitialData() {
  try {
    // 1. Initial Users
    const users = [
      { employeeId: "ADM01", name: "Admin MMS", pinHash: "1234", role: "ADMIN", department: "MANAGEMENT" },
      { employeeId: "SPV01", name: "Syarip Hidayat", pinHash: "1234", role: "SUPERVISOR", department: "MOLDING" },
      { employeeId: "PLN01", name: "Saifudin", pinHash: "1234", role: "PLANNER", department: "PPIC" },
      { employeeId: "OPR01", name: "Ahmad Dani", pinHash: "1234", role: "OPERATOR", department: "MOLDING" },
      { employeeId: "OPR02", name: "Budi Santoso", pinHash: "1234", role: "OPERATOR", department: "MOLDING" },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { employeeId: u.employeeId },
        update: {},
        create: u,
      });
    }

    // 2. Initial Machines (MC01 - MC15)
    const machineList = [
      { code: "MC01", model: "SI-100-6s", tonnage: 100 },
      { code: "MC02", model: "SI-100-6s", tonnage: 100 },
      { code: "MC03", model: "SI-280-6s", tonnage: 280 },
      { code: "MC04", model: "SI-280-6s", tonnage: 280 },
      { code: "MC05", model: "SI-450-6s", tonnage: 450 },
      { code: "MC06", model: "SI-450-6s", tonnage: 450 },
      { code: "MC07", model: "SI-450-6s", tonnage: 450 },
      { code: "MC08", model: "SI-450-6s", tonnage: 450 },
      { code: "MC09", model: "SI-850-6s", tonnage: 850 },
      { code: "MC10", model: "SI-850-6s", tonnage: 850 },
      { code: "MC11", model: "SI-850-6s", tonnage: 850 },
      { code: "MC12", model: "JSW 1800", tonnage: 1800 },
      { code: "MC13", model: "JSW 1300", tonnage: 1300 },
      { code: "MC14", model: "SI-850-6s", tonnage: 850 },
      { code: "MC15", model: "JSW 1800", tonnage: 1800 },
    ];

    for (const m of machineList) {
      await prisma.machine.upsert({
        where: { code: m.code },
        update: {},
        create: { ...m, isActive: true },
      });
    }

    // 3. Initial Stop Reasons (FO/MLD/009 Rev.08)
    const stopReasons = [
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
      { code: "Q", category: "Sebab Lambat", reason: "5S" },
      { code: "R", category: "Sebab Lambat", reason: "Meeting , Training" },
      { code: "S", category: "Sebab Lambat", reason: "Pengecekan alat" },
      { code: "T", category: "Sebab Lambat", reason: "Tidak ada trolly" },
      { code: "U", category: "Sebab Lambat", reason: "Makan" },
      { code: "V", category: "Sebab Lambat", reason: "Trial" },
      { code: "W", category: "Sebab Lambat", reason: "Sesuai Intruksi" },
      { code: "X", category: "Sebab Lambat", reason: "Listrik mati" },
      { code: "Y", category: "Sebab Lambat", reason: "Pengecekan Qualitas" },
      { code: "OK", category: "Selesai Produksi", reason: "Selesai Produksi (Target Tercapai)" },
      { code: "CHG", category: "Selesai Produksi", reason: "Selesai Produksi (Ganti Part / Job Baru)" },
    ];

    for (const sr of stopReasons) {
      const exists = await prisma.stopReason.findFirst({
        where: { code: sr.code },
      });
      if (!exists) {
        await prisma.stopReason.create({
          data: { ...sr, isActive: true },
        });
      }
    }
  } catch (err) {
    console.error("Auto-seed error:", err);
  }
}
