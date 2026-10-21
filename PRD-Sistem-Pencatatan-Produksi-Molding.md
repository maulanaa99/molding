# PRD: Sistem Pencatatan Produksi Molding

| | |
|---|---|
| **Versi** | 0.1 (Draft) |
| **Tanggal** | 13 Oktober 2026 |
| **Stack** | Next.js (App Router), Prisma, PostgreSQL, berjalan di local server (LAN) |
| **Status** | Untuk review |

---

## 1. Latar Belakang

Pabrik memiliki 15 mesin injection molding (termasuk Toyo SI-500-6S) dengan tonase berbeda-beda. Pencatatan waktu jalan, waktu stop, alasan stop, dan hasil produksi saat ini belum terpusat. Sistem ini dibuat untuk mencatat data tersebut **secara manual oleh operator** (tanpa koneksi langsung ke mesin) dan mengolahnya menjadi laporan produksi, downtime, dan efisiensi.

## 2. Tujuan

1. Mencatat waktu **START** dan **STOP** setiap mesin dengan satu klik (timestamp otomatis dari server).
2. Mencatat **alasan stop** secara terstandar.
3. Mencatat **hasil produksi** dengan cepat melalui **scan kanban trolly** (kamera), tanpa mengetik.
4. Menghitung **target, efisiensi, utilisasi, dan downtime** berdasarkan cycle time standar.
5. Berjalan sepenuhnya di **local server** (tanpa internet).

### Di Luar Cakupan (Versi 1)
- Koneksi langsung ke PLC/controller mesin.
- Perencanaan produksi (scheduling) dan manajemen order.
- Integrasi ERP.
- Pencatatan inspeksi kualitas detail.

## 3. Pengguna

| Peran | Kebutuhan |
|---|---|
| **Operator** | Pilih mesin dan part, tekan START/STOP, pilih alasan stop, scan kanban |
| **Supervisor / Leader** | Pantau status 15 mesin real-time, koreksi data, lihat laporan |
| **Admin** | Kelola master data (mesin, part, alasan stop, user) |
| **Manajemen** | Lihat dashboard dan laporan ringkas |

## 4. Alur Utama

```
Pilih Mesin → Pilih Part → START → (mesin berjalan, scan kanban tiap trolly full)
           → STOP → Pilih Alasan Stop → (input sisa pcs jika ada) → Mesin DOWN/IDLE
           → START berikutnya (menutup downtime)
```

### 4.1 START
1. Operator memilih mesin (hanya mesin aktif).
2. Operator memilih part (daftar terfilter sesuai part yang diizinkan di mesin tsb.).
3. Tekan **START**. Server menyimpan `startTime = now()`.
4. Status mesin menjadi **RUNNING**.

Aturan: satu mesin hanya boleh punya **satu run aktif**. Jika sudah ada run aktif, tombol START dinonaktifkan.

### 4.2 Scan Kanban (Tambah Hasil Produksi)
1. Saat run aktif, operator menekan **Scan Kanban**, kamera terbuka.
2. Operator mengarahkan kamera ke QR/barcode pada kanban trolly.
3. Sistem membaca kode kanban lalu mencari part dan **standar qty per trolly**.
4. Sistem menampilkan konfirmasi singkat (nama part, qty yang akan ditambahkan), lalu menambahkan `qty` ke run berjalan.
5. Kamera menutup (atau tetap terbuka untuk scan berikutnya, opsional).

Aturan validasi:
- **Part tidak sesuai**: jika part pada kanban berbeda dengan part pada run aktif, tampilkan peringatan dan jangan simpan otomatis (operator harus batal atau konfirmasi, sesuai keputusan di bagian 11).
- **Anti-duplikat**: scan kode yang sama dalam jeda singkat (misal 10 detik) ditolak. Bila kanban bersifat unik per trolly, kode yang sudah pernah dipakai ditolak.
- Setiap scan dicatat terpisah (`ScanLog`) dan bisa **dibatalkan (void)** oleh supervisor atau operator dengan alasan.

### 4.3 STOP
1. Operator menekan **STOP**. Server menyimpan `stopTime = now()`.
2. Sistem memunculkan **alasan stop** (wajib), dikelompokkan per kategori, misal:
   - Material: ketersediaan material kurang
   - Material Handling: trolly tidak ada
   - Dokumen: checksheet tidak ada
   - Lainnya sesuai master yang Anda siapkan
3. Operator dapat mengisi **sisa pcs** (trolly belum penuh) dan **reject**.
4. Run ditutup. Mesin berstatus **DOWN/IDLE**, downtime mulai dihitung sampai START berikutnya.

## 5. Kebutuhan Fungsional

### 5.1 Master Data (Admin)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | CRUD **Mesin**: kode (IMM-01…IMM-15), model, tonase, status aktif | Must |
| FR-02 | CRUD **Part**: part no, nama, cycle time standar (detik), cavity, **qty standar per trolly** | Must |
| FR-03 | **Relasi mesin–part** (part yang boleh diproduksi per mesin), opsional override cycle time per mesin | Must |
| FR-04 | CRUD **Alasan Stop** dengan kategori | Must |
| FR-05 | CRUD **Kanban**: kode kanban, part, qty per trolly (default dari part), status aktif | Must |
| FR-06 | Generate dan **cetak label QR kanban** | Should |
| FR-07 | CRUD **User** dan peran | Must |
| FR-08 | CRUD **Shift** (jam mulai/selesai) | Should |
| FR-09 | Import master data dari Excel/CSV | Should |

### 5.2 Operasional (Operator)
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-10 | Layar pilih mesin dengan status warna (RUNNING / DOWN / IDLE) | Must |
| FR-11 | Pilih part terfilter berdasarkan mesin | Must |
| FR-12 | Tombol START (timestamp server) | Must |
| FR-13 | Tombol STOP + alasan stop wajib | Must |
| FR-14 | **Scan kanban via kamera** menambah qty otomatis | Must |
| FR-15 | Counter qty run berjalan tampil real-time (jumlah trolly dan total pcs) | Must |
| FR-16 | Input sisa pcs dan reject saat STOP | Must |
| FR-17 | Timer durasi run berjalan | Should |
| FR-18 | Input manual qty (fallback bila kamera/kanban rusak), butuh alasan | Should |
| FR-19 | Auto-lanjut: run baru dengan part sama setelah stop tanpa pilih ulang | Could |

### 5.3 Supervisor
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-20 | Dashboard status 15 mesin (real-time, auto refresh) | Must |
| FR-21 | Koreksi waktu START/STOP, alasan stop, qty (dengan **audit log**) | Must |
| FR-22 | Void scan kanban | Must |
| FR-23 | Tutup paksa run yang lupa di-STOP | Must |

### 5.4 Laporan dan Perhitungan
| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-24 | Laporan produksi per mesin / part / shift / tanggal | Must |
| FR-25 | Laporan downtime per alasan dan **Pareto** | Must |
| FR-26 | Efisiensi dan utilisasi per mesin | Must |
| FR-27 | Export Excel/CSV | Must |
| FR-28 | Rekap harian otomatis | Could |

### 5.5 Rumus

```
Durasi run (detik)  = stopTime − startTime
Target qty          = (durasi run ÷ cycle time) × cavity
Qty aktual (OK)     = (jumlah scan trolly × qty standar trolly) + sisa pcs
Efisiensi           = qty aktual ÷ target qty × 100%
Reject rate         = qty reject ÷ (qty OK + qty reject) × 100%
Downtime            = startTime run berikutnya − stopTime run sebelumnya (per mesin)
Utilisasi mesin     = total durasi run ÷ waktu tersedia × 100%
```

> **Catatan:** Qty dari scan kanban adalah qty *standar*. Selisih trolly yang tidak penuh ditangani lewat input "sisa pcs".

## 6. Model Data (Prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  OPERATOR
  SUPERVISOR
  ADMIN
}

enum RunStatus {
  RUNNING
  STOPPED
}

model User {
  id        Int      @id @default(autoincrement())
  name      String
  employeeId String  @unique
  pinHash   String?
  role      Role     @default(OPERATOR)
  isActive  Boolean  @default(true)
  runs      ProductionRun[]
  scans     ScanLog[]
}

model Machine {
  id        Int      @id @default(autoincrement())
  code      String   @unique        // IMM-01
  model     String?                 // Toyo SI-500-6S
  tonnage   Int
  isActive  Boolean  @default(true)
  parts     MachinePart[]
  runs      ProductionRun[]
}

model Part {
  id            Int      @id @default(autoincrement())
  partNo        String   @unique
  name          String
  cycleTimeSec  Float
  cavity        Int      @default(1)
  qtyPerTrolly  Int                 // standar isi 1 trolly penuh
  isActive      Boolean  @default(true)
  machines      MachinePart[]
  kanbans       Kanban[]
  runs          ProductionRun[]
}

model MachinePart {
  machineId     Int
  partId        Int
  cycleTimeSec  Float?              // override CT per mesin (opsional)
  machine       Machine @relation(fields: [machineId], references: [id])
  part          Part    @relation(fields: [partId], references: [id])
  @@id([machineId, partId])
}

model Kanban {
  id           Int      @id @default(autoincrement())
  code         String   @unique     // isi QR/barcode
  partId       Int
  qtyPerTrolly Int?                 // override; default dari Part
  isActive     Boolean  @default(true)
  part         Part     @relation(fields: [partId], references: [id])
  scans        ScanLog[]
}

model StopReason {
  id        Int      @id @default(autoincrement())
  category  String
  reason    String
  isActive  Boolean  @default(true)
  runs      ProductionRun[]
}

model ProductionRun {
  id           Int        @id @default(autoincrement())
  machineId    Int
  partId       Int
  operatorId   Int
  shift        String?
  status       RunStatus  @default(RUNNING)
  startTime    DateTime   @default(now())
  stopTime     DateTime?
  stopReasonId Int?
  remainderQty Int        @default(0)   // sisa pcs (trolly belum penuh)
  qtyReject    Int        @default(0)
  notes        String?
  machine      Machine    @relation(fields: [machineId], references: [id])
  part         Part       @relation(fields: [partId], references: [id])
  operator     User       @relation(fields: [operatorId], references: [id])
  stopReason   StopReason? @relation(fields: [stopReasonId], references: [id])
  scans        ScanLog[]

  @@index([machineId, startTime])
}

model ScanLog {
  id         Int      @id @default(autoincrement())
  runId      Int
  kanbanId   Int
  qty        Int                       // qty yang ditambahkan saat scan
  scannedAt  DateTime @default(now())
  scannedById Int
  isVoid     Boolean  @default(false)
  voidReason String?
  run        ProductionRun @relation(fields: [runId], references: [id])
  kanban     Kanban        @relation(fields: [kanbanId], references: [id])
  scannedBy  User          @relation(fields: [scannedById], references: [id])
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  entity    String
  entityId  Int
  action    String
  oldValue  Json?
  newValue  Json?
  userId    Int
  createdAt DateTime @default(now())
}
```

**Catatan implementasi data:**
- Satu run aktif per mesin dijaga dengan **partial unique index** di PostgreSQL: `CREATE UNIQUE INDEX one_running_per_machine ON "ProductionRun"("machineId") WHERE status = 'RUNNING';` (ditambahkan lewat migrasi SQL manual karena Prisma belum mendukung partial index secara native).
- `ScanLog.qty` menyimpan qty saat scan (snapshot), jadi perubahan standar trolly di kemudian hari tidak mengubah data historis.
- Downtime **diturunkan** dari selisih `stopTime` run sebelumnya dan `startTime` run berikutnya pada mesin yang sama, alasannya diambil dari `stopReason` run sebelumnya.

## 7. Kebutuhan Non-Fungsional

| Area | Kebutuhan |
|---|---|
| **Deployment** | Berjalan di local server, diakses lewat LAN (tablet/HP/PC). Tanpa ketergantungan internet |
| **HTTPS (penting)** | Akses kamera di browser (`getUserMedia`) hanya berjalan di *secure context*. Akses via `http://192.168.x.x` akan **memblokir kamera**. Gunakan HTTPS dengan sertifikat lokal (mkcert atau CA internal) lewat reverse proxy seperti Caddy/Nginx. Domain lokal disarankan, misal `molding.local` |
| **Waktu** | Semua timestamp dari **server**, bukan perangkat klien. Zona waktu Asia/Jakarta (WIB). Simpan UTC di DB |
| **Responsif** | Tombol besar, mudah ditekan di tablet/HP (touch-first) |
| **Performa** | Respon aksi START/STOP/scan < 1 detik di LAN |
| **Ketersediaan data** | Backup database otomatis harian, simpan di media terpisah |
| **Keamanan** | Login dengan ID karyawan + PIN, hak akses per peran, audit log untuk koreksi data |
| **Real-time** | Dashboard auto refresh (polling 5–10 detik atau SSE) |
| **Browser** | Chrome/Edge versi terbaru di Android/Windows, Safari di iOS |

## 8. Rancangan Teknis

### Arsitektur
```
[Tablet/HP/PC] ──HTTPS (LAN)──► [Reverse proxy: Caddy/Nginx]
                                        │
                                  [Next.js app]
                                  (Server Actions / Route Handlers)
                                        │
                                   [Prisma ORM]
                                        │
                                  [PostgreSQL]
```

### Komponen
- **Framework:** Next.js (App Router), TypeScript.
- **ORM/DB:** Prisma + PostgreSQL (disarankan; SQLite hanya jika benar-benar satu server kecil tanpa concurrency tinggi).
- **UI:** Tailwind CSS + komponen (misal shadcn/ui).
- **Scan kamera:** library `@zxing/browser` atau `html5-qrcode` (mendukung QR dan barcode 1D/2D).
- **Auth:** Auth.js (credentials: ID karyawan + PIN) atau sesi sederhana berbasis cookie.
- **Validasi:** Zod untuk semua input server.
- **Grafik:** Recharts untuk dashboard.
- **Proses:** jalankan dengan PM2 atau Docker Compose agar otomatis hidup kembali setelah restart.

### Endpoint / Server Action Utama
| Aksi | Fungsi |
|---|---|
| `startRun(machineId, partId)` | Buat run baru, validasi tidak ada run aktif |
| `stopRun(runId, stopReasonId, remainderQty, qtyReject)` | Tutup run, simpan alasan |
| `scanKanban(runId, code)` | Validasi kanban, anti-duplikat, tambah ScanLog |
| `voidScan(scanId, reason)` | Batalkan scan (dengan audit) |
| `correctRun(runId, patch)` | Koreksi supervisor (dengan audit) |
| `getMachineStatuses()` | Data dashboard |
| `getReports(filters)` | Data laporan |

## 9. Rancangan Layar

1. **Login**: ID karyawan + PIN.
2. **Beranda Operator**: grid 15 mesin dengan status berwarna (hijau RUNNING, merah DOWN, abu IDLE).
3. **Detail Mesin**:
   - Belum jalan: pilih part, tombol **START** besar.
   - Sedang jalan: nama part, timer, jumlah trolly dan total pcs, tombol **SCAN KANBAN**, tombol **STOP**.
4. **Dialog Scan**: preview kamera, hasil scan (part dan qty), tombol konfirmasi/batal.
5. **Dialog Stop**: pilihan alasan (per kategori), sisa pcs, reject.
6. **Dashboard Supervisor**: status semua mesin, produksi hari ini, efisiensi, top downtime.
7. **Laporan**: filter tanggal/mesin/part/shift, tabel dan grafik, export.
8. **Admin Master Data**: mesin, part, kanban (cetak QR), alasan stop, user, shift.

## 10. Metrik Keberhasilan

- 100% start/stop tercatat untuk 15 mesin pada shift berjalan.
- Waktu input satu siklus (START sampai scan) < 15 detik per aksi.
- Selisih qty sistem vs hitung fisik < 2%.
- Laporan downtime Pareto tersedia tanpa rekap manual.

## 11. Pertanyaan Terbuka (Perlu Keputusan)

1. **Kanban unik atau per part?** Apakah setiap kartu kanban punya kode unik per trolly, atau satu kode per part yang dipakai berulang? Ini menentukan logika anti-duplikat (jika per part, anti-duplikat hanya berbasis jeda waktu).
2. **Format kode kanban:** QR atau barcode? Apakah sudah ada isi/format kode yang dipakai sekarang?
3. **Part berbeda saat scan:** blokir total, atau boleh dengan konfirmasi (misal saat trolly sisa dari part sebelumnya)?
4. **Trolly tidak penuh saat STOP:** cukup input "sisa pcs" manual, atau perlu kanban khusus untuk trolly parsial?
5. **Perangkat:** satu tablet per mesin, tablet bersama, atau HP operator? (berpengaruh pada login dan desain layar)
6. **Login:** wajib login per operator, atau cukup pilih nama dari daftar?
7. **Shift:** berapa shift dan jamnya? Run yang melewati pergantian shift dipecah atau dibiarkan?
8. **Ganti part (changeover):** dicatat sebagai alasan stop khusus, atau perlu event tersendiri dengan perhitungan waktu setup?
9. **Cycle time:** sama untuk semua mesin, atau berbeda per kombinasi mesin–part?
10. **Reject:** input manual saat stop saja, atau perlu alasan reject?
11. **Lupa STOP:** batas waktu otomatis (misal ditandai peringatan setelah N jam) atau hanya ditutup manual oleh supervisor?

## 12. Tahapan Pengerjaan

| Fase | Isi | Estimasi |
|---|---|---|
| **1. Fondasi** | Setup Next.js + Prisma + PostgreSQL, skema, seed data, auth, HTTPS lokal | 1 minggu |
| **2. Master data** | CRUD mesin, part, relasi, alasan stop, kanban, user | 1 minggu |
| **3. Operasional** | Pilih mesin/part, START/STOP, alasan stop, timer | 1 minggu |
| **4. Scan kanban** | Kamera, validasi, anti-duplikat, void, cetak label QR | 1 minggu |
| **5. Dashboard dan laporan** | Status real-time, efisiensi, Pareto, export | 1–2 minggu |
| **6. Uji dan rollout** | UAT di lantai produksi (mulai 2–3 mesin), perbaikan, backup, pelatihan | 1–2 minggu |

*Estimasi kasar untuk satu developer; dapat berubah sesuai keputusan di bagian 11.*

## 13. Risiko

| Risiko | Mitigasi |
|---|---|
| Kamera diblokir karena tanpa HTTPS | Siapkan HTTPS lokal sejak Fase 1 |
| Operator lupa START/STOP | Peringatan run berjalan terlalu lama, fitur koreksi supervisor |
| Salah scan / scan ganda | Anti-duplikat, konfirmasi, fitur void |
| Kamera sulit baca kanban (cahaya/label rusak) | Ukuran QR cukup besar, laminasi, fallback input manual |
| Server lokal mati / data hilang | Backup harian otomatis, UPS untuk server |
| Perubahan standar trolly | Qty disimpan sebagai snapshot di ScanLog |
